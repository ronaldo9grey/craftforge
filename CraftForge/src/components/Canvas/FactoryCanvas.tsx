import { useRef, useEffect, useCallback, lazy, Suspense } from 'react';
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

// 3D 场景懒加载（独立 chunk，不影响 2D 场景启动速度）
const TBMScene3D = lazy(() => import('@/scenes/tbm/TBMScene3D').then((m) => ({ default: m.TBMScene3D })));
const OffshoreRigScene3D = lazy(() => import('@/scenes/offshore/OffshoreRigScene3D').then((m) => ({ default: m.OffshoreRigScene3D })));

/**
 * FactoryCanvas 现在是渲染路由分发器：
 * - 检查当前场景 meta 是否标记 is3D
 * - is3D=true → 根据场景ID渲染对应3D组件（TBM/Offshore）
 * - 否则 → 渲染原来的 2D Canvas（FactoryCanvas2D）
 *
 * 该 wrapper 仅一个 useEquipmentStore subscribe，hooks 规则始终满足。
 */
export const FactoryCanvas: React.FC = () => {
  const activeTemplate = useUIStore((s) => s.activeTemplate);
  const sceneMeta = activeTemplate ? getSceneMeta(activeTemplate) : undefined;

  if (sceneMeta?.is3D) {
    // 根据场景ID选择3D渲染器
    const Scene3D = activeTemplate === 'offshore' ? OffshoreRigScene3D : TBMScene3D;
    const loadingIcon = activeTemplate === 'offshore' ? '🏗️' : '🛞';
    return (
      <Suspense fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: '#94a3b8', background: '#0a1426' }}>
          {loadingIcon} 加载 3D 引擎中...
        </div>
      }>
        <Scene3D />
      </Suspense>
    );
  }

  return <FactoryCanvas2D />;
};

/**
 * 2D 渲染器：原 FactoryCanvas 实现
 */
