// =============================================================
// P1-4 专家时间轴回放：固化端到端验证脚本
//
// 运行：npm run test:p14
//
// 测试分两段：
//   段 1 - 单元测试（纯函数，无需启动 server）
//     U1  buildTimelineFromOperations: 空输入
//     U2  buildTimelineFromOperations: action / view / pause 三类事件正确生成
//     U3  buildTimelineFromOperations: 噪声过滤（noiseRatio）
//     U4  compareTimelines: 完全相同时间轴应 0 差异（关键回归点）
//     U5  compareTimelines: 4 类差异 (missing / extra / value_mismatch / skip_observe) 全部触发
//
//   段 2 - 集成测试（需 craftforge-server 已在 :3001 启动）
//     I1  双角色登录（admin / teacher1，默认密码 admin123）
//     I2  GET /experience/high-score-pool 可访问 + 返回结构正确
//     I3  POST /drill-records 上传 S 评级合成演练
//     I4  GET /experience/from-record/:id (teacher 用学生演练) 200
//     I5  POST /experience/collect 带 timeline 入库 + GET 详情能取回 timeline
//     I6  B 评级演练做 from-record 应被 400 拒绝
//
//   若 server 未启动，段 2 自动跳过并提示，整体仍按段 1 结果判定 PASS/FAIL。
// =============================================================

import {
  buildTimelineFromOperations,
  compareTimelines,
  type ExpertTimeline,
  type OperationRecordLike,
  type TimelineDiff,
} from '../src/services/timeline';

const BASE = process.env.P14_TEST_BASE || 'http://127.0.0.1:3001/api';
const ADMIN_USER = process.env.P14_ADMIN_USER || 'admin';
const ADMIN_PWD = process.env.P14_ADMIN_PWD || 'admin123';
const TEACHER_USER = process.env.P14_TEACHER_USER || 'teacher1';
const TEACHER_PWD = process.env.P14_TEACHER_PWD || 'admin123';

// ============ 测试运行器 ============
let passCount = 0;
let failCount = 0;
let skipCount = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passCount++;
    console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failCount++;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}
function skip(name: string, reason: string) {
  skipCount++;
  console.log(`  ⏭  ${name} — 跳过：${reason}`);
}

// ============ 辅助：HTTP 调用 ============
async function call(
  path: string,
  opts: RequestInit = {},
  token?: string,
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((opts.headers as Record<string, string>) || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, { ...opts, headers });
  const text = await r.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    // 非 JSON，原样返回
  }
  return { status: r.status, body };
}

async function serverReachable(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return r.status < 500;
  } catch {
    return false;
  }
}

