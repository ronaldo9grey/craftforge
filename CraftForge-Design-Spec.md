# CraftForge 匠魂 · 可配置工艺实训引擎 - 设计文档

> **版本**: v1.0  
> **日期**: 2026-06-17  
> **作者**: AI Assistant  
> **状态**: 待实现

---

## 1. 项目概述

### 1.1 一句话定义

**像搭乐高一样搭建虚拟工厂，像问老师傅一样解决工艺问题。**

### 1.2 核心创新

不是"做一个工厂Demo"，而是做一个**能生成任意工厂Demo的引擎**。通过可配置的设备库、管道系统和AI知识库，让用户能够：
- 拖拽搭建任意工艺流程
- 上传工艺文档自动生成知识图谱
- AI老师傅基于RAG+Agent提供个性化指导

### 1.3 应用名称

**匠魂 · 可配置工艺实训引擎** (CraftForge)

> 备选：AI手艺传承实训舱

### 1.4 目标用户

- 化工/制造企业的操作员培训
- 职业院校工艺专业学生
- 工程师工艺验证和故障演练

---

## 2. 技术架构

### 2.1 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **框架** | React 18 + Vite + TypeScript | 现代前端开发体验 |
| **状态管理** | Zustand | 轻量、TypeScript友好、支持分片 |
| **样式** | Tailwind CSS | 原子化CSS，快速构建工业风UI |
| **Canvas渲染** | 原生Canvas 2D API | 设备渲染、管道动画、交互检测 |
| **语音合成** | Web Speech API | AI老师傅语音朗读 |
| **AI能力** | RAG + Agent (模拟) | 预置知识库，架构预留真实API |
| **图标** | Lucide React | 轻量图标库 |

### 2.2 状态管理分片

```typescript
// uiStore - UI状态
interface UIState {
  activeTemplate: 'fcc' | 'welding' | 'mixed' | null;
  sidebarLeftOpen: boolean;
  sidebarRightOpen: boolean;
  selectedEquipmentId: string | null;
  theme: 'dark';
}

// equipmentStore - 设备与工艺状态
interface EquipmentState {
  equipments: Equipment[];
  pipelines: Pipeline[];
  parameters: Record<string, ParameterValue>;
  alarms: Alarm[];
  updateParameter: (id: string, value: number) => void;
}

// aiStore - AI老师傅状态
interface AIState {
  messages: Message[];
  avatarMood: 'calm' | 'thinking' | 'alert' | 'guiding';
  voiceEnabled: boolean;
  knowledgeBase: KnowledgeItem[];
  isProcessing: boolean;
}

// drillStore - 演练状态
interface DrillState {
  isRunning: boolean;
  currentFault: Fault | null;
  steps: DrillStep[];
  score: number;
  history: DrillRecord[];
  startDrill: () => void;
  submitStep: (action: string) => void;
}
```

### 2.3 项目文件结构

