import type { Pipeline, Equipment } from '@/types';

export class PipelineRenderer {
  /** 当前一帧的设备坐标映射 — 由 render 入口注入，供 getConnectionPoint 读取真实坐标 */
  private static liveEquipmentMap: Record<string, { x: number; y: number; w: number; h: number }> = {};

  static render(ctx: CanvasRenderingContext2D, pipelines: Pipeline[], flowOffset: number, equipments?: Equipment[]) {
    this.renderLines(ctx, pipelines, flowOffset, equipments);
    this.renderLabels(ctx, pipelines);
  }

  /** 只画管道线条 + 箭头 + 流动动画（用于在设备之前画） */
  static renderLines(ctx: CanvasRenderingContext2D, pipelines: Pipeline[], flowOffset: number, equipments?: Equipment[]) {
    // 用实时 equipments 数组构建坐标映射，覆盖下方硬编码 fallback 表
    if (equipments && equipments.length > 0) {
      const m: Record<string, { x: number; y: number; w: number; h: number }> = {};
      for (const eq of equipments) {
        m[eq.id] = { x: eq.x, y: eq.y, w: eq.width, h: eq.height };
      }
      this.liveEquipmentMap = m;
    }
    pipelines.forEach((pipeline) => {
      this.drawPipeline(ctx, pipeline, flowOffset, /* drawLabelToo */ false);
    });
  }

  /** 只画管道 medium 标签（用于在设备之后画，确保 z 序最高） */
  static renderLabels(ctx: CanvasRenderingContext2D, pipelines: Pipeline[]) {
    // 去重：相同 medium 的管道只画一次标签
    // 避免类似"点焊"出现 3 次、"控制"出现 4 次的视觉混乱
    const drawn = new Set<string>();
    pipelines.forEach((pipeline) => {
      if (drawn.has(pipeline.medium)) return;
      drawn.add(pipeline.medium);
      this.drawPipelineLabelOnly(ctx, pipeline);
    });
  }

  /** 只画该管道的 medium 标签（用于二遍 z 序覆盖） */
  private static drawPipelineLabelOnly(ctx: CanvasRenderingContext2D, pipeline: Pipeline) {
    const { from, to, fromPoint, toPoint, color, medium } = pipeline;
    const fromPos = this.getConnectionPoint(from, fromPoint);
    const toPos = this.getConnectionPoint(to, toPoint);
    if (!fromPos || !toPos) return;
    const path = this.calculatePath(fromPos, toPos, fromPoint, toPoint);
    this.drawLabel(ctx, path, medium, color);
  }

