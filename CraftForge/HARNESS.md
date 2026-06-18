# CraftForge 匠魂实训引擎 - Harness 迭代管理文档

> **版本**: v1.0  
> **日期**: 2026-06-17  
> **状态**: 开发中  
> **方法论**: Harness-Driven Development (HDD)

---

## 1. Harness 方法论概述

### 1.1 什么是 Harness

Harness（挽具/框架）是一种**结构化迭代管理方法**，确保：
- ✅ 每次迭代有明确的目标和验收标准
- ✅ 代码变更可追溯、可回滚
- ✅ 知识（上下文）在迭代间完整传递
- ✅ 多人协作时减少冲突和重复工作

### 1.2 Harness 核心原则

| 原则 | 说明 |
|------|------|
| **版本锚定** | 每次迭代产生一个可运行的版本 |
| **变更清单** | 所有修改必须记录在 Harness 文档中 |
| **验收标准** | 每个功能必须有明确的测试/验证方式 |
| **知识沉淀** | 设计决策、技术选型必须文档化 |
| **回滚能力** | 保留上一个稳定版本的完整状态 |

---

## 2. 项目 Harness 结构

```
CraftForge/
├── HARNESS.md              # 本文件：迭代总览
├── docs/
│   ├── design/             # 设计文档
│   │   └── v1.0-spec.md    # v1.0 设计规格
│   ├── iterations/         # 迭代记录
│   │   ├── iter-001.md     # 迭代1：MVP框架
│   │   ├── iter-002.md     # 迭代2：故障演练系统
│   │   └── iter-003.md     # 迭代3：Canvas自适应
│   └── decisions/          # 技术决策记录
│       └── adr-001.md      # 架构决策记录
├── src/                    # 源代码
├── dist/                   # 构建输出
└── tests/                  # 测试用例
```

---

## 3. 迭代历史

### 迭代 001：MVP 核心框架 ✅

**日期**: 2026-06-17  
**目标**: 搭建项目基础框架，实现核心功能模块  
**状态**: 已完成

**功能清单**:
- [x] React + Vite + TypeScript 项目脚手架
- [x] Zustand 状态管理（4个store）
- [x] Tailwind CSS 暗色工业风主题
- [x] 左侧模板选择器（3个模板）
- [x] 中央 Canvas 2D 虚拟车间
- [x] 右侧 AI 老师傅对话区（含数字人）
- [x] 设备参数面板（滑块+趋势图）
- [x] 顶部工具栏

**验收标准**:
- [x] `npm run build` 构建成功
- [x] 页面加载无报错
- [x] 模板切换正常
- [x] 设备点击弹出参数面板

**已知问题**:
- 故障演练系统逻辑不完整
- Canvas 设备显示太小

---

### 迭代 002：故障演练系统修复 ✅

**日期**: 2026-06-17  
**目标**: 修复故障演练交互逻辑，完善评分系统  
**状态**: 已完成

**变更清单**:
- [x] 修复 `TopBar.tsx` 演练按钮逻辑
- [x] 修复 `drillStore.ts` 状态管理
- [x] 新增 `ScoreBoard.tsx` 评分面板组件
- [x] 修复故障触发后设备状态更新
- [x] 修复参数异常值设置
- [x] 新增 AI 故障提示消息

**验收标准**:
- [x] 点击"开始演练"触发随机故障
- [x] 故障设备变红闪烁
- [x] AI 发送故障提示
- [x] 点击"结束演练"显示评分面板
- [x] 评分面板显示 S/A/B/C/D 等级

**测试记录**:
- 本地运行: `npm run dev` ✅
- 构建测试: `npm run build` ✅

---

### 迭代 003：Canvas 自适应缩放 ✅

**日期**: 2026-06-17  
**目标**: 修复 Canvas 设备显示比例问题  
**状态**: 已完成

**变更清单**:
- [x] 新增 `calculateScale` 自适应算法
- [x] 修复 `getEquipmentAtPosition` 坐标转换
- [x] 新增 `scaleRef` 和 `offsetRef` 状态
- [x] 修复动画循环中的缩放应用

**验收标准**:
- [x] 设备自适应画布大小
- [x] 设备居中显示
- [x] 点击交互精度正常
- [x] 窗口缩放后自动调整

---

## 4. 当前状态

### 4.1 版本信息

| 属性 | 值 |
|------|-----|
| 当前版本 | v1.0.2 |
| 最新迭代 | iter-003 |
| 构建状态 | ✅ 成功 |
| 部署状态 | ✅ 已部署到 123.207.74.78:8088 |

### 4.2 功能矩阵

| 功能模块 | 状态 | 迭代 | 备注 |
|----------|------|------|------|
| 模板选择器 | ✅ | iter-001 | 3个模板 |
| Canvas渲染 | ✅ | iter-003 | 自适应缩放 |
| 设备参数面板 | ✅ | iter-001 | 滑块+趋势图 |
| AI老师傅 | ✅ | iter-001 | 数字人+语音 |
| 故障演练 | ✅ | iter-002 | 含评分系统 |
| 评分面板 | ✅ | iter-002 | S/A/B/C/D |
| 语音合成 | ✅ | iter-001 | Web Speech API |

---

## 5. 待办事项 (Backlog)

