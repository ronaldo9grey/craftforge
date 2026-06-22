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
      ctx.fillText('v7 welding', w - 30, h - 8);

      // 安全通道（黄虚线 y=415，已与上下设备拉开 90px+ 间距）
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(20, 415);
      ctx.lineTo(w - 20, 415);
      ctx.stroke();
      ctx.setLineDash([]);

      // 工区标签
      ctx.fillStyle = '#475569';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('▎ 物流/安全通道', 25, 420);
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
