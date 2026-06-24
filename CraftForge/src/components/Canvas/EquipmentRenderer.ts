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

    // 动画时间相位（用于传送带、机器人摆动等）
    const animTime = time ?? 0;
    
    const { x, y, width, height, status, type, name, id } = equipment;
    
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
    
    // 选中高亮边框
    if (isSelected) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(x - 5, y - 5, width + 10, height + 10);
      ctx.setLineDash([]);
    }
    
    ctx.restore();
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
        // 电解槽 2.5D 深度还原 (460×220 大尺寸)
        // 真实造型参考 240-500 kA 大型预焙阳极电解槽：
        //   - 顶部集烟罩（梯形罩斗，往上收口）
        //   - 26 块阳极碳块整齐排列在槽顶（黑色矩形）
        //   - 每块阳极通过金黄导电棒连到槽顶横向母线
        //   - 槽体钢壳（深灰长方体，有等距斜投影右侧面）
        //   - 槽内分层：电解质（青色）+ 铝水（橙红）
        //   - 槽底阴极母线粗条（金黄横条）+ 阴极导电棒
        //   - 槽边铭牌
        //   - 微小工人小人在槽前巡检（仅在 #101 主槽前显示）
        //
        // 视觉布局：
        //   y=0    ~  35h   集烟罩 + 烟道竖管
        //   y=35h  ~ 70h    阳极导电柄阵列 + 顶部母线
        //   y=70h  ~ 90h    阳极头部（顶视碳块）
        //   y=90h  ~ 170h   槽壳正面 + 侧面投影 + 电解质/铝水分层窗
        //   y=170h ~ 200h   阴极母线 + 接地标识
        //   y=200h ~ 220h   地面阴影
        //
        // 简化处理：使用比例避免硬编码（适配不同 width/height）
        const W = width, H = height;
        const cx = x + W / 2;

        // ============ ① 集烟罩（梯形，往上收口）============
        const hoodTop    = { l: x + W * 0.20, r: x + W * 0.80 }; // 顶部窄
        const hoodBottom = { l: x + W * 0.05, r: x + W * 0.95 }; // 底部宽
        const hoodY1 = y;
        const hoodY2 = y + H * 0.13;
        ctx.fillStyle = '#475569';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(hoodTop.l, hoodY1);
        ctx.lineTo(hoodTop.r, hoodY1);
        ctx.lineTo(hoodBottom.r, hoodY2);
        ctx.lineTo(hoodBottom.l, hoodY2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // 罩内黑色阴影（暗化）
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fill();
        // 烟道（向上引到屋顶）：在罩顶中央画一条粗灰管引到画布顶部
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(cx, hoodY1);
        ctx.lineTo(cx, y - 20);
        ctx.stroke();
        ctx.lineWidth = 1;

        // ============ ② 阳极导电柄阵列（26 根金黄竖直棒）============
        const anodeCount = 26;
        const anodeAreaL = x + W * 0.08;
        const anodeAreaR = x + W * 0.92;
        const anodeAreaW = anodeAreaR - anodeAreaL;
        const stepX = anodeAreaW / anodeCount;
        const stemY1 = y + H * 0.14; // 导电柄顶
        const stemY2 = y + H * 0.32; // 导电柄底（=阳极头顶）
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        for (let i = 0; i < anodeCount; i++) {
          const ax = anodeAreaL + stepX * (i + 0.5);
          ctx.beginPath();
          ctx.moveTo(ax, stemY1);
          ctx.lineTo(ax, stemY2);
          ctx.stroke();
          // 导电柄顶部小方块（夹具）
          ctx.fillStyle = '#a16207';
          ctx.fillRect(ax - 2, stemY1 - 2, 4, 4);
        }
        // 顶部横向母线（金黄粗横条，连接所有导电柄顶）
        ctx.fillStyle = '#facc15';
        ctx.fillRect(anodeAreaL - 4, stemY1 - 4, anodeAreaW + 8, 4);
        ctx.strokeStyle = '#a16207';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(anodeAreaL - 4, stemY1 - 4, anodeAreaW + 8, 4);

        // ============ ③ 阳极碳块阵列（26 块黑色矩形）============
        const anodeBlockH = H * 0.10;
        const anodeBlockY = stemY2;
        const anodeBlockW = stepX * 0.85;
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 0.6;
        for (let i = 0; i < anodeCount; i++) {
          const bx = anodeAreaL + stepX * (i + 0.5) - anodeBlockW / 2;
          ctx.fillRect(bx, anodeBlockY, anodeBlockW, anodeBlockH);
          ctx.strokeRect(bx, anodeBlockY, anodeBlockW, anodeBlockH);
          // 阳极间隙处的橙红色高光（电解质表面火苗）
          if (i < anodeCount - 1) {
            const gapX = bx + anodeBlockW;
            const flameY = anodeBlockY + anodeBlockH;
            const animT = animTime ?? Date.now() / 1000;
            const flick = 0.6 + 0.4 * Math.sin(animT * 6 + i);
            ctx.fillStyle = `rgba(255, 140, 30, ${flick * 0.7})`;
            ctx.fillRect(gapX, flameY - 2, stepX * 0.15, 3);
            ctx.fillStyle = '#0f172a';
          }
        }

        // ============ ④ 槽壳正面 + 侧面等距投影 ============
        const shellY1 = anodeBlockY + anodeBlockH;
        const shellY2 = y + H * 0.85;
        const shellH = shellY2 - shellY1;
        const shellL = x + W * 0.05;
        const shellR = x + W * 0.95;
        const isoDepth = 20;

        // 右侧面（深灰梯形等距投影）
        ctx.fillStyle = '#1f2937';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(shellR, shellY1);
        ctx.lineTo(shellR + isoDepth, shellY1 - isoDepth * 0.5);
        ctx.lineTo(shellR + isoDepth, shellY2 - isoDepth * 0.5);
        ctx.lineTo(shellR, shellY2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // 顶面（等距投影长方形 → 视为槽顶覆盖板，前方已被阳极覆盖了所以基本看不到，画窄一条）
        ctx.fillStyle = '#374151';
        ctx.beginPath();
        ctx.moveTo(shellL, shellY1);
        ctx.lineTo(shellL + isoDepth, shellY1 - isoDepth * 0.5);
        ctx.lineTo(shellR + isoDepth, shellY1 - isoDepth * 0.5);
        ctx.lineTo(shellR, shellY1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 正面（钢壳）
        ctx.fillStyle = '#334155';
        ctx.fillRect(shellL, shellY1, shellR - shellL, shellH);
        ctx.strokeRect(shellL, shellY1, shellR - shellL, shellH);

        // 槽内分层"开窗"
        const winInset = 8;
        const winL = shellL + winInset;
        const winR = shellR - winInset;
        const winT = shellY1 + winInset;
        const winB = shellY2 - winInset;
        const winH = winB - winT;
        const bathLayer = winH * 0.58;

        // 电解质层（青色）
        const bathGrad = ctx.createLinearGradient(winL, winT, winL, winT + bathLayer);
        bathGrad.addColorStop(0, '#0ea5e9');
        bathGrad.addColorStop(1, '#0369a1');
        ctx.fillStyle = bathGrad;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(winL, winT, winR - winL, bathLayer);
        ctx.globalAlpha = 1;
        // 电解质表面高光
        ctx.strokeStyle = '#7dd3fc';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(winL, winT + 2);
        ctx.lineTo(winR, winT + 2);
        ctx.stroke();

        // 铝水层（橙红）
        const alGrad = ctx.createLinearGradient(winL, winT + bathLayer, winL, winB);
        alGrad.addColorStop(0, '#fb923c');
        alGrad.addColorStop(1, '#9a3412');
        ctx.fillStyle = alGrad;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(winL, winT + bathLayer, winR - winL, winH - bathLayer);
        ctx.globalAlpha = 1;
        // 铝水面高光
        ctx.strokeStyle = '#fcd34d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(winL + 4, winT + bathLayer + 1);
        ctx.lineTo(winR - 4, winT + bathLayer + 1);
        ctx.stroke();

        // ============ ⑤ 阴极母线（槽底金黄粗条）============
        const cathodeY = shellY2 + 4;
        ctx.fillStyle = '#facc15';
        ctx.fillRect(shellL - 8, cathodeY, shellR - shellL + 16 + isoDepth, 6);
        ctx.strokeStyle = '#a16207';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(shellL - 8, cathodeY, shellR - shellL + 16 + isoDepth, 6);
        // 母线接地标识（左右各一个三角接地符号）
        ctx.fillStyle = '#94a3b8';
        for (const ex of [shellL - 4, shellR + 4]) {
          ctx.beginPath();
          ctx.moveTo(ex, cathodeY + 7);
          ctx.lineTo(ex + 6, cathodeY + 7);
          ctx.lineTo(ex + 3, cathodeY + 14);
          ctx.closePath();
          ctx.fill();
        }

        // ============ ⑥ 铭牌（左下角）============
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(shellL + 4, shellY2 - 22, 80, 18);
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const nameTag = id === 'CELL-101' ? '#101 主槽' : id === 'CELL-102' ? '#102 副槽' : '电解槽';
        ctx.fillText(nameTag, shellL + 8, shellY2 - 13);

        // ============ ⑦ 工人小人（仅在 CELL-101 前显示）============
        if (id === 'CELL-101') {
          const wx = shellL + 60;
          const wy = y + H - 12;
          // 头
          ctx.fillStyle = '#fcd34d';
          ctx.beginPath();
          ctx.arc(wx, wy - 16, 3, 0, Math.PI * 2);
          ctx.fill();
          // 身体（橙色工服）
          ctx.fillStyle = '#ea580c';
          ctx.fillRect(wx - 3, wy - 12, 6, 8);
          // 腿
          ctx.fillStyle = '#1f2937';
          ctx.fillRect(wx - 3, wy - 4, 2.5, 4);
          ctx.fillRect(wx + 0.5, wy - 4, 2.5, 4);
          // 安全帽顶（黄色）
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

        // 滑车（120s 一周期来回移动，慢速）
        const animT = animTime ?? Date.now() / 1000;
        const period = 120;
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
        // 抬包到位停留时往下"取铝"：当 phase 接近 0.3 或 0.7 时下降
        const dwellRise = Math.abs(phase - 0.3) < 0.05 || Math.abs(phase - 0.7) < 0.05;
        const ropeLen = dwellRise ? 28 + 12 * Math.sin(animT * 5) : 22;
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
