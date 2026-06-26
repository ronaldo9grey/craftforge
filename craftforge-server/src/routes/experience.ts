// =============================================================
// 专家经验蒸馏 API (Experience Distillation)
// 教师提交专家口述/操作记录 → LLM蒸馏为结构化经验 → 存入经验库
// 学生演练时注入AI师傅上下文，讲评时对比"专家做法 vs 学生做法"
// =============================================================

import { Router, Request, Response } from 'express';
import { db, uuid } from '../db';
import { requireAuth, requireRole } from '../middleware/jwtAuth';

export const experienceRouter = Router();

// =============================================================
// 辅助：安全解析 JSON
// =============================================================
function safeParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

// =============================================================
// LLM 蒸馏：调用 DeepSeek 将专家口述转化为结构化经验
// =============================================================
async function distillWithLLM(
  transcript: string,
  sceneId: string,
  faultName: string,
  annotations?: string,
): Promise<any> {
  const apiKey = process.env.DEEPSEEK_API_KEY || '';
  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY 未配置');
  }

  const systemPrompt = `你是一位工业知识工程师，擅长从老专家的口述和操作记录中提取结构化经验。
请从以下专家处置"${faultName}"（场景：${sceneId}）的口述记录中，提取结构化经验规则。

要求：
1. key_decisions：提取专家的关键操作决策，按时间顺序排列，标注时机和推理过程
2. param_thresholds：提取专家提到的参数临界值和对应操作
3. rhythm：总结专家的操作节奏特征
4. intuition_rules：提取专家的"经验直觉"（即专家说"感觉不对"背后的依据）
5. common_mistakes：提取专家提到的新手常见错误及正确替代方案
6. master_insight：用一句话总结核心经验

输出严格JSON格式（不要markdown代码块），结构如下：
{
  "key_decisions": [{"step": 1, "timing": "...", "action": "...", "reasoning": "...", "priority": "critical|recommended"}],
  "param_thresholds": [{"param": "...", "danger_zone": "...", "expert_action": "...", "normal_range": "..."}],
  "rhythm": "...",
  "intuition_rules": ["..."],
  "common_mistakes": [{"mistake": "...", "why_wrong": "...", "correct_alternative": "..."}],
  "master_insight": "..."
}`;

  const userContent = annotations
    ? `专家口述记录：\n${transcript}\n\n操作标注（JSON）：\n${annotations}`
    : `专家口述记录：\n${transcript}`;

  const endpoint = baseUrl.replace(/\/+$/, '').endsWith('/chat/completions')
    ? baseUrl.replace(/\/+$/, '')
    : `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      stream: false,
      response_format: { type: 'json_object' },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`LLM请求失败 (HTTP ${resp.status}): ${text.slice(0, 200)}`);
  }

  const data = await resp.json() as any;
  const content = data?.choices?.[0]?.message?.content || '{}';
  return JSON.parse(content);
}

// =============================================================
// POST /api/experience/collect
// 教师提交专家口述，触发LLM蒸馏，存入经验库
// =============================================================
experienceRouter.post('/collect', requireAuth, requireRole('teacher', 'admin'), async (req: Request, res: Response) => {
  try {
    const {
      scene_id,
      fault_id,
      fault_name,
      title,
      raw_transcript,
      raw_annotations,
      expert_name,
      expert_title,
      source_type,
    } = req.body;

    if (!scene_id || !fault_name || !title || !raw_transcript) {
      res.status(400).json({ error: '缺少必填字段: scene_id, fault_name, title, raw_transcript' });
      return;
    }

    const id = uuid();
    const now = Date.now();

    // 先插入记录（distilled暂为null）
    db.prepare(
      `INSERT INTO experience_rules
        (id, scene_id, fault_id, fault_name, title, raw_transcript, raw_annotations,
         expert_name, expert_title, source_type, status, distilled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NULL, ?, ?)`
    ).run(
      id, scene_id, fault_id ?? null, fault_name, title,
      raw_transcript, raw_annotations ?? null,
      expert_name ?? null, expert_title ?? null, source_type ?? 'think_aloud',
      now, now
    );

    // 调用LLM蒸馏
    let distilled = null;
    let distillError = null;
    try {
      distilled = await distillWithLLM(raw_transcript, scene_id, fault_name, raw_annotations);
      db.prepare('UPDATE experience_rules SET distilled = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(distilled), Date.now(), id);
    } catch (err: any) {
      distillError = err.message;
    }

    res.json({
      id,
      distilled,
      distill_error: distillError,
      message: distillError ? '经验已保存，但LLM蒸馏失败：' + distillError : '经验蒸馏完成',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error', detail: err.message });
  }
});

// =============================================================
// POST /api/experience/:id/redistill
// 重新蒸馏（教师修正口述后重试）
// =============================================================
experienceRouter.post('/:id/redistill', requireAuth, requireRole('teacher', 'admin'), async (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT * FROM experience_rules WHERE id = ?').get(req.params.id) as any;
    if (!row) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const distilled = await distillWithLLM(row.raw_transcript, row.scene_id, row.fault_name, row.raw_annotations);
    db.prepare('UPDATE experience_rules SET distilled = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(distilled), Date.now(), req.params.id);

    res.json({ id: req.params.id, distilled, message: '重新蒸馏完成' });
  } catch (err: any) {
    res.status(500).json({ error: '蒸馏失败', detail: err.message });
  }
});

// =============================================================
// GET /api/experience
// 查询经验列表（支持 scene_id / fault_id 筛选）
// =============================================================
experienceRouter.get('/', requireAuth, (req: Request, res: Response) => {
  const { scene_id, fault_id, status } = req.query;
  let sql = 'SELECT id, scene_id, fault_id, fault_name, title, expert_name, expert_title, source_type, status, created_at, updated_at FROM experience_rules WHERE 1=1';
  const params: (string | number)[] = [];

  if (status) { sql += ' AND status = ?'; params.push(status as string); }
  else { sql += " AND status = 'active'"; }
  if (scene_id) { sql += ' AND scene_id = ?'; params.push(scene_id as string); }
  if (fault_id) { sql += ' AND fault_id = ?'; params.push(fault_id as string); }

  sql += ' ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json({ experiences: rows });
});

// =============================================================
// GET /api/experience/:id
// 单条经验详情（含蒸馏结果）
// =============================================================
experienceRouter.get('/:id', requireAuth, (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM experience_rules WHERE id = ?').get(req.params.id) as any;
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({
    ...row,
    distilled: safeParse(row.distilled, null),
    raw_annotations: safeParse(row.raw_annotations, null),
  });
});

// =============================================================
// PUT /api/experience/:id
// 更新经验（教师修正蒸馏结果或元信息）
// =============================================================
experienceRouter.put('/:id', requireAuth, requireRole('teacher', 'admin'), (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM experience_rules WHERE id = ?').get(req.params.id) as any;
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const {
    title, fault_name, expert_name, expert_title,
    distilled, status, raw_transcript,
  } = req.body;

  const updates: string[] = [];
  const params: any[] = [];

  if (title !== undefined) { updates.push('title = ?'); params.push(title); }
  if (fault_name !== undefined) { updates.push('fault_name = ?'); params.push(fault_name); }
  if (expert_name !== undefined) { updates.push('expert_name = ?'); params.push(expert_name); }
  if (expert_title !== undefined) { updates.push('expert_title = ?'); params.push(expert_title); }
  if (raw_transcript !== undefined) { updates.push('raw_transcript = ?'); params.push(raw_transcript); }
  if (distilled !== undefined) { updates.push('distilled = ?'); params.push(typeof distilled === 'string' ? distilled : JSON.stringify(distilled)); }
  if (status !== undefined) { updates.push('status = ?'); params.push(status); }

  if (updates.length === 0) {
    res.json({ message: '无更新', id: req.params.id });
    return;
  }

  updates.push('updated_at = ?');
  params.push(Date.now());
  params.push(req.params.id);

  db.prepare(`UPDATE experience_rules SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json({ message: '更新成功', id: req.params.id });
});