const FactoryCanvas2D: React.FC = () => {
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

      // ===== 三阶段绘制（解决文字被设备/管道遮挡） =====
      // 第 1 阶段：管道线条（在设备之下，避免遮挡设备渲染细节）
      try {
        PipelineRenderer.renderLines(ctx, pipelinesRef.current, flowOffsetRef.current, equipmentsRef.current);
      } catch (err) {
        if (!(window as any).__pipelineErrLogged) {
          (window as any).__pipelineErrLogged = true;
          console.error('[PipelineRenderer] 管道渲染出错:', err);
        }
      }

      // 第 2 阶段：设备本体（盖在管道之上，正常展示设备）
      // 用 try/catch 包住每个设备，避免单个设备渲染错误导致整个 animate 循环停摆
      equipmentsRef.current.forEach((equipment) => {
        try {
          const isSelected = equipment.id === selectedEquipmentIdRef.current;
          const isFaulty = !!(isDrillRunningRef.current && currentFaultRef.current?.affectedEquipments.includes(equipment.id));
          EquipmentRenderer.render(ctx, equipment, isSelected, isFaulty, flowOffsetRef.current);
        } catch (err) {
          if (!(window as any).__renderErrLogged?.[equipment.id]) {
            (window as any).__renderErrLogged ??= {};
            (window as any).__renderErrLogged[equipment.id] = true;
            console.error(`[EquipmentRenderer] 渲染设备 ${equipment.id} (${equipment.type}) 出错:`, err);
          }
        }
      });

      // 第 3 阶段：管道 medium 标签（最高 z 序，盖在管道线和设备本体之上，永不被遮挡）
      try {
        PipelineRenderer.renderLabels(ctx, pipelinesRef.current);
      } catch (err) {
        if (!(window as any).__pipelineLabelErrLogged) {
          (window as any).__pipelineLabelErrLogged = true;
          console.error('[PipelineRenderer] 标签渲染出错:', err);
        }
      }

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

    /**
     * 通用工具：绘制顶部工艺流程横幅（6 节点 + 序号 + 标签 + 描述 + ▶ 箭头）
     * @param steps        步骤数组（4-6 个），每个含 num/label/desc
     * @param accentColor  主色（横幅边框 + 序号填色，建议跟场景主色一致）
     * @param yOffset      横幅顶部 y（默认 40）。对设备已铺满顶部的场景（如 aluminum 天车 y=42），传 2 让横幅放最顶端
     * @param hBanner      横幅高度（默认 36）。紧凑模式可以传 28
     */
    const drawProcessBanner = (
      steps: Array<{ num: string; label: string; desc: string }>,
      accentColor: string,
      yOffset: number = 40,
      hBanner: number = 36,
    ) => {
      const bannerY = yOffset;
      const bannerH = hBanner;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(20, bannerY, w - 40, bannerH);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(20, bannerY, w - 40, bannerH);

      const stepW = (w - 60) / steps.length;
      steps.forEach((s, i) => {
        const sx = 30 + stepW * i + stepW / 2;
        ctx.fillStyle = accentColor;
        ctx.font = 'bold 16px Inter, "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(s.num, sx - 42, bannerY + bannerH / 2);
        ctx.fillStyle = '#fde68a';
        ctx.font = 'bold 13px Inter, "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(s.label, sx - 34, bannerY + bannerH / 2 - 7);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px Inter, "Microsoft YaHei", sans-serif';
        ctx.fillText(s.desc, sx - 34, bannerY + bannerH / 2 + 8);
        if (i < steps.length - 1) {
          ctx.fillStyle = accentColor;
          ctx.font = 'bold 16px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('▶', sx + stepW / 2 - 8, bannerY + bannerH / 2);
        }
      });
    };

    /**
     * 通用工具：绘制设备节点编号小圆灯（落在设备左上角）
     * @param equipNums    [设备 id, 编号] 数组
     * @param accentColor  小圆灯背景色（建议跟场景主色一致）
     */
    const drawEquipmentNodeBadges = (
      equipNums: Array<[string, string]>,
      accentColor: string,
    ) => {
      equipNums.forEach(([eqId, num]) => {
        const eq = equipmentsRef.current.find((e) => e.id === eqId);
        if (!eq) return;
        // 跳过画面外设备（坐标负数/超出画布）
        if (eq.x < 0 || eq.y < 0 || eq.x > w || eq.y > h) return;
        const ncx = eq.x - 12;
        const ncy = eq.y + 10;
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.arc(ncx, ncy, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fde68a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px Inter, "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(num, ncx, ncy + 1);
      });
    };

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

    // 焊装场景 v12：控制区下移避开标签压线 + 控制管道精简到 1 条
    if (activeTemplate === 'welding') {
      // 主焊装区底色（y=130~390）
      ctx.fillStyle = 'rgba(34, 211, 238, 0.05)';
      ctx.fillRect(0, 130, w, 260);
      // 下排机器人区（y=400~575）
      ctx.fillStyle = 'rgba(251, 191, 36, 0.04)';
      ctx.fillRect(0, 400, w, 175);
      // 控制柜区域浅底色（y=615 起 高 85，紧贴 CTRL 设备 y=625~695）
      ctx.fillStyle = '#0a1629';
      ctx.fillRect(0, 615, w, 105);

      // baseboard 分割线（下移到 y=610）
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(15, 390); ctx.lineTo(w - 15, 390); ctx.stroke();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
      ctx.beginPath(); ctx.moveTo(15, 610); ctx.lineTo(w - 15, 610); ctx.stroke();

      // 工艺横幅
      drawProcessBanner([
        { num: '①', label: '白车身上件', desc: '上件节拍 60 s/件' },
        { num: '②', label: '输送进位', desc: '输送带 1.2 m/min' },
        { num: '③', label: '定位夹紧', desc: '夹紧力 5000 N' },
        { num: '④', label: '机器人点焊', desc: '180 A / 22 V' },
        { num: '⑤', label: '焊缝检测', desc: '熔深 2.5 mm' },
        { num: '⑥', label: '合格下件', desc: '下件 60 s/件' },
      ], '#22d3ee');

      // ---- 标志性动画：机器人点焊弧光 + 火花飞溅 ----
      // 让弧光从机器人臂端朝下方"虚拟焊点"短距离闪烁，不再连接到 FIX 中心
      // 这样不会跨越 50~165px 距离遮挡其他设备/管道/文字标签
      const animTW = Date.now() / 1000;
      // 每台机器人有自己的"虚拟焊点"，紧贴在机器人臂端下方/上方 20-30px
      const weldingArcs: Array<{ rx: number; ry: number; fx: number; fy: number }> = [
        // ROB-101：朝右下方 30px 处焊接（不跨越到 FIX）
        { rx: 540 + 110 / 2, ry: 110 + 80, fx: 540 + 110 / 2 + 20, fy: 110 + 80 + 30 },
        // ROB-102：朝左下方 30px
        { rx: 680 + 110 / 2, ry: 110 + 80, fx: 680 + 110 / 2 - 20, fy: 110 + 80 + 30 },
        // ROB-103：朝上方 30px（这台在 FIX 下方，从下往上焊）
        { rx: 540 + 110 / 2, ry: 440,       fx: 540 + 110 / 2 + 15, fy: 440 - 30 },
      ];

      weldingArcs.forEach(({ rx, ry, fx, fy }, idx) => {
        const cycle = 0.8;
        const localT = (animTW + idx * 0.27) % cycle;
        const arcOn = localT < 0.35;
        if (!arcOn) return;
        const intensity = Math.sin((localT / 0.35) * Math.PI);

        // 1) 短焊弧光柱：从机器人臂端到 ~30px 外的虚拟焊点
        const grad = ctx.createLinearGradient(rx, ry, fx, fy);
        grad.addColorStop(0, `rgba(186, 230, 253, ${0.4 * intensity})`);
        grad.addColorStop(0.5, `rgba(255, 255, 255, ${0.95 * intensity})`);
        grad.addColorStop(1, `rgba(56, 189, 248, ${0.85 * intensity})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 3 * intensity;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(fx, fy);
        ctx.stroke();

        // 2) 焊点辉光（在每台机器人各自的虚拟焊点）
        const glowR = 8 + 6 * intensity;
        const radialGrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, glowR);
        radialGrad.addColorStop(0, `rgba(255, 255, 255, ${0.95 * intensity})`);
        radialGrad.addColorStop(0.4, `rgba(186, 230, 253, ${0.7 * intensity})`);
        radialGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = radialGrad;
        ctx.beginPath();
        ctx.arc(fx, fy, glowR, 0, Math.PI * 2);
        ctx.fill();

        // 3) 火花飞溅（4 道短火花，长度 ≤ 10px，不会喷出 30px 范围）
        const sparkCount = 4;
        for (let s = 0; s < sparkCount; s++) {
          const sparkAngle = (s / sparkCount) * Math.PI * 2 + idx * 0.7 + animTW * 2;
          const sparkLen = 5 + 6 * intensity;
          const sx = fx + Math.cos(sparkAngle) * sparkLen;
          const sy = fy + Math.sin(sparkAngle) * sparkLen;
          ctx.strokeStyle = `rgba(252, 211, 77, ${0.8 * intensity})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.lineTo(sx, sy);
          ctx.stroke();
          ctx.fillStyle = `rgba(254, 240, 138, ${intensity})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // 节点编号灯（最后画在弧光之上）
      drawEquipmentNodeBadges([
        ['ST-101',   '①'],
        ['CONV-101', '②'],
        ['FIX-101',  '③'],
        ['ROB-101',  '④'],
        ['INST-101', '⑤'],
        ['ST-102',   '⑥'],
      ], '#0891b2');

      // 安全通道（黄虚线 y=395）
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(20, 395);
      ctx.lineTo(w - 20, 395);
      ctx.stroke();
      ctx.setLineDash([]);

      // 工区标签
      ctx.font = 'bold 12px Inter, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#bef0ff';
      ctx.fillText('▎ 焊装主轴', 24, 26);
      ctx.fillStyle = '#fde68a';
      ctx.fillText('▎ 物流/安全通道', 24, 398);
      ctx.fillStyle = '#c4b5fd';
      ctx.fillText('▎ 控制区', 24, 623);

      // 🎯 版本水印
      ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('v12 welding  (控制管道 4→1 + 控制区下移 25px)', w - 30, h - 8);
    }

    // CNC 场景：3 大功能分区（加工区 / 物流主线 / 辅助系统）+ 横幅 + 节点编号（无单独控制层）
    if (activeTemplate === 'cnc') {
      // 区域 1：加工区（y=90~270）- 浅紫
      ctx.fillStyle = 'rgba(167, 139, 250, 0.06)';
      ctx.fillRect(0, 90, w, 180);
      // 区域 2：物流主线区（y=280~390）- 浅青
      ctx.fillStyle = 'rgba(34, 211, 238, 0.06)';
      ctx.fillRect(0, 280, w, 110);
      // 区域 3：辅助系统区（y=410~680）- 浅蓝灰（含 PMP/HMI/CONV/CTRL）
      ctx.fillStyle = 'rgba(100, 116, 139, 0.10)';
      ctx.fillRect(0, 410, w, 270);

      // 区域分隔细虚线
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      [275, 400].forEach((yy) => {
        ctx.beginPath();
        ctx.moveTo(20, yy);
        ctx.lineTo(w - 20, yy);
        ctx.stroke();
      });
      ctx.setLineDash([]);

      // 工艺横幅
      drawProcessBanner([
        { num: '①', label: '毛坯来料', desc: '毛坯库存 35 件' },
        { num: '②', label: '装夹定位', desc: '夹紧 8000 N' },
        { num: '③', label: '车铣加工', desc: '主轴 1800 rpm' },
        { num: '④', label: '冷却排屑', desc: '冷却液 12 L/min' },
        { num: '⑤', label: '在线测量', desc: '偏差 ±0.05 mm' },
        { num: '⑥', label: '成品下料', desc: '合格成品入库' },
      ], '#a78bfa');

      drawEquipmentNodeBadges([
        ['ST-201',   '①'],
        ['FIX-201',  '②'],
        ['CNC-101',  '③'],
        ['PMP-201',  '④'],
        ['INST-201', '⑤'],
        ['ST-202',   '⑥'],
      ], '#7c3aed');

      // 区域标签（居左）
      ctx.font = 'bold 12px Inter, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#e0d4ff';
      ctx.fillText('▎ 加工区', 24, 26);
      ctx.fillStyle = '#67e8f9';
      ctx.fillText('▎ 物流主线', 24, 285);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('▎ 辅助系统', 24, 415);

      // 🎯 版本水印
      ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('v4 cnc  (3 区合并辅助/控制 · 来料区右移)', w - 30, h - 8);
    }

    // 注塑场景：3 大功能分区 + 中间下移 40px 避开主机区
    if (activeTemplate === 'injection') {
      // 区域 1：主机区（y=80~245，不动）
      ctx.fillStyle = 'rgba(245, 158, 11, 0.07)';
      ctx.fillRect(0, 80, w, 165);
      // 区域 2：物流主线区（y=290~410，下移 40px）
      ctx.fillStyle = 'rgba(34, 211, 238, 0.07)';
      ctx.fillRect(0, 290, w, 125);
      // 区域 3：辅助系统区（y=435~680，下移 55px 含合并的电气控制）
      ctx.fillStyle = 'rgba(100, 116, 139, 0.12)';
      ctx.fillRect(0, 435, w, 245);

      // 区域分隔细虚线（下移）
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      [287, 432].forEach((yy) => {
        ctx.beginPath();
        ctx.moveTo(10, yy);
        ctx.lineTo(w - 10, yy);
        ctx.stroke();
      });
      ctx.setLineDash([]);

      // 工艺横幅
      drawProcessBanner([
        { num: '①', label: '原料干燥', desc: '干燥 85°C 除水' },
        { num: '②', label: '加热塑化', desc: '三段料筒 240°C' },
        { num: '③', label: '注射合模', desc: '85 MPa / 锁模 1200 kN' },
        { num: '④', label: '保压冷却', desc: '模温 55°C 保压 5s' },
        { num: '⑤', label: '机械手取件', desc: '真空 -85 kPa' },
        { num: '⑥', label: '在线检测', desc: '重量 ±0.3 g' },
      ], '#f59e0b');

      drawEquipmentNodeBadges([
        ['DRY-201',  '①'],
        ['HEAT-301', '②'],
        ['IMM-101',  '③'],
        ['MOLD-201', '④'],
        ['ROB-201',  '⑤'],
        ['INST-201', '⑥'],
      ], '#d97706');

      // 区域标签
      ctx.font = 'bold 12px Inter, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fde68a';
      ctx.fillText('▎ 主机区', 24, 26);
      ctx.fillStyle = '#67e8f9';
      ctx.fillText('▎ 物流主线', 24, 297);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('▎ 辅助系统', 24, 442);

      // 🎯 版本水印
      ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('v8 injection  (中间下移 40px · 料斗右移)', w - 30, h - 8);
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

      // ---- (2) 区域底色（v12：除横幅外整体下移 40px，画布 760 高）----
      // 行 1 电解车间核心区（y=125~475 含天车下方+2 槽+阴极母线）
      ctx.fillStyle = 'rgba(6, 182, 212, 0.06)';
      ctx.fillRect(0, 125, w, 350);
      // 阴极母线区（y=452~472 紧贴电解槽底）
      ctx.fillStyle = 'rgba(250, 204, 21, 0.08)';
      ctx.fillRect(0, 452, w, 20);
      // 槽控柜区（y=480~550）
      ctx.fillStyle = 'rgba(168, 85, 247, 0.06)';
      ctx.fillRect(0, 480, w, 90);
      // 控制层（y=590~725）
      ctx.fillStyle = 'rgba(168, 85, 247, 0.12)';
      ctx.fillRect(0, 590, w, 135);

      // ---- (2.1) 区域间地面横线 ----
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(15, 451);
      ctx.lineTo(w - 15, 451);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
      ctx.beginPath();
      ctx.moveTo(15, 473);
      ctx.lineTo(w - 15, 473);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.45)';
      ctx.beginPath();
      ctx.moveTo(15, 588);
      ctx.lineTo(w - 15, 588);
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

      // ---- (2.6) 阴极母线（y=415 紧贴电解槽底部 y=410）+ DC− 回路示意 ----
      const busY = 415;

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

      // DC− 回流连接线：阴极母线左端 ↓ 到变压器 DC− 端子
      // 工艺逻辑：电流从槽底阴极母线沿外侧线缆引到变压器（避开槽控柜区域 x=200~440）
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(50, busY + 8);
      ctx.lineTo(50, 565);            // 接到变压器顶部
      ctx.stroke();
      // 端子箭头
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(50, 565);
      ctx.lineTo(45, 558);
      ctx.lineTo(55, 558);
      ctx.closePath();
      ctx.fill();
      // DC− 电流：闪电图标从上往下滑回变压器（3.5s/周期，方向 = PI/2 向下）
      const dcMinusPeriod = 3.5 / Math.max(0.3, currentRatio);
      const dcMinusPhase = (tNow / dcMinusPeriod) % 1;
      const dcMinusY = (busY + 8) + dcMinusPhase * (565 - (busY + 8));
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
      const traDcMinusY = 565;
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.arc(traDcMinusX, traDcMinusY - 4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('−', traDcMinusX, traDcMinusY - 4);

      // DC+ 直流主回路：变压器右端 → ↑ → 槽底右侧（沿画布右边缘走线，避开槽控柜）
      // 视觉闭环：变压器 DC+(右) → ↑(沿控制层) → →(沿槽控柜下) → ↑(沿画布右) → 槽底
      const dcPlusX = 290;            // 变压器右端
      // 路径：(290, 565) → ↑ → (290, 545) → → → (w-35, 545) → ↑ → (w-35, busY+12)
      // 利用槽控柜区与控制层之间的空白带 y=545 做横走线 — 不穿越任何设备
      const dcPlusRouteY = 545;
      const dcPlusEndY = busY + 12;   // 紧贴阴极母线下方接入
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(dcPlusX, 565);
      ctx.lineTo(dcPlusX, dcPlusRouteY);
      ctx.lineTo(w - 35, dcPlusRouteY);
      ctx.lineTo(w - 35, dcPlusEndY);
      ctx.stroke();
      // DC+ 红圆点
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(dcPlusX, 565 - 4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+', dcPlusX, 565 - 4);
      // DC+ 电流：闪电图标沿主回路三段折线滑动（4s/周期）
      const dcPlusPeriod = 4 / Math.max(0.3, currentRatio);
      const dcPlusPhase = (tNow / dcPlusPeriod) % 1;
      const seg1Len = 565 - dcPlusRouteY;
      const seg2Len = (w - 35) - dcPlusX;
      const seg3Len = dcPlusRouteY - dcPlusEndY;
      const totalLen = seg1Len + seg2Len + seg3Len;
      const traveled = dcPlusPhase * totalLen;
      let dcPlusBallX: number, dcPlusBallY: number, dcPlusAngle: number;
      if (traveled < seg1Len) {
        dcPlusBallX = dcPlusX;
        dcPlusBallY = 565 - traveled;
        dcPlusAngle = -Math.PI / 2;
      } else if (traveled < seg1Len + seg2Len) {
        const tSeg = traveled - seg1Len;
        dcPlusBallX = dcPlusX + tSeg;
        dcPlusBallY = dcPlusRouteY;
        dcPlusAngle = 0;
      } else {
        const tSeg = traveled - seg1Len - seg2Len;
        dcPlusBallX = w - 35;
        dcPlusBallY = dcPlusRouteY - tSeg;
        dcPlusAngle = -Math.PI / 2;
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
      ctx.fillRect(20, 128, 180, 14);
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('▎ 电解车间 (2 × 600 kA 槽)', 24, 131);

      // 槽控柜区域标签（位于槽控柜区上沿 y=440 之上）
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(20, 477, 75, 14);
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('▎ 槽控柜', 24, 480);

      // 控制层标签
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(20, 593, 70, 14);
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('▎ 控制层', 24, 596);

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

      // ---- 工艺横幅 + 节点编号灯（aluminum 天车已占 y=42~82，横幅紧贴顶部 y=4~32）----
      drawProcessBanner([
        { num: '①', label: '整流供电', desc: '直流母线 600 kA' },
        { num: '②', label: '打壳下料', desc: '2.5 kg / 6 次每小时' },
        { num: '③', label: '电解反应', desc: '槽温 955°C / 4.15 V' },
        { num: '④', label: '阳极更换', desc: '天车 0.03 m/s' },
        { num: '⑤', label: '烟气净化', desc: 'HF 2.1 mg/m³' },
        { num: '⑥', label: '抬包出铝', desc: '铝水 920°C 抽吸' },
      ], '#06b6d4', 4, 32);

      drawEquipmentNodeBadges([
        ['TRA-301',      '①'],
        ['POT-CTRL-101', '②'],
        ['CELL-101',     '③'],
        ['CRANE-302',    '④'],
        ['FGT-301',      '⑤'],
        ['HMI-301',      '⑥'],
      ], '#0891b2');

      // ---- (7) 物料流向 已删除（与阴极母线标签重叠，且信息冗余）----

      // ---- (8) 版本水印 ----
      ctx.fillStyle = '#06b6d4';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('v19 aluminum  (变压器铭牌移到 render 主函数，必显示)', w - 30, h - 8);
    }

    // ===== FCC 催化裂化 v5：去除多余区域分割带 · 动画减速 =====
    if (activeTemplate === 'fcc') {
      // 单一主轴区底色（取消之前的"辅助换热泵区"分割，因为它没有明确分割语义，
      // 而下方黄线被误认为催化剂回路 — 改为只画一个反应再生主区底色就够了）
      ctx.fillStyle = 'rgba(34, 197, 94, 0.04)';
      ctx.fillRect(0, 140, w, 530);

      // 仅画地面线（画布底）
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(15, 670); ctx.lineTo(w - 15, 670); ctx.stroke();

      // 工艺横幅
      drawProcessBanner([
        { num: '①', label: '原料进料', desc: '原料油泵 120 t/h' },
        { num: '②', label: '预热换热', desc: '原料 180→280°C' },
        { num: '③', label: '加热升温', desc: '加热炉 750°C' },
        { num: '④', label: '提升管裂化', desc: '反应 485°C / 0.25 MPa' },
        { num: '⑤', label: '催化剂再生', desc: '再生 690°C 烧焦' },
        { num: '⑥', label: '产品分馏', desc: '塔顶 125°C' },
      ], '#22c55e');

      // ---- 催化剂双循环管路动画 — FCC 标志性工艺 ----
      // R-101 (x=620~720, y=260~400) ↔ REG-101 (x=820~920, y=260~400)
      // 待生剂：R 顶 → REG 顶（暗黄，下行管线）
      // 再生剂：REG 底 → R 底（亮黄，上行管线，热催化剂）
      const animT = Date.now() / 1000;
      const rRight = 720, rTop = 260, rBot = 400;
      const regLeft = 820, regTop = 260, regBot = 400;

      // 上方"待生剂"管路（R→REG，从反应器顶部出去，绕到再生器顶部入）
      const wasteY = rTop - 18;  // y=242，紧贴反应器顶
      ctx.strokeStyle = '#a16207';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(rRight - 30, rTop);          // R 顶部出口
      ctx.lineTo(rRight - 30, wasteY);         // 上升
      ctx.lineTo(regLeft + 30, wasteY);        // 横走
      ctx.lineTo(regLeft + 30, regTop);        // 下降到 REG 顶
      ctx.stroke();
      // 待生剂流动小球（向右流，减速到 0.3 周期/秒）
      for (let i = 0; i < 4; i++) {
        const phase = ((animT * 0.3 + i * 0.25) % 1);
        const totalLen = (regLeft + 30) - (rRight - 30);
        const fx = (rRight - 30) + phase * totalLen;
        ctx.fillStyle = '#ca8a04';
        ctx.beginPath();
        ctx.arc(fx, wasteY, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      // 标签
      ctx.fillStyle = '#a16207';
      ctx.font = 'bold 10px Inter, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('待生剂 →', (rRight - 30 + regLeft + 30) / 2, wasteY - 4);

      // 下方"再生剂"管路（REG→R，从再生器底部出，绕到反应器底入）
      const regenY = rBot + 18;  // y=418，紧贴反应器底
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(regLeft + 30, regBot);        // REG 底部出口
      ctx.lineTo(regLeft + 30, regenY);        // 下降
      ctx.lineTo(rRight - 30, regenY);         // 横走（向左）
      ctx.lineTo(rRight - 30, rBot);           // 上升到 R 底
      ctx.stroke();
      // 再生剂流动小球（向左流，减速到 0.4 周期/秒；保持比待生剂略快表达主流）
      for (let i = 0; i < 5; i++) {
        const phase = ((animT * 0.4 + i * 0.2) % 1);
        const totalLen = (regLeft + 30) - (rRight - 30);
        const fx = (regLeft + 30) - phase * totalLen;
        // 辉光（外圈）
        ctx.fillStyle = 'rgba(252, 211, 77, 0.4)';
        ctx.beginPath();
        ctx.arc(fx, regenY, 8, 0, Math.PI * 2);
        ctx.fill();
        // 内核（橙红色：热）
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(fx, regenY, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // 标签
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 10px Inter, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('← 再生剂 (690°C)', (rRight - 30 + regLeft + 30) / 2, regenY + 4);

      // 节点编号灯
      drawEquipmentNodeBadges([
        ['P-101',   '①'],
        ['E-101',   '②'],
        ['F-101',   '③'],
        ['R-101',   '④'],
        ['REG-101', '⑤'],
        ['T-101',   '⑥'],
      ], '#16a34a');

      // 区域标签（只保留主轴标签）
      ctx.font = 'bold 12px Inter, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#bbf7d0';
      ctx.fillText('▎ 反应再生主轴', 24, 26);

      // 版本水印
      ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('v5 fcc  (去多余分割带 · 动画减速)', w - 30, h - 8);
    }

    // ===== 阳极振压成型场景 v3：工艺流程横幅 + 工序节点编号 =====
    if (activeTemplate === 'anode') {
      // ---- (0) 厂房深色底（同 aluminum 风格）----
      const aGrad = ctx.createLinearGradient(0, 0, 0, h);
      aGrad.addColorStop(0, '#1a0f08');     // 顶部偏橙红（暖工厂感）
      aGrad.addColorStop(0.5, '#0c0a06');
      aGrad.addColorStop(1, '#0a0a0a');
      ctx.fillStyle = aGrad;
      ctx.fillRect(0, 0, w, h);

      // ---- (1) 区域底色：核心工艺主轴 + 辅助设备区（加高 100→125 充分呼吸）+ 控制层 ----
      // 行 1 主工艺主轴 (y=140~370)
      ctx.fillStyle = 'rgba(249, 115, 22, 0.05)';
      ctx.fillRect(0, 140, w, 230);
      // 行 2 辅助设备区 (y=380~505 高度从 100→125 充分扩大空间)
      ctx.fillStyle = 'rgba(34, 211, 238, 0.05)';
      ctx.fillRect(0, 380, w, 125);
      // 控制层 (y=515~660 下移 25px)
      ctx.fillStyle = 'rgba(168, 85, 247, 0.08)';
      ctx.fillRect(0, 515, w, 145);

      // baseboard 分割线
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.4)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(15, 374); ctx.lineTo(w - 15, 374); ctx.stroke();
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
      ctx.beginPath(); ctx.moveTo(15, 509); ctx.lineTo(w - 15, 509); ctx.stroke();
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(15, 665); ctx.lineTo(w - 15, 665); ctx.stroke();

      // ---- (2) 顶部工艺流程横幅（y=40~80，充分利用画布上方空白区）----
      // 表达: 配料 → 糊料 → 称量 → 振压 → 冷却
      const bannerY = 40;
      const bannerH = 36;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(20, bannerY, w - 40, bannerH);
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(20, bannerY, w - 40, bannerH);

      // 工艺节点：5 个步骤
      const steps = [
        { num: '①', label: '配料', desc: '石油焦+沥青' },
        { num: '②', label: '糊料保温', desc: '150°C 混捏' },
        { num: '③', label: '称量加料', desc: '1080 kg/块' },
        { num: '④', label: '振压成型', desc: '1280t × 95s' },
        { num: '⑤', label: '生坯冷却', desc: '→ 焙烧炉' },
      ];
      const stepW = (w - 60) / steps.length;
      steps.forEach((s, i) => {
        const sx = 30 + stepW * i + stepW / 2;
        // 编号
        ctx.fillStyle = '#f97316';
        ctx.font = 'bold 16px Inter, "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(s.num, sx - 42, bannerY + bannerH / 2);
        // 标签
        ctx.fillStyle = '#fde68a';
        ctx.font = 'bold 13px Inter, "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(s.label, sx - 34, bannerY + bannerH / 2 - 7);
        // 说明
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px Inter, "Microsoft YaHei", sans-serif';
        ctx.fillText(s.desc, sx - 34, bannerY + bannerH / 2 + 8);
        // 箭头分隔
        if (i < steps.length - 1) {
          ctx.fillStyle = '#f97316';
          ctx.font = 'bold 16px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('▶', sx + stepW / 2 - 8, bannerY + bannerH / 2);
        }
      });

      // ---- (3) 设备节点编号：把 ① ② ③ ④ ⑤ 画在对应设备的左上角 ----
      const equipNums: Array<[string, string]> = [
        ['CFG-701',   '①'],
        ['PASTE-101', '②'],
        ['WGT-401',   '③'],
        ['FORM-201',  '④'],
        ['COOL-301',  '⑤'],
      ];
      equipNums.forEach(([eqId, num]) => {
        const eq = equipmentsRef.current.find((e) => e.id === eqId);
        if (!eq) return;
        const ncx = eq.x - 14;
        const ncy = eq.y + 8;
        // 圆背景
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(ncx, ncy, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fde68a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // 编号
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px Inter, "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(num, ncx, ncy + 1);
      });

      // ---- (4) 区域标签（居左 + 无背景 + 纯文字，工艺主轴放在流程横幅之上）----
      ctx.font = 'bold 12px Inter, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      // 工艺主轴标签 — 放在流程横幅 y=40 之上（y=20，画布最顶部）
      ctx.fillStyle = '#fde68a';
      ctx.fillText('▎ 工艺主轴', 24, 26);

      // 辅助系统标签 — 放在分割线 y=374 上方空白带（y=365）
      ctx.fillStyle = '#67e8f9';
      ctx.fillText('▎ 辅助系统', 24, 365);

      // 控制层标签 — 放在分割线 y=509 上方空白带（y=500，新位置）
      ctx.fillStyle = '#c4b5fd';
      ctx.fillText('▎ 控制层', 24, 500);

      // ---- (5) 版本水印 ----
      ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('v9 anode  (动力学引擎+搅拌器+冷却台滑动+振压参数联动)', w - 30, h - 8);
    }

    // ===== 阳极焙烧炉车间 v1：工艺流程横幅 + 区域标签 =====
    if (activeTemplate === 'baking') {
      // ---- (0) 厂房深色底（炽热红橙工厂感）----
      const bGrad = ctx.createLinearGradient(0, 0, 0, h);
      bGrad.addColorStop(0, '#1a0a05');       // 顶部偏红橙（炉膛余热）
      bGrad.addColorStop(0.5, '#0c0805');
      bGrad.addColorStop(1, '#0a0a0a');
      ctx.fillStyle = bGrad;
      ctx.fillRect(0, 0, w, h);

      // ---- (1) 区域底色 ----
      // 行 1 焙烧炉室阵列 (y=120~325，高 205)
      ctx.fillStyle = 'rgba(220, 38, 38, 0.06)';
      ctx.fillRect(0, 120, w, 205);
      // 行 2 抽烟净化系统 (y=340~460，高 120)
      ctx.fillStyle = 'rgba(34, 211, 238, 0.05)';
      ctx.fillRect(0, 340, w, 120);
      // 行 3 辅助供给 (y=475~560，高 85)
      ctx.fillStyle = 'rgba(251, 191, 36, 0.06)';
      ctx.fillRect(0, 475, w, 85);
      // 控制层 (y=565~680，高 115)
      ctx.fillStyle = 'rgba(168, 85, 247, 0.08)';
      ctx.fillRect(0, 565, w, 115);

      // baseboard 分割线（落在各区域下边沿）
      ctx.strokeStyle = 'rgba(220, 38, 38, 0.4)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(15, 325); ctx.lineTo(w - 15, 325); ctx.stroke();
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
      ctx.beginPath(); ctx.moveTo(15, 463); ctx.lineTo(w - 15, 463); ctx.stroke();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
      ctx.beginPath(); ctx.moveTo(15, 562); ctx.lineTo(w - 15, 562); ctx.stroke();
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(15, 683); ctx.lineTo(w - 15, 683); ctx.stroke();

      // ---- (2) 顶部工艺流程横幅（y=40~76）----
      // 表达: 装炉 → 升温 → 恒温 → 降温 → 出炉
      const bannerY = 40;
      const bannerH = 36;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(20, bannerY, w - 40, bannerH);
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(20, bannerY, w - 40, bannerH);

      const steps = [
        { num: '①', label: '装炉填焦', desc: '焦床 100mm' },
        { num: '②', label: '升温段', desc: '500→900°C / 8天' },
        { num: '③', label: '恒温段', desc: '1100°C / 3天' },
        { num: '④', label: '降温段', desc: '900→200°C / 7天' },
        { num: '⑤', label: '出炉装运', desc: '电阻率 55 μΩ·m' },
      ];
      const stepW = (w - 60) / steps.length;
      steps.forEach((s, i) => {
        const sx = 30 + stepW * i + stepW / 2;
        ctx.fillStyle = '#dc2626';
        ctx.font = 'bold 16px Inter, "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(s.num, sx - 42, bannerY + bannerH / 2);
        ctx.fillStyle = '#fde68a';
        ctx.font = 'bold 13px Inter, "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(s.label, sx - 34, bannerY + bannerH / 2 - 7);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px Inter, "Microsoft YaHei", sans-serif';
        ctx.fillText(s.desc, sx - 34, bannerY + bannerH / 2 + 8);
        if (i < steps.length - 1) {
          ctx.fillStyle = '#dc2626';
          ctx.font = 'bold 16px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('▶', sx + stepW / 2 - 8, bannerY + bannerH / 2);
        }
      });

      // ---- (3) 设备节点编号：对应 4 个炉室 + 出炉位 ----
      const equipNums: Array<[string, string]> = [
        ['BAKE-K1', '②'],
        ['BAKE-K2', '②'],
        ['BAKE-K3', '③'],
        ['BAKE-K4', '④'],
        ['OUT-K5',  '⑤'],
      ];
      equipNums.forEach(([eqId, num]) => {
        const eq = equipmentsRef.current.find((e) => e.id === eqId);
        if (!eq) return;
        const ncx = eq.x - 12;
        const ncy = eq.y + 10;
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(ncx, ncy, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fde68a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px Inter, "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(num, ncx, ncy + 1);
      });

      // ---- (4) 区域标签（居左 + 无背景；主轴在横幅上方；其余靠分割线避开设备）----
      ctx.font = 'bold 12px Inter, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      // 焙烧主轴标签（横幅上方）
      ctx.fillStyle = '#fde68a';
      ctx.fillText('▎ 焙烧主轴', 24, 26);

      // 抽烟净化系统标签（紧贴分割线 y=325 之下 9px，BAKE 区域底部之外、FLUE 设备上方）
      ctx.fillStyle = '#67e8f9';
      ctx.fillText('▎ 抽烟净化', 24, 334);

      // 辅助供给标签（紧贴分割线 y=463 之下 9px）
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('▎ 辅助供给', 24, 472);

      // 控制层标签（紧贴分割线 y=562 之上 5px，避开 HMI-902 name 标签 y=553）
      ctx.fillStyle = '#c4b5fd';
      ctx.fillText('▎ 控制层', 24, 558);

      // ---- (5) 版本水印 ----
      ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('v2 baking  (布局加宽呼吸+各区域分割线下方安全位放标签)', w - 30, h - 8);
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