```
CraftForge-匠魂实训引擎/
├── public/
│   └── assets/
│       └── icons/              # 设备图标SVG
├── src/
│   ├── main.tsx                # 入口
│   ├── App.tsx                 # 根组件
│   ├── index.css               # 全局样式
│   ├── types/
│   │   ├── equipment.ts        # 设备类型定义
│   │   ├── pipeline.ts         # 管道类型定义
│   │   ├── parameter.ts        # 参数类型定义
│   │   ├── ai.ts               # AI消息类型定义
│   │   └── drill.ts            # 演练类型定义
│   ├── stores/
│   │   ├── uiStore.ts          # UI状态
│   │   ├── equipmentStore.ts   # 设备状态
│   │   ├── aiStore.ts          # AI状态
│   │   └── drillStore.ts       # 演练状态
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── MainLayout.tsx  # 主布局
│   │   │   ├── TopBar.tsx      # 顶部工具栏
│   │   │   ├── LeftSidebar.tsx # 左侧模板选择器
│   │   │   └── RightSidebar.tsx# 右侧AI对话区
│   │   ├── Canvas/
│   │   │   ├── FactoryCanvas.tsx    # Canvas主组件
│   │   │   ├── EquipmentRenderer.ts # 设备渲染器
│   │   │   ├── PipelineRenderer.ts  # 管道渲染器
│   │   │   ├── AnimationLoop.ts     # 动画循环
│   │   │   └── InteractionHandler.ts# 交互处理器
│   │   ├── Equipment/
│   │   │   ├── ParameterPanel.tsx   # 参数面板
│   │   │   ├── EquipmentIcon.tsx    # 设备图标
│   │   │   └── TrendChart.tsx       # 趋势微图
│   │   ├── AI/
│   │   │   ├── AIChat.tsx           # AI对话区
│   │   │   ├── DigitalAvatar.tsx    # 数字人头像
│   │   │   ├── MessageBubble.tsx    # 消息气泡
│   │   │   └── VoiceToggle.tsx      # 语音开关
│   │   ├── Drill/
│   │   │   ├── DrillControl.tsx     # 演练控制
│   │   │   ├── FaultIndicator.tsx   # 故障指示器
│   │   │   ├── ScoreBoard.tsx       # 评分面板
│   │   │   └── StepGuide.tsx        # 步骤引导
│   │   └── common/
│   │       ├── Button.tsx
│   │       ├── Slider.tsx
│   │       ├── Badge.tsx
│   │       └── Tooltip.tsx
│   ├── templates/
│   │   ├── fcc/                # 催化裂化模板
│   │   │   ├── config.ts       # 设备配置
│   │   │   ├── layout.ts       # 布局定义
│   │   │   ├── faults.ts       # 故障库
│   │   │   └── knowledge.ts    # 知识库
│   │   └── welding/            # 焊装车间模板
│   │       ├── config.ts
│   │       ├── layout.ts
│   │       └── knowledge.ts
│   ├── hooks/
│   │   ├── useCanvas.ts        # Canvas初始化
│   │   ├── useAnimation.ts     # 动画控制
│   │   ├── useSpeech.ts        # 语音合成
│   │   └── useDrill.ts         # 演练逻辑
│   └── utils/
│       ├── canvasHelpers.ts    # Canvas工具函数
│       ├── colorMaps.ts        # 色温映射
│       └── validators.ts       # 参数校验
├── docs/
│   └── knowledge/              # 工艺文档
│       └── fcc-process.pdf
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## 3. 功能模块设计

### 3.1 模板选择器（左侧边栏）

#### 3.1.1 功能描述

提供工业场景模板选择，支持快速切换不同实训环境。

#### 3.1.2 模板列表

| 模板 | 状态 | 场景描述 |
|------|------|----------|
| **催化裂化装置** | ✅ 可用 | 石油炼制核心工艺，包含反应器、分馏塔、加热炉等 |
| **汽车焊装车间** | ✅ 可用 | 工业机器人焊装，包含机械臂、夹具、传送带等 |
| **混合模式** | 🔒 Coming Soon | 支持自定义组合流程+离散设备 |

#### 3.1.3 交互设计

- 点击模板卡片切换场景
- 当前选中模板高亮显示（主色边框+微光效果）
- 鼠标悬停显示模板预览图和简介
- Coming Soon模板灰色显示，点击提示"敬请期待"

#### 3.1.4 视觉设计

```
模板卡片：
- 背景：#1e293b（slate-800）
- 边框：1px solid #334155（slate-700）
- 选中：2px solid #3b82f6（blue-500）+ box-shadow: 0 0 20px rgba(59,130,246,0.3)
- 悬停：边框变为 #475569（slate-600）
- 图标：48x48px，设备简笔画风格
- 标签：右上角状态徽标（可用/即将推出）
```

---

### 3.2 虚拟车间Canvas（中央区域）

#### 3.2.1 功能描述

使用Canvas 2D渲染虚拟工厂场景，包含设备、管道、动画和交互。

#### 3.2.2 渲染层级

```
Layer 0: 背景网格（点状网格，#1e293b）
Layer 1: 管道系统（静态管道 + 流动动画）
Layer 2: 设备主体（几何形状 + 渐变填充）
Layer 3: 设备状态（色温 overlay）
Layer 4: 参数标签（流量/温度/压力数值）
Layer 5: 交互层（点击检测 + 选中高亮）
Layer 6: 特效层（故障闪烁、告警脉冲）
```

#### 3.2.3 设备渲染规范

**催化裂化设备库：**

| 设备类型 | 形状 | 尺寸 | 颜色 | 状态指示 |
|----------|------|------|------|----------|
| 反应器 | 圆柱体（圆角矩形） | 80x120px | 渐变灰 | 顶部温度指示条 |
| 分馏塔 | 多层矩形堆叠 | 60x160px | 渐变蓝 | 各层温度标签 |
| 加热炉 | 圆角矩形+火焰图标 | 100x80px | 渐变橙 | 炉膛温度 |
| 换热器 | 双圆重叠 | 70x70px | 渐变绿 | 温差指示 |
| 泵 | 圆形+叶片标记 | 50x50px | 渐变蓝 | 转速动画 |
| 压缩机 | 圆形+箭头 | 60x60px | 渐变紫 | 压力指示 |
| 阀门 | 菱形 | 30x30px | 渐变灰 | 开度角度 |
| 仪表 | 圆形表盘 | 40x40px | 渐变白 | 指针角度 |

**设备状态色温映射：**

```typescript
const statusColorMap = {
  normal:    { fill: '#10b981', glow: 'rgba(16,185,129,0.3)' },   // 正常绿
  warning:   { fill: '#f59e0b', glow: 'rgba(245,158,11,0.3)' },   // 警告黄
  danger:    { fill: '#ef4444', glow: 'rgba(239,68,68,0.3)' },    // 危险红
  offline:   { fill: '#64748b', glow: 'rgba(100,116,139,0.3)' },  // 离线灰
  highlight: { fill: '#3b82f6', glow: 'rgba(59,130,246,0.5)' },   // 高亮蓝
};
```

#### 3.2.4 管道渲染规范

- 管道使用 `stroke` 绘制，线宽 4px
- 正常状态：#475569（slate-600）
- 流体动画：使用 `setLineDash` + `lineDashOffset` 实现流动效果
- 流向指示：虚线向正方向移动，速度映射流量大小
- 管道标签：显示介质名称（如"原料油"、"催化剂"）

#### 3.2.5 动画系统

```typescript
// 动画循环 60fps
class AnimationLoop {
  private animationId: number;
  private lastTime: number;
  