// =============================================================
// DELETE /api/experience/:id
// 归档经验（软删除）
// =============================================================
experienceRouter.delete('/:id', requireAuth, requireRole('teacher', 'admin'), (req: Request, res: Response) => {
  const result = db.prepare("UPDATE experience_rules SET status = 'archived', updated_at = ? WHERE id = ?")
    .run(Date.now(), req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({ message: '已归档', id: req.params.id });
});

// =============================================================
// GET /api/experience/scene/:sceneId
// 获取某场景所有active经验（学生端用，只返回蒸馏结果）
// =============================================================
experienceRouter.get('/scene/:sceneId', requireAuth, (req: Request, res: Response) => {
  const rows = db.prepare(
    "SELECT id, scene_id, fault_id, fault_name, title, distilled, expert_name, expert_title FROM experience_rules WHERE scene_id = ? AND status = 'active' ORDER BY created_at DESC"
  ).all(req.params.sceneId) as any[];

  const experiences = rows.map((r) => ({
    ...r,
    distilled: safeParse(r.distilled, null),
  }));

  res.json({ experiences });
});

// =============================================================
// GET /api/experience/fault/:sceneId/:faultId
// 获取某故障的经验（用于AI师傅注入 + 详情页对比）
// =============================================================
experienceRouter.get('/fault/:sceneId/:faultId', requireAuth, (req: Request, res: Response) => {
  const { sceneId, faultId } = req.params;
  const rows = db.prepare(
    "SELECT id, scene_id, fault_id, fault_name, title, distilled, expert_name, expert_title FROM experience_rules WHERE scene_id = ? AND fault_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1"
  ).all(sceneId, faultId) as any[];

  if (rows.length === 0) {
    res.json({ experience: null });
    return;
  }

  const exp = rows[0];
  res.json({
    experience: {
      ...exp,
      distilled: safeParse(exp.distilled, null),
    },
  });
});
