import { useRef, useEffect, useCallback } from 'react';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useUIStore } from '@/stores/uiStore';
import { useDrillStore } from '@/stores/drillStore';
import { EquipmentRenderer } from './EquipmentRenderer';
import { PipelineRenderer } from './PipelineRenderer';
import type { Equipment } from '@/types';

// 设计分辨率：从场景注册中心读取（templates/<id>/meta.ts）
// 这样新增场景只需新建 meta.ts，FactoryCanvas 无需任何改动
import { getSceneMeta } from '@/templates';
const FALLBACK_DESIGN_SIZE = { width: 1200, height: 680 };

export const FactoryCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const flowOffsetRef = useRef<number>(0);
  const scaleRef = useRef<number>(1);
  const offsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const equipments = useEquipmentStore((state) => state.equipments);
  const pipelines = useEquipmentStore((state) => state.pipelines);
  const selectedEquipmentId = useUIStore((state) => state.selectedEquipmentId);
  const selectEquipment = useUIStore((state) => state.selectEquipment);
  const activeTemplate = useUIStore((state) => state.activeTemplate);
  const isDrillRunning = useDrillStore((state) => state.isRunning);
  const currentFault = useDrillStore((state) => state.currentFault);

  // 当前场景的设计尺寸（从注册中心读取）
  const designSize = getSceneMeta(activeTemplate ?? 'fcc')?.designSize ?? FALLBACK_DESIGN_SIZE;

  // 计算自适应缩放 - 使用统一的缩放比例，保持设备不变形
  const calculateScale = useCallback((canvasWidth: number, canvasHeight: number): { scale: number; offsetX: number; offsetY: number } => {
    if (equipments.length === 0) return { scale: 1, offsetX: 0, offsetY: 0 };

    // 使用统一的缩放比例，保持宽高比；预留 20px 内边距
    const padding = 20;
    const scaleX = (canvasWidth - padding * 2) / designSize.width;
    const scaleY = (canvasHeight - padding * 2) / designSize.height;
    const scale = Math.min(scaleX, scaleY);

    // 计算偏移使内容居中
    const contentWidth = designSize.width * scale;
    const contentHeight = designSize.height * scale;
    const offsetX = (canvasWidth - contentWidth) / 2;
    const offsetY = (canvasHeight - contentHeight) / 2;

    return { scale, offsetX, offsetY };
  }, [equipments, designSize]);

  const getEquipmentAtPosition = useCallback((x: number, y: number): Equipment | null => {
    const scale = scaleRef.current;
    const offset = offsetRef.current;

    // 将屏幕坐标转换为设计坐标
    const designX = (x - offset.x) / scale;
    const designY = (y - offset.y) / scale;

    for (let i = equipments.length - 1; i >= 0; i--) {
      const eq = equipments[i];
      if (designX >= eq.x && designX <= eq.x + eq.width &&
          designY >= eq.y && designY <= eq.y + eq.height) {
        return eq;
      }
    }
    return null;
  }, [equipments]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const equipment = getEquipmentAtPosition(x, y);
    if (equipment) {
      selectEquipment(equipment.id);
    } else {
      selectEquipment(null);
    }
  }, [getEquipmentAtPosition, selectEquipment]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const equipment = getEquipmentAtPosition(x, y);
    canvas.style.cursor = equipment ? 'pointer' : 'default';
  }, [getEquipmentAtPosition]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;

        // 重新计算缩放
        const { scale, offsetX, offsetY } = calculateScale(canvas.width, canvas.height);
        scaleRef.current = scale;
        offsetRef.current = { x: offsetX, y: offsetY };
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const animate = () => {
      if (!ctx || !canvas) return;

      // 🔍 版本标记：检查浏览器是否加载了最新代码
      // 如果控制台没有这条日志，说明浏览器用了缓存
      const WELDING_ROB3_Y = 440;
      const WELDING_CTRL_Y = 610;
      if (activeTemplate === 'welding') {
        const rob3 = equipments.find(e => e.id === 'ROB-103');
        const ctrl = equipments.find(e => e.id === 'CTRL-101');
        if (rob3 && ctrl) {
          if (rob3.y !== WELDING_ROB3_Y || ctrl.y !== WELDING_CTRL_Y) {
            console.warn(
              `[FactoryCanvas] ⚠️ 坐标异常！期望 ROB-103.y=${WELDING_ROB3_Y} 实际=${rob3.y}, CTRL-101.y=${WELDING_CTRL_Y} 实际=${ctrl.y}`
            );
          }
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 绘制背景
      drawBackground(ctx, canvas.width, canvas.height);

      // 保存上下文并应用缩放
      ctx.save();
      ctx.translate(offsetRef.current.x, offsetRef.current.y);
      ctx.scale(scaleRef.current, scaleRef.current);

      // 在 design 坐标系下绘制地面网格 / 工区 / 安全通道
      drawDesignArea(ctx);

      // 更新流动偏移
      flowOffsetRef.current += 0.5;

      // 绘制管道
      PipelineRenderer.render(ctx, pipelines, flowOffsetRef.current);

      // 绘制设备（把 flowOffset 当作动画时间相位传入，驱动机器人/传送带动画）
      equipments.forEach((equipment) => {
        const isSelected = equipment.id === selectedEquipmentId;
        const isFaulty = !!(isDrillRunning && currentFault?.affectedEquipments.includes(equipment.id));
        EquipmentRenderer.render(ctx, equipment, isSelected, isFaulty, flowOffsetRef.current);
      });

      ctx.restore();

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationRef.current);
    };
  }, [equipments, pipelines, selectedEquipmentId, isDrillRunning, currentFault, calculateScale, activeTemplate, designSize]);

  const drawBackground = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // 填充画布外深色底（设备区外部）
    ctx.fillStyle = '#0a0f1c';
    ctx.fillRect(0, 0, width, height);
  };

  /**
   * 在 design 坐标系（缩放/位移已经应用）下绘制工厂地面：
   * 1. 工区底色（亮一点，区分场外深色）
   * 2. 大格 100px / 小格 25px 网格线，类似车间地砖
   * 3. 工区外边框 + 四角"L"型加重，模拟划线区
   * 4. 焊装场景额外画虚线"安全通道"
   */
  const drawDesignArea = (ctx: CanvasRenderingContext2D) => {
    const w = designSize.width;
    const h = designSize.height;

    // 工区底色（比场外略亮，模拟地坪漆）
    ctx.fillStyle = '#111c30';
    ctx.fillRect(0, 0, w, h);

    // 小格网格（25px，浅色）
    ctx.strokeStyle = '#1a2740';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 25) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = 0; y <= h; y += 25) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    // 大格网格（100px，重一点）
    ctx.strokeStyle = '#243352';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 100) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = 0; y <= h; y += 100) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    // 工区外边框
    ctx.strokeStyle = '#3b4b7a';
    ctx.lineWidth = 2;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    // 四角加重 L 型角标
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 3;
    const corner = 24;
    // 左上
    ctx.beginPath(); ctx.moveTo(0, corner); ctx.lineTo(0, 0); ctx.lineTo(corner, 0); ctx.stroke();
    // 右上
    ctx.beginPath(); ctx.moveTo(w - corner, 0); ctx.lineTo(w, 0); ctx.lineTo(w, corner); ctx.stroke();
    // 左下
    ctx.beginPath(); ctx.moveTo(0, h - corner); ctx.lineTo(0, h); ctx.lineTo(corner, h); ctx.stroke();
    // 右下
    ctx.beginPath(); ctx.moveTo(w - corner, h); ctx.lineTo(w, h); ctx.lineTo(w, h - corner); ctx.stroke();

    // 焊装场景额外画安全通道 + 控制柜区底色分隔
    if (activeTemplate === 'welding') {
      // 控制柜区域浅底色（紧凑型：y=580 起，仅 120px 高）
      ctx.fillStyle = '#0a1629';
      ctx.fillRect(0, 580, w, h - 580);

      // 🎯 版本水印
      ctx.fillStyle = '#22d3ee';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('v8.2 welding', w - 30, h - 8);

      // 安全通道（黄虚线 y=395，再下移 30px 以彻底避开上方主输送线设备文字）
      // 主输送线底 320 → 黄虚线 395：75px 净距
      // 黄虚线 395 → 下排机器人 440：45px 净距
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(20, 395);
      ctx.lineTo(w - 20, 395);
      ctx.stroke();
      ctx.setLineDash([]);

      // 工区标签
      ctx.fillStyle = '#475569';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('▎ 物流/安全通道', 25, 400);
      ctx.fillText('▎ 控制区', 25, 588);
    }

    // CNC 场景：4 大功能分区底色 + 区域标签
    if (activeTemplate === 'cnc') {
      // 区域 1：加工区（y=90~270）- 浅紫
      ctx.fillStyle = 'rgba(167, 139, 250, 0.06)';
      ctx.fillRect(0, 90, w, 180);
      // 区域 2：物流主线区（y=280~390）- 浅青
      ctx.fillStyle = 'rgba(34, 211, 238, 0.06)';
      ctx.fillRect(0, 280, w, 110);
      // 区域 3：辅助系统区（y=410~520）- 浅蓝灰
      ctx.fillStyle = 'rgba(100, 116, 139, 0.10)';
      ctx.fillRect(0, 410, w, 110);
      // 区域 4：电气控制区（y=560~660）- 暗蓝
      ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
      ctx.fillRect(0, 560, w, 100);

      // 区域分隔细虚线
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      [275, 400, 550].forEach((yy) => {
        ctx.beginPath();
        ctx.moveTo(20, yy);
        ctx.lineTo(w - 20, yy);
        ctx.stroke();
      });
      ctx.setLineDash([]);

      // 区域标签（左侧浅色文字）
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('▎ 加工区', 25, 100);
      ctx.fillText('▎ 物流主线', 25, 282);
      ctx.fillText('▎ 辅助系统', 25, 412);
      ctx.fillText('▎ 电气控制', 25, 562);

      // 物料流主方向箭头提示（在物流区右上角画一个大箭头说明）
      ctx.strokeStyle = '#22d3ee';
      ctx.fillStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('物料流向 →', w - 30, 286);

      // 🎯 版本水印
      ctx.fillStyle = '#a78bfa';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('v2 cnc', w - 30, h - 8);
    }

    // 注塑场景：4 大功能分区底色 + 区域标签 (v3 布局)
    if (activeTemplate === 'injection') {
      // 区域 1：主机区（y=40~245）- 浅琥珀（呼应注塑机熔融塑料颜色）
      ctx.fillStyle = 'rgba(245, 158, 11, 0.07)';
      ctx.fillRect(0, 40, w, 205);
      // 区域 2：物流主线区（y=250~375）- 浅青
      ctx.fillStyle = 'rgba(34, 211, 238, 0.07)';
      ctx.fillRect(0, 250, w, 125);
      // 区域 3：辅助系统区（y=380~540）- 浅蓝灰
      ctx.fillStyle = 'rgba(100, 116, 139, 0.12)';
      ctx.fillRect(0, 380, w, 160);
      // 区域 4：电气控制区（y=560~665）- 暗蓝
      ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
      ctx.fillRect(0, 560, w, 105);

      // 区域分隔细虚线（在区间之间画明显分隔线）
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      [247, 377, 555].forEach((yy) => {
        ctx.beginPath();
        ctx.moveTo(10, yy);
        ctx.lineTo(w - 10, yy);
        ctx.stroke();
      });
      ctx.setLineDash([]);

      // 区域标签（左侧浅色文字）
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('▎ 主机区', 15, 50);
      ctx.fillText('▎ 物流主线', 15, 255);
      ctx.fillText('▎ 辅助系统', 15, 385);
      ctx.fillText('▎ 电气控制', 15, 565);

      // 物料流主方向箭头提示
      ctx.fillStyle = '#22d3ee';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('原料 → 干燥 → 注塑 → 模具 → 检测 → 下料', w - 30, 255);

      // 🎯 版本水印
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('v5 injection', w - 30, h - 8);
    }

    // 铝电解场景 v3：电解车间沉浸式专属视觉 - 厂房屋顶 + 5 区域底色 + 氛围灯光
    if (activeTemplate === 'aluminum') {
      // ---- (0) 厂房整体深色底（车间夜间集控大屏感）----
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0c1424');
      grad.addColorStop(0.5, '#0a0f1c');
      grad.addColorStop(1, '#0e1828');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // ---- (1) 厂房屋顶钢架轮廓（顶部 y=20~50 区域）----
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      // 屋顶主轮廓（人字坡）
      ctx.beginPath();
      ctx.moveTo(10, 50);
      ctx.lineTo(w / 2, 18);
      ctx.lineTo(w - 10, 50);
      ctx.stroke();
      // 屋顶桁架斜线
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      for (let tx = 60; tx < w - 60; tx += 80) {
        ctx.beginPath();
        ctx.moveTo(tx, 50);
        ctx.lineTo(tx + 40, 30);
        ctx.stroke();
      }
      // 两侧立柱
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(15, 50); ctx.lineTo(15, h - 30);
      ctx.moveTo(w - 15, 50); ctx.lineTo(w - 15, h - 30);
      ctx.stroke();

      // ---- (1.5) 屋顶水平烟道（横管）+ 两条竖管引自 2 槽 + 右侧出口"→ 净化车间" ----
      const flueY = 32;          // 烟道在屋顶下方
      // 水平烟道主管（深绿色，区分氧化铝管）
      ctx.fillStyle = '#15803d';
      ctx.strokeStyle = '#052e16';
      ctx.lineWidth = 1;
      ctx.fillRect(280, flueY - 4, w - 280 - 50, 8);
      ctx.strokeRect(280, flueY - 4, w - 280 - 50, 8);
      // 内部流动虚线（浅绿走马灯）
      const animTNow = Date.now() / 1000;
      ctx.setLineDash([6, 8]);
      ctx.lineDashOffset = -animTNow * 8;
      ctx.strokeStyle = '#86efac';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(285, flueY);
      ctx.lineTo(w - 55, flueY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      // 2 个分支竖管（连到 2 槽顶部烟道）
      const flueDownXs = [30 + 290, 650 + 290];  // 2 槽 x 中心
      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 5;
      flueDownXs.forEach((cx) => {
        ctx.beginPath();
        ctx.moveTo(cx, flueY + 4);
        ctx.lineTo(cx, 120);  // 到槽顶集烟罩
        ctx.stroke();
      });
      // 右侧出口箭头 + 标签 "→ 净化车间（厂房外）"
      ctx.fillStyle = '#86efac';
      ctx.beginPath();
      ctx.moveTo(w - 50, flueY - 8);
      ctx.lineTo(w - 40, flueY);
      ctx.lineTo(w - 50, flueY + 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#86efac';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText('→ 烟气净化（车间外）', w - 60, flueY - 12);
      // 烟道左端标签
      ctx.fillStyle = '#86efac';
      ctx.textAlign = 'left';
      ctx.fillText('车间集烟主管', 285, flueY - 12);

      // ---- (2) 区域底色（v6 布局：2 槽 600 kA + 控制层）----
      // 行 1 电解车间核心区（y=105~495，含 2 槽 + 2 槽控柜）- 深青
      ctx.fillStyle = 'rgba(6, 182, 212, 0.06)';
      ctx.fillRect(0, 105, w, 390);
      // 阴极母线区（y=500~520）- 金黄淡底
      ctx.fillStyle = 'rgba(250, 204, 21, 0.06)';
      ctx.fillRect(0, 500, w, 20);
      // 控制层（y=525~610）
      ctx.fillStyle = 'rgba(168, 85, 247, 0.06)';
      ctx.fillRect(0, 525, w, 85);
      // 总控（y=615~680）
      ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
      ctx.fillRect(0, 615, w, 65);

      // ---- (2.5) 氧化铝输送管道：水平主管 + 2 个分支竖管（连到 2 槽顶部）----
      const pipeY = 105;
      const pipeGrad = ctx.createLinearGradient(0, pipeY - 3, 0, pipeY + 6);
      pipeGrad.addColorStop(0, '#cbd5e1');
      pipeGrad.addColorStop(0.5, '#94a3b8');
      pipeGrad.addColorStop(1, '#475569');
      ctx.fillStyle = pipeGrad;
      ctx.fillRect(30, pipeY - 3, w - 60, 8);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.strokeRect(30, pipeY - 3, w - 60, 8);
      // 2 个分支竖管（连到 2 槽顶部 x 中心）
      const cellXCenters = [30 + 290, 650 + 290];
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 5;
      cellXCenters.forEach((cx) => {
        ctx.beginPath();
        ctx.moveTo(cx, pipeY + 5);
        ctx.lineTo(cx, 120);
        ctx.stroke();
      });
      // 输送方向箭头 + 标签
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(40, pipeY - 8);
      ctx.lineTo(50, pipeY - 8);
      ctx.lineTo(45, pipeY - 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('氧化铝粉气力输送管 ⟶', 55, pipeY - 4);

      // ---- (2.6) 阴极母线（金黄粗条贯穿 2 槽底部）----
      const busY = 505;
      ctx.fillStyle = '#facc15';
      ctx.fillRect(30, busY, w - 60, 8);
      ctx.strokeStyle = '#a16207';
      ctx.lineWidth = 1;
      ctx.strokeRect(30, busY, w - 60, 8);
      // 接地三角
      ctx.fillStyle = '#94a3b8';
      [40, w - 50].forEach((bx) => {
        ctx.beginPath();
        ctx.moveTo(bx, busY + 10);
        ctx.lineTo(bx + 10, busY + 10);
        ctx.lineTo(bx + 5, busY + 18);
        ctx.closePath();
        ctx.fill();
      });
      // 母线标签
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText('━━ 阴极母线 600 kA ━━', w - 70, busY + 4);

      // ---- (3) 灯光氛围：槽阵列区橙红泛光 ----
      const cellGlow = ctx.createRadialGradient(w / 2, 270, 100, w / 2, 270, 700);
      cellGlow.addColorStop(0, 'rgba(249, 115, 22, 0.18)');
      cellGlow.addColorStop(0.5, 'rgba(249, 115, 22, 0.08)');
      cellGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = cellGlow;
      ctx.fillRect(0, 110, w, 410);

      // ---- (4) 地面网格 ----
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.18)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 6]);
      [495, 525, 615, 675].forEach((yy) => {
        ctx.beginPath();
        ctx.moveTo(15, yy);
        ctx.lineTo(w - 15, yy);
        ctx.stroke();
      });
      ctx.setLineDash([]);

      // ---- (5) 区域标签 ----
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('▎ 电解车间 (2 × 600 kA 槽)', 22, 113);
      ctx.fillText('▎ 控制层', 22, 528);
      ctx.fillText('▎ 总控', 22, 623);

      // ---- (6) 关键数据指标（顶部状态条）----
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(w - 250, 100, 240, 18);
      ctx.strokeStyle = '#06b6d4';
      ctx.strokeRect(w - 250, 100, 240, 18);
      ctx.fillStyle = '#06b6d4';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('系列电流 600 kA / 母线电压 1660 V', w - 244, 112);

      // ---- (7) 物料流向 ----
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('氧化铝粉 → 电解 → 铝水 → 抬包 → 出铝口', w - 25, 240);

      // ---- (8) 版本水印 ----
      ctx.fillStyle = '#06b6d4';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('v7 aluminum  (屋顶烟道+单排阳极+大任务台)', w - 30, h - 8);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handleCanvasClick}
      onMouseMove={handleMouseMove}
      className="w-full h-full"
      style={{ background: '#0f172a' }}
    />
  );
};