### 高优先级

- [ ] **iter-004**: 接入真实 LLM API（OpenAI/Claude）
  - 目标: 替换模拟AI，实现智能问答
  - 验收: AI能回答未预置的问题

- [ ] **iter-005**: 多人协同演练
  - 目标: 支持多用户同时演练
  - 验收: 2个用户同时在线，状态同步

### 中优先级

- [ ] **iter-006**: 新增工业模板
  - 目标: 添加石化、电力等模板
  - 验收: 至少新增2个模板

- [ ] **iter-007**: 操作手册悬浮提示
  - 目标: 鼠标悬停显示设备操作说明
  - 验收: 所有设备都有提示

### 低优先级

- [ ] **iter-008**: 数据持久化
  - 目标: 保存演练历史到本地存储
  - 验收: 刷新页面后历史保留

---

## 6. 技术决策记录 (ADR)

### ADR-001: Canvas 2D vs WebGL

**日期**: 2026-06-17  
**决策**: 使用原生 Canvas 2D API  
**原因**:
- 工业HMI本身就是2D平面图
- 加载速度快（无需WebGL初始化）
- 浏览器兼容性更好
- 本项目不需要3D效果

**替代方案**: PixiJS、Three.js  
**影响**: 未来如需3D设备拆解，需迁移到WebGL

---

### ADR-002: Zustand vs Redux

**日期**: 2026-06-17  
**决策**: 使用 Zustand  
**原因**:
- 轻量级，无需Provider包裹
- TypeScript支持更好
- 代码更少，维护简单
- 支持分片存储

**替代方案**: Redux Toolkit、Jotai  
**影响**: 状态逻辑集中在stores目录

---

### ADR-003: 模拟AI vs 真实LLM

**日期**: 2026-06-17  
**决策**: 先使用模拟AI，架构预留真实API  
**原因**:
- 演示场景需要稳定可控的回答
- 避免API密钥泄露风险
- 网络不稳定时仍可演示

**替代方案**: 直接接入OpenAI API  
**影响**: 未来切换只需实现AIService接口

---

## 7. 回归测试清单

每次迭代后必须执行的测试：

```markdown
- [ ] 构建测试: `npm run build` 无错误
- [ ] 启动测试: `npm run dev` 正常启动
- [ ] 模板切换: 3个模板都能正常加载
- [ ] 设备点击: 点击设备弹出参数面板
- [ ] 参数调节: 滑块调节后数值更新
- [ ] AI对话: 输入问题得到回答
- [ ] 故障演练: 开始→触发故障→结束→显示评分
- [ ] Canvas缩放: 窗口缩放后设备自适应
- [ ] 响应式: 不同屏幕尺寸正常显示
```

---

## 8. 部署记录

| 版本 | 日期 | 部署方式 | 状态 |
|------|------|----------|------|
| v1.0.0 | 2026-06-17 | 手动部署 | ✅ |
| v1.0.1 | 2026-06-17 | 安全脚本 | ✅ |
| v1.0.2 | 2026-06-17 | 待部署 | 🔄 |

---

## 9. 知识沉淀

### 9.1 关键代码片段

**Canvas自适应缩放**:
```typescript
const calculateScale = (canvasWidth: number, canvasHeight: number) => {
  // 计算所有设备的边界框
  let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
  equipments.forEach(eq => {
    minX = Math.min(minX, eq.x);
    minY = Math.min(minY, eq.y);
    maxX = Math.max(maxX, eq.x + eq.width);
    maxY = Math.max(maxY, eq.y + eq.height);
  });
  
  const scaleX = (canvasWidth * 0.8) / (maxX - minX);
  const scaleY = (canvasHeight * 0.8) / (maxY - minY);
  return Math.min(scaleX, scaleY, 1.5);
};
```

**故障演练触发**:
```typescript
const handleStartDrill = () => {
  startDrill();
  const fault = useDrillStore.getState().currentFault;
  if (fault) {
    fault.affectedEquipments.forEach(eqId => {
      setEquipmentStatus(eqId, 'danger');
    });
  }
};
```

### 9.2 常见问题

**Q: Canvas设备点击不准确？**  
A: 检查坐标转换公式：`(screenX - offset.x) / scale`

**Q: 故障演练不触发？**  
A: 确保 `startDrill()` 后使用 `setTimeout` 获取最新状态

**Q: 构建失败？**  
A: 检查 `tsconfig.json` 中的 `ignoreDeprecations` 设置

---

## 10. 迭代启动模板

新建迭代时，复制以下模板：

```markdown
### 迭代 XXX：[迭代名称]

**日期**: YYYY-MM-DD  
**目标**: [一句话描述目标]  
**状态**: [进行中/已完成/已取消]

**变更清单**:
- [ ] [具体修改1]
- [ ] [具体修改2]

**验收标准**:
- [ ] [验收条件1]
- [ ] [验收条件2]

**测试记录**:
- 本地运行: [结果]
- 构建测试: [结果]

**已知问题**:
- [问题描述]

**回滚方案**:
- 上一个稳定版本: [版本号]
- 回滚命令: [命令]
```

---

> **Harness 维护者**: AI Assistant  
> **最后更新**: 2026-06-17  
> **下次评审**: 待安排
