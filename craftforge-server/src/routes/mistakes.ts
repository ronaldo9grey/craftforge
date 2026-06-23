// 错题本路由
//   GET    /api/mistakes              我的错题本（默认 status=open，可 ?status=all|mastered）
//   POST   /api/mistakes/:id/master   学生手动"标记掌握"
//   POST   /api/mistakes              手动添加一条错题（来自详情页"标错"按钮）
//
// 自动归档规则（在 drillRecords.ts 提交时触发）：
//   - 演练 grade=C/D → upsert 到 mistakes（fail_count++, last_*更新）
//   - 演练 grade=S/A 且对应错题处于 open → 自动 mastered
//   - 演练 grade=B 不变更状态（中性，不加不减）

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db, uuid } from '../db';
import { requireAuth } from '../middleware/jwtAuth';

const router = Router();

interface MistakeRow {
  id: string;
  user_id: string;
  scene_id: string;
  fault_id: string;
  fault_name: string;
  fail_count: number;
  last_fail_at: number;
  last_score: number;
  last_grade: string;
  status: string;
  mastered_at: number | null;
  created_at: number;
}

// =============================================================
// 工具：在提交演练记录时调用，自动维护错题状态
// =============================================================
export function syncMistakeOnDrill(input: {
  user_id: string;
  scene_id: string;
  fault_id: string;
  fault_name: string;
  score: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  end_time: number;
}): { action: 'added' | 'updated' | 'mastered' | 'noop' } {
  const now = input.end_time;
  const existing = db
    .prepare(`SELECT * FROM mistakes WHERE user_id = ? AND scene_id = ? AND fault_id = ?`)
    .get(input.user_id, input.scene_id, input.fault_id) as MistakeRow | undefined;

  // C/D 评级 → 加入错题本
  if (input.grade === 'C' || input.grade === 'D') {
    if (existing) {
      db.prepare(
        `UPDATE mistakes SET fail_count = fail_count + 1, last_fail_at = ?, last_score = ?, last_grade = ?,
            status = 'open', mastered_at = NULL
         WHERE id = ?`,
      ).run(now, Math.round(input.score), input.grade, existing.id);
      return { action: 'updated' };
    } else {
      db.prepare(
        `INSERT INTO mistakes (id, user_id, scene_id, fault_id, fault_name, fail_count,
            last_fail_at, last_score, last_grade, status, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, 'open', ?)`,
      ).run(
        uuid(), input.user_id, input.scene_id, input.fault_id, input.fault_name,
        now, Math.round(input.score), input.grade, now,
      );
      return { action: 'added' };
    }
  }

  // S/A 评级 → 若已在错题本且 open，自动标记掌握（Q3-A 默认）
  if ((input.grade === 'S' || input.grade === 'A') && existing && existing.status === 'open') {
    db.prepare(`UPDATE mistakes SET status = 'mastered', mastered_at = ? WHERE id = ?`).run(now, existing.id);
    return { action: 'mastered' };
  }

  return { action: 'noop' };
}

// =============================================================
// GET /api/mistakes  我的错题本
// =============================================================
router.get('/', requireAuth, (req: Request, res: Response) => {
  const userId = req.authUser!.id;
  const statusParam = (req.query.status as string) || 'open';
  let sql = `SELECT * FROM mistakes WHERE user_id = ?`;
  const params: (string | number)[] = [userId];
  if (statusParam !== 'all') {
    sql += ` AND status = ?`;
    params.push(statusParam);
  }
  sql += ` ORDER BY last_fail_at DESC`;
  const rows = db.prepare(sql).all(...params) as MistakeRow[];

  // 统计：open / mastered 各多少
  const counts = db
    .prepare(`SELECT status, COUNT(*) AS c FROM mistakes WHERE user_id = ? GROUP BY status`)
    .all(userId) as { status: string; c: number }[];
  const stats: Record<string, number> = { open: 0, mastered: 0 };
  counts.forEach((c) => (stats[c.status] = c.c));

  res.json({ mistakes: rows, stats });
});

// =============================================================
// POST /api/mistakes/:id/master  手动标记已掌握
// =============================================================
router.post('/:id/master', requireAuth, (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM mistakes WHERE id = ?').get(req.params.id) as MistakeRow | undefined;
  if (!row) { res.status(404).json({ error: 'Mistake not found' }); return; }
  if (row.user_id !== req.authUser!.id) { res.status(403).json({ error: 'Forbidden' }); return; }
  db.prepare(`UPDATE mistakes SET status = 'mastered', mastered_at = ? WHERE id = ?`).run(Date.now(), row.id);
  res.json({ ok: true });
});

// =============================================================
// POST /api/mistakes  手动添加错题（详情页"标错"按钮）
// body: { scene_id, fault_id, fault_name, score?, grade? }
// =============================================================
const AddSchema = z.object({
  scene_id: z.string().min(1),
  fault_id: z.string().min(1),
  fault_name: z.string().min(1),
  score: z.number().int().min(0).max(100).optional(),
  grade: z.enum(['S', 'A', 'B', 'C', 'D']).optional(),
});
router.post('/', requireAuth, (req: Request, res: Response) => {
  const parsed = AddSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Bad request', detail: parsed.error.flatten() }); return; }
  const d = parsed.data;
  const userId = req.authUser!.id;
  const now = Date.now();
  const existing = db
    .prepare(`SELECT * FROM mistakes WHERE user_id = ? AND scene_id = ? AND fault_id = ?`)
    .get(userId, d.scene_id, d.fault_id) as MistakeRow | undefined;
  if (existing) {
    db.prepare(
      `UPDATE mistakes SET fail_count = fail_count + 1, last_fail_at = ?, status = 'open', mastered_at = NULL
       WHERE id = ?`,
    ).run(now, existing.id);
    res.json({ ok: true, action: 'updated', id: existing.id });
    return;
  }
  const id = uuid();
  db.prepare(
    `INSERT INTO mistakes (id, user_id, scene_id, fault_id, fault_name, fail_count,
        last_fail_at, last_score, last_grade, status, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, 'open', ?)`,
  ).run(id, userId, d.scene_id, d.fault_id, d.fault_name, now, d.score ?? 0, d.grade ?? 'D', now);
  res.status(201).json({ ok: true, action: 'added', id });
});

export default router;