  private static drawPipeline(ctx: CanvasRenderingContext2D, pipeline: Pipeline, flowOffset: number, drawLabelToo: boolean = true) {
    const { from, to, fromPoint, toPoint, color, flowRate, medium } = pipeline;

    // 获取设备位置（与config.ts中的坐标对应）
    const fromPos = this.getConnectionPoint(from, fromPoint);
    const toPos = this.getConnectionPoint(to, toPoint);

    if (!fromPos || !toPos) return;

    // 计算路径点
    const path = this.calculatePath(fromPos, toPos, fromPoint, toPoint);

    // 绘制管道主体
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(3, flowRate / 80);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.stroke();

    // 绘制流动动画（双层 + 流光小球，明确方向）
    if (flowRate > 0) {
      // 1) 白色虚线流动 — 速度比旧版快 6 倍，明显可见
      //    lineDashOffset 取负值才能让虚线方向 = from→to（path 顺序）
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([12, 10]);
      ctx.lineDashOffset = -flowOffset * Math.max(flowRate / 16, 1.5);

      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;

      // 2) 沿路径走动的"流光小球"3 个，从 from→to 方向移动
      //    给每根管道用 from→to 路径总长度，按 phase 取插值点
      const segLens: number[] = [];
      let totalLen = 0;
      for (let i = 1; i < path.length; i++) {
        const dx = path[i].x - path[i - 1].x;
        const dy = path[i].y - path[i - 1].y;
        const l = Math.sqrt(dx * dx + dy * dy);
        segLens.push(l);
        totalLen += l;
      }
      if (totalLen > 0) {
        const ballSpeed = Math.max(flowRate * 0.6, 40); // px/s 大致换算
        for (let b = 0; b < 3; b++) {
          // 用 flowOffset 模拟时间，0.5 px/frame ≈ 30 px/s
          const t = ((flowOffset * 0.5 + (b * totalLen) / 3) % totalLen);
          // 找到 t 落在哪一段
          let acc = 0;
          let bx = path[0].x, by = path[0].y;
          for (let i = 0; i < segLens.length; i++) {
            if (t <= acc + segLens[i]) {
              const ratio = (t - acc) / Math.max(segLens[i], 0.01);
              bx = path[i].x + (path[i + 1].x - path[i].x) * ratio;
              by = path[i].y + (path[i + 1].y - path[i].y) * ratio;
              break;
            }
            acc += segLens[i];
          }
          // 流光小球（用管道颜色 + 白色亮心）
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(bx, by, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.beginPath();
          ctx.arc(bx, by, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
        // 避免 unused 警告
        void ballSpeed;
      }
    }

    // 绘制箭头指示流向（在路径终点前）
    this.drawArrow(ctx, path, color);

    // 绘制介质标签（仅在主调用 render 时跳过，由二遍 drawPipelineLabelOnly 统一画在最上层）
    if (drawLabelToo) {
      this.drawLabel(ctx, path, medium, color);
    }
  }

  private static calculatePath(
    from: { x: number; y: number },
    to: { x: number; y: number },
    fromPoint: string,
    toPoint: string
  ): { x: number; y: number }[] {
    const path: { x: number; y: number }[] = [from];

    const dx = to.x - from.x;
    const dy = to.y - from.y;

    // 根据连接点方向决定路径
    if (fromPoint === 'right' && toPoint === 'left') {
      // 水平连接
      const midX = (from.x + to.x) / 2;
      path.push({ x: midX, y: from.y });
      path.push({ x: midX, y: to.y });
    } else if (fromPoint === 'left' && toPoint === 'right') {
      // 水平反向
      const midX = (from.x + to.x) / 2;
      path.push({ x: midX, y: from.y });
      path.push({ x: midX, y: to.y });
    } else if (fromPoint === 'top' && toPoint === 'top') {
      // 顶部到顶部（上方绕行）
      const topY = Math.min(from.y, to.y) - 40;
      path.push({ x: from.x, y: topY });
      path.push({ x: to.x, y: topY });
    } else if (fromPoint === 'bottom' && toPoint === 'top') {
      // 底部到顶部（垂直连接）
      const midY = (from.y + to.y) / 2;
      path.push({ x: from.x, y: midY });
      path.push({ x: to.x, y: midY });
    } else if (fromPoint === 'top' && toPoint === 'bottom') {
      // 顶部到底部（垂直连接）
      const midY = (from.y + to.y) / 2;
      path.push({ x: from.x, y: midY });
      path.push({ x: to.x, y: midY });
    } else if (fromPoint === 'top' && toPoint === 'right') {
      // 顶部 → 右侧（三段绕行：先抬到目标下方水平段，再水平到目标 x，再上抬接入）
      // 默认绕行高度：取目标和起点 y 之间的较低位置 + 偏移，避免与主水平干流冲突
      const detourY = Math.min(from.y, to.y + 100);
      path.push({ x: from.x, y: detourY });
      path.push({ x: to.x, y: detourY });
    } else if (fromPoint === 'top' && toPoint === 'left') {
      // 顶部 → 左侧：先向上抬升，再水平向右接入
      path.push({ x: from.x, y: to.y });
    } else if (fromPoint === 'bottom' && toPoint === 'right') {
      // 底部 → 右侧
      path.push({ x: from.x, y: to.y });
    } else if (fromPoint === 'bottom' && toPoint === 'left') {
      // 底部 → 左侧
      path.push({ x: from.x, y: to.y });
    } else if (fromPoint === 'right' && toPoint === 'top') {
      // 右侧 → 顶部
      path.push({ x: to.x, y: from.y });
    } else if (fromPoint === 'left' && toPoint === 'top') {
      // 左侧 → 顶部
      path.push({ x: to.x, y: from.y });
    } else {
      // 默认：L型连接
      if (Math.abs(dx) > Math.abs(dy)) {
        path.push({ x: from.x + dx / 2, y: from.y });
        path.push({ x: from.x + dx / 2, y: to.y });
      } else {
        path.push({ x: from.x, y: from.y + dy / 2 });
        path.push({ x: to.x, y: from.y + dy / 2 });
      }
    }

    path.push(to);
    return path;
  }

  private static drawArrow(
    ctx: CanvasRenderingContext2D,
    path: { x: number; y: number }[],
    color: string
  ) {
    // 在路径最后一段绘制箭头（靠近终点）
    if (path.length < 2) return;

    // 取最后两个点计算方向
    const p1 = path[path.length - 2];
    const p2 = path[path.length - 1];

    // 在距离终点20px的位置绘制箭头
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const arrowX = p2.x - Math.cos(angle) * 20;
    const arrowY = p2.y - Math.sin(angle) * 20;

    ctx.save();
    ctx.translate(arrowX, arrowY);
    ctx.rotate(angle);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private static drawLabel(
    ctx: CanvasRenderingContext2D,
    path: { x: number; y: number }[],
    medium: string,
    color: string
  ) {
    // 在路径中点上方绘制标签
    const midIndex = Math.floor(path.length / 2);
    const p1 = path[midIndex - 1] || path[0];
    const p2 = path[midIndex] || path[path.length - 1];

    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    // 计算标签位置（在管道上方）
    const labelY = midY - 18;

    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textWidth = ctx.measureText(medium).width;

    // 标签背景
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.fillRect(midX - textWidth / 2 - 6, labelY - 10, textWidth + 12, 20);

    // 标签边框
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(midX - textWidth / 2 - 6, labelY - 10, textWidth + 12, 20);

    // 标签文字
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(medium, midX, labelY);
  }

  private static getConnectionPoint(equipmentId: string, point: string): { x: number; y: number } | null {
    // 设备坐标映射（与config.ts中的坐标对应）
    const equipmentPositions: Record<string, { x: number; y: number; w: number; h: number }> = {
      'R-101': { x: 620, y: 180, w: 100, h: 140 },
      'REG-101': { x: 820, y: 180, w: 100, h: 140 },
      'T-101': { x: 1020, y: 160, w: 90, h: 180 },
      'F-101': { x: 420, y: 200, w: 120, h: 100 },
      'E-101': { x: 260, y: 400, w: 100, h: 100 },
      'P-101': { x: 80, y: 420, w: 80, h: 80 },
      'K-101': { x: 940, y: 470, w: 100, h: 100 },
      'V-101': { x: 720, y: 20, w: 50, h: 50 },
      'PI-101': { x: 520, y: 20, w: 60, h: 60 },
      'ROB-101': { x: 200, y: 200, w: 80, h: 100 },
      'ROB-102': { x: 400, y: 200, w: 80, h: 100 },
      'CONV-101': { x: 100, y: 350, w: 500, h: 40 },
      'FIX-101': { x: 180, y: 320, w: 60, h: 40 },
      'FIX-102': { x: 380, y: 320, w: 60, h: 40 },
      'INST-101': { x: 550, y: 200, w: 50, h: 50 },
    };

    const pos = this.liveEquipmentMap[equipmentId] ?? equipmentPositions[equipmentId];
    if (!pos) return null;

    switch (point) {
      case 'top':
        return { x: pos.x + pos.w / 2, y: pos.y };
      case 'bottom':
        return { x: pos.x + pos.w / 2, y: pos.y + pos.h };
      case 'left':
        return { x: pos.x, y: pos.y + pos.h / 2 };
      case 'right':
        return { x: pos.x + pos.w, y: pos.y + pos.h / 2 };
      case 'center':
        return { x: pos.x + pos.w / 2, y: pos.y + pos.h / 2 };
      default:
        return { x: pos.x + pos.w / 2, y: pos.y + pos.h / 2 };
    }
  }
}
