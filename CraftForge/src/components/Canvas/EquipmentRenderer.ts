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
    this.drawEquipmentShape(ctx, type, x, y, width, height, fillColor, strokeColor, animTime);
    
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
    animTime: number = 0
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
        // 六轴关节机器人 v3：底座 + 转台 + 大臂 + 肘关节 + 前臂 + 焊枪
        // 动画：机器人在 ±15° 范围内缓慢摆动，模拟点焊轨迹
        const armSwing = Math.sin(animTime * 0.03) * 0.2; // 摆动相位
        const cx = x + width / 2;
        const baseY = y + height - 10;
        // 底座
        ctx.fillStyle = '#475569';
        this.roundRect(ctx, x + 10, baseY, width - 20, 10, 3);
        ctx.fill();
        ctx.strokeStyle = '#64748b';
        ctx.stroke();
        // 转台（圆盘）
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(cx, baseY - 6, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // 机身
        ctx.fillStyle = fillColor;
        this.roundRect(ctx, x + 14, y + 30, width - 28, baseY - 30 - 6, 4);
        ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.stroke();
        // 大臂（从机身中上部伸出，向下弯折）
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        const shoulderX = cx + armSwing * 6;
        const shoulderY = y + 40;
        ctx.moveTo(shoulderX, shoulderY);
        const elbowX = shoulderX + 18 + armSwing * 8;
        const elbowY = shoulderY + 30;
        ctx.lineTo(elbowX, elbowY);
        ctx.stroke();
        // 前臂（从肘关节伸向夹具方向）
        ctx.beginPath();
        ctx.moveTo(elbowX, elbowY);
        const wristX = elbowX + 12;
        const wristY = elbowY + 22;
        ctx.lineTo(wristX, wristY);
        ctx.stroke();
        // 肘关节圆
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(elbowX, elbowY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // 焊枪电极头
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(wristX, wristY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // 指示灯
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.arc(cx, y + 36, 3, 0, Math.PI * 2);
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