// ============================================================
// 段 1 - 单元测试
// ============================================================
function runUnitTests() {
  console.log('\n=========== 段 1 / 单元测试（纯函数）===========');

  // U1
  console.log('\n[U1] buildTimelineFromOperations 空输入');
  const emptyTl = buildTimelineFromOperations([], {});
  ok('events 数量 = 0', emptyTl.events.length === 0);
  ok('duration_sec = 0', emptyTl.duration_sec === 0);

  // U2
  console.log('\n[U2] buildTimelineFromOperations 生成三类事件');
  const t0 = 1700000000000;
  const ops: OperationRecordLike[] = [
    { timestamp: t0 + 0, action: '巡检 TI', targetEquipment: 'TI-101' },
    {
      timestamp: t0 + 45_000,
      action: '降 RR',
      targetEquipment: 'reactor-01',
      parameterChange: { param: 'RR', from: 1.0, to: 0.7 },
    },
    {
      timestamp: t0 + 120_000,
      action: '升 FRC',
      targetEquipment: 'reactor-01',
      parameterChange: { param: 'FRC', from: 50, to: 60 },
    },
  ];
  const tl = buildTimelineFromOperations(ops, { minPauseSec: 15 });
  const types = tl.events.reduce<Record<string, number>>((a, e) => {
    a[e.type] = (a[e.type] || 0) + 1;
    return a;
  }, {});
  ok('有 1 个 view', types.view === 1);
  ok('有 2 个 action', types.action === 2);
  ok('有 2 个 pause（自动识别两段观察期）', types.pause === 2);
  ok(
    'duration_sec ≈ 120',
    tl.duration_sec === 120,
    `actual=${tl.duration_sec}`,
  );

  // U3
  console.log('\n[U3] buildTimelineFromOperations 噪声过滤 (noiseRatio=0.05)');
  const noisyOps: OperationRecordLike[] = [
    {
      timestamp: t0 + 0,
      action: '微调',
      targetEquipment: 'r',
      parameterChange: { param: 'p', from: 100, to: 101 }, // 1% 变化
    },
    {
      timestamp: t0 + 1000,
      action: '大调',
      targetEquipment: 'r',
      parameterChange: { param: 'p', from: 100, to: 130 }, // 30% 变化
    },
  ];
  const filtered = buildTimelineFromOperations(noisyOps, { noiseRatio: 0.05 });
  ok(
    '微调被过滤、只保留 1 个 action 事件',
    filtered.events.filter((e) => e.type === 'action').length === 1,
  );

  // U4 — 关键回归点
  console.log('\n[U4] compareTimelines: 完全相同时间轴零差异（回归点）');
  const sameDiff = compareTimelines(tl, tl);
  ok(
    '相同 timeline 差异 = 0',
    sameDiff.length === 0,
    `actual=${sameDiff.length}`,
  );

  // U5 — 4 类差异
  console.log('\n[U5] compareTimelines: 4 类差异全部触发');
  const expertOps: OperationRecordLike[] = [
    { timestamp: t0, action: '巡检', targetEquipment: 'TI-101' },
    {
      timestamp: t0 + 45_000,
      action: '降 RR',
      targetEquipment: 'reactor-01',
      parameterChange: { param: 'RR', from: 1.0, to: 0.7 },
    },
    {
      timestamp: t0 + 120_000,
      action: '升 FRC',
      targetEquipment: 'reactor-01',
      parameterChange: { param: 'FRC', from: 50, to: 60 },
    },
    {
      timestamp: t0 + 150_000,
      action: '微调温度',
      targetEquipment: 'reactor-01',
      parameterChange: { param: 'TC-temp', from: 510, to: 505 },
    },
  ];
  const studentOps: OperationRecordLike[] = [
    { timestamp: t0, action: '巡检', targetEquipment: 'TI-101' },
    {
      timestamp: t0 + 5_000,
      action: '降 RR',
      targetEquipment: 'reactor-01',
      parameterChange: { param: 'RR', from: 1.0, to: 0.7 },
    },
    {
      timestamp: t0 + 8_000,
      action: '升 FRC',
      targetEquipment: 'reactor-01',
      parameterChange: { param: 'FRC', from: 50, to: 90 }, // 偏离 33%
    },
    {
      timestamp: t0 + 12_000,
      action: '动 PR (extra)',
      targetEquipment: 'reactor-01',
      parameterChange: { param: 'PR', from: 2.0, to: 1.5 },
    },
  ];
  const eTl = buildTimelineFromOperations(expertOps, { minPauseSec: 15 });
  const sTl = buildTimelineFromOperations(studentOps, { minPauseSec: 15 });
  const diffs: TimelineDiff[] = compareTimelines(eTl, sTl);
  const kinds = new Set(diffs.map((d) => d.kind));
  ok('触发 missing (TC-temp)', kinds.has('missing'));
  ok('触发 extra (PR)', kinds.has('extra'));
  ok('触发 value_mismatch (FRC)', kinds.has('value_mismatch'));
  ok('触发 skip_observe', kinds.has('skip_observe'));
}

