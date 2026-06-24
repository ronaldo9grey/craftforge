import type { Equipment } from '@/types';

export class EquipmentRenderer {
  static render(
    ctx: CanvasRenderingContext2D,
    equipment: Equipment,
    isSelected: boolean,
    isFaulty: boolean,
    time: number = 0
  ) {
    ctx.save();
    try {

    // 动画时间相位（用于传送带、机器人摆动等）
    const animTime = time ?? 0;
    
    const { x, y, width, height, status, type, name, id } = equipment;

    // 跳过尺寸过小或位置在画布外的设备（用于"隐藏但保留参数"的场景，例如 FGT-301 屋顶烟道代替）
    if (width < 10 || height < 10 || x < -100 || y < -100) {
      return;
    }
    
    // 确定颜色
    let fillColor = '#475569';
    let strokeColor = '#64748b';
    
    if (isFaulty) {
      fillColor = '#ef4444';
      strokeColor = '#f87171';
    } else if (status === 'warning') {
      fillColor = '#f59e0b';
      strokeColor = '#fbbf24';
    } else if (status === 'danger') {
      fillColor = '#ef4444';
      strokeColor = '#f87171';
    } else if (status === 'offline') {
      fillColor = '#64748b';
      strokeColor = '#94a3b8';
    } else if (status === 'highlight') {
      fillColor = '#3b82f6';
      strokeColor = '#60a5fa';
    } else {
      // 正常状态根据类型着色
      switch (type) {
        case 'reactor':
        case 'regenerator':
          fillColor = '#374151';
          break;
        case 'cell':
        case 'cell-iso':
          // 电解槽：深青色（呼应电解质冰晶石熔体颜色）
          fillColor = '#0c4a6e';
          break;
        case 'crane-iso':
          // 天车横梁：钢灰
          fillColor = '#475569';
          break;
        case 'pot-ctrl':
          // 槽控柜：深灰金属外壳
          fillColor = '#1f2937';
          break;
        case 'task-board':
          // 班组任务台：深蓝办公屏
          fillColor = '#1e293b';
          break;
        case 'heater':
          fillColor = '#7c2d12';
          break;
        case 'exchanger':
          fillColor = '#064e3b';
          break;
        case 'pump':
        case 'compressor':
          fillColor = '#1e3a8a';
          break;
        case 'robot':
          fillColor = '#312e81';
          break;
        case 'conveyor':
          fillColor = '#422006';
          break;
        case 'fixture':
          fillColor = '#1e293b';
          break;
        case 'weld_gun':
          fillColor = '#7c2d12';
          break;
        case 'control_box':
          fillColor = '#334155';
          break;
        case 'station':
          fillColor = '#3f3f46';
          break;
        default:
          fillColor = '#475569';
      }
    }
    
    // 故障脉冲效果
    if (isFaulty) {
      const pulseAlpha = 0.3 + Math.sin(Date.now() / 200) * 0.2;
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 20 * pulseAlpha;
    } else if (isSelected) {
      ctx.shadowColor = '#3b82f6';
      ctx.shadowBlur = 15;
    }
    
    // 绘制设备形状（传入动画相位，驱动机器人/传送带动画）
    this.drawEquipmentShape(ctx, type, x, y, width, height, fillColor, strokeColor, animTime, equipment.id);
    
    // 绘制设备标签
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // ⭐ 自带铭牌/标题的设备类型，跳过外部 name + id 渲染，避免与其他元素重叠
    //   - cell-iso：内部左下角已画"#101 · 600 kA"铭牌
    //   - task-board：顶部标题条已显示"班组生产任务"
    //   - pot-ctrl：内部已画"POT-CTRL-101"
    //   - crane-iso：横梁极扁，外部 name 会糊在管道/抬包上
    const SELF_LABELED = ['cell-iso', 'task-board', 'pot-ctrl', 'crane-iso'];
    const skipExternalLabel = SELF_LABELED.includes(type);

    if (!skipExternalLabel) {
      // 名称显示在设备上方 - 加大与设备图形的间距，避免被塞阀阀杆/加热炉烟囱/分馏塔顶塔盘等顶部装饰物覆盖
      // 阀门顶部有阀杆+手轮（占 24px 高），标签需再上移
      const nameOffset = type === 'valve' ? 38 : 22;
      ctx.fillStyle = '#f1f5f9';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillText(name, x + width / 2, y - nameOffset);

      // 设备ID显示在设备下方 - 与上方间距保持一致
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Roboto Mono, monospace';
      ctx.fillText(id, x + width / 2, y + height + 22);
    }
    
    // 选中高亮边框
    if (isSelected) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(x - 5, y - 5, width + 10, height + 10);
      ctx.setLineDash([]);
    }
    
    } finally {
      // 关键：用 try/finally 确保即便中间分支抛错，ctx.restore() 也一定执行
      // 否则会导致每帧 translate 累积，画面持续向下漂移（"瞬间正确然后逐渐下移"现象的根因）
      ctx.restore();
    }
  }
  
  private static drawEquipmentShape(
    ctx: CanvasRenderingContext2D,
    type: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor: string,
    strokeColor: string,
    animTime: number = 0,
    id: string = ''
  ) {
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5;
    
    switch (type) {
      case 'reactor':
      case 'regenerator':
        // 圆柱体 - 圆角矩形 + 顶部椭圆 + 底部椭圆
        this.roundRect(ctx, x, y, width, height, 8);
        ctx.fill();
        ctx.stroke();
        
        // 顶部椭圆（3D效果）
        ctx.beginPath();
        ctx.ellipse(x + width / 2, y, width / 2, 8, 0, 0, Math.PI * 2);
        ctx.fillStyle = this.lightenColor(fillColor, 30);
        ctx.fill();
        ctx.stroke();
        
        // 底部椭圆
        ctx.beginPath();
        ctx.ellipse(x + width / 2, y + height, width / 2, 8, 0, 0, Math.PI * 2);
        ctx.fillStyle = this.darkenColor(fillColor, 20);
        ctx.fill();
        ctx.stroke();
        
        // 内部细节 - 垂直线条
        ctx.strokeStyle = this.lightenColor(fillColor, 15);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + width * 0.3, y + 15);
        ctx.lineTo(x + width * 0.3, y + height - 15);
        ctx.moveTo(x + width * 0.7, y + 15);
        ctx.lineTo(x + width * 0.7, y + height - 15);
        ctx.stroke();
        break;
        
      case 'fractionator':
        // 分馏塔 - 多层矩形 + 塔盘效果
        const layers = 5;
        const layerHeight = height / layers;
        for (let i = 0; i < layers; i++) {
          const ly = y + i * layerHeight;
          const layerWidth = width * (0.7 + i * 0.06);
          const lx = x + (width - layerWidth) / 2;
          
          // 塔层
          this.roundRect(ctx, lx, ly, layerWidth, layerHeight - 2, 4);
          ctx.fillStyle = i % 2 === 0 ? fillColor : this.lightenColor(fillColor, 10);
          ctx.fill();
          ctx.stroke();
          
          // 塔盘线条
          if (i < layers - 1) {
            ctx.strokeStyle = this.lightenColor(fillColor, 25);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(lx + 5, ly + layerHeight - 2);
            ctx.lineTo(lx + layerWidth - 5, ly + layerHeight - 2);
            ctx.stroke();
          }
        }
        
        // 顶部帽子
        ctx.beginPath();
        ctx.moveTo(x + width / 2 - 15, y);
        ctx.lineTo(x + width / 2, y - 15);
        ctx.lineTo(x + width / 2 + 15, y);
        ctx.closePath();
        ctx.fillStyle = this.lightenColor(fillColor, 20);
        ctx.fill();
        ctx.stroke();
        break;
        
      case 'heater':
        // 加热炉 - 圆角矩形 + 烟囱 + 火焰效果
        this.roundRect(ctx, x, y, width, height, 6);
        ctx.fill();
        ctx.stroke();
        
        // 烟囱
        ctx.fillStyle = this.darkenColor(fillColor, 30);
        ctx.fillRect(x + width / 2 - 8, y - 20, 16, 20);
        ctx.strokeRect(x + width / 2 - 8, y - 20, 16, 20);
        
        // 烟囱顶部
        ctx.beginPath();
        ctx.ellipse(x + width / 2, y - 20, 10, 3, 0, 0, Math.PI * 2);
        ctx.fillStyle = this.darkenColor(fillColor, 40);
        ctx.fill();
        ctx.stroke();
        
        // 火焰动画
        const flameTime = Date.now() / 200;
        const flameHeight = 15 + Math.sin(flameTime) * 5;
        ctx.beginPath();
        ctx.moveTo(x + width / 2, y + height - 8);
        ctx.quadraticCurveTo(x + width / 2 - 8, y + height - 8 - flameHeight * 0.6, x + width / 2, y + height - 8 - flameHeight);
        ctx.quadraticCurveTo(x + width / 2 + 8, y + height - 8 - flameHeight * 0.6, x + width / 2, y + height - 8);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
        
        // 内部火焰
        ctx.beginPath();
        ctx.moveTo(x + width / 2, y + height - 8);
        ctx.quadraticCurveTo(x + width / 2 - 5, y + height - 8 - flameHeight * 0.4, x + width / 2, y + height - 8 - flameHeight * 0.7);
        ctx.quadraticCurveTo(x + width / 2 + 5, y + height - 8 - flameHeight * 0.4, x + width / 2, y + height - 8);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        break;
        
      case 'exchanger':
        // 换热器 - 卧式圆柱体
        this.roundRect(ctx, x, y + height * 0.25, width, height * 0.5, height * 0.25);
        ctx.fill();
        ctx.stroke();
        
        // 左管板
        ctx.beginPath();
        ctx.ellipse(x, y + height / 2, height * 0.25, height * 0.25, 0, 0, Math.PI * 2);
        ctx.fillStyle = this.darkenColor(fillColor, 15);
        ctx.fill();
        ctx.stroke();
        
        // 右管板
        ctx.beginPath();
        ctx.ellipse(x + width, y + height / 2, height * 0.25, height * 0.25, 0, 0, Math.PI * 2);
        ctx.fillStyle = this.darkenColor(fillColor, 15);
        ctx.fill();
        ctx.stroke();
        
        // 内部换热管
        ctx.strokeStyle = this.lightenColor(fillColor, 20);
        ctx.lineWidth = 2;
        for (let i = 1; i <= 3; i++) {
          const tubeY = y + height * 0.25 + (height * 0.5 / 4) * i;
          ctx.beginPath();
          ctx.moveTo(x + 10, tubeY);
          ctx.lineTo(x + width - 10, tubeY);
          ctx.stroke();
        }
        break;
        
      case 'pump':
        // 泵 - 离心泵样式
        ctx.beginPath();
        ctx.arc(x + width / 2, y + height / 2, width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // 泵体细节
        ctx.beginPath();
        ctx.arc(x + width / 2, y + height / 2, width / 2 - 8, 0, Math.PI * 2);
        ctx.strokeStyle = this.lightenColor(fillColor, 20);
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 进口
        ctx.fillStyle = this.darkenColor(fillColor, 20);
        ctx.fillRect(x - 8, y + height / 2 - 6, 12, 12);
        ctx.strokeRect(x - 8, y + height / 2 - 6, 12, 12);
        
        // 出口
        ctx.fillRect(x + width - 4, y + height / 2 - 6, 12, 12);
        ctx.strokeRect(x + width - 4, y + height / 2 - 6, 12, 12);
        
        // 旋转箭头动画
        const pumpTime = Date.now() / 500;
        ctx.save();
        ctx.translate(x + width / 2, y + height / 2);
        ctx.rotate(pumpTime);
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, width / 4, 0, Math.PI * 1.5);
        ctx.stroke();
        // 箭头
        ctx.beginPath();
        ctx.moveTo(width / 4, -5);
        ctx.lineTo(width / 4 + 5, 0);
        ctx.lineTo(width / 4, 5);
        ctx.fill();
        ctx.restore();
        break;
        
      case 'compressor':
        // 压缩机 - 蜗壳式
        ctx.beginPath();
        ctx.arc(x + width / 2, y + height / 2, width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // 蜗壳螺旋线
        ctx.strokeStyle = this.lightenColor(fillColor, 20);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + width / 2, y + height / 2, width / 3, 0, Math.PI * 1.8);
        ctx.stroke();
        
        // 出口管道
        ctx.fillStyle = this.darkenColor(fillColor, 20);
        ctx.fillRect(x + width - 5, y + height / 2 - 8, 15, 16);
        ctx.strokeRect(x + width - 5, y + height / 2 - 8, 15, 16);
        
        // 旋转指示
        const compTime = Date.now() / 300;
        ctx.save();
        ctx.translate(x + width / 2, y + height / 2);
        ctx.rotate(compTime);
        ctx.fillStyle = '#f1f5f9';
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-4, -6);
        ctx.lineTo(-4, 6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
        
      case 'valve':
        // 阀门 - 闸阀样式
        // 阀体
        ctx.beginPath();
        ctx.moveTo(x + width / 2, y);
        ctx.lineTo(x + width, y + height / 2);
        ctx.lineTo(x + width / 2, y + height);
        ctx.lineTo(x, y + height / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // 阀杆
        ctx.fillStyle = this.lightenColor(fillColor, 30);
        ctx.fillRect(x + width / 2 - 4, y - 12, 8, 14);
        ctx.strokeRect(x + width / 2 - 4, y - 12, 8, 14);
        
        // 手轮
        ctx.beginPath();
        ctx.arc(x + width / 2, y - 14, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
        ctx.stroke();
        
        // 手轮辐条
        ctx.strokeStyle = this.darkenColor('#f59e0b', 20);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + width / 2 - 8, y - 14);
        ctx.lineTo(x + width / 2 + 8, y - 14);
        ctx.moveTo(x + width / 2, y - 22);
        ctx.lineTo(x + width / 2, y - 6);
        ctx.stroke();
        break;
        
      case 'instrument':
        // 仪表 - 圆形表盘（带刻度）
        const cx = x + width / 2;
        const cy = y + height / 2;
        const radius = width / 2 - 2;
        
        // 表盘外圈
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 刻度线
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 10; i++) {
          const tickAngle = -Math.PI * 0.8 + (i / 10) * Math.PI * 1.6;
          const isMajor = i % 5 === 0;
          const tickLen = isMajor ? 6 : 3;
          ctx.beginPath();
          ctx.moveTo(
            cx + Math.cos(tickAngle) * (radius - tickLen - 2),
            cy + Math.sin(tickAngle) * (radius - tickLen - 2)
          );
          ctx.lineTo(
            cx + Math.cos(tickAngle) * (radius - 2),
            cy + Math.sin(tickAngle) * (radius - 2)
          );
          ctx.stroke();
        }
        
        // 指针（基于时间平滑摆动）
        const time = Date.now() / 1000;
        const pointerAngle = -Math.PI * 0.6 + Math.sin(time) * 0.3 + 0.3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(
          cx + Math.cos(pointerAngle) * (radius - 8),
          cy + Math.sin(pointerAngle) * (radius - 8)
        );
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 中心点
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        break;
        
      case 'robot': {
        // 六轴关节机器人 v4：宽矮造型 (110×80)，底座+转台+机身+大臂+肘关节+前臂+焊枪
        const armSwing = Math.sin(animTime * 0.03) * 0.15; // 微摆
        const cx = x + width / 2;
        const baseY = y + height - 10;
        // 底座
        ctx.fillStyle = '#475569';
        this.roundRect(ctx, x + 10, baseY, width - 20, 10, 3);
        ctx.fill();
        ctx.strokeStyle = '#64748b';
        ctx.stroke();
        // 转台
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(cx, baseY - 6, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // 机身（宽扁）
        ctx.fillStyle = fillColor;
        this.roundRect(ctx, x + 14, y + 18, width - 28, height - 42, 4);
        ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.stroke();
        // 大臂
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        const shoulderX = cx + armSwing * 5;
        const shoulderY = y + 28;
        ctx.beginPath();
        ctx.moveTo(shoulderX, shoulderY);
        const elbowX = shoulderX + 14 + armSwing * 6;
        const elbowY = shoulderY + 22;
        ctx.lineTo(elbowX, elbowY);
        ctx.stroke();
        // 前臂
        ctx.beginPath();
        ctx.moveTo(elbowX, elbowY);
        const wristX = elbowX + 10;
        const wristY = elbowY + 16;
        ctx.lineTo(wristX, wristY);
        ctx.stroke();
        // 肘关节
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(elbowX, elbowY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // 焊枪头
        ctx.beginPath();
        ctx.arc(wristX, wristY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // 指示灯
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.arc(cx, y + 24, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'conveyor': {
        // 传送带 v3：长矩形 + 旋转滚轮（动画） + 走马灯式承载线 + 物料块
        this.roundRect(ctx, x, y + 6, width, height - 12, 3);
        ctx.fill();
        ctx.stroke();
        // 旋转滚轮（每个滚轮按相位旋转）
        const rollerR = 6;
        const rollerSpin = animTime * 0.08; // 角速度
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1;
        for (let rx = x + 15; rx < x + width - 10; rx += 32) {
          // 滚轮主圆
          ctx.fillStyle = this.lightenColor(fillColor, 30);
          ctx.beginPath();
          ctx.arc(rx, y + height / 2, rollerR, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // 滚轮上的十字线（旋转视觉）
          ctx.save();
          ctx.translate(rx, y + height / 2);
          ctx.rotate(rollerSpin);
          ctx.strokeStyle = '#0f172a';
          ctx.beginPath();
          ctx.moveTo(-rollerR + 1, 0);
          ctx.lineTo(rollerR - 1, 0);
          ctx.moveTo(0, -rollerR + 1);
          ctx.lineTo(0, rollerR - 1);
          ctx.stroke();
          ctx.restore();
        }
        // 走马灯式承载线（虚线偏移产生流动感）
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1;
        ctx.setLineDash([8, 4]);
        ctx.lineDashOffset = -animTime * 0.5;
        ctx.beginPath();
        ctx.moveTo(x + 8, y + height / 2 + 9);
        ctx.lineTo(x + width - 8, y + height / 2 + 9);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 8, y + height / 2 - 9);
        ctx.lineTo(x + width - 8, y + height / 2 - 9);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
        // 物料块（一个小车身在传送带上随时间从左到右移动并循环）
        const carPhase = ((animTime * 0.7) % (width - 30)) + 10;
        ctx.fillStyle = '#cbd5e1';
        ctx.strokeStyle = '#475569';
        this.roundRect(ctx, x + carPhase, y + height / 2 - 4, 18, 8, 2);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'fixture':
        // 夹紧定位夹具 - 底板 + 双夹爪 + 定位销
        // 底板
        ctx.fillRect(x + 4, y + height - 8, width - 8, 8);
        ctx.strokeRect(x + 4, y + height - 8, width - 8, 8);
        // 左夹爪
        ctx.fillRect(x, y + 4, 8, height - 12);
        ctx.strokeRect(x, y + 4, 8, height - 12);
        // 右夹爪
        ctx.fillRect(x + width - 8, y + 4, 8, height - 12);
        ctx.strokeRect(x + width - 8, y + 4, 8, height - 12);
        // 定位销（小圆）
        ctx.fillStyle = this.lightenColor(fillColor, 30);
        ctx.beginPath();
        ctx.arc(x + width / 2, y + height / 2, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;

      case 'weld_gun':
        // 焊枪 - 枪身 + 喷嘴 + 线缆
        ctx.fillRect(x + 4, y + 6, width - 8, height - 12);
        ctx.strokeRect(x + 4, y + 6, width - 8, height - 12);
        // 喷嘴（锥形）
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.moveTo(x + 6, y + 6);
        ctx.lineTo(x + width / 2, y);
        ctx.lineTo(x + width - 6, y + 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // 线缆（圆）
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(x + width / 2, y + height - 4, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;

      case 'control_box':
        // 控制柜 - 矩形 + 屏幕 + 按钮
        this.roundRect(ctx, x + 4, y + 2, width - 8, height - 4, 4);
        ctx.fill();
        ctx.stroke();
        // 屏幕
        ctx.fillStyle = '#1e293b';
        this.roundRect(ctx, x + 10, y + 6, width - 20, 20, 2);
        ctx.fill();
        // 屏幕亮条
        ctx.fillStyle = '#22d3ee';
        ctx.fillRect(x + 14, y + 10, 4, 4);
        ctx.fillRect(x + 14, y + 18, 4, 3);
        // 按钮列
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(x + 20, y + height - 12, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(x + 34, y + height - 12, 3, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'station':
        // 工位台 - 台面 + 支柱 + 信号灯
        // 台面
        ctx.fillRect(x + 2, y + 10, width - 4, height - 14);
        ctx.strokeRect(x + 2, y + 10, width - 4, height - 14);
        // 支柱
        ctx.fillStyle = '#475569';
        ctx.fillRect(x + 6, y + height - 6, width - 12, 6);
        // 信号灯
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(x + width / 2, y + 6, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;

      case 'cell': {
        // 电解槽：矮胖梯形外壳 + 顶部 8 块阳极棒阵列 + 电解质熔体层 + 槽边沿
        // 真实形态：1-2m 高、12-18m 长、3-5m 宽的钢壳，顶上排排碳阳极
        const padTop = 8;
        const anodeRowH = 14;             // 阳极棒高度区
        const bathH = Math.max(8, height * 0.35);  // 电解质层高度
        const shellTop = y + padTop + anodeRowH;

        // 槽体外壳（轻微梯形，下窄上宽）
        ctx.beginPath();
        ctx.moveTo(x + 6, shellTop);
        ctx.lineTo(x + width - 6, shellTop);
        ctx.lineTo(x + width - 12, y + height - 4);
        ctx.lineTo(x + 12, y + height - 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 电解质熔体层（青色亮带，位于槽内上层）
        ctx.fillStyle = '#0ea5e9';
        ctx.globalAlpha = 0.6;
        ctx.fillRect(x + 10, shellTop + 4, width - 20, bathH);
        ctx.globalAlpha = 1;
        // 熔体表面高光线
        ctx.strokeStyle = '#7dd3fc';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + 12, shellTop + 5);
        ctx.lineTo(x + width - 12, shellTop + 5);
        ctx.stroke();

        // 底部铝水层（暖橙色）
        ctx.fillStyle = '#f97316';
        ctx.globalAlpha = 0.7;
        const alTop = shellTop + 4 + bathH;
        const alH = (y + height - 8) - alTop;
        if (alH > 4) ctx.fillRect(x + 12, alTop, width - 24, alH);
        ctx.globalAlpha = 1;

        // 顶部阳极棒阵列（8 根碳块，竖直长方体）
        const anodeCount = 8;
        const anodeW = Math.floor((width - 20) / anodeCount) - 2;
        ctx.fillStyle = '#1c1917';  // 碳黑
        ctx.strokeStyle = '#78716c';
        ctx.lineWidth = 1;
        for (let i = 0; i < anodeCount; i++) {
          const ax = x + 10 + i * (anodeW + 2);
          ctx.fillRect(ax, y + 4, anodeW, anodeRowH);
          ctx.strokeRect(ax, y + 4, anodeW, anodeRowH);
          // 导电棒（小黄竖线连接到顶部母线）
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ax + anodeW / 2, y);
          ctx.lineTo(ax + anodeW / 2, y + 4);
          ctx.stroke();
          ctx.strokeStyle = '#78716c';
          ctx.lineWidth = 1;
        }

        // 槽边沿铭牌（中央顶部小标识带）
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(x + width / 2 - 12, shellTop - 2, 24, 4);
        break;
      }

      case 'cell-iso': {
        // 电解槽 v9 侧面解剖图（横剖视图，正面看进去）
        // 真实 600 kA 大型预焙阳极电解槽侧面结构（从上到下）：
        //   ① 集烟罩（钢板梯形罩）
        //   ② 4 个打壳下料点（顶部金黄小方块）
        //   ③ 阳极母线（顶部金黄超粗水平条 + 标签"+"极）
        //   ④ 22 根铝导杆（金黄竖线，从母线垂直下到阳极）
        //   ⑤ 22 个钢爪（深灰短竖块，连接导杆和碳块）
        //   ⑥ 22 块碳阳极块（黑色长方体，下端浸入电解质）
        //   ⑦ 电解质熔体层（青色 / 表面有结壳壳层"白色"）
        //   ⑧ 铝水层（橙红 / 沉在槽底）
        //   ⑨ 阴极碳块（深灰大方块，铺满槽底）
        //   ⑩ 阴极钢棒（左右各伸出 1 根金黄横棒，对应阴极母线）
        //   ⑪ 槽底保温层（深棕色，最底部）
        //   ⑫ 槽壳钢结构（黑色外框）
        //   ⑬ 标签"-"极、"+"极
        const W = width, H = height;
        const cx = x + W / 2;

        // ① 集烟罩（梯形）+ 烟道
        const hoodTopL = x + W * 0.30, hoodTopR = x + W * 0.70;
        const hoodBotL = x + W * 0.05, hoodBotR = x + W * 0.95;
        const hoodY1 = y;
        const hoodY2 = y + H * 0.09;
        ctx.fillStyle = '#475569';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(hoodTopL, hoodY1);
        ctx.lineTo(hoodTopR, hoodY1);
        ctx.lineTo(hoodBotR, hoodY2);
        ctx.lineTo(hoodBotL, hoodY2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fill();
        // 烟道竖管
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(cx, hoodY1);
        ctx.lineTo(cx, y - 16);
        ctx.stroke();
        ctx.lineWidth = 1;

        // ② 4 个打壳下料点
        const feedPtY = hoodY2 + 4;
        ctx.fillStyle = '#fbbf24';
        ctx.strokeStyle = '#a16207';
        ctx.lineWidth = 1;
        for (let p = 0; p < 4; p++) {
          const px = x + W * (0.18 + p * 0.21);
          ctx.fillRect(px - 6, feedPtY, 12, 5);
          ctx.strokeRect(px - 6, feedPtY, 12, 5);
        }

        // ③ 阳极母线（金黄水平超粗条）+ "+" 标识
        const anodeAreaL = x + W * 0.07;
        const anodeAreaR = x + W * 0.93;
        const anodeAreaW = anodeAreaR - anodeAreaL;
        const anodeCount = 22;
        const anodeStepX = anodeAreaW / anodeCount;
        const anodeBlockW = anodeStepX * 0.82;
        const anodeBaseY = feedPtY + 14;

        const anodeBusY = anodeBaseY;
        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1;
        ctx.fillRect(anodeAreaL - 10, anodeBusY, anodeAreaW + 20, 9);
        ctx.strokeRect(anodeAreaL - 10, anodeBusY, anodeAreaW + 20, 9);
        ctx.strokeStyle = '#fef3c7';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(anodeAreaL - 8, anodeBusY + 2);
        ctx.lineTo(anodeAreaR + 8, anodeBusY + 2);
        ctx.stroke();
        // "+" 极标签（左端）带圆形背景
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(anodeAreaL - 16, anodeBusY + 4, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', anodeAreaL - 16, anodeBusY + 4);

        // ④⑤⑥ 铝导杆 + 钢爪 + 碳阳极块（单排 22 个，侧视图）
        const stemY1 = anodeBusY + 9;
        const stemY2 = stemY1 + 12;
        const clawY2 = stemY2 + 8;
        const blockH = 22;
        for (let i = 0; i < anodeCount; i++) {
          const ax = anodeAreaL + anodeStepX * (i + 0.5);
          // ④ 铝导杆
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 2.8;
          ctx.beginPath();
          ctx.moveTo(ax, stemY1);
          ctx.lineTo(ax, stemY2);
          ctx.stroke();
          // ⑤ 钢爪
          ctx.fillStyle = '#52525b';
          ctx.strokeStyle = '#27272a';
          ctx.lineWidth = 0.6;
          ctx.fillRect(ax - 3, stemY2, 6, 8);
          ctx.strokeRect(ax - 3, stemY2, 6, 8);
          // ⑥ 碳阳极块（黑色长方体 + 顶部高光）
          const blockGrad = ctx.createLinearGradient(ax, clawY2, ax, clawY2 + blockH);
          blockGrad.addColorStop(0, '#1f2937');
          blockGrad.addColorStop(1, '#0a0a0a');
          ctx.fillStyle = blockGrad;
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 0.5;
          ctx.fillRect(ax - anodeBlockW / 2, clawY2, anodeBlockW, blockH);
          ctx.strokeRect(ax - anodeBlockW / 2, clawY2, anodeBlockW, blockH);
          // 碳块底部火苗（动画）
          if (i % 2 === 0) {
            const animT = animTime ?? Date.now() / 1000;
            const flick = 0.5 + 0.5 * Math.sin(animT * 5 + i);
            ctx.fillStyle = `rgba(255, 140, 30, ${flick * 0.85})`;
            ctx.fillRect(ax - anodeBlockW / 2 + 1, clawY2 + blockH - 3, anodeBlockW - 2, 3);
          }
        }

        // ============ 槽壳剖切（侧视图，不再画 isometric 投影）============
        const shellY1 = clawY2 + blockH + 2;
        const shellY2 = y + H * 0.95;
        const shellH = shellY2 - shellY1;
        const shellL = x + W * 0.04;
        const shellR = x + W * 0.96;

        // ⑫ 外槽壳（钢板包围）+ 顶部封板
        ctx.fillStyle = '#1f2937';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.fillRect(shellL, shellY1, shellR - shellL, shellH);
        ctx.strokeRect(shellL, shellY1, shellR - shellL, shellH);

        // 内部空间（剖切面）
        const innerL = shellL + 8;
        const innerR = shellR - 8;
        const innerT = shellY1 + 4;
        const innerB = shellY2 - 4;
        const innerH = innerB - innerT;

        // 划分内部层（自顶向下）
        // 比例：电解质 40% / 铝水 30% / 阴极碳块 22% / 保温层 8%
        const bathTopY = innerT;
        const bathBotY = innerT + innerH * 0.40;
        const alTopY = bathBotY;
        const alBotY = innerT + innerH * 0.70;
        const cathodeTopY = alBotY;
        const cathodeBotY = innerT + innerH * 0.92;
        const insulTopY = cathodeBotY;

        // ⑦ 电解质熔体层（青色渐变）
        const bathGrad = ctx.createLinearGradient(innerL, bathTopY, innerL, bathBotY);
        bathGrad.addColorStop(0, '#0ea5e9');
        bathGrad.addColorStop(1, '#0c4a6e');
        ctx.fillStyle = bathGrad;
        ctx.fillRect(innerL, bathTopY, innerR - innerL, bathBotY - bathTopY);

        // 电解质表面结壳壳层（白色不规则带）
        ctx.fillStyle = '#e0f2fe';
        ctx.fillRect(innerL, bathTopY, innerR - innerL, 4);
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 0.5;
        for (let cx2 = innerL; cx2 < innerR; cx2 += 12) {
          ctx.beginPath();
          ctx.moveTo(cx2, bathTopY + 4);
          ctx.lineTo(cx2 + 4, bathTopY + 2);
          ctx.lineTo(cx2 + 8, bathTopY + 4);
          ctx.stroke();
        }
        // 标签："电解质 950°C"
        ctx.fillStyle = '#7dd3fc';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('电解质 ~950°C', innerL + 6, (bathTopY + bathBotY) / 2);

        // ⑧ 铝水层（橙红渐变 + 流动波纹）
        const alGrad = ctx.createLinearGradient(innerL, alTopY, innerL, alBotY);
        alGrad.addColorStop(0, '#fb923c');
        alGrad.addColorStop(1, '#7c2d12');
        ctx.fillStyle = alGrad;
        ctx.fillRect(innerL, alTopY, innerR - innerL, alBotY - alTopY);
        // 表面高光
        ctx.strokeStyle = '#fcd34d';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(innerL + 4, alTopY + 1);
        ctx.lineTo(innerR - 4, alTopY + 1);
        ctx.stroke();
        // 标签："液态铝 ~920°C"
        ctx.fillStyle = '#fef3c7';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.fillText('液态铝 ~920°C', innerL + 6, (alTopY + alBotY) / 2);

        // ⑨ 阴极碳块（深灰大方块）+ 内部颗粒纹理
        ctx.fillStyle = '#262626';
        ctx.fillRect(innerL, cathodeTopY, innerR - innerL, cathodeBotY - cathodeTopY);
        // 颗粒纹理（小斜线）
        ctx.strokeStyle = '#404040';
        ctx.lineWidth = 0.6;
        for (let g = 0; g < 30; g++) {
          const gx = innerL + Math.random() * (innerR - innerL);
          const gy = cathodeTopY + Math.random() * (cathodeBotY - cathodeTopY);
          ctx.beginPath();
          ctx.moveTo(gx, gy);
          ctx.lineTo(gx + 3, gy + 2);
          ctx.stroke();
        }
        // 标签："阴极碳块"
        ctx.fillStyle = '#a3a3a3';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.fillText('阴极碳块', innerL + 6, (cathodeTopY + cathodeBotY) / 2);

        // ⑪ 槽底保温层（深棕色）
        ctx.fillStyle = '#78350f';
        ctx.fillRect(innerL, insulTopY, innerR - innerL, innerB - insulTopY);
        // 标签："保温层"（右端）
        ctx.fillStyle = '#fed7aa';
        ctx.font = 'bold 8px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('保温层', innerR - 6, (insulTopY + innerB) / 2);

        // ⑩ 阴极钢棒（左右各一根金黄横棒，从阴极碳块层伸出）
        const rodY = (cathodeTopY + cathodeBotY) / 2;
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1;
        // 左侧
        ctx.fillRect(x - 8, rodY - 5, shellL + 8 - (x - 8), 10);
        ctx.strokeRect(x - 8, rodY - 5, shellL + 8 - (x - 8), 10);
        // 右侧
        ctx.fillRect(shellR - 8, rodY - 5, (x + W + 8) - (shellR - 8), 10);
        ctx.strokeRect(shellR - 8, rodY - 5, (x + W + 8) - (shellR - 8), 10);
        // "-" 极标签（右端，蓝色圆背景）
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.arc(x + W + 14, rodY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('−', x + W + 14, rodY);

        // ⑬ 铭牌（左下角）
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(shellL + 6, shellY2 - 20, 110, 16);
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const nameTag = id === 'CELL-101' ? '#101 · 600 kA' : id === 'CELL-102' ? '#102 · 600 kA' : '电解槽';
        ctx.fillText(nameTag, shellL + 12, shellY2 - 12);

        // 工人小人（仅 CELL-101）
        if (id === 'CELL-101') {
          const wx = shellL + 130;
          const wy = y + H - 6;
          ctx.fillStyle = '#fcd34d';
          ctx.beginPath();
          ctx.arc(wx, wy - 16, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ea580c';
          ctx.fillRect(wx - 3, wy - 12, 6, 8);
          ctx.fillStyle = '#1f2937';
          ctx.fillRect(wx - 3, wy - 4, 2.5, 4);
          ctx.fillRect(wx + 0.5, wy - 4, 2.5, 4);
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(wx, wy - 18, 3.5, Math.PI, 0);
          ctx.fill();
        }
        break;
      }

      case 'crane-iso': {
        // 天车横梁 v2：桁架 + 滑车 + 挂抬包（红色铝水桶）+ 慢速移动 120s
        ctx.fillStyle = '#475569';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        const beamTop = y + 6;
        const beamBot = y + height - 6;
        const beamMid = (beamTop + beamBot) / 2;
        ctx.fillRect(x, beamTop - 3, width, 4);
        ctx.fillRect(x, beamBot - 1, width, 4);

        // 桁架斜支撑
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.5;
        const segLen = 35;
        for (let sx = x; sx < x + width; sx += segLen * 2) {
          ctx.beginPath();
          ctx.moveTo(sx, beamTop);
          ctx.lineTo(sx + segLen, beamBot);
          ctx.moveTo(sx + segLen, beamTop);
          ctx.lineTo(sx + segLen * 2, beamBot);
          ctx.stroke();
        }

        // 滑车（600s 一周期来回移动，10 分钟一周期 = 真实换极节奏）
        const animT = animTime ?? Date.now() / 1000;
        const period = 600;
        const phase = (animT % period) / period;
        const tri = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
        const trolleyX = x + 30 + tri * (width - 80);
        const trolleyW = 60;
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(trolleyX, beamMid - 8, trolleyW, 16);
        ctx.strokeStyle = '#a16207';
        ctx.strokeRect(trolleyX, beamMid - 8, trolleyW, 16);
        // 滑车轮
        ctx.fillStyle = '#1f2937';
        [6, trolleyW - 6].forEach((dx) => {
          ctx.beginPath();
          ctx.arc(trolleyX + dx, beamMid - 8, 3, 0, Math.PI * 2);
          ctx.arc(trolleyX + dx, beamMid + 8, 3, 0, Math.PI * 2);
          ctx.fill();
        });

        // ============ 起吊钢绳 + 抬包（红色铝水桶）============
        const ropeX = trolleyX + trolleyW / 2;
        const ropeTop = beamMid + 8;
        // 抬包到位停留时往下"取铝"：当 phase 接近 0.3 或 0.7 时平滑下降（避免突变抖动）
        // 用 smoothstep 计算下降系数 dwell ∈ [0,1]，钢绳长度在 22~32 间平滑过渡
        const dist1 = Math.abs(phase - 0.3);
        const dist2 = Math.abs(phase - 0.7);
        const dist = Math.min(dist1, dist2);
        // smoothstep: 距离 0.05 时 dwell=1，距离 0.10 时 dwell=0（线性外侧 + 三次内侧）
        const range = 0.10;
        const tDwell = Math.max(0, Math.min(1, 1 - dist / range));
        const dwell = tDwell * tDwell * (3 - 2 * tDwell);  // smoothstep
        const ropeLen = 22 + dwell * 10;  // 22 ~ 32 范围，平滑过渡 不再抖动
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ropeX, ropeTop);
        ctx.lineTo(ropeX, ropeTop + ropeLen);
        ctx.stroke();

        // 抬包桶（红色烤红铝水罐）
        const ladleY = ropeTop + ropeLen;
        const ladleW = 28;
        const ladleH = 22;
        // 桶身（梯形，下窄上宽）
        ctx.fillStyle = '#dc2626';
        ctx.strokeStyle = '#7f1d1d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ropeX - ladleW / 2, ladleY);
        ctx.lineTo(ropeX + ladleW / 2, ladleY);
        ctx.lineTo(ropeX + ladleW / 2 - 4, ladleY + ladleH);
        ctx.lineTo(ropeX - ladleW / 2 + 4, ladleY + ladleH);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // 桶口高温发光（橙色）
        const ladleGlow = ctx.createLinearGradient(ropeX - ladleW / 2, ladleY, ropeX + ladleW / 2, ladleY);
        ladleGlow.addColorStop(0, 'rgba(252, 211, 77, 0.3)');
        ladleGlow.addColorStop(0.5, 'rgba(255, 140, 30, 0.95)');
        ladleGlow.addColorStop(1, 'rgba(252, 211, 77, 0.3)');
        ctx.fillStyle = ladleGlow;
        ctx.fillRect(ropeX - ladleW / 2 + 2, ladleY + 1, ladleW - 4, 3);
        // 桶身横竖加强筋
        ctx.strokeStyle = '#991b1b';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(ropeX - ladleW / 2 + 2, ladleY + ladleH * 0.5);
        ctx.lineTo(ropeX + ladleW / 2 - 2, ladleY + ladleH * 0.5);
        ctx.stroke();
        // 提手吊耳（两侧黑色圆点）
        ctx.fillStyle = '#1f2937';
        ctx.beginPath();
        ctx.arc(ropeX - ladleW / 2 + 3, ladleY + 2, 2, 0, Math.PI * 2);
        ctx.arc(ropeX + ladleW / 2 - 3, ladleY + 2, 2, 0, Math.PI * 2);
        ctx.fill();

        // 抬包热气升腾（透明灰白色波浪）
        ctx.strokeStyle = 'rgba(229, 231, 235, 0.4)';
        ctx.lineWidth = 1;
        for (let k = 0; k < 3; k++) {
          const wave = Math.sin(animT * 2 + k * 1.5) * 2;
          ctx.beginPath();
          ctx.moveTo(ropeX - 6 + k * 6, ladleY - 4);
          ctx.bezierCurveTo(
            ropeX - 6 + k * 6 + wave, ladleY - 10,
            ropeX - 6 + k * 6 - wave, ladleY - 16,
            ropeX - 6 + k * 6, ladleY - 22,
          );
          ctx.stroke();
        }
        break;
      }

      case 'pot-ctrl': {
        // 槽控柜（PLC 控制柜）：立式机柜外形 + 顶部状态灯条 + 屏幕 + 散热栅
        const padX = 10;
        const cabinetL = x + padX;
        const cabinetR = x + width - padX;
        const cabinetT = y + 4;
        const cabinetB = y + height - 4;

        // 主体柜壳
        const cabGrad = ctx.createLinearGradient(cabinetL, cabinetT, cabinetR, cabinetT);
        cabGrad.addColorStop(0, '#1f2937');
        cabGrad.addColorStop(0.5, '#374151');
        cabGrad.addColorStop(1, '#1f2937');
        ctx.fillStyle = cabGrad;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.2;
        ctx.fillRect(cabinetL, cabinetT, cabinetR - cabinetL, cabinetB - cabinetT);
        ctx.strokeRect(cabinetL, cabinetT, cabinetR - cabinetL, cabinetB - cabinetT);

        // 顶部 5 个状态灯（绿/绿/绿/黄/绿，第 4 灯闪烁）
        const lights = ['#22c55e', '#22c55e', '#22c55e', '#facc15', '#22c55e'];
        const lightSize = 5;
        const lightGap = 14;
        const lightTotalW = lights.length * lightSize + (lights.length - 1) * lightGap;
        const lightStartX = cabinetL + (cabinetR - cabinetL - lightTotalW) / 2;
        const animT = animTime ?? Date.now() / 1000;
        for (let i = 0; i < lights.length; i++) {
          let color = lights[i];
          if (i === 3 && Math.sin(animT * 4) < 0) color = '#92400e';
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(lightStartX + i * (lightSize + lightGap), cabinetT + 9, lightSize / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // 中央液晶屏（黑底 + 青绿色数据波形）
        const screenL = cabinetL + 18;
        const screenT = cabinetT + 18;
        const screenR = cabinetR - 18;
        const screenB = cabinetB - 18;
        ctx.fillStyle = '#020617';
        ctx.fillRect(screenL, screenT, screenR - screenL, screenB - screenT);
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(screenL, screenT, screenR - screenL, screenB - screenT);

        // 屏幕模拟数据波形（运行中的曲线）
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        const wavY = (screenT + screenB) / 2;
        for (let wx = screenL + 2; wx < screenR - 2; wx += 3) {
          const wy = wavY + Math.sin((wx + animT * 35) * 0.18) * 3.5;
          if (wx === screenL + 2) ctx.moveTo(wx, wy);
          else ctx.lineTo(wx, wy);
        }
        ctx.stroke();

        // 屏幕文字 (POT CTRL)
        ctx.fillStyle = '#06b6d4';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('POT CTRL', screenL + 3, screenT + 2);
        // 槽号
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'right';
        const cellNum = id.replace('POT-CTRL-', '#');
        ctx.fillText(cellNum, screenR - 3, screenT + 1);

        // 左右两侧把手（小竖线）
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cabinetL + 4, cabinetT + 18);
        ctx.lineTo(cabinetL + 4, cabinetB - 18);
        ctx.moveTo(cabinetR - 4, cabinetT + 18);
        ctx.lineTo(cabinetR - 4, cabinetB - 18);
        ctx.stroke();
        break;
      }

      case 'task-board': {
        // 班组任务台：工位办公屏样式（v7 放大版 580×120）
        const padX = 10;
        const boardL = x + padX;
        const boardR = x + width - padX;
        const boardT = y + 4;
        const boardB = y + height - 4;
        // 屏框
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2;
        ctx.fillRect(boardL, boardT, boardR - boardL, boardB - boardT);
        ctx.strokeRect(boardL, boardT, boardR - boardL, boardB - boardT);

        // 顶部标题条（高度根据 height 缩放）
        const titleH = Math.min(20, (boardB - boardT) * 0.18);
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(boardL, boardT, boardR - boardL, titleH);
        ctx.fillStyle = '#0f172a';
        const titleFontSize = Math.max(10, Math.min(14, titleH - 6));
        ctx.font = `bold ${titleFontSize}px Inter, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('▎ 班组生产任务', boardL + 8, boardT + titleH / 2);
        // 班次（右侧）
        ctx.textAlign = 'right';
        ctx.fillText('3 班 / 系列 5 / 已完成 3·8', boardR - 8, boardT + titleH / 2);

        // 任务列表（行数和字号根据尺寸自适应）
        const isLarge = (boardB - boardT) > 80;
        const tasks = isLarge ? [
          { done: true,  text: '#101 出铝 5.0 t  已完成' },
          { done: true,  text: '#102 换极 4 块  已完成' },
          { done: true,  text: '巡检阴极母线温度（< 80°C）' },
          { done: false, text: '#102 极距下调 0.3 cm（待执行）' },
          { done: false, text: '清理 #101 槽顶打壳锤（待执行）' },
          { done: false, text: '上报 18:00 当班报表' },
        ] : [
          { done: true,  text: '#101 出铝 5.0 t' },
          { done: true,  text: '#102 换极 4 块' },
          { done: false, text: '巡检阴极母线温度' },
          { done: false, text: '清理打壳锤 *' },
        ];
        const taskListT = boardT + titleH + 4;
        const taskListB = boardB - 4;
        const rowH = (taskListB - taskListT) / tasks.length;
        const rowFontSize = isLarge ? 12 : 9;
        const checkboxSize = isLarge ? 10 : 6;

        tasks.forEach((t, i) => {
          const ry = taskListT + i * rowH + rowH / 2;
          // 复选框
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 1;
          ctx.strokeRect(boardL + 10, ry - checkboxSize / 2, checkboxSize, checkboxSize);
          if (t.done) {
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(boardL + 10 + 1, ry - checkboxSize / 2 + 1, checkboxSize - 2, checkboxSize - 2);
            // ✓ 印
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(boardL + 10 + checkboxSize * 0.2, ry);
            ctx.lineTo(boardL + 10 + checkboxSize * 0.45, ry + checkboxSize * 0.3);
            ctx.lineTo(boardL + 10 + checkboxSize * 0.8, ry - checkboxSize * 0.3);
            ctx.stroke();
          }
          // 文本
          ctx.fillStyle = t.done ? '#64748b' : '#e5e7eb';
          ctx.font = (t.done ? `${rowFontSize}px` : `bold ${rowFontSize}px`) + ' Inter, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(t.text, boardL + 10 + checkboxSize + 6, ry);
        });
        break;
      }

      default:
        this.roundRect(ctx, x, y, width, height, 4);
        ctx.fill();
        ctx.stroke();
    }
  }
  
  private static roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
  
  private static lightenColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = ((num >> 8) & 0x00ff) + amt;
    const B = (num & 0x0000ff) + amt;
    return '#' + (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    ).toString(16).slice(1);
  }
  
  private static darkenColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = ((num >> 8) & 0x00ff) - amt;
    const B = (num & 0x0000ff) - amt;
    return '#' + (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    ).toString(16).slice(1);
  }
}
