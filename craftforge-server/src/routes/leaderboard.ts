// 排行榜路由
//   GET /api/leaderboard?scope=class|global&window=30d|all&metric=avg|drill_count|s_count
//
// 设计：
//   - scope: class（本班）/ global（全站，Q5-A 学生也可查）
//   - window: 30d（滚动 30 天）/ all（全部历史）
//   - metric: avg（按平均分降序）/ drill_count（演练数降序）/ s_count（S 级数降序）
//
//   返回：
//     leaderboard: Array<{ rank, user_id, display_name, class_name, total_drills, avg_score, s_count }>
//     my_rank: 自己的排名（不在前 50 时也返回，让学员知道自己在哪儿）

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { requireAuth } from '../middleware/jwtAuth';

const router = Router();

interface LbRow {
  user_id: string;
  display_name: string;
  class_id: string | null;
  class_name: string | null;
  total_drills: number;
  avg_score: number;
  s_count: number;
}

router.get('/', requireAuth, (req: Request, res: Response) => {
  const me = req.authUser!;
  const scope = (req.query.scope as string) || 'class';   // 'class' | 'global'
  const window = (req.query.window as string) || '30d';   // '30d' | 'all'
  const metric = (req.query.metric as string) || 'avg';   // 'avg' | 'drill_count' | 's_count'

  // 时间窗口下限（毫秒）
  let timeFloor = 0;
  if (window === '30d') timeFloor = Date.now() - 30 * 24 * 3600 * 1000;

  // scope 过滤：本班只统计本班学生
  let userClassFilter = '';
  const params: (string | number)[] = [timeFloor];
  if (scope === 'class') {
    if (!me.class_id) {
      res.json({ leaderboard: [], my_rank: null, scope, window, metric, note: 'You are not in any class yet' });
      return;
    }
    userClassFilter = ` AND u.class_id = ?`;
    params.push(me.class_id);
  }

  // 聚合查询
  const sql = `
    SELECT u.id AS user_id, u.display_name, u.class_id,
           c.name AS class_name,
           COUNT(r.id) AS total_drills,
           ROUND(AVG(r.score), 1) AS avg_score,
           SUM(CASE WHEN r.grade = 'S' THEN 1 ELSE 0 END) AS s_count
    FROM users u
    LEFT JOIN classes c ON c.id = u.class_id
    LEFT JOIN drill_records r ON r.user_id = u.id AND r.created_at >= ?
    WHERE u.role = 'student' ${userClassFilter}
    GROUP BY u.id
    HAVING total_drills > 0
  `;

  const allRows = (db.prepare(sql).all(...params) as LbRow[])
    // 排序：metric 决定
    .sort((a, b) => {
      if (metric === 'drill_count') return b.total_drills - a.total_drills;
      if (metric === 's_count') return b.s_count - a.s_count;
      // 默认 avg
      return b.avg_score - a.avg_score || b.total_drills - a.total_drills;
    });

  // 加排名
  const ranked = allRows.map((row, i) => ({ rank: i + 1, ...row }));

  // 切前 50 + 自己排名（如不在前 50，单独把自己附上）
  const top50 = ranked.slice(0, 50);
  const myItem = ranked.find((r) => r.user_id === me.id);
  const myInTop = myItem && myItem.rank <= 50 ? null : myItem ?? null;

  res.json({
    leaderboard: top50,
    my_rank: myItem ? myItem.rank : null,
    my_extra_row: myInTop, // 若我不在 top50，前端可单独展示
    total: ranked.length,
    scope,
    window,
    metric,
  });
});

export default router;