// ============================================================
// 段 2 - 集成测试（依赖 server）
// ============================================================
async function runIntegrationTests() {
  console.log('\n=========== 段 2 / 集成测试（依赖 server）===========');
  const alive = await serverReachable();
  if (!alive) {
    skip('全部集成测试', `craftforge-server 未在 ${BASE} 响应；请先 npm run dev`);
    return;
  }

  // I1
  console.log('\n[I1] 双角色登录');
  const adminLogin = await call('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PWD }),
  });
  ok('admin login 200', adminLogin.status === 200);
  if (adminLogin.status !== 200) {
    skip('后续集成测试', '管理员登录失败');
    return;
  }
  const adminToken: string = adminLogin.body.token;

  const teacherLogin = await call('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: TEACHER_USER, password: TEACHER_PWD }),
  });
  ok(
    'teacher1 login 200（缺则跳过 I4）',
    teacherLogin.status === 200,
    teacherLogin.status !== 200 ? '没有 teacher1 用户也没关系' : undefined,
  );
  const teacherToken: string | null =
    teacherLogin.status === 200 ? teacherLogin.body.token : null;

  // I2
  console.log('\n[I2] GET /experience/high-score-pool');
  const pool = await call('/experience/high-score-pool', {}, adminToken);
  ok('status 200', pool.status === 200);
  ok(
    '返回 records 数组',
    Array.isArray(pool.body?.records),
    `records.length=${pool.body?.records?.length}`,
  );

  // I3 上传一条 S 级合成演练，留作 from-record / collect 的输入
  console.log('\n[I3] 上传 S 评级合成演练');
  const ts0 = Date.now() - 5 * 60 * 1000;
  const fakeOps: OperationRecordLike[] = [
    { timestamp: ts0, action: '巡检', targetEquipment: 'TI-101' },
    {
      timestamp: ts0 + 45_000,
      action: '降 RR',
      targetEquipment: 'reactor-01',
      parameterChange: { param: 'RR', from: 1.0, to: 0.7 },
    },
    {
      timestamp: ts0 + 120_000,
      action: '升 FRC',
      targetEquipment: 'reactor-01',
      parameterChange: { param: 'FRC', from: 50, to: 60 },
    },
  ];
  const drillRes = await call(
    '/drill-records',
    {
      method: 'POST',
      body: JSON.stringify({
        scene_id: 'fcc',
        fault_id: '__P14_TEST__',
        fault_name: 'P1-4 自动化测试故障',
        start_time: ts0,
        end_time: ts0 + 180_000,
        duration_sec: 180,
        score: 95,
        grade: 'S',
        difficulty: 'expert',
        score_breakdown: { dimensions: [] },
        operations: fakeOps,
      }),
    },
    adminToken,
  );
  const drillOk = drillRes.status === 200 || drillRes.status === 201;
  ok(
    '演练记录创建 2xx',
    drillOk,
    `status=${drillRes.status}`,
  );
  const drillId: string | undefined = drillRes.body?.id;
  if (!drillId) {
    skip('I4-I6', '没拿到 drillId');
    return;
  }

  // I4
  console.log('\n[I4] teacher 用 from-record 拉取学生（admin）的 S 级演练');
  if (teacherToken) {
    const fr = await call(`/experience/from-record/${drillId}`, {}, teacherToken);
    ok('status 200', fr.status === 200);
    ok(
      'timeline.events 长度 > 0',
      fr.body?.timeline?.events?.length > 0,
      `events=${fr.body?.timeline?.events?.length}`,
    );
  } else {
    skip('I4', '无 teacher token');
  }

  // I5
  console.log('\n[I5] POST /experience/collect 带 timeline 入库 + 取回 timeline');
  const fakeTimeline: ExpertTimeline = buildTimelineFromOperations(fakeOps, {
    minPauseSec: 15,
  });
  const collectRes = await call(
    '/experience/collect',
    {
      method: 'POST',
      body: JSON.stringify({
        scene_id: 'fcc',
        fault_id: '__P14_TEST__',
        fault_name: 'P1-4 自动化测试故障',
        title: 'P1-4 自动化测试条目',
        raw_transcript: '自动化测试创建的条目',
        expert_name: 'P14-Test',
        source_type: 'from_record',
        timeline: fakeTimeline,
        source_record_id: drillId,
      }),
    },
    adminToken,
  );
  ok(
    'collect 2xx',
    collectRes.status === 200 || collectRes.status === 201,
    `status=${collectRes.status}`,
  );
  const expId: string | undefined = collectRes.body?.id;
  if (expId) {
    const detail = await call(`/experience/${expId}`, {}, adminToken);
    ok('detail 200', detail.status === 200);
    ok(
      'detail.timeline 回填正确',
      detail.body?.timeline?.events?.length === fakeTimeline.events.length,
      `expect=${fakeTimeline.events.length}, got=${detail.body?.timeline?.events?.length}`,
    );
    ok(
      'source_record_id 已存',
      detail.body?.source_record_id === drillId,
    );
    // 清理：把这条测试经验删了，避免污染（管理员有权限）
    await call(`/experience/${expId}`, { method: 'DELETE' }, adminToken);
  } else {
    skip('detail 验证', '没有 expId');
  }

  // I6 B 级拒绝
  console.log('\n[I6] B 评级演练 from-record 应被 400 拒绝');
  const lowDrillRes = await call(
    '/drill-records',
    {
      method: 'POST',
      body: JSON.stringify({
        scene_id: 'fcc',
        fault_id: '__P14_TEST_B__',
        fault_name: 'P1-4 B 级测试',
        start_time: ts0,
        end_time: ts0 + 60_000,
        duration_sec: 60,
        score: 65,
        grade: 'B',
        operations: fakeOps,
      }),
    },
    adminToken,
  );
  const lowId: string | undefined = lowDrillRes.body?.id;
  if (lowId) {
    const r = await call(`/experience/from-record/${lowId}`, {}, adminToken);
    ok(
      '返回 400 + 含 grade 字段',
      r.status === 400 && r.body?.grade === 'B',
      `status=${r.status}, grade=${r.body?.grade}`,
    );
  } else {
    skip('I6', '低分演练创建失败');
  }
}

// ============================================================
// 主入口
// ============================================================
(async () => {
  console.log('============================================');
  console.log(' P1-4 专家时间轴回放：固化测试');
  console.log(' Base:', BASE);
  console.log('============================================');
  try {
    runUnitTests();
    await runIntegrationTests();
  } catch (err) {
    failCount++;
    console.log('\n❌ 测试抛出未捕获异常:', err);
  }
  console.log('\n============================================');
  console.log(` 通过 ${passCount} / 失败 ${failCount} / 跳过 ${skipCount}`);
  if (failCount > 0) {
    console.log('\n失败列表：');
    failures.forEach((f) => console.log('  - ' + f));
    console.log('============================================');
    process.exit(1);
  }
  console.log('============================================');
  process.exit(0);
})();
