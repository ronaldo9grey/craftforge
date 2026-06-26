// =============================================================
// 学习数据分析 API (Learning Analytics)
// 从 drill_records 表深度挖掘学员弱点、成长趋势、个性化建议
// =============================================================

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { requireAuth } from '../middleware/jwtAuth';

export const analyticsRouter = Router();

// =============================================================
// 辅助：安全解析 JSON 字段
// =============================================================
function safeParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

// =============================================================
// 辅助：计算趋势（线性回归斜率 > 0 = improving）
// =============================================================
function calcTrend(values: number[]): 'improving' | 'declining' | 'stable' {
  if (values.length < 3) return 'stable';
  const n = values.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = values.reduce((acc, y, x) => acc + x * y, 0);
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  if (slope > 0.5) return 'improving';
  if (slope < -0.5) return 'declining';
  return 'stable';
}

// =============================================================
// GET /api/analytics/me/weakness
// 学员弱点分析：场景弱点 + 故障难度 + 参数调偏 + 维度得分 + 时间分析 + 建议
// =============================================================
analyticsRouter.get('/me/weakness', requireAuth, (req: Request, res: Response) => {
  const userId = req.authUser!.id;

  // 拉取该学员所有演练记录
  const records = db.prepare(
    `SELECT * FROM drill_records WHERE user_id = ? ORDER BY created_at ASC`
  ).all(userId) as any[];

  if (records.length === 0) {
    res.json({
      total_drills: 0,
      avg_score: 0,
      score_trend: 'stable',
      scene_weakness: [],
      fault_difficulty: [],
      parameter_errors: [],
      dimension_scores: {},
      time_analysis: { avg_duration: 0, fastest: 0, slowest: 0, trend: 'stable' },
      recommendations: [],
    });
    return;
  }

  const totalDrills = records.length;
  const avgScore = Math.round(records.reduce((s, r) => s + r.score, 0) / totalDrills);
  const scoreTrend = calcTrend(records.map(r => r.score));

  // ===== 1. 场景弱点分析 =====
  const sceneMap = new Map<string, { scores: number[]; durations: number[]; count: number; best: number; lastAt: number }>();
  for (const r of records) {
    if (!sceneMap.has(r.scene_id)) {
      sceneMap.set(r.scene_id, { scores: [], durations: [], count: 0, best: 0, lastAt: 0 });
    }
    const s = sceneMap.get(r.scene_id)!;
    s.scores.push(r.score);
    s.durations.push(r.duration_sec);
    s.count++;
    s.best = Math.max(s.best, r.score);
    s.lastAt = Math.max(s.lastAt, r.created_at);
  }

  const sceneWeakness = Array.from(sceneMap.entries()).map(([sceneId, data]) => {
    const avg = Math.round(data.scores.reduce((a, b) => a + b, 0) / data.count);
    const avgDur = Math.round(data.durations.reduce((a, b) => a + b, 0) / data.count);
    // 生成弱点标签
    const tags: string[] = [];
    if (avg < 60) tags.push('基础薄弱');
    if (avgDur > 300) tags.push('响应慢');
    if (data.count < 3) tags.push('练习不足');
    const trend = calcTrend(data.scores);
    if (trend === 'declining') tags.push('成绩下滑');
    return {
      scene_id: sceneId,
      scene_name: getSceneName(sceneId),
      drill_count: data.count,
      avg_score: avg,
      best_score: data.best,
      avg_duration: avgDur,
      weakness_tags: tags,
      score_trend: trend,
      last_drill_at: data.lastAt,
    };
  }).sort((a, b) => a.avg_score - b.avg_score); // 最低分排前面

  // ===== 2. 故障难度分析 =====
  const faultMap = new Map<string, { faultName: string; sceneId: string; scores: number[]; durations: number[]; count: number; bestGrade: string; commonErrors: Set<string> }>();
  for (const r of records) {
    const key = `${r.scene_id}:${r.fault_id}`;
    if (!faultMap.has(key)) {
      faultMap.set(key, { faultName: r.fault_name, sceneId: r.scene_id, scores: [], durations: [], count: 0, bestGrade: 'D', commonErrors: new Set() });
    }
    const f = faultMap.get(key)!;
    f.scores.push(r.score);
    f.durations.push(r.duration_sec);
    f.count++;
    // 最佳等级
    const gradeOrder = ['S', 'A', 'B', 'C', 'D'];
    if (gradeOrder.indexOf(r.grade) < gradeOrder.indexOf(f.bestGrade)) {
      f.bestGrade = r.grade;
    }
    // 收集错误操作
    const ops = safeParse<any[]>(r.operations, []);
    for (const op of ops) {
      if (op.isCorrect === false) {
        f.commonErrors.add(op.action || '未知操作');
      }
    }
  }

  // 查错题本掌握状态
  const mistakes = db.prepare(
    `SELECT scene_id, fault_id, status FROM mistakes WHERE user_id = ?`
  ).all(userId) as any[];
  const mistakeStatus = new Map<string, boolean>();
  for (const m of mistakes) {
    mistakeStatus.set(`${m.scene_id}:${m.fault_id}`, m.status === 'mastered');
  }

  const faultDifficulty = Array.from(faultMap.entries()).map(([key, data]) => {
    const avg = Math.round(data.scores.reduce((a, b) => a + b, 0) / data.count);
    const avgDur = Math.round(data.durations.reduce((a, b) => a + b, 0) / data.count);
    return {
      fault_id: key.split(':')[1],
      fault_name: data.faultName,
      scene_id: data.sceneId,
      scene_name: getSceneName(data.sceneId),
      attempt_count: data.count,
      avg_score: avg,
      best_grade: data.bestGrade,
      avg_duration: avgDur,
      common_errors: Array.from(data.commonErrors).slice(0, 5),
      is_mastered: mistakeStatus.get(key) ?? false,
    };
  }).sort((a, b) => a.avg_score - b.avg_score);

  // ===== 3. 参数调偏分析 =====
  const paramErrorMap = new Map<string, { paramId: string; paramName: string; sceneId: string; errorCount: number; deviations: number[]; directions: { high: number; low: number }; typicalValues: number[] }>();
  for (const r of records) {
    const ops = safeParse<any[]>(r.operations, []);
    for (const op of ops) {
      if (op.isCorrect === false && op.parameterChange) {
        const pc = op.parameterChange;
        const key = `${r.scene_id}:${pc.param}`;
        if (!paramErrorMap.has(key)) {
          paramErrorMap.set(key, { paramId: pc.param, paramName: pc.param, sceneId: r.scene_id, errorCount: 0, deviations: [], directions: { high: 0, low: 0 }, typicalValues: [] });
        }
        const pe = paramErrorMap.get(key)!;
        pe.errorCount++;
        const change = pc.to - pc.from;
        if (change > 0) pe.directions.high++;
        else if (change < 0) pe.directions.low++;
        pe.deviations.push(Math.abs(change));
        pe.typicalValues.push(pc.to);
      }
    }
  }

  const parameterErrors = Array.from(paramErrorMap.values()).map(pe => {
    const avgDev = pe.deviations.length > 0
      ? Math.round(pe.deviations.reduce((a, b) => a + b, 0) / pe.deviations.length * 100) / 100
      : 0;
    const typicalVal = pe.typicalValues.length > 0
      ? Math.round(pe.typicalValues.reduce((a, b) => a + b, 0) / pe.typicalValues.length * 100) / 100
      : 0;
    return {
      param_id: pe.paramId,
      param_name: pe.paramName,
      scene_id: pe.sceneId,
      scene_name: getSceneName(pe.sceneId),
      error_count: pe.errorCount,
      avg_deviation: avgDev,
      direction: pe.directions.high > pe.directions.low ? 'high' : 'low',
      typical_value: typicalVal,
    };
  }).sort((a, b) => b.error_count - a.error_count).slice(0, 10);

  // ===== 4. 维度得分分析 =====
  const dimMap: Record<string, { scores: number[]; maxes: number[] }> = {
    baseScore: { scores: [], maxes: [] },
    stepScore: { scores: [], maxes: [] },
    speedScore: { scores: [], maxes: [] },
    penalty: { scores: [], maxes: [] },
  };
  for (const r of records) {
    const bd = safeParse<any>(r.score_breakdown, null);
    if (bd?.dimensions) {
      for (const dim of bd.dimensions) {
        if (dimMap[dim.key]) {
          dimMap[dim.key].scores.push(dim.score);
          dimMap[dim.key].maxes.push(dim.max);
        }
      }
    }
  }

  const dimensionScores: Record<string, { avg: number; max: number; trend: string }> = {};
  for (const [key, data] of Object.entries(dimMap)) {
    if (data.scores.length > 0) {
      dimensionScores[key] = {
        avg: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
        max: data.maxes[0] || 0,
        trend: calcTrend(data.scores),
      };
    }
  }

  // ===== 5. 时间分析 =====
  const durations = records.map(r => r.duration_sec);
  const timeAnalysis = {
    avg_duration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
    fastest: Math.min(...durations),
    slowest: Math.max(...durations),
    trend: calcTrend(durations.map(d => -d)), // 反转：用时减少 = improving
  };

  // ===== 6. 个性化建议 =====
  const recommendations: Array<{ type: string; priority: string; scene_id?: string; scene_name?: string; fault_id?: string; fault_name?: string; reason: string; suggested_action: string }> = [];

  // 建议1：最低分场景 + 未掌握故障
  for (const sw of sceneWeakness.slice(0, 2)) {
    if (sw.avg_score < 70) {
      const worstFault = faultDifficulty.find(f => f.scene_id === sw.scene_id && !f.is_mastered);
      recommendations.push({
        type: 'scene_practice',
        priority: sw.avg_score < 60 ? 'high' : 'medium',
        scene_id: sw.scene_id,
        scene_name: sw.scene_name,
        fault_id: worstFault?.fault_id,
        fault_name: worstFault?.fault_name,
        reason: `「${sw.scene_name}」场景平均分${sw.avg_score}分${sw.avg_score < 60 ? '，低于及格线' : '，有提升空间'}${worstFault ? `，故障「${worstFault.fault_name}」尚未掌握` : ''}`,
        suggested_action: worstFault
          ? `建议重点练习「${worstFault.fault_name}」故障处置`
          : `建议继续在「${sw.scene_name}」场景加强训练`,
      });
    }
  }

  // 建议2：参数调偏
  for (const pe of parameterErrors.slice(0, 2)) {
    if (pe.error_count >= 3) {
      recommendations.push({
        type: 'parameter_adjustment',
        priority: pe.error_count >= 5 ? 'high' : 'medium',
        scene_id: pe.scene_id,
        scene_name: pe.scene_name,
        reason: `参数「${pe.param_name}」在「${pe.scene_name}」场景调偏${pe.error_count}次，平均偏差${pe.avg_deviation}，方向偏${pe.direction === 'high' ? '高' : '低'}`,
        suggested_action: `注意${pe.direction === 'high' ? '降低' : '提高'}${pe.param_name}的调节幅度，小步微调`,
      });
    }
  }

  // 建议3：速度维度
  if (dimensionScores.speedScore && dimensionScores.speedScore.trend === 'declining') {
    recommendations.push({
      type: 'speed_improvement',
      priority: 'medium',
      reason: '响应速度呈下降趋势，近期演练用时增加',
      suggested_action: '建议复习操作流程，减少犹豫时间，提升处置效率',
    });
  }

  // 建议4：持续练习
  if (totalDrills < 10) {
    recommendations.push({
      type: 'practice_more',
      priority: 'low',
      reason: `累计演练${totalDrills}次，建议每个场景至少完成3次演练以建立稳定的操作记忆`,
      suggested_action: '保持每天1-2次完整演练，逐步覆盖所有场景',
    });
  }

  res.json({
    total_drills: totalDrills,
    avg_score: avgScore,
    score_trend: scoreTrend,
    scene_weakness: sceneWeakness,
    fault_difficulty: faultDifficulty,
    parameter_errors: parameterErrors,
    dimension_scores: dimensionScores,
    time_analysis: timeAnalysis,
    recommendations,
  });
});

