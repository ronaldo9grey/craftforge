// =============================================================
// 专家经验蒸馏 API (Experience Distillation)
// 教师提交专家口述/操作记录 → LLM蒸馏为结构化经验 → 存入经验库
// 学生演练时注入AI师傅上下文，讲评时对比"专家做法 vs 学生做法"
// =============================================================

import { Router, Request, Response } from 'express';
import { db, uuid } from '../db';
import { requireAuth, requireRole } from '../middleware/jwtAuth';
import { writeEventLog } from '../utils/logger';
import {
  buildTimelineFromOperations,
  parseTimeline,
  type OperationRecordLike,
} from '../services/timeline';

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
  timelineJson?: string | null,
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

  const userContent = [
    `专家口述记录：\n${transcript}`,
    annotations ? `\n\n操作标注（JSON）：\n${annotations}` : '',
    timelineJson ? `\n\n专家时间轴（按时间顺序的事件序列，包含动作与观察期）：\n${timelineJson}\n说明：请重点根据时间轴中的"pause 观察期"和"action 之间的间隔"提炼 rhythm（节奏）；并把每个 action 与 key_decisions 对应。` : '',
  ].join('');

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
      timeline,           // P1-4: 可选，专家时间轴（ExpertTimeline 或 null）
      source_record_id,   // P1-4: 可选，来源演练记录 id
    } = req.body;

    if (!scene_id || !fault_name || !title || !raw_transcript) {
      res.status(400).json({ error: '缺少必填字段: scene_id, fault_name, title, raw_transcript' });
      return;
    }

    const id = uuid();
    const now = Date.now();
    const timelineJson = timeline ? JSON.stringify(timeline) : null;

    // 先插入记录（distilled暂为null）
    db.prepare(
      `INSERT INTO experience_rules
        (id, scene_id, fault_id, fault_name, title, raw_transcript, raw_annotations,
         expert_name, expert_title, source_type, status, distilled,
         timeline_json, source_record_id,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NULL, ?, ?, ?, ?)`
    ).run(
      id, scene_id, fault_id ?? null, fault_name, title,
      raw_transcript, raw_annotations ?? null,
      expert_name ?? null, expert_title ?? null, source_type ?? 'think_aloud',
      timelineJson, source_record_id ?? null,
      now, now
    );

    // 调用LLM蒸馏
    let distilled = null;
    let distillError = null;
    try {
      distilled = await distillWithLLM(raw_transcript, scene_id, fault_name, raw_annotations, timelineJson);
      db.prepare('UPDATE experience_rules SET distilled = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(distilled), Date.now(), id);
      writeEventLog('experience_distilled', {
        userId: req.authUser!.id,
        experienceId: id,
        sceneId: scene_id,
        faultId: fault_id,
        expertName: expert_name,
      });
    } catch (err: any) {
      distillError = err.message;
      writeEventLog('experience_distill_failed', {
        userId: req.authUser!.id,
        experienceId: id,
        sceneId: scene_id,
        faultId: fault_id,
        error: err.message,
      });
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

    const distilled = await distillWithLLM(row.raw_transcript, row.scene_id, row.fault_name, row.raw_annotations, row.timeline_json);
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
    timeline: parseTimeline(row.timeline_json),
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
    timeline,   // P1-4: 教师可在前端预览页编辑后回写
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
  if (timeline !== undefined) {
    updates.push('timeline_json = ?');
    params.push(timeline === null ? null : JSON.stringify(timeline));
  }

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
    "SELECT id, scene_id, fault_id, fault_name, title, distilled, timeline_json, expert_name, expert_title FROM experience_rules WHERE scene_id = ? AND fault_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1"
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
      timeline: parseTimeline(exp.timeline_json),
    },
  });
});

// =============================================================
// P1-4: POST /api/experience/from-record/:recordId
// 一键把某条高分演练记录"提升"为专家时间轴草稿。
// - 校验该演练记录属于当前 teacher/admin 自己（或 admin 可跨账户）
// - 自动按 operations 生成 timeline 草稿
// - 返回 timeline_preview，前端教师可继续编辑后再 POST /collect 正式入库
// 不直接落库，避免误操作污染经验库
// =============================================================
experienceRouter.get('/from-record/:recordId', requireAuth, requireRole('teacher', 'admin'), (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM drill_records WHERE id = ?').get(req.params.recordId) as any;
  if (!row) {
    res.status(404).json({ error: '演练记录不存在' });
    return;
  }
  // 仅允许 admin 跨账户访问；teacher 只能用自己的演练
  if (req.authUser!.role !== 'admin' && row.user_id !== req.authUser!.id) {
    res.status(403).json({ error: '无权访问他人的演练记录' });
    return;
  }
  const ops: OperationRecordLike[] = safeParse(row.operations, [] as OperationRecordLike[]);
  // 专家时间轴：噪声过滤更严（< 5% 视为噪声跳过），观察期阈值 15s
  const timeline = buildTimelineFromOperations(ops, { minPauseSec: 15, noiseRatio: 0.05 });
  res.json({
    record: {
      id: row.id,
      scene_id: row.scene_id,
      fault_id: row.fault_id,
      fault_name: row.fault_name,
      score: row.score,
      grade: row.grade,
      duration_sec: row.duration_sec,
      created_at: row.created_at,
    },
    timeline,
    // 给前端一个建议草稿，教师可改
    suggested_title: `${row.fault_name} - ${row.grade} 评级处置`,
    suggested_transcript: ops
      .map((o, i) => `[${i + 1}] ${o.action}${o.parameterChange ? `（${o.parameterChange.param}: ${o.parameterChange.from}→${o.parameterChange.to}）` : ''}${o.aiFeedback ? ` -- ${o.aiFeedback}` : ''}`)
      .join('\n'),
  });
});

// =============================================================
// P1-4: GET /api/experience/student-timeline/:recordId
// 学生侧"自己演练时间轴" — 直接基于自己的 drill_record.operations 现算
// 不持久化，节省 DB；学生本人 / admin / 该班教师可查
// =============================================================
experienceRouter.get('/student-timeline/:recordId', requireAuth, (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM drill_records WHERE id = ?').get(req.params.recordId) as any;
  if (!row) {
    res.status(404).json({ error: '演练记录不存在' });
    return;
  }
  const me = req.authUser!;
  const owner = row.user_id === me.id;
  if (!owner && me.role !== 'admin' && me.role !== 'teacher') {
    res.status(403).json({ error: '无权查看' });
    return;
  }
  const ops: OperationRecordLike[] = safeParse(row.operations, [] as OperationRecordLike[]);
  // 学生时间轴：不做噪声过滤（学生可能正是因为微调过多被扣分，要展示真实记录）
  const timeline = buildTimelineFromOperations(ops, { minPauseSec: 15, noiseRatio: 0 });
  res.json({
    record_id: row.id,
    scene_id: row.scene_id,
    fault_id: row.fault_id,
    timeline,
  });
});