  start() {
    const loop = (timestamp: number) => {
      const delta = timestamp - this.lastTime;
      this.update(delta);
      this.render();
      this.lastTime = timestamp;
      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }
  
  update(delta: number) {
    // 更新管道流动偏移
    // 更新设备旋转（泵、压缩机）
    // 更新粒子位置（蒸汽、火花）
    // 更新告警脉冲效果
  }
}
```

#### 3.2.6 交互系统

- **悬停**：鼠标悬停设备显示Tooltip（设备名称+关键参数）
- **点击**：选中设备，弹出参数面板，设备外框高亮
- **拖拽**：支持画布拖拽平移（未来扩展）
- **缩放**：支持滚轮缩放（未来扩展）

**点击检测：**
```typescript
// 使用 Path2D 进行精确点击检测
const path = new Path2D();
path.rect(equipment.x, equipment.y, equipment.width, equipment.height);
const isHit = ctx.isPointInPath(path, mouseX, mouseY);
```

---

### 3.3 设备参数面板

#### 3.3.1 功能描述

点击设备后弹出参数面板，显示实时数值并支持调节。

#### 3.3.2 面板布局

```
┌─────────────────────────┐
│  [图标] 反应器 R-101     │
│  状态: ● 正常运行        │
├─────────────────────────┤
│  反应温度        485°C   │
│  [========●====]        │
│  范围: 480-520°C        │
├─────────────────────────┤
│  催化剂循环量    25 t/h  │
│  [======●======]        │
│  范围: 20-30 t/h        │
├─────────────────────────┤
│  油气比          6.5     │
│  [=======●=====]        │
│  范围: 5-8              │
├─────────────────────────┤
│  [趋势图] 最近5分钟      │
│    ∿∿∿∿∿∿∿∿∿∿          │
├─────────────────────────┤
│  [操作手册] [历史记录]   │
└─────────────────────────┘
```

#### 3.3.3 滑块设计

- 轨道背景：#334155（slate-700）
- 已填充部分：渐变（#3b82f6 → #60a5fa）
- 滑块 thumb：16px 圆形，白色，阴影
- 当前值标签：跟随 thumb 显示
- 超出正常范围时：轨道变为警告色（#f59e0b / #ef4444）

#### 3.3.4 趋势微图

- 使用 Canvas 绘制 Sparkline
- 数据：最近 60 个数据点（1秒采样）
- 正常区域：#10b981 半透明填充
- 异常区域：#ef4444 半透明填充
- 当前值指示线：垂直虚线

---

### 3.4 AI老师傅对话区（右侧边栏）

#### 3.4.1 功能描述

AI老师傅提供工艺知识问答、故障排查指导、操作评价。

#### 3.4.2 数字人头像

```
┌─────────────────────────┐
│      ┌─────────┐        │
│      │  [头像]  │        │
│      │  ◠   ◠  │        │
│      │    ▽    │        │
│      │  ═════  │        │
│      │ [指示灯] │        │
│      └─────────┘        │
│      王师傅 · 高级工艺师 │
│      [语音开关]          │
└─────────────────────────┘
```

**情绪状态系统：**

| 状态 | 指示灯 | 表情 | 触发条件 |
|------|--------|------|----------|
| 平静 | 蓝色呼吸灯 | ◠ ◠ | 默认状态 |
| 思考 | 黄色闪烁 | ◠ ◠ | 处理用户问题 |
| 告警 | 红色急促 | ◣ ◢ | 检测到故障 |
| 指导 | 绿色稳定 | ◠ ◠ | 给出操作建议 |
| 表扬 | 绿色闪烁 | ◠ ◠ | 学员操作正确 |

**CSS动画实现：**
```css
/* 呼吸灯 */
@keyframes breathe {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
/* 急促闪烁 */
@keyframes alert {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
}
/* 思考旋转 */
@keyframes think {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
```

#### 3.4.3 对话界面

```
┌─────────────────────────┐
│  [数字人头像区域]        │
├─────────────────────────┤
│  ┌─────────────────┐    │
│  │ 你好，我是王师傅 │    │
│  │ 有什么工艺问题？ │    │
│  └─────────────────┘    │
│         ↑ AI消息        │
│  ┌─────────────────┐    │
│  │ 反应器温度怎么调？│   │
│  └─────────────────┘    │
│         ↑ 用户消息      │
│  ┌─────────────────┐    │
│  │ 反应器温度建议... │   │
│  │ 控制在480-520°C  │   │
│  │ [查看设备位置]    │   │
│  └─────────────────┘    │
├─────────────────────────┤
│  📎 上传工艺文档        │
│  [输入消息...] [发送]   │
└─────────────────────────┘
```

#### 3.4.4 预置问答库（催化裂化）

```typescript
const presetQA = [
  {
    q: "催化裂化装置的主要设备有哪些？",
    a: "主要设备包括：反应器（进行裂化反应）、再生器（烧焦再生催化剂）、分馏塔（分离反应产物）、吸收稳定系统（分离液化气）、主风机（提供烧焦用空气）、气压机（压缩富气）。",
    tags: ["设备", "概述"]
  },
  {
    q: "反应温度对产品质量有什么影响？",
    a: "反应温度升高，汽油辛烷值提高，但气体产率增加；温度降低，柴油产率增加。一般控制在480-520°C，根据产品方案调整。",
    tags: ["反应器", "温度", "产品质量"]
  },
  {
    q: "催化剂循环量不足会有什么后果？",
    a: "催化剂循环量不足会导致：1) 反应深度下降，转化率降低；2) 生焦减少，再生器温度下降；3) 产品分布变差，汽油收率降低。应及时检查塞阀或滑阀开度。",
    tags: ["催化剂", "故障"]
  },
  {
    q: "分馏塔底油浆固含量高的原因？",
    a: "主要原因：1) 催化剂破碎严重；2) 油浆回流比过大；3) 分馏塔底温度过低；4) 催化剂跑损。应检查催化剂物理性质和分馏塔操作参数。",
    tags: ["分馏塔", "故障", "油浆"]
  },
  {
    q: "主风机突然停机怎么处理？",
    a: "紧急处理步骤：1) 立即切断反应器进料；2) 打开主风事故蒸汽；3) 维持催化剂流化；4) 关闭再生器塞阀；5) 通知调度。这是Ⅰ级事故，需按紧急预案执行。",
    tags: ["主风机", "紧急事故", "操作步骤"]
  }
];
```

#### 3.4.5 知识图谱联动

- AI回答中的设备名称自动高亮（如"反应器"、"分馏塔"）
- 点击高亮设备名，Canvas自动定位并选中该设备
- 设备选中后，AI自动给出该设备的当前参数和操作建议

#### 3.4.6 语音合成

```typescript
// Web Speech API
const speak = (text: string) => {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 0.9; // 稍慢，便于理解
  utterance.pitch = 1.0;
  speechSynthesis.speak(utterance);
};
```

- 默认关闭，用户手动开启
- AI发送重要消息时自动朗读（可配置）
- 故障告警时强制朗读（可关闭）

---

### 3.5 演练系统

#### 3.5.1 功能描述

模拟真实故障场景，训练学员的排查和处理能力。

#### 3.5.2 演练流程

```
1. 学员点击"开始演练"按钮
2. 系统随机选择一个故障场景
3. AI老师傅在对话区给出初始提示
4. Canvas中高亮相关设备（脉冲效果）
5. 学员查看参数面板，识别异常
6. 学员在对话区回答排查步骤
7. AI评估操作是否正确，给出反馈
8. 完成所有正确步骤后，显示评分
```

#### 3.5.3 故障库（催化裂化）

```typescript
const faultLibrary = [
  {
    id: 'F001',
    name: '反应器温度异常升高',
    description: '反应器出口温度超过520°C，触发高温报警',
    affectedEquipments: ['R-101', 'F-101'],
    symptoms: [
      { param: 'reactor_temp', value: 535, normal: '480-520' },
      { param: 'regenerator_temp', value: 720, normal: '680-700' }
    ],
    cause: '再生器催化剂循环量过大，带入过多热量',
    steps: [
      { action: '检查再生器塞阀开度', correct: true },
      { action: '降低催化剂循环量', correct: true },
      { action: '增加原料油预热温度', correct: false },
      { action: '打开反应器急冷油', correct: true }
    ],
    hints: [
      '先看看再生器的情况，催化剂循环是否正常？',
      '温度升高通常是热量失衡，想想热量从哪来的？',
      '急冷油是快速降温的有效手段'
    ]
  },
  {
    id: 'F002',
    name: '主风机流量不足',
    description: '主风机出口流量下降，再生器压力降低',
    affectedEquipments: ['K-101', 'REG-101'],
    symptoms: [
      { param: 'air_flow', value: 1200, normal: '1500-1800' },
      { param: 'regenerator_pressure', value: 0.18, normal: '0.22-0.25' }
    ],
    cause: '主风机入口过滤器堵塞或叶片磨损',
    steps: [
      { action: '检查入口过滤器压差', correct: true },
      { action: '切换备用过滤器', correct: true },
      { action: '立即停机检修', correct: false },
      { action: '降低催化剂循环量', correct: true }
    ],
    hints: [
      '流量不足先查入口，过滤器堵了吗？',
      '有备用设备就先切换，保证生产连续',
      '减少催化剂循环可以降低用风量'
    ]
  },
  {
    id: 'F003',
    name: '分馏塔冲塔',
    description: '分馏塔顶温度突升，油中带水',
    affectedEquipments: ['T-101', 'E-101'],
    symptoms: [
      { param: 'tower_top_temp', value: 145, normal: '120-130' },
      { param: 'gasoline_color', value: '浑浊', normal: '清澈' }
    ],
    cause: '塔底液位过高或蒸汽量过大',
    steps: [
      { action: '降低塔底液位', correct: true },
      { action: '减少塔底蒸汽量', correct: true },
      { action: '增加回流量', correct: true },
      { action: '提高反应深度', correct: false }
    ],
    hints: [
      '冲塔通常是气相负荷过大，查查塔底',
      '液位过高会增加蒸发量',
      '增加回流可以稳定塔顶温度'
    ]
  }
];
```

#### 3.5.4 评分系统

| 评分维度 | 权重 | 说明 |
|----------|------|------|
| 响应速度 | 20% | 从故障发生到首次正确操作的时间 |
| 操作准确性 | 40% | 正确步骤数 / 总步骤数 |
| 操作顺序 | 20% | 是否按最优顺序执行 |
| 知识掌握 | 20% | AI问答中的正确率 |

**评分等级：**
- S (90-100): 优秀操作员
- A (80-89): 合格操作员
- B (70-79): 需要加强
- C (60-69): 建议重新培训
- D (<60): 不合格

#### 3.5.5 操作回放

```typescript
interface OperationRecord {
  timestamp: number;
  action: string;
  targetEquipment: string;
  parameterChange?: { param: string; from: number; to: number };
  isCorrect: boolean;
  aiFeedback: string;
}

// 回放功能
class ReplaySystem {
  records: OperationRecord[];
  
  play() {
    // 按时间顺序重放操作
    // 高亮当前操作的设备
    // 显示AI当时的反馈
  }
}
```

---

### 3.6 顶部工具栏

#### 3.6.1 功能描述

提供全局操作入口和状态显示。

#### 3.6.2 布局

```
┌─────────────────────────────────────────────────────────┐
│  ⚙️ 匠魂实训引擎  │  [催化裂化装置]  │  🟢 系统正常  │
│                                                          │
│  [▶ 开始演练]  [⏸ 暂停]  [🔄 重置]  │  📊 历史记录  │
│                                                          │
│  [🔊 语音]  [🌙 主题]  [❓ 帮助]  │  👤 学员: 张三 │
└─────────────────────────────────────────────────────────┘
```

#### 3.6.3 按钮状态

- **开始演练**：默认显示，点击后变为"结束演练"
- **暂停**：演练进行中可用
- **重置**：恢复初始状态
- **语音开关**：控制AI语音输出

---

## 4. 数据流设计

### 4.1 初始化流程

```
1. 用户选择模板（如"催化裂化"）
2. uiStore 更新 activeTemplate = 'fcc'
3. equipmentStore 加载 fcc/config.ts 中的设备定义
4. Canvas 根据布局定义渲染设备和管道
5. aiStore 加载 fcc/knowledge.ts 中的知识库
6. drillStore 加载 fcc/faults.ts 中的故障库
7. 启动动画循环
```

### 4.2 设备交互流程

```
1. 用户点击Canvas上的设备
2. InteractionHandler 检测到点击，获取设备ID
3. uiStore 更新 selectedEquipmentId
4. ParameterPanel 订阅 selectedEquipmentId，显示对应参数
5. 用户拖动滑块调节参数
6. equipmentStore 更新参数值
7. Canvas 重新渲染设备状态（色温变化）
8. 如果参数超出正常范围，触发告警
9. aiStore 添加告警消息，数字人变为告警状态
```

### 4.3 演练流程

```
1. 用户点击"开始演练"
2. drillStore 随机选择故障
3. uiStore 显示故障指示器
4. equipmentStore 更新故障设备的参数值
5. Canvas 高亮故障设备（红色脉冲）
6. aiStore 发送初始提示消息
7. 数字人变为告警状态
8. 用户查看参数，识别异常
9. 用户在AI对话框输入排查步骤
10. aiStore 匹配预设答案，评估正确性
11. 如果正确，给出下一步提示；如果错误，给出纠正
12. 完成所有步骤后，计算评分
13. 显示评分面板和操作回放
```

---

## 5. 视觉设计规范

### 5.1 色彩系统

```css
:root {
  /* 背景 */
  --bg-primary: #0f172a;      /* slate-900 */
  --bg-secondary: #1e293b;    /* slate-800 */
  --bg-tertiary: #334155;     /* slate-700 */
  
  /* 主色 */
  --primary: #3b82f6;         /* blue-500 */
  --primary-light: #60a5fa;   /* blue-400 */
  --primary-dark: #2563eb;    /* blue-600 */
  
  /* 状态色 */
  --success: #10b981;         /* emerald-500 */
  --warning: #f59e0b;         /* amber-500 */
  --danger: #ef4444;          /* red-500 */
  --info: #06b6d4;            /* cyan-500 */
  
  /* 文字 */
  --text-primary: #f1f5f9;    /* slate-100 */
  --text-secondary: #94a3b8;  /* slate-400 */
  --text-muted: #64748b;      /* slate-500 */
  
  /* 边框 */
  --border: #334155;          /* slate-700 */
  --border-light: #475569;    /* slate-600 */
}
```

### 5.2 字体规范

- **标题**：Inter, 18px, font-weight 600
- **正文**：Inter, 14px, font-weight 400
- **标签**：Inter, 12px, font-weight 500, uppercase
- **数值**：Roboto Mono, 16px, font-weight 500（等宽字体，对齐数值）

### 5.3 间距规范

- 卡片内边距：16px
- 卡片间距：12px
- 边栏宽度：280px
- 顶部栏高度：56px
- 圆角：8px（卡片），4px（按钮），50%（头像）

### 5.4 阴影与光效

```css
/* 卡片阴影 */
--shadow-card: 0 4px 6px -1px rgba(0,0,0,0.3);

/* 选中光晕 */
--glow-primary: 0 0 20px rgba(59,130,246,0.3);
--glow-danger: 0 0 20px rgba(239,68,68,0.3);

/* 告警脉冲 */
@keyframes pulse-danger {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
  50% { box-shadow: 0 0 0 10px rgba(239,68,68,0); }
}
```

---

## 6. 性能优化

### 6.1 Canvas渲染优化

- **分层渲染**：静态层（设备、管道）缓存为离屏Canvas
- **脏矩形检测**：只重绘变化区域
- **对象池**：复用粒子对象，避免GC
- **节流**：参数更新节流为100ms

### 6.2 状态更新优化

- Zustand 使用 selector 避免不必要的重渲染
- 参数更新使用 transient updates（不触发React渲染）
- 趋势图数据使用环形缓冲区，固定长度60

### 6.3 加载优化

- 模板配置按需加载（动态 import）
- 设备图标使用 SVG sprite
- 工艺文档PDF使用懒加载

---

## 7. 扩展性设计

### 7.1 新增模板

新增工业场景只需创建以下文件：
```
templates/<template-name>/
  ├── config.ts       # 设备定义
  ├── layout.ts       # 布局定义
  ├── faults.ts       # 故障库
  └── knowledge.ts    # 知识库
```

### 7.2 接入真实AI

当前使用预置问答库，架构预留了AI接口：
```typescript
interface AIService {
  ask(question: string, context: KnowledgeItem[]): Promise<string>;
  evaluateStep(step: string, fault: Fault): Promise<boolean>;
  generateHint(fault: Fault, progress: number): Promise<string>;
}

// 模拟实现
class MockAIService implements AIService { ... }

// 真实实现（未来接入OpenAI/Claude）
class OpenAIService implements AIService { ... }
```

### 7.3 多人协同（未来扩展）

- 使用 WebSocket 实现实时同步
- 角色分工：操作员、班长、工程师
- 操作权限控制

---

## 8. 实现优先级

### Phase 1: 核心框架（MVP）
- [ ] 项目脚手架搭建
- [ ] Zustand状态管理
- [ ] 主布局组件
- [ ] Canvas基础渲染
- [ ] 模板选择器

### Phase 2: 流程制造模板
- [ ] 催化裂化设备库
- [ ] 管道系统
- [ ] 参数面板
- [ ] 设备交互

### Phase 3: AI老师傅
- [ ] 数字人头像
- [ ] 对话界面
- [ ] 预置问答库
- [ ] 语音合成

### Phase 4: 演练系统
- [ ] 故障库
- [ ] 演练流程
- [ ] 评分系统
- [ ] 操作回放

### Phase 5: 增强功能
- [ ] 趋势图
- [ ] 操作手册悬浮提示
- [ ] 主动式预警
- [ ] 知识图谱联动

### Phase 6: 离散制造模板
- [ ] 焊装车间设备库
- [ ] 静态展示

---

## 9. 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Canvas性能不足 | 中 | 分层渲染、脏矩形检测、对象池 |
| 移动端兼容性 | 低 | 本项目主要面向桌面端实训 |
| 语音API不支持 | 低 | 提供降级方案，文字提示 |
| 状态管理复杂 | 中 | Zustand分片，严格类型约束 |
| 模板配置繁琐 | 低 | 提供配置生成工具（未来） |

---

## 10. 附录

### 10.1 术语表

| 术语 | 说明 |
|------|------|
| FCC | Fluid Catalytic Cracking，催化裂化 |
| HMI | Human Machine Interface，人机界面 |
| DCS | Distributed Control System，集散控制系统 |
| RAG | Retrieval-Augmented Generation，检索增强生成 |
| Agent | 智能体，能自主决策的AI系统 |

### 10.2 参考资源

- [催化裂化工艺流程图](https://example.com/fcc-process)
- [工业HMI设计规范](https://example.com/hmi-design)
- [Canvas 2D最佳实践](https://example.com/canvas-best-practices)

---

> **文档状态**: 已完成设计，待进入实现阶段  
> **下一步**: 创建实现计划 (writing-plans)