// =============================================================
// GET /api/analytics/me/radar
// 学员五维雷达图数据
// 维度：基础工况 / 操作准确度 / 响应速度 / 知识掌握 / 稳定性
// =============================================================
analyticsRouter.get('/me/radar', requireAuth, (req: Request, res: Response) => {
  const userId = req.authUser!.id;
  const records = db.prepare(
    `SELECT * FROM drill_records WHERE user_id = ? ORDER BY created_at ASC`
  ).all(userId) as any[];

  if (records.length === 0) {
    res.json({
      radar: [
        { dimension: '基础工况', score: 0, max: 100 },
        { dimension: '操作准确度', score: 0, max: 100 },
        { dimension: '响应速度', score: 0, max: 100 },
        { dimension: '知识掌握', score: 0, max: 100 },
        { dimension: '稳定性', score: 0, max: 100 },
      ],
    });
    return;
  }

  // 1. 基础工况：baseScore 维度平均 / max * 100
  // 2. 操作准确度：正确操作数 / 总操作数 * 100
  // 3. 响应速度：speedScore 维度平均 / max * 100
  // 4. 知识掌握：已掌握故障数 / 总故障数 * 100
  // 5. 稳定性：最近10次分数的标准差反向 (100 - CV*100)

  let baseAvg = 0, baseMax = 40, baseCount = 0;
  let speedAvg = 0, speedMax = 20, speedCount = 0;
  let totalOps = 0, correctOps = 0;

  for (const r of records) {
    const bd = safeParse<any>(r.score_breakdown, null);
    if (bd?.dimensions) {
      for (const dim of bd.dimensions) {
        if (dim.key === 'baseScore') { baseAvg += dim.score; baseMax = dim.max; baseCount++; }
        if (dim.key === 'speedScore') { speedAvg += dim.score; speedMax = dim.max; speedCount++; }
      }
    }
    const ops = safeParse<any[]>(r.operations, []);
    for (const op of ops) {
      totalOps++;
      if (op.isCorrect) correctOps++;
    }
  }

  // 知识掌握
  const totalFaults = new Set(records.map(r => `${r.scene_id}:${r.fault_id}`)).size;
  const masteredFaults = db.prepare(
    `SELECT COUNT(*) AS c FROM mistakes WHERE user_id = ? AND status = 'mastered'`
  ).get(userId) as { c: number };
  const masteredCount = masteredFaults?.c || 0;
  // 也考虑直接拿高分(S/A)的故障
  const highGradeFaults = new Set<string>();
  for (const r of records) {
    if (r.grade === 'S' || r.grade === 'A') {
      highGradeFaults.add(`${r.scene_id}:${r.fault_id}`);
    }
  }
  const knowledgeScore = totalFaults > 0
    ? Math.round((Math.max(masteredCount, highGradeFaults.size) / totalFaults) * 100)
    : 0;

  // 稳定性：最近10次分数的变异系数
  const recentScores = records.slice(-10).map(r => r.score);
  const meanScore = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
  const variance = recentScores.reduce((a, b) => a + (b - meanScore) ** 2, 0) / recentScores.length;
  const stdDev = Math.sqrt(variance);
  const cv = meanScore > 0 ? stdDev / meanScore : 1;
  const stabilityScore = Math.max(0, Math.min(100, Math.round(100 - cv * 100)));

  const radar = [
    {
      dimension: '基础工况',
      score: baseCount > 0 ? Math.round((baseAvg / baseCount / baseMax) * 100) : 0,
      max: 100,
    },
    {
      dimension: '操作准确度',
      score: totalOps > 0 ? Math.round((correctOps / totalOps) * 100) : 0,
      max: 100,
    },
    {
      dimension: '响应速度',
      score: speedCount > 0 ? Math.round((speedAvg / speedCount / speedMax) * 100) : 0,
      max: 100,
    },
    {
      dimension: '知识掌握',
      score: knowledgeScore,
      max: 100,
    },
    {
      dimension: '稳定性',
      score: stabilityScore,
      max: 100,
    },
  ];

  res.json({ radar });
});

