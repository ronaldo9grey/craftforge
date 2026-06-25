// 阳极振压成型车间动力学耦合规则 v1
//
// 核心物理化学链路（按工艺逻辑）：
//
// === 糊料温度链 ===
// A1. 配料控制柜.沥青配比 → 糊料缸.沥青配比（间接，相当于配比指令）
// A2. 糊料缸.糊料温度 → 振压机.模具温度内部基准（高温糊料带热进模）
//
// === 模具温度链 ===
// B1. 模具加热站.加热功率 → 模具加热站.模具预热温度
// B2. 模具加热站.模具预热温度 → 振压机.模具温度（导热油传递）
//
// === 真空度链 ===
// C1. 真空泵.抽气流量 → 真空泵.绝对压力（流量↑→压力↓更低真空越好）
//
// === 振实密度链（最终质量指标）===
// D1. 糊料温度 → 生阳极密度（145~155°C 最佳）
// D2. 模具温度 → 生阳极密度（130~145°C 最佳）
// D3. 振压压力 → 生阳极密度
// D4. 振压时间 → 生阳极密度
// D5. 真空绝压 → 生阳极密度（绝压↓气孔↓密度↑）
// D6. 振动频率 → 生阳极密度
//
// === 合格率链 ===
// E1. 生阳极密度 → 合格率（标准 1.58~1.65 g/cm³）
// E2. 模具温度偏离 130~145 → 合格率（缺角/粘模）
// E3. 真空绝压偏离 1~5 kPa → 合格率（起鼓）
// E4. 糊料温度偏离 145~155 → 合格率（裂纹/起鼓）
//
// === 配比 → 糊料温度 ===
// F1. 沥青配比 → 糊料流动性（间接通过密度体现）
//
// === 称量 → 重量偏差 ===
// G1. 单块加料量稳定性 → 重量偏差

import type { CouplingRule } from '@/engine/dynamics';

