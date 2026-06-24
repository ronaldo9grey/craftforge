import { useRef, useEffect, useCallback } from 'react';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useUIStore } from '@/stores/uiStore';
import { useDrillStore } from '@/stores/drillStore';
import { EquipmentRenderer, drawLightning } from './EquipmentRenderer';
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

  // 🔑 闪烁修复 v2：把所有"频繁变化"的状态都用 ref 持有
  // 之前 useEffect 依赖 equipments → updateParameter 每秒数次 → 数组引用变化 → useEffect cleanup+remount → animate 重启 → 闪烁
  // 现在 animate 通过 ref 读最新数据，useEffect 仅依赖结构性变化（场景切换/管道结构）
  const equipmentsRef = useRef(equipments);
  const pipelinesRef = useRef(pipelines);
  const isDrillRunningRef = useRef(isDrillRunning);
  const currentFaultRef = useRef(currentFault);
  const selectedEquipmentIdRef = useRef(selectedEquipmentId);
  useEffect(() => { equipmentsRef.current = equipments; }, [equipments]);
  useEffect(() => { pipelinesRef.current = pipelines; }, [pipelines]);
  useEffect(() => { isDrillRunningRef.current = isDrillRunning; }, [isDrillRunning]);
  useEffect(() => { currentFaultRef.current = currentFault; }, [currentFault]);
  useEffect(() => { selectedEquipmentIdRef.current = selectedEquipmentId; }, [selectedEquipmentId]);

  // 用 activeTemplate 作为"结构变化"的代理键：只有切换场景才重启 animate
  // 设备列表内部参数变化不再触发 useEffect 重启

  // 当前场景的设计尺寸（从注册中心读取）
  const designSize = getSceneMeta(activeTemplate ?? 'fcc')?.designSize ?? FALLBACK_DESIGN_SIZE;

  // 计算自适应缩放 - 使用统一的缩放比例，保持设备不变形
  // 注意：不依赖 equipments（避免演练时频繁变化），改用 equipmentsRef
  const calculateScale = useCallback((canvasWidth: number, canvasHeight: number): { scale: number; offsetX: number; offsetY: number } => {
    if (equipmentsRef.current.length === 0) return { scale: 1, offsetX: 0, offsetY: 0 };

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
  }, [designSize]);

  const getEquipmentAtPosition = useCallback((x: number, y: number): Equipment | null => {
    const scale = scaleRef.current;
    const offset = offsetRef.current;

    // 将屏幕坐标转换为设计坐标
    const designX = (x - offset.x) / scale;
    const designY = (y - offset.y) / scale;

    const eqs = equipmentsRef.current;
    for (let i = eqs.length - 1; i >= 0; i--) {
      const eq = eqs[i];
      if (designX >= eq.x && designX <= eq.x + eq.width &&
          designY >= eq.y && designY <= eq.y + eq.height) {
        return eq;
      }
    }
    return null;
  }, []);

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
        // 容器宽高为 0 时跳过（DOM 还没布局完）→ 等 ResizeObserver 后续触发
        const cw = parent.clientWidth;
        const ch = parent.clientHeight;
        if (cw < 10 || ch < 10) return;

        // 用设备像素比避免高 DPI 屏幕模糊（同时改了实际像素和 CSS 尺寸）
        canvas.width = cw;
        canvas.height = ch;

        // 重新计算缩放
        const { scale, offsetX, offsetY } = calculateScale(canvas.width, canvas.height);
        scaleRef.current = scale;
        offsetRef.current = { x: offsetX, y: offsetY };
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 关键修复：用 ResizeObserver 监听父容器尺寸变化
    // 首屏挂载时父容器宽高可能还是 0（"一闪而过"现象的根因），
    // ResizeObserver 在容器布局完成后会立即触发，正确测量并重置 canvas 尺寸
    let resizeObserver: ResizeObserver | null = null;
    if (canvas.parentElement && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        resizeCanvas();
      });
      resizeObserver.observe(canvas.parentElement);
    }

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

      // 双保险：每帧开始时重置变换矩阵到单位矩阵
      // 防止任何子绘制泄漏的 translate/scale 累积导致画面漂移
      ctx.setTransform(1, 0, 0, 1, 0, 0);

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

      // 绘制管道（容错）- 通过 ref 读，避免数组引用变化触发 useEffect 重启
      try {
        PipelineRenderer.render(ctx, pipelinesRef.current, flowOffsetRef.current);
      } catch (err) {
        if (!(window as any).__pipelineErrLogged) {
          (window as any).__pipelineErrLogged = true;
          console.error('[PipelineRenderer] 管道渲染出错:', err);
        }
      }

      // 绘制设备（把 flowOffset 当作动画时间相位传入，驱动机器人/传送带动画）
      // 用 try/catch 包住每个设备，避免单个设备渲染错误导致整个 animate 循环停摆
      // 用 ref 读取最新数据，避免每次 store 变化触发 useEffect 重启 animate（闪烁根因）
      equipmentsRef.current.forEach((equipment) => {
        try {
          const isSelected = equipment.id === selectedEquipmentIdRef.current;
          const isFaulty = !!(isDrillRunningRef.current && currentFaultRef.current?.affectedEquipments.includes(equipment.id));
          EquipmentRenderer.render(ctx, equipment, isSelected, isFaulty, flowOffsetRef.current);
        } catch (err) {
          // 只在第一次报错时打印（避免每秒 60 次刷屏）
          if (!(window as any).__renderErrLogged?.[equipment.id]) {
            (window as any).__renderErrLogged ??= {};
            (window as any).__renderErrLogged[equipment.id] = true;
            console.error(`[EquipmentRenderer] 渲染设备 ${equipment.id} (${equipment.type}) 出错:`, err);
          }
        }
      });

      ctx.restore();

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationRef.current);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [calculateScale, activeTemplate, designSize]);

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

      // ---- (1) 厂房屋顶钢架轮廓（顶部 y=4~24 区域，缩小屋顶给烟道让空间）----
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      // 屋顶主轮廓（人字坡）
      ctx.beginPath();
      ctx.moveTo(10, 24);
      ctx.lineTo(w / 2, 4);
      ctx.lineTo(w - 10, 24);
      ctx.stroke();
      // 屋顶桁架斜线
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      for (let tx = 60; tx < w - 60; tx += 80) {
        ctx.beginPath();
        ctx.moveTo(tx, 24);
        ctx.lineTo(tx + 40, 12);
        ctx.stroke();
      }
      // 两侧立柱
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(15, 24); ctx.lineTo(15, h - 30);
      ctx.moveTo(w - 15, 24); ctx.lineTo(w - 15, h - 30);
      ctx.stroke();

      // ---- (1.5) 屋顶水平烟道（y=26~36 紧贴屋顶下方）----
      const flueY = 32;
      // 水平烟道主管
      ctx.fillStyle = '#15803d';
      ctx.strokeStyle = '#052e16';
      ctx.lineWidth = 1;
      ctx.fillRect(280, flueY - 4, w - 280 - 50, 8);
      ctx.strokeRect(280, flueY - 4, w - 280 - 50, 8);
      // 内部流动虚线
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
      const flueDownXs = [30 + 290, 650 + 290];
      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 5;
      flueDownXs.forEach((cx) => {
        ctx.beginPath();
        ctx.moveTo(cx, flueY + 4);
        ctx.lineTo(cx, 120);
        ctx.stroke();
      });
      // 右侧出口箭头
      ctx.fillStyle = '#86efac';
      ctx.beginPath();
      ctx.moveTo(w - 50, flueY - 8);
      ctx.lineTo(w - 40, flueY);
      ctx.lineTo(w - 50, flueY + 8);
      ctx.closePath();
      ctx.fill();
      // 标签：放在烟道左端正上方（屋顶人字坡内），加深色背景框防止遮挡
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(283, flueY - 18, 100, 12);
      ctx.fillStyle = '#86efac';
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('车间集烟主管 →', 285, flueY - 12);
      // 右侧标签
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(w - 152, flueY - 18, 90, 12);
      ctx.fillStyle = '#86efac';
      ctx.textAlign = 'right';
      ctx.fillText('→ 烟气净化（车间外）', w - 64, flueY - 12);

      // ---- (2) 区域底色（v10 布局：删除总控柜，控制层下移撑满底部）----
      // 行 1 电解车间核心区（y=85~490 含天车下方+2 槽+2 槽控柜）
      ctx.fillStyle = 'rgba(6, 182, 212, 0.06)';
      ctx.fillRect(0, 85, w, 405);
      // 阴极母线区（y=498~528 提升到 30px 高度）
      ctx.fillStyle = 'rgba(250, 204, 21, 0.08)';
      ctx.fillRect(0, 498, w, 30);
      // 控制层（y=530~685 加深到 0.12，分区更清晰）
      ctx.fillStyle = 'rgba(168, 85, 247, 0.12)';
      ctx.fillRect(0, 530, w, 155);

      // ---- (2.1) 区域间地面横线（baseboard，比虚线网格更明显）----
      // 电解车间↔阴极母线区
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(15, 490);
      ctx.lineTo(w - 15, 490);
      ctx.stroke();
      // 阴极母线区↔控制层
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
      ctx.beginPath();
      ctx.moveTo(15, 528);
      ctx.lineTo(w - 15, 528);
      ctx.stroke();
      // 控制层底（地面）
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(15, 685);
      ctx.lineTo(w - 15, 685);
      ctx.stroke();
      // baseboard 浅阴影（地面投影感）
      const baseGrad = ctx.createLinearGradient(0, 685, 0, 700);
      baseGrad.addColorStop(0, 'rgba(0,0,0,0.25)');
      baseGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 685, w, 15);

      // ---- (2.5) 氧化铝输送管道：y=96 水平主管 + 2 个分支竖管 ----
      const pipeY = 100;
      const pipeGrad = ctx.createLinearGradient(0, pipeY - 3, 0, pipeY + 6);
      pipeGrad.addColorStop(0, '#cbd5e1');
      pipeGrad.addColorStop(0.5, '#94a3b8');
      pipeGrad.addColorStop(1, '#475569');
      ctx.fillStyle = pipeGrad;
      ctx.fillRect(30, pipeY - 3, w - 60, 8);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.strokeRect(30, pipeY - 3, w - 60, 8);
      // 2 个分支竖管（连到 2 槽顶部）
      const cellXCenters = [30 + 290, 650 + 290];
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 5;
      cellXCenters.forEach((cx) => {
        ctx.beginPath();
        ctx.moveTo(cx, pipeY + 5);
        ctx.lineTo(cx, 120);
        ctx.stroke();
      });
      // 输送方向箭头（左端）
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(40, pipeY - 8);
      ctx.lineTo(50, pipeY - 8);
      ctx.lineTo(45, pipeY - 2);
      ctx.closePath();
      ctx.fill();
      // 标签：氧化铝输送管加深色背景框
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(58, pipeY + 8, 138, 14);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('氧化铝粉气力输送管 ⟶', 62, pipeY + 11);

      // ---- (2.6) 阴极母线（y=505 金黄粗条贯穿 2 槽底部）+ DC− 回路示意 ----
      const busY = 505;

      // 实时电流强度（用于联动所有脉冲球速度；故障时电流偏离 → 球速肉眼可见变化）
      const _tra = equipmentsRef.current.find((e) => e.id === 'TRA-301');
      const _curParam = _tra?.parameters.find((p) => p.id === 'bus_current');
      const _curVal = _curParam ? _curParam.value : 600;
      // 归一化到正常 600 kA 为 1.0；偏离则线性放大/缩小
      const currentRatio = Math.max(0.3, Math.min(2.0, _curVal / 600));

      // 阴极母线粗条
      ctx.fillStyle = '#facc15';
      ctx.fillRect(30, busY, w - 60, 8);
      ctx.strokeStyle = '#a16207';
      ctx.lineWidth = 1;
      ctx.strokeRect(30, busY, w - 60, 8);

      // 阴极母线电流动效（两层叠加）
      const tNow = Date.now() / 1000;
      // 底层：连续走马灯虚线（恢复原有效果，弱化亮度）
      ctx.setLineDash([6, 8]);
      ctx.lineDashOffset = tNow * 25 * currentRatio;     // 正方向 = 从右往左
      ctx.strokeStyle = 'rgba(254, 224, 71, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(35, busY + 4);
      ctx.lineTo(w - 35, busY + 4);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      // 顶层：闪电图标从右往左滑过整条母线（4s / currentRatio 周期）
      const busPeriod = 4 / Math.max(0.3, currentRatio);
      const busPhase = (tNow / busPeriod) % 1;
      const busPulseX = (w - 35) - busPhase * (w - 70);  // 从右到左
      const busPulseY = busY + 4;
      drawLightning(ctx, busPulseX, busPulseY, Math.PI, 22);

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

      // DC− 回流连接线：母线左端往下接到整流变压器 DC− 端子
      // 让"电流闭环"可视化：阴极母线 → ↓ → 变压器
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(50, busY + 8);
      ctx.lineTo(50, 535);            // 接到变压器顶部
      ctx.stroke();
      // 端子箭头
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(50, 535);
      ctx.lineTo(45, 528);
      ctx.lineTo(55, 528);
      ctx.closePath();
      ctx.fill();
      // DC− 电流：闪电图标从上往下滑回变压器（3.5s/周期，方向 = PI/2 向下）
      const dcMinusPeriod = 3.5 / Math.max(0.3, currentRatio);
      const dcMinusPhase = (tNow / dcMinusPeriod) % 1;
      const dcMinusY = (busY + 8) + dcMinusPhase * (535 - (busY + 8));
      drawLightning(ctx, 50, dcMinusY, Math.PI / 2, 16);

      // 母线标签：加深色背景框 + 改为"DC − 阴极母线"明确语义
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(w - 240, busY + 10, 170, 14);
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('━━ 阴极母线 DC− 600 kA ━━', w - 74, busY + 13);

      // 变压器 DC− 端子标识（小红蓝圆点 + 文字）
      const traDcMinusX = 50;
      const traDcMinusY = 535;
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.arc(traDcMinusX, traDcMinusY - 4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('−', traDcMinusX, traDcMinusY - 4);

      // DC+ 直流主回路：变压器右端 → ↑ → 槽底右侧
      // 视觉闭环：变压器 DC+(右) → ↑ → 阳极母线 / 阴极母线 DC−(左) → ↓ → 变压器 DC−(左)
      const dcPlusX = 290;            // 变压器右端
      // 路径：(290, 535) → ↑ → (290, busY+18) → →  → (w-35, busY+18) → ↑ → (w-35, 472)
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(dcPlusX, 535);
      ctx.lineTo(dcPlusX, busY + 22);   // 上到母线区下方
      ctx.lineTo(w - 35, busY + 22);    // 横向走到右
      ctx.lineTo(w - 35, 472);          // 上到槽底
      ctx.stroke();
      // DC+ 红圆点
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(dcPlusX, 535 - 4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+', dcPlusX, 535 - 4);
      // DC+ 电流：闪电图标沿主回路三段折线滑动（4s/周期）
      // 路径：(dcPlusX, 535) → (dcPlusX, busY+22) → (w-35, busY+22) → (w-35, 472)
      // 闪电方向跟当前段方向保持一致：段 1 向上 / 段 2 向右 / 段 3 向上
      const dcPlusPeriod = 4 / Math.max(0.3, currentRatio);
      const dcPlusPhase = (tNow / dcPlusPeriod) % 1;
      const seg1Len = 535 - (busY + 22);     // 段 1：竖向上
      const seg2Len = (w - 35) - dcPlusX;    // 段 2：横向右
      const seg3Len = (busY + 22) - 472;     // 段 3：竖向上
      const totalLen = seg1Len + seg2Len + seg3Len;
      const traveled = dcPlusPhase * totalLen;
      let dcPlusBallX: number, dcPlusBallY: number, dcPlusAngle: number;
      if (traveled < seg1Len) {
        dcPlusBallX = dcPlusX;
        dcPlusBallY = 535 - traveled;
        dcPlusAngle = -Math.PI / 2;          // 向上
      } else if (traveled < seg1Len + seg2Len) {
        const tSeg = traveled - seg1Len;
        dcPlusBallX = dcPlusX + tSeg;
        dcPlusBallY = busY + 22;
        dcPlusAngle = 0;                     // 向右
      } else {
        const tSeg = traveled - seg1Len - seg2Len;
        dcPlusBallX = w - 35;
        dcPlusBallY = (busY + 22) - tSeg;
        dcPlusAngle = -Math.PI / 2;          // 向上
      }
      drawLightning(ctx, dcPlusBallX, dcPlusBallY, dcPlusAngle, 18, 'rgba(254, 202, 202, 0.7)');

      // ---- (3) 灯光氛围 ----
      const cellGlow = ctx.createRadialGradient(w / 2, 250, 100, w / 2, 250, 700);
      cellGlow.addColorStop(0, 'rgba(249, 115, 22, 0.18)');
      cellGlow.addColorStop(0.5, 'rgba(249, 115, 22, 0.08)');
      cellGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = cellGlow;
      ctx.fillRect(0, 110, w, 360);

      // ---- (4) 地面网格（已被 (2.1) baseboard 替代，此处不再画 ）----

      // ---- (5) 区域标签（左侧带深色背景框）----
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(20, 88, 180, 14);
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('▎ 电解车间 (2 × 600 kA 槽)', 24, 91);

      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(20, 533, 70, 14);
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('▎ 控制层', 24, 536);

      // ---- (6) 关键数据指标（顶部状态条）----
      // 顶部状态条：实时跟随 TRA-301（整流变压器）的母线电流 + 二次直流电压
      // 从 equipmentsRef 取最新值（避免 store 订阅导致 re-render）
      const tra = equipmentsRef.current.find((e) => e.id === 'TRA-301');
      const busCurParam = tra?.parameters.find((p) => p.id === 'bus_current');
      const secVoltParam = tra?.parameters.find((p) => p.id === 'secondary_dc_volt');
      const busCurrent = busCurParam ? Math.round(busCurParam.value) : 600;
      const secVoltage = secVoltParam ? Math.round(secVoltParam.value) : 1660;
      // 报警态：偏离正常范围切红色
      const isAlarm = busCurParam && (busCurParam.value < (busCurParam.normalMin ?? 580) || busCurParam.value > (busCurParam.normalMax ?? 620));
      const barColor = isAlarm ? '#ef4444' : '#06b6d4';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(w - 260, 78, 250, 16);
      ctx.strokeStyle = barColor;
      ctx.strokeRect(w - 260, 78, 250, 16);
      ctx.fillStyle = barColor;
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`系列电流 ${busCurrent} kA / 母线电压 ${secVoltage} V`, w - 254, 90);

      // ---- (7) 物料流向 已删除（与阴极母线标签重叠，且信息冗余）----

      // ---- (8) 版本水印 ----
      ctx.fillStyle = '#06b6d4';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('v15 aluminum  (脉冲球→闪电图标 + 恢复原走马灯)', w - 30, h - 8);
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