// =============================================================
// GET /api/analytics/teacher/class/:classId/overview
// 教师端：班级整体弱点分析
// =============================================================
analyticsRouter.get('/teacher/class/:classId/overview', requireAuth, (req: Request, res: Response) => {
  const me = req.authUser!;
  if (me.role !== 'teacher' && me.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const classId = req.params.classId;

  // 验证班级归属
  if (me.role === 'teacher') {
    const cls = db.prepare('SELECT teacher_id FROM classes WHERE id = ?').get(classId) as { teacher_id: string } | undefined;
    if (!cls || cls.teacher_id !== me.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
  }

  // 获取班级所有学生的演练记录
  const records = db.prepare(`
    SELECT dr.*, u.display_name, u.username
    FROM drill_records dr
    JOIN users u ON dr.user_id = u.id
    WHERE u.class_id = ?
    ORDER BY dr.created_at DESC
  `).all(classId) as any[];

  if (records.length === 0) {
    res.json({
      total_drills: 0,
      avg_score: 0,
      student_count: 0,
      scene_weakness: [],
      at_risk_students: [],
      top_students: [],
    });
    return;
  }

  // 班级整体统计
  const studentIds = new Set(records.map(r => r.user_id));
  const totalDrills = records.length;
  const avgScore = Math.round(records.reduce((s, r) => s + r.score, 0) / totalDrills);

  // 场景弱点
  const sceneMap = new Map<string, { scores: number[]; count: number }>();
  for (const r of records) {
    if (!sceneMap.has(r.scene_id)) sceneMap.set(r.scene_id, { scores: [], count: 0 });
    const s = sceneMap.get(r.scene_id)!;
    s.scores.push(r.score);
    s.count++;
  }
  const sceneWeakness = Array.from(sceneMap.entries()).map(([sceneId, data]) => ({
    scene_id: sceneId,
    scene_name: getSceneName(sceneId),
    drill_count: data.count,
    avg_score: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.count),
    student_coverage: studentIds.size,
  })).sort((a, b) => a.avg_score - b.avg_score);

  // 风险学生（均分 < 60 或 近5次呈下降趋势 或 演练数 < 3）
  const studentMap = new Map<string, { name: string; scores: number[]; count: number; lastAt: number }>();
  for (const r of records) {
    if (!studentMap.has(r.user_id)) {
      studentMap.set(r.user_id, { name: r.display_name, scores: [], count: 0, lastAt: 0 });
    }
    const s = studentMap.get(r.user_id)!;
    s.scores.push(r.score);
    s.count++;
    s.lastAt = Math.max(s.lastAt, r.created_at);
  }

  const atRiskStudents = Array.from(studentMap.entries()).map(([uid, data]) => {
    const avg = data.scores.reduce((a, b) => a + b, 0) / data.count;
    const trend = calcTrend(data.scores.slice(-5));
    const reasons: string[] = [];
    if (avg < 60) reasons.push('均分低于60');
    if (trend === 'declining') reasons.push('近期成绩下滑');
    if (data.count < 3) reasons.push('演练次数不足');
    return {
      user_id: uid,
      name: data.name,
      avg_score: Math.round(avg),
      drill_count: data.count,
      trend,
      risk_level: reasons.length >= 2 ? 'high' : reasons.length === 1 ? 'medium' : 'low',
      reasons,
      last_drill_at: data.lastAt,
    };
  }).filter(s => s.risk_level !== 'low').sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.risk_level as keyof typeof order] - order[b.risk_level as keyof typeof order];
  });

  // 优秀学生
  const topStudents = Array.from(studentMap.entries()).map(([uid, data]) => {
    const avg = data.scores.reduce((a, b) => a + b, 0) / data.count;
    const sCount = data.scores.filter(s => s >= 90).length;
    return {
      user_id: uid,
      name: data.name,
      avg_score: Math.round(avg),
      drill_count: data.count,
      s_count: sCount,
    };
  }).sort((a, b) => b.avg_score - a.avg_score).slice(0, 10);

  res.json({
    total_drills: totalDrills,
    avg_score: avgScore,
    student_count: studentIds.size,
    scene_weakness: sceneWeakness,
    at_risk_students: atRiskStudents,
    top_students: topStudents,
  });
});

// =============================================================
// 场景名称映射
// =============================================================
const SCENE_NAMES: Record<string, string> = {
  fcc: '催化裂化装置',
  welding: '汽车焊装',
  cnc: '数控加工',
  injection: '注塑成型',
  aluminum: '电解铝车间',
  anode: '阳极振压成型',
  baking: '焙烧炉',
  tbm: '盾构机隧道掘进',
  offshore: '海上钻井平台',
};

function getSceneName(sceneId: string): string {
  return SCENE_NAMES[sceneId] || sceneId;
}
