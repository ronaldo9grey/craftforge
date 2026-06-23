// 成就定义 + 解锁判定
// 设计：成就规则在代码里维护（不入库），用户解锁状态存 user_achievements 表
// 每次演练记录提交后，evaluate(userId) 自动跑一遍所有规则，新解锁的写入 DB

import { db, uuid } from './index';
import type { DrillRecordRow } from './types';

// 成就定义
export interface AchievementDef {
  key: string;
  name: string;
  description: string;
  icon: string;       // emoji
  /** 判定函数：给定用户的所有演练记录，返回是否解锁 */
  check: (records: DrillRecordRow[]) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    key: 'first_drill',
    name: '初出茅庐',
    description: '完成第一次演练',
    icon: '🚩',
    check: (records) => records.length >= 1,
  },
  {
    key: 'first_pass',
    name: '小试牛刀',
    description: '首次获得 C 级以上评分',
    icon: '🥉',
    check: (records) => records.some((r) => ['S', 'A', 'B', 'C'].includes(r.grade)),
  },
  {
    key: 'first_a',
    name: '渐入佳境',
    description: '首次获得 A 级评分',
    icon: '🥈',
    check: (records) => records.some((r) => ['S', 'A'].includes(r.grade)),
  },
  {
    key: 'first_s',
    name: '炉火纯青',
    description: '首次获得 S 级评分',
    icon: '🥇',
    check: (records) => records.some((r) => r.grade === 'S'),
  },
  {
    key: 'five_drills',
    name: '勤学不辍',
    description: '累计完成 5 次演练',
    icon: '📚',
    check: (records) => records.length >= 5,
  },
  {
    key: 'twenty_drills',
    name: '熟能生巧',
    description: '累计完成 20 次演练',
    icon: '🛠️',
    check: (records) => records.length >= 20,
  },
  {
    key: 'all_scenes',
    name: '博采众长',
    description: '在 3 个不同场景都完成过演练',
    icon: '🌐',
    check: (records) => new Set(records.map((r) => r.scene_id)).size >= 3,
  },
  {
    key: 'expert_pass',
    name: '高手过招',
    description: '在专家难度下通过演练（A 级以上）',
    icon: '🎯',
    check: (records) =>
      records.some((r) => r.difficulty === 'expert' && ['S', 'A'].includes(r.grade)),
  },
  {
    key: 'streak_3a',
    name: '渐臻完美',
    description: '连续 3 次 A 级以上评分',
    icon: '🔥',
    check: (records) => {
      // 按时间升序遍历，找连续 3 个 A+
      const sorted = [...records].sort((a, b) => a.created_at - b.created_at);
      let streak = 0;
      for (const r of sorted) {
        if (['S', 'A'].includes(r.grade)) {
          streak++;
          if (streak >= 3) return true;
        } else {
          streak = 0;
        }
      }
      return false;
    },
  },
  {
    key: 'all_s',
    name: '匠魂登顶',
    description: '在 3 个场景都至少拿到一次 S 级',
    icon: '👑',
    check: (records) => {
      const scenesWithS = new Set(records.filter((r) => r.grade === 'S').map((r) => r.scene_id));
      return scenesWithS.size >= 3;
    },
  },
];

/** 评估用户成就：返回新解锁的成就 key 列表 */
export function evaluateAchievements(userId: string): string[] {
  const records = db
    .prepare('SELECT * FROM drill_records WHERE user_id = ?')
    .all(userId) as DrillRecordRow[];
  const unlockedKeys = new Set<string>(
    (db.prepare('SELECT achievement_key FROM user_achievements WHERE user_id = ?').all(userId) as {
      achievement_key: string;
    }[]).map((r) => r.achievement_key),
  );
  const newKeys: string[] = [];
  const now = Date.now();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO user_achievements (id, user_id, achievement_key, unlocked_at) VALUES (?, ?, ?, ?)`,
  );
  for (const def of ACHIEVEMENTS) {
    if (unlockedKeys.has(def.key)) continue;
    if (def.check(records)) {
      insert.run(uuid(), userId, def.key, now);
      newKeys.push(def.key);
    }
  }
  return newKeys;
}