export const anodeCouplings: CouplingRule[] = [
  // ====== B 模具温度链 ======
  // B1. 加热功率 → 模具预热温度（加热站自身）
  {
    from: { equipmentId: 'MHT-501', param: 'heat_power' },
    to:   { equipmentId: 'MHT-501', param: 'mold_pre_temp' },
    gain: 0.9, baseline: 65, tau: 20,
  },
  // B2. 模具预热温度 → 振压机模具温度（导热油传递，有滞后）
  {
    from: { equipmentId: 'MHT-501', param: 'mold_pre_temp' },
    to:   { equipmentId: 'FORM-201', param: 'mold_temp' },
    gain: 1.0, baseline: 135, tau: 30,
  },

  // ====== A 糊料温度对模具温度的二次影响 ======
  // A2. 糊料温度高 → 模具温度被动升高（糊料带热）
  {
    from: { equipmentId: 'PASTE-101', param: 'paste_temp' },
    to:   { equipmentId: 'FORM-201', param: 'mold_temp' },
    gain: 0.08, baseline: 150, tau: 60,
  },

  // ====== C 真空度链 ======
  // C1. 抽气流量 → 绝对压力（流量↑→压力↓，负相关）
  {
    from: { equipmentId: 'VAC-601', param: 'vac_flow' },
    to:   { equipmentId: 'VAC-601', param: 'vac_pressure' },
    gain: -0.04, baseline: 200, tau: 4,
  },

  // ====== D 生阳极密度链 ======
  // D1. 糊料温度 → 密度（围绕 150°C 最佳，偏离则下降）
  {
    from: { equipmentId: 'PASTE-101', param: 'paste_temp' },
    to:   { equipmentId: 'FORM-201', param: 'block_dens' },
    gain: 0.006, baseline: 150, tau: 15,
  },
  // D2. 模具温度 → 密度
  {
    from: { equipmentId: 'FORM-201', param: 'mold_temp' },
    to:   { equipmentId: 'FORM-201', param: 'block_dens' },
    gain: 0.004, baseline: 138, tau: 12,
  },
  // D3. 振压压力 → 密度
  {
    from: { equipmentId: 'FORM-201', param: 'press_force' },
    to:   { equipmentId: 'FORM-201', param: 'block_dens' },
    gain: 0.0005, baseline: 1280, tau: 5,
  },
  // D4. 振压时间 → 密度
  {
    from: { equipmentId: 'FORM-201', param: 'press_time' },
    to:   { equipmentId: 'FORM-201', param: 'block_dens' },
    gain: 0.0035, baseline: 95, tau: 5,
  },
  // D5. 真空绝压 → 密度（绝压↑→气孔多→密度↓，负相关）
  {
    from: { equipmentId: 'VAC-601', param: 'vac_pressure' },
    to:   { equipmentId: 'FORM-201', param: 'block_dens' },
    gain: -0.008, baseline: 4.5, tau: 10,
  },
  // D6. 振动频率 → 密度
  {
    from: { equipmentId: 'FORM-201', param: 'vib_freq' },
    to:   { equipmentId: 'FORM-201', param: 'block_dens' },
    gain: 0.003, baseline: 50, tau: 5,
  },

  // ====== E 合格率链 ======
  // E1. 生阳极密度 → 合格率（核心指标，密度高→合格率高）
  {
    from: { equipmentId: 'FORM-201', param: 'block_dens' },
    to:   { equipmentId: 'HMI-802', param: 'qc_ratio' },
    gain: 100, baseline: 1.62, tau: 30,
  },
  // E2. 模具温度 → 合格率（130~145 最佳）
  {
    from: { equipmentId: 'FORM-201', param: 'mold_temp' },
    to:   { equipmentId: 'HMI-802', param: 'qc_ratio' },
    gain: 0.4, baseline: 138, tau: 25,
  },
  // E3. 真空绝压 → 合格率（负相关，绝压高 → 起鼓 → 合格率低）
  {
    from: { equipmentId: 'VAC-601', param: 'vac_pressure' },
    to:   { equipmentId: 'HMI-802', param: 'qc_ratio' },
    gain: -1.5, baseline: 4.5, tau: 20,
  },
  // E4. 糊料温度 → 合格率（145~155 最佳，偏离两边都跌）
  {
    from: { equipmentId: 'PASTE-101', param: 'paste_temp' },
    to:   { equipmentId: 'HMI-802', param: 'qc_ratio' },
    gain: 0.3, baseline: 150, tau: 25,
  },

  // ====== F 配料 → 糊料 ======
  // F1. 配料柜.沥青配比 ≈ 糊料缸.沥青配比（间接通过 fine_ratio 反映）
  //     这里直接耦合到糊料温度——配比中沥青多→流动性好→温度容易维持
  {
    from: { equipmentId: 'PASTE-101', param: 'pitch_ratio' },
    to:   { equipmentId: 'FORM-201', param: 'block_dens' },
    gain: 0.008, baseline: 15, tau: 30,
  },

  // ====== G 称量 → 重量偏差 ======
  // G1. 加料量稳定 → 重量偏差小（加料量偏离 1080 越远，偏差越大）
  //     这是个保护性耦合，避免学员瞎调
  {
    from: { equipmentId: 'WGT-401', param: 'feed_weight' },
    to:   { equipmentId: 'WGT-401', param: 'feed_dev' },
    gain: 0.05, baseline: 1080, tau: 10,
  },

  // ====== H 入口温度联动（冷却台）======
  // H1. 振压机模具温度高 → 冷却台入口温度高（生阳极坯块带热）
  {
    from: { equipmentId: 'FORM-201', param: 'mold_temp' },
    to:   { equipmentId: 'COOL-301', param: 'cool_temp_in' },
    gain: 1.5, baseline: 138, tau: 30,
  },
  // H2. 入口温度高 + 冷却传送速度慢 → 出口温度高
  {
    from: { equipmentId: 'COOL-301', param: 'cool_temp_in' },
    to:   { equipmentId: 'COOL-301', param: 'cool_temp_out' },
    gain: 0.25, baseline: 220, tau: 40,
  },
  {
    from: { equipmentId: 'COOL-301', param: 'cool_speed' },
    to:   { equipmentId: 'COOL-301', param: 'cool_temp_out' },
    gain: -300, baseline: 0.05, tau: 25,
  },
];
