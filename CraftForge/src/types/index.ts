// 设备类型定义
export interface Equipment {
  id: string;
  name: string;
  type: 'reactor' | 'regenerator' | 'fractionator' | 'heater' | 'exchanger' | 'pump' | 'compressor' | 'valve' | 'instrument' | 'robot' | 'conveyor' | 'fixture';
  x: number;
  y: number;
  width: number;
  height: number;
  status: 'normal' | 'warning' | 'danger' | 'offline' | 'highlight';
  parameters: Parameter[];
  rotation?: number;
  template: 'fcc' | 'welding';
}

export interface Parameter {
  id: string;
  name: string;
  value: number;          // 实际显示值（由动力学引擎按一阶滞后逐步逼近 setpoint）
  unit: string;
  min: number;
  max: number;
  normalMin: number;
  normalMax: number;
  trend: number[];
  // —— 工艺动力学相关字段 ——
  setpoint?: number;     // 目标值（学员调的是这个）；若未提供，引擎默认 setpoint=value
  tau?: number;          // 一阶滞后时间常数（秒），默认值由动力学引擎补
  inertia?: boolean;     // 是否启用一阶滞后；默认 true
}

// 管道类型定义
export interface Pipeline {
  id: string;
  from: string;
  to: string;
  fromPoint: 'top' | 'bottom' | 'left' | 'right' | 'center';
  toPoint: 'top' | 'bottom' | 'left' | 'right' | 'center';
  medium: string;
  flowRate: number;
  color: string;
  points?: { x: number; y: number }[];
}

// AI消息类型
export interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: number;
  equipmentRefs?: string[];
}

export interface KnowledgeItem {
  id: string;
  question: string;
  answer: string;
  tags: string[];
}

// 演练类型
export interface Fault {
  id: string;
  name: string;
  description: string;
  affectedEquipments: string[];
  symptoms: Symptom[];
  cause: string;
  steps: DrillStep[];
  hints: string[];
}

export interface Symptom {
  equipmentId: string;     // 症状所属设备 id（精确归属，便于按设备查参数与展示）
  param: string;           // 参数 id，与 Parameter.id 对齐
  paramName?: string;      // 参数中文名（用于 UI 展示，可选）
  value: number;           // 异常值，统一为数值类型
  unit?: string;           // 单位（用于展示）
  normal: string;          // 正常范围描述（如 "480-520"）
  trend: 'up' | 'down';    // 异常方向：偏高 / 偏低
}

export interface DrillStep {
  id: string;
  action: string;
  correct: boolean;
  order: number;
}

// 演练难度模式：
// - novice  新手：完整简报 + 目标值提示，错误扣分轻，最高 80（A 级）
// - standard 进阶：默认模式，给现象/根因不给处置步骤
// - expert   专家：仅简短提示，不标红设备，基础工况分 ×1.2，错误扣分重
export type DrillDifficulty = 'novice' | 'standard' | 'expert';

export interface DrillRecord {
  id: string;
  faultId: string;
  startTime: number;
  endTime: number;
  steps: OperationRecord[];
  score: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  // 评分明细（讲评报告使用）
  breakdown?: ScoreBreakdown;
  // 本次演练采用的难度（用于历史记录里展示标签）
  difficulty?: DrillDifficulty;
}

// 单维度得分明细：分数 + 满分 + 解释 + 提升建议
export interface ScoreDimension {
  key: 'baseScore' | 'stepScore' | 'speedScore' | 'penalty';
  label: string;          // 维度名（如 "基础工况分"）
  score: number;          // 实际得分（penalty 为正数表示扣了多少）
  max: number;            // 满分
  formula: string;        // 公式说明
  explain: string;        // 本次得分的具体解释
  suggestion?: string;    // 提升建议（仅当未拿满）
}

// 完整评分讲评报告
export interface ScoreBreakdown {
  total: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  bypassed: boolean;            // 是否走了"一键平稳"路径
  dimensions: ScoreDimension[]; // 各维度明细
  highlights: string[];         // 强项（做得好的点）
  improvements: string[];       // 短板（需改进的点）
  coachComment: string;         // AI 师傅一句话点评
}

export interface OperationRecord {
  timestamp: number;
  action: string;
  targetEquipment: string;
  parameterChange?: { param: string; from: number; to: number };
  isCorrect: boolean;
  aiFeedback: string;
}

// 告警类型
export interface Alarm {
  id: string;
  equipmentId: string;
  parameterId: string;
  message: string;
  level: 'warning' | 'danger';
  timestamp: number;
  acknowledged: boolean;
}

// 模板配置
export interface TemplateConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'available' | 'coming-soon';
  equipments: Equipment[];
  pipelines: Pipeline[];
  knowledge: KnowledgeItem[];
  faults: Fault[];
}

// 设备操作手册：用于设备弹窗的"操作手册"视图
export interface EquipmentManual {
  overview: string;        // 设备概述（2-3句话讲清作用）
  operatingProcedure: string[];  // 标准操作步骤（5-8条）
  safetyNotes: string[];   // 安全注意事项（3-5条）
  troubleshooting: { symptom: string; action: string }[];  // 常见故障处理
}

// 腾讯云 TTS 返回的字级时间戳片段
export interface SubtitlePiece {
  Text: string;        // 该片段对应的文字（通常 1-2 个字）
  BeginTime: number;   // 开始时间（毫秒）
  EndTime: number;     // 结束时间（毫秒）
  StableIndex?: number;
  PhoneBeginTime?: number;
  PhoneEndTime?: number;
}
