import { useRef, useEffect, useCallback } from 'react';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useUIStore } from '@/stores/uiStore';
import { useDrillStore } from '@/stores/drillStore';
import { EquipmentRenderer } from './EquipmentRenderer';
import { PipelineRenderer } from './PipelineRenderer';
import type { Equipment } from '@/types';

// 固定设计分辨率
const DESIGN_WIDTH = 1200;
const DESIGN_HEIGHT = 600;

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
  const isDrillRunning = useDrillStore((state) => state.isRunning);
  const currentFault = useDrillStore((state) => state.currentFault);

  // 计算自适应缩放 - 使用统一的缩放比例，保持设备不变形
  const calculateScale = useCallback((canvasWidth: number, canvasHeight: number): { scale: number; offsetX: number; offsetY: number } => {
    if (equipments.length === 0) return { scale: 1, offsetX: 0, offsetY: 0 };

    // 使用统一的缩放比例，保持宽高比
    const scaleX = canvasWidth / DESIGN_WIDTH;
    const scaleY = canvasHeight / DESIGN_HEIGHT;
    const scale = Math.min(scaleX, scaleY);

    // 计算偏移使内容居中
    const contentWidth = DESIGN_WIDTH * scale;
    const contentHeight = DESIGN_HEIGHT * scale;
    const offsetX = (canvasWidth - contentWidth) / 2;
    const offsetY = (canvasHeight - contentHeight) / 2;

    return { scale, offsetX, offsetY };
  }, [equipments]);

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

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 绘制背景
      drawBackground(ctx, canvas.width, canvas.height);

      // 保存上下文并应用缩放
      ctx.save();
      ctx.translate(offsetRef.current.x, offsetRef.current.y);
      ctx.scale(scaleRef.current, scaleRef.current);

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
  }, [equipments, pipelines, selectedEquipmentId, isDrillRunning, currentFault, calculateScale]);

  const drawBackground = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // 填充背景色
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // 绘制网格点
    ctx.fillStyle = '#1e293b';
    const gridSize = 20;
    for (let x = 0; x < width; x += gridSize) {
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
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
