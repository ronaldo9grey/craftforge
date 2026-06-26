/**
 * 海上钻井平台 3D 主场景 (v1.0 offshore-3d)
 * 基于 @react-three/fiber + @react-three/drei + three.js
 * 全部使用程序化几何体，无外部模型
 *
 * 视觉优化策略：
 *  1. 所有关键部件加 Edges 描边 → 暗背景下轮廓清晰
 *  2. 使用 metalness/roughness 营造金属质感
 *  3. emissive 自发光让暗背景下部件醒目
 *  4. 海面波浪用 vertex displacement (sin/cos 波形)
 *  5. 火焰粒子脉动闪烁
 *  6. 颜色方案：平台银白/灰、井架银灰、火炬红橙、海水深蓝、甲板深灰
 */
import { Suspense, useRef, useState, useEffect, useMemo, Component, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Edges } from '@react-three/drei';
import * as THREE from 'three';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useUIStore } from '@/stores/uiStore';
import { useDrillStore } from '@/stores/drillStore';

// ============= 错误边界 =============
class Scene3DErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message || String(error) };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[OffshoreRigScene3D] 3D 场景渲染错误:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: '#0a1929', color: '#38bdf8', padding: 24, textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}> offshore</div>
          <div style={{ fontSize: 16, marginBottom: 8 }}>3D 场景加载失败</div>
          <div style={{ fontSize: 12, color: '#94a3b8', maxWidth: 480 }}>{this.state.error}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 16 }}>
            提示：可能是浏览器不支持 WebGL 或显卡驱动有问题，请切换到 2D 场景
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============= 颜色常量 =============
const COLORS = {
  // 海洋
  ocean: '#0c4a6e',
  oceanDeep: '#0a1929',
  seaFloor: '#1a1a2e',
  // 平台结构
  pontoon: '#475569',
  column: '#64748b',
  deck: '#334155',
  deckTop: '#3b4252',
  // 井架
  derrick: '#94a3b8',
  derrickEdge: '#e2e8f0',
  // 设备
  equipment: '#64748b',
  equipmentAccent: '#fbbf24',
  // 火炬
  flarePipe: '#52525b',
  flame1: '#ff4500',
  flame2: '#ff6b35',
  flame3: '#ff8c00',
  flame4: '#ffaa00',
  // 居住区
  livingQuarters: '#4a5568',
  window: '#67e8f9',
  lifeboat: '#f97316',
  // 直升机甲板
  helideck: '#1e3a5f',
  helideckH: '#ffffff',
  helideckLight: '#22c55e',
  // 隔水管
  riser: '#3b82f6',
  // BOP
  bop: '#dc2626',
  // 描边颜色
  edgeWhite: '#f1f5f9',
  edgeBlue: '#60a5fa',
  edgeGold: '#fde047',
  edgeOrange: '#fb923c',
  edgeGreen: '#4ade80',
};

function labelStyle(color: string): React.CSSProperties {
  return {
    background: 'rgba(10, 25, 41, 0.92)',
    color, padding: '3px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600,
    border: `1px solid ${color}`, whiteSpace: 'nowrap',
    transform: 'translate(-50%, -50%)', pointerEvents: 'none',
  };
}

// ============= 设备ID → 3D空间位置映射 =============
const EQUIP_3D_POS: Record<string, [number, number, number]> = {
  'RIG-DCR-101': [0, 8, 0],       // 钻井绞车: 甲板中央
  'RIG-RST-101': [0, 7, 0],       // 转盘: 甲板中央井口
  'RIG-MP-101': [-8, 6, 2],       // 泥浆泵: 甲板左侧
  'RIG-BOP-101': [0, -2, 0],      // 防喷器: 海面附近
  'RIG-DER-101': [0, 14, 0],      // 井架: 甲板上方
  'RIG-RIS-101': [0, -15, 0],     // 隔水管: 海面到海底
  'RIG-CS-101': [8, 6, 2],        // 固井设备: 甲板右侧
  'RIG-CK-101': [6, 6, -3],       // 节流管汇: 甲板右后
  'RIG-SH-101': [-6, 5, -3],      // 振动筛: 甲板左后
  'RIG-FLR-101': [-12, 12, 8],    // 火炬塔: 平台左前方
  'RIG-PWR-101': [0, 6, -6],      // 发电机: 甲板后方
  'RIG-Heli-101': [12, 8, 6],     // 直升机甲板: 平台右前方
};

const EQUIP_NAMES: Record<string, string> = {
  'RIG-DCR-101': '钻井绞车',
  'RIG-RST-101': '转盘',
  'RIG-MP-101': '泥浆泵',
  'RIG-BOP-101': '防喷器',
  'RIG-DER-101': '井架',
  'RIG-RIS-101': '隔水管',
  'RIG-CS-101': '固井设备',
  'RIG-CK-101': '节流管汇',
  'RIG-SH-101': '振动筛',
  'RIG-FLR-101': '火炬塔',
  'RIG-PWR-101': '发电机',
  'RIG-Heli-101': '直升机甲板',
};

// ============= 管道定义：6条管道连接设备 =============
const PIPE_DEFS = [
  { from: [-8, 6, 2], to: [-6, 5, -3], color: '#8b5cf6', name: '泥浆供给', radius: 0.12 },
  { from: [-6, 5, -3], to: [0, -2, 0], color: '#f59e0b', name: '返浆管线', radius: 0.12 },
  { from: [8, 6, 2], to: [0, -2, 0], color: '#22c55e', name: '固井管线', radius: 0.11 },
  { from: [6, 6, -3], to: [0, -2, 0], color: '#ef4444', name: '节流管线', radius: 0.10 },
  { from: [0, 6, -6], to: [0, 14, 0], color: '#fbbf24', name: '电力供应', radius: 0.08 },
  { from: [-8, 6, 2], to: [0, 14, 0], color: '#3b82f6', name: '泥浆立管', radius: 0.10 },
];

// ============= 视角预设 =============
const VIEW_PRESETS = [
  { id: 'overview', label: '全景', icon: ' sea', pos: [25, 12, 25] as [number, number, number], target: [0, 5, 0] as [number, number, number] },
  { id: 'derrick', label: '井架', icon: ' tower', pos: [10, 16, 10] as [number, number, number], target: [0, 14, 0] as [number, number, number] },
  { id: 'deck', label: '甲板', icon: ' deck', pos: [15, 10, 15] as [number, number, number], target: [0, 8, 0] as [number, number, number] },
  { id: 'sea', label: '海面', icon: ' wave', pos: [20, 2, 20] as [number, number, number], target: [0, 0, 0] as [number, number, number] },
  { id: 'flare', label: '火炬', icon: ' fire', pos: [5, 15, 18] as [number, number, number], target: [-12, 12, 8] as [number, number, number] },
];

// ============= 通用梁/柱组件（两点之间创建圆柱体） =============
function Beam({
  from, to, radius = 0.08, color = COLORS.derrick, metalness = 0.8, roughness = 0.3, edgeColor,
}: {
  from: [number, number, number];
  to: [number, number, number];
  radius?: number;
  color?: string;
  metalness?: number;
  roughness?: number;
  edgeColor?: string;
}) {
  const { position, rotation, length } = useMemo(() => {
    const f = new THREE.Vector3(...from);
    const t = new THREE.Vector3(...to);
    const dir = t.clone().sub(f);
    const len = dir.length();
    const mid = f.clone().add(t).multiplyScalar(0.5);
    const up = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir.normalize());
    const e = new THREE.Euler().setFromQuaternion(q);
    return {
      position: [mid.x, mid.y, mid.z] as [number, number, number],
      rotation: [e.x, e.y, e.z] as [number, number, number],
      length: len,
    };
  }, [from[0], from[1], from[2], to[0], to[1], to[2]]);

  return (
    <mesh position={position} rotation={rotation}>
      <cylinderGeometry args={[radius, radius, length, 8]} />
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
      {edgeColor && <Edges color={edgeColor} />}
    </mesh>
  );
}

// ============= 1. 海洋（波浪顶点动画） =============
function Ocean() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const mesh = meshRef.current;
    if (!mesh) return;
    const geo = mesh.geometry;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const wave =
        Math.sin(x * 0.3 + t * 0.8) * 0.4 +
        Math.cos(y * 0.25 + t * 0.6) * 0.4 +
        Math.sin((x + y) * 0.15 + t * 1.2) * 0.2;
      pos.setZ(i, wave);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[140, 140, 40, 40]} />
      <meshStandardMaterial
        color={COLORS.ocean}
        metalness={0.3}
        roughness={0.4}
        transparent
        opacity={0.88}
      />
    </mesh>
  );
}

// ============= 深水体积（海面以下渐变到深黑） =============
function DeepWater() {
  return (
    <mesh position={[0, -12, 0]}>
      <boxGeometry args={[140, 24, 140]} />
      <meshStandardMaterial
        color={COLORS.oceanDeep}
        transparent
        opacity={0.6}
        depthWrite={false}
        side={THREE.BackSide}
      />
    </mesh>
  );
}

// ============= 11. 海底（深色平面 + 岩石 + 井口装置） =============
function SeaFloor() {
  const rocks = useMemo(() => {
    return Array.from({ length: 12 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 8 + Math.random() * 20;
      return {
        pos: [Math.cos(angle) * dist, -24.8, Math.sin(angle) * dist] as [number, number, number],
        scale: 0.5 + Math.random() * 1.5,
        rot: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI] as [number, number, number],
      };
    });
  }, []);

  return (
    <group>
      {/* 海底平面 */}
      <mesh position={[0, -25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color={COLORS.seaFloor} roughness={0.95} />
      </mesh>

      {/* 岩石（不规则球体） */}
      {rocks.map((rock, i) => (
        <mesh key={i} position={rock.pos} rotation={rock.rot} scale={[rock.scale, rock.scale * 0.7, rock.scale]}>
          <sphereGeometry args={[1, 6, 5]} />
          <meshStandardMaterial color="#2d2d44" roughness={0.9} />
          <Edges color="#1a1a2e" />
        </mesh>
      ))}

      {/* 井口装置（海底） */}
      <group position={[0, -24, 0]}>
        {/* 井口基座 */}
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[3, 1, 3]} />
          <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.4} />
          <Edges color={COLORS.edgeWhite} />
        </mesh>
        {/* 井口阀门组 */}
        <mesh position={[0, 1.5, 0]}>
          <cylinderGeometry args={[0.6, 0.8, 1.5, 12]} />
          <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.3} />
          <Edges color={COLORS.edgeWhite} />
        </mesh>
        {/* 阀门手轮 */}
        {[0, 1, 2, 3].map((i) => {
          const a = (i / 4) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 1.2, 1.5, Math.sin(a) * 1.2]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.3, 0.05, 6, 16]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
            </mesh>
          );
        })}
        <Html position={[0, 3, 0]}>
          <div style={labelStyle('#60a5fa')}>海底井口</div>
        </Html>
      </group>
    </group>
  );
}

// ============= 2. 平台主体（半潜式：浮筒 + 立柱 + 甲板） =============
function PlatformHull() {
  const pontoonPositions: [number, number, number][] = [
    [6, -4.5, 6], [-6, -4.5, 6], [6, -4.5, -6], [-6, -4.5, -6],
  ];
  const columnPositions: [number, number, number][] = [
    [6, 3, 6], [-6, 3, 6], [6, 3, -6], [-6, 3, -6],
  ];

  return (
    <group>
      {/* 4个浮筒（圆柱体浮力舱，位于水面下） */}
      {pontoonPositions.map((pos, i) => (
        <mesh key={`pontoon-${i}`} position={pos}>
          <cylinderGeometry args={[2.0, 2.0, 5, 20]} />
          <meshStandardMaterial color={COLORS.pontoon} metalness={0.5} roughness={0.5} />
          <Edges color={COLORS.edgeWhite} />
        </mesh>
      ))}

      {/* 浮筒间连接横梁 */}
      <Beam from={[6, -4.5, 6]} to={[-6, -4.5, 6]} radius={0.6} color={COLORS.pontoon} metalness={0.5} roughness={0.5} />
      <Beam from={[6, -4.5, -6]} to={[-6, -4.5, -6]} radius={0.6} color={COLORS.pontoon} metalness={0.5} roughness={0.5} />
      <Beam from={[6, -4.5, 6]} to={[6, -4.5, -6]} radius={0.6} color={COLORS.pontoon} metalness={0.5} roughness={0.5} />
      <Beam from={[-6, -4.5, 6]} to={[-6, -4.5, -6]} radius={0.6} color={COLORS.pontoon} metalness={0.5} roughness={0.5} />

      {/* 4根立柱（粗圆柱连接浮筒到甲板） */}
      {columnPositions.map((pos, i) => (
        <mesh key={`col-${i}`} position={pos}>
          <cylinderGeometry args={[1.2, 1.4, 10, 20]} />
          <meshStandardMaterial color={COLORS.column} metalness={0.6} roughness={0.4} />
          <Edges color={COLORS.edgeWhite} />
        </mesh>
      ))}

      {/* 甲板（大矩形平台） */}
      <mesh position={[0, 8.5, 0]}>
        <boxGeometry args={[18, 1.5, 18]} />
        <meshStandardMaterial color={COLORS.deck} metalness={0.4} roughness={0.5} />
        <Edges color={COLORS.edgeWhite} />
      </mesh>

      {/* 甲板表面（略亮色，标识工作面） */}
      <mesh position={[0, 9.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[17.5, 17.5]} />
        <meshStandardMaterial color={COLORS.deckTop} roughness={0.6} metalness={0.3} />
      </mesh>

      {/* 甲板边缘护栏（四周矮墙） */}
      {[
        { pos: [0, 9.6, 9] as [number, number, number], size: [18, 0.5, 0.15] as [number, number, number] },
        { pos: [0, 9.6, -9] as [number, number, number], size: [18, 0.5, 0.15] as [number, number, number] },
        { pos: [9, 9.6, 0] as [number, number, number], size: [0.15, 0.5, 18] as [number, number, number] },
        { pos: [-9, 9.6, 0] as [number, number, number], size: [0.15, 0.5, 18] as [number, number, number] },
      ].map((rail, i) => (
        <mesh key={`rail-${i}`} position={rail.pos}>
          <boxGeometry args={rail.size} />
          <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.5} />
          <Edges color={COLORS.edgeWhite} />
        </mesh>
      ))}
    </group>
  );
}

// ============= 3. 钻井井架（Derrick） =============
function Derrick() {
  // 井架参数
  const baseY = 9;
  const topY = 21;
  const baseHalf = 2.5;
  const topHalf = 1.0;
  const levels = [0, 0.2, 0.4, 0.6, 0.8, 1.0]; // 横梁层（比例）

  // 计算4根腿的起止点
  const legCorners: [string, [number, number, number], [number, number, number]][] = [
    ['fr', [baseHalf, baseY, baseHalf], [topHalf, topY, topHalf]],
    ['fl', [-baseHalf, baseY, baseHalf], [-topHalf, topY, topHalf]],
    ['br', [baseHalf, baseY, -baseHalf], [topHalf, topY, -topHalf]],
    ['bl', [-baseHalf, baseY, -baseHalf], [-topHalf, topY, -topHalf]],
  ];

  // 在给定比例高度计算半宽
  const hw = (ratio: number) => baseHalf + (topHalf - baseHalf) * ratio;
  const yAt = (ratio: number) => baseY + (topY - baseY) * ratio;

  // 旋转臂引用
  const crownRef = useRef<THREE.Group>(null);
  const travelingRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // 游动滑车上下移动
    if (travelingRef.current) {
      travelingRef.current.position.y = 13 + Math.sin(t * 0.5) * 2;
    }
  });

  return (
    <group>
      {/* 4根斜柱（腿） */}
      {legCorners.map(([key, from, to]) => (
        <Beam key={key} from={from} to={to} radius={0.18} color={COLORS.derrick} metalness={0.8} roughness={0.3} edgeColor={COLORS.derrickEdge} />
      ))}

      {/* 多层横梁（每层4根） */}
      {levels.map((ratio, li) => {
        const y = yAt(ratio);
        const h = hw(ratio);
        return (
          <group key={`level-${li}`}>
            <Beam from={[-h, y, h]} to={[h, y, h]} radius={0.1} color={COLORS.derrick} />
            <Beam from={[-h, y, -h]} to={[h, y, -h]} radius={0.1} color={COLORS.derrick} />
            <Beam from={[h, y, h]} to={[h, y, -h]} radius={0.1} color={COLORS.derrick} />
            <Beam from={[-h, y, h]} to={[-h, y, -h]} radius={0.1} color={COLORS.derrick} />
          </group>
        );
      })}

      {/* 交叉斜撑（X型，每个面2根，分3段） */}
      {[0, 0.33, 0.66].map((start, si) => {
        const end = start + 0.34;
        const y0 = yAt(start), y1 = yAt(end);
        const h0 = hw(start), h1 = hw(end);
        return (
          <group key={`brace-${si}`}>
            {/* 前面 X */}
            <Beam from={[-h0, y0, h0]} to={[h1, y1, h1]} radius={0.06} color={COLORS.derrick} />
            <Beam from={[h0, y0, h0]} to={[-h1, y1, h1]} radius={0.06} color={COLORS.derrick} />
            {/* 后面 X */}
            <Beam from={[-h0, y0, -h0]} to={[h1, y1, -h1]} radius={0.06} color={COLORS.derrick} />
            <Beam from={[h0, y0, -h0]} to={[-h1, y1, -h1]} radius={0.06} color={COLORS.derrick} />
            {/* 左面 X */}
            <Beam from={[-h0, y0, h0]} to={[-h1, y1, -h1]} radius={0.06} color={COLORS.derrick} />
            <Beam from={[-h0, y0, -h0]} to={[-h1, y1, h1]} radius={0.06} color={COLORS.derrick} />
            {/* 右面 X */}
            <Beam from={[h0, y0, h0]} to={[h1, y1, -h1]} radius={0.06} color={COLORS.derrick} />
            <Beam from={[h0, y0, -h0]} to={[h1, y1, h1]} radius={0.06} color={COLORS.derrick} />
          </group>
        );
      })}

      {/* 顶部天车（小圆柱） */}
      <group ref={crownRef} position={[0, topY + 0.5, 0]}>
        <mesh>
          <cylinderGeometry args={[0.8, 0.8, 1.2, 16]} />
          <meshStandardMaterial color="#64748b" metalness={0.85} roughness={0.2} />
          <Edges color={COLORS.derrickEdge} />
        </mesh>
        {/* 天车滑轮 */}
        <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.5, 0.12, 8, 16]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.15} />
        </mesh>
      </group>

      {/* 游动滑车（boxGeometry，上下移动） */}
      <mesh ref={travelingRef} position={[0, 13, 0]}>
        <boxGeometry args={[1.2, 0.8, 1.2]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
        <Edges color={COLORS.derrickEdge} />
      </mesh>

      {/* 钻杆从井架中心向下穿过甲板延伸到海面以下 */}
      <Beam from={[0, 15, 0]} to={[0, -3, 0]} radius={0.15} color="#cbd5e1" metalness={0.9} roughness={0.1} />

      {/* 钻杆接头（每隔一段一个粗环） */}
      {[6, 0, -6].map((y, i) => (
        <mesh key={`joint-${i}`} position={[0, y, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.3, 12]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.15} />
          <Edges color={COLORS.derrickEdge} />
        </mesh>
      ))}

      <Html position={[0, topY + 2, 0]}>
        <div style={labelStyle(COLORS.derrickEdge)}>井架 Derrick</div>
      </Html>
    </group>
  );
}

// ============= 4. 直升机甲板（Helideck） =============
function Helideck() {
  const pos: [number, number, number] = [12, 8, 6];

  // 绿色边缘灯（圆周排列）
  const lightCount = 12;
  const lights = useMemo(() => {
    return Array.from({ length: lightCount }, (_, i) => {
      const a = (i / lightCount) * Math.PI * 2;
      return [Math.cos(a) * 2.8, 0.15, Math.sin(a) * 2.8] as [number, number, number];
    });
  }, []);

  return (
    <group>
      {/* 支撑结构（从甲板延伸到直升机平台） */}
      <Beam from={[9, 9, 5]} to={[12, 7.5, 6]} radius={0.15} color={COLORS.column} metalness={0.6} roughness={0.4} />
      <Beam from={[9, 9, 7]} to={[12, 7.5, 6]} radius={0.15} color={COLORS.column} metalness={0.6} roughness={0.4} />

      {/* 圆形平台（扁平圆柱） */}
      <mesh position={pos}>
        <cylinderGeometry args={[3, 3, 0.4, 32]} />
        <meshStandardMaterial color={COLORS.helideck} metalness={0.3} roughness={0.5} />
        <Edges color={COLORS.edgeWhite} />
      </mesh>

      {/* 平台表面标记圆 */}
      <mesh position={[pos[0], pos[1] + 0.21, pos[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.5, 2.7, 32]} />
        <meshStandardMaterial color={COLORS.helideckH} emissive={COLORS.helideckH} emissiveIntensity={0.2} side={THREE.DoubleSide} />
      </mesh>

      {/* H 标记（用 boxGeometry 拼字母） */}
      {/* 左竖 */}
      <mesh position={[pos[0] - 0.7, pos[1] + 0.22, pos[2]]}>
        <boxGeometry args={[0.25, 0.02, 1.8]} />
        <meshStandardMaterial color={COLORS.helideckH} emissive={COLORS.helideckH} emissiveIntensity={0.3} />
      </mesh>
      {/* 右竖 */}
      <mesh position={[pos[0] + 0.7, pos[1] + 0.22, pos[2]]}>
        <boxGeometry args={[0.25, 0.02, 1.8]} />
        <meshStandardMaterial color={COLORS.helideckH} emissive={COLORS.helideckH} emissiveIntensity={0.3} />
      </mesh>
      {/* 横 */}
      <mesh position={[pos[0], pos[1] + 0.22, pos[2]]}>
        <boxGeometry args={[1.65, 0.02, 0.25]} />
        <meshStandardMaterial color={COLORS.helideckH} emissive={COLORS.helideckH} emissiveIntensity={0.3} />
      </mesh>

      {/* 绿色边缘灯（小发光球体排列在圆周上） */}
      {lights.map((lp, i) => (
        <mesh key={`heli-light-${i}`} position={[pos[0] + lp[0], pos[1] + lp[1], pos[2] + lp[2]]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial color={COLORS.helideckLight} emissive={COLORS.helideckLight} emissiveIntensity={0.8} />
        </mesh>
      ))}

      <Html position={[pos[0], pos[1] + 1.5, pos[2]]}>
        <div style={labelStyle(COLORS.edgeGreen)}>直升机甲板 H</div>
      </Html>
    </group>
  );
}

// ============= 5. 火炬塔（Flare Tower） =============
function FlareTower() {
  const flameRef = useRef<THREE.Group>(null);
  const tipPos: [number, number, number] = [-14, 15, 10];
  const basePos: [number, number, number] = [-9, 9, 6];

  // 火焰粒子参数
  const flameParticles = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => ({
      offset: [Math.random() * 0.4 - 0.2, Math.random() * 0.8, Math.random() * 0.4 - 0.2] as [number, number, number],
      baseScale: 0.6 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2,
      speed: 2 + Math.random() * 2,
      color: [COLORS.flame1, COLORS.flame2, COLORS.flame3, COLORS.flame4][i % 4],
      type: i % 2 === 0 ? 'cone' : 'sphere',
    }));
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!flameRef.current) return;
    flameRef.current.children.forEach((child, i) => {
      const p = flameParticles[i];
      if (!p) return;
      const mesh = child as THREE.Mesh;
      const pulse = 0.7 + 0.3 * Math.sin(t * p.speed + p.phase);
      mesh.scale.set(p.baseScale * pulse, p.baseScale * pulse * 1.5, p.baseScale * pulse);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.4 + 0.4 * Math.abs(Math.sin(t * p.speed * 1.3 + p.phase));
      mat.emissiveIntensity = 0.6 + 0.4 * pulse;
    });
  });

  return (
    <group>
      {/* 斜向上的管道（火炬臂） */}
      <Beam from={basePos} to={tipPos} radius={0.2} color={COLORS.flarePipe} metalness={0.7} roughness={0.3} edgeColor={COLORS.edgeWhite} />

      {/* 支撑斜拉筋 */}
      <Beam from={[-9, 9, 7]} to={[-12, 12, 9]} radius={0.08} color={COLORS.flarePipe} metalness={0.7} roughness={0.3} />
      <Beam from={[-9, 9, 5]} to={[-12, 12, 9]} radius={0.08} color={COLORS.flarePipe} metalness={0.7} roughness={0.3} />

      {/* 火焰粒子组 */}
      <group ref={flameRef} position={tipPos}>
        {flameParticles.map((p, i) => (
          <mesh key={i} position={p.offset}>
            {p.type === 'cone' ? (
              <coneGeometry args={[0.4, 1.2, 8]} />
            ) : (
              <sphereGeometry args={[0.35, 10, 10]} />
            )}
            <meshStandardMaterial
              color={p.color}
              emissive={COLORS.flame1}
              emissiveIntensity={0.8}
              transparent
              opacity={0.7}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* 火焰光源 */}
      <pointLight position={tipPos} intensity={2} color={COLORS.flame2} distance={15} />

      <Html position={[tipPos[0], tipPos[1] + 2, tipPos[2]]}>
        <div style={labelStyle(COLORS.flame2)}>火炬塔 Flare</div>
      </Html>
    </group>
  );
}

// ============= 6. 居住区（Living Quarters） =============
function LivingQuarters() {
  const pos: [number, number, number] = [-8, 9, -6];
  const floors = 4;
  const floorHeight = 1.5;

  return (
    <group position={pos}>
      {/* 多层矩形建筑主体 */}
      <mesh position={[0, floors * floorHeight / 2, 0]}>
        <boxGeometry args={[4, floors * floorHeight, 3.5]} />
        <meshStandardMaterial color={COLORS.livingQuarters} metalness={0.3} roughness={0.5} />
        <Edges color={COLORS.edgeWhite} />
      </mesh>

      {/* 每层窗户发光带（4面都有） */}
      {Array.from({ length: floors }, (_, f) => {
        const y = 0.8 + f * floorHeight;
        return (
          <group key={f}>
            {/* 正面窗带 */}
            <mesh position={[0, y, 1.76]}>
              <boxGeometry args={[3.5, 0.5, 0.04]} />
              <meshStandardMaterial color={COLORS.window} emissive={COLORS.window} emissiveIntensity={0.4} />
            </mesh>
            {/* 背面窗带 */}
            <mesh position={[0, y, -1.76]}>
              <boxGeometry args={[3.5, 0.5, 0.04]} />
              <meshStandardMaterial color={COLORS.window} emissive={COLORS.window} emissiveIntensity={0.3} />
            </mesh>
            {/* 左面窗带 */}
            <mesh position={[-2.01, y, 0]}>
              <boxGeometry args={[0.04, 0.5, 3.0]} />
              <meshStandardMaterial color={COLORS.window} emissive={COLORS.window} emissiveIntensity={0.3} />
            </mesh>
            {/* 右面窗带 */}
            <mesh position={[2.01, y, 0]}>
              <boxGeometry args={[0.04, 0.5, 3.0]} />
              <meshStandardMaterial color={COLORS.window} emissive={COLORS.window} emissiveIntensity={0.3} />
            </mesh>
          </group>
        );
      })}

      {/* 屋顶 */}
      <mesh position={[0, floors * floorHeight + 0.2, 0]}>
        <boxGeometry args={[4.3, 0.4, 3.8]} />
        <meshStandardMaterial color="#374151" metalness={0.4} roughness={0.5} />
        <Edges color={COLORS.edgeWhite} />
      </mesh>

      {/* 救生艇（椭圆型 boxGeometry） */}
      <mesh position={[2.5, floors * floorHeight - 1, 0]} scale={[1, 0.6, 0.6]}>
        <boxGeometry args={[2, 1.2, 1.2]} />
        <meshStandardMaterial color={COLORS.lifeboat} emissive={COLORS.lifeboat} emissiveIntensity={0.15} metalness={0.4} roughness={0.4} />
        <Edges color={COLORS.edgeWhite} />
      </mesh>
      {/* 救生艇支架 */}
      <Beam from={[2.5, floors * floorHeight - 1.8, 0]} to={[2.5, floors * floorHeight - 0.5, 0]} radius={0.05} color="#64748b" />

      <Html position={[0, floors * floorHeight + 1, 0]}>
        <div style={labelStyle(COLORS.window)}>居住区 Living Quarters</div>
      </Html>
    </group>
  );
}

// ============= 7. 起重机（Crane） =============
function Crane() {
  const basePos: [number, number, number] = [10, 9.5, -2];
  const armRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (armRef.current) {
      armRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.5;
    }
  });

  return (
    <group position={basePos}>
      {/* 底座圆柱 */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.6, 0.8, 1, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.4} />
        <Edges color={COLORS.edgeWhite} />
      </mesh>

      {/* 旋转臂组 */}
      <group ref={armRef} position={[0, 1.2, 0]}>
        {/* 臂基座 */}
        <mesh>
          <cylinderGeometry args={[0.4, 0.4, 0.6, 12]} />
          <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.3} />
          <Edges color={COLORS.edgeWhite} />
        </mesh>
        {/* 旋转臂（长boxGeometry，斜向上） */}
        <mesh position={[3, 1.5, 0]} rotation={[0, 0, -0.3]}>
          <boxGeometry args={[7, 0.5, 0.5]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
          <Edges color={COLORS.edgeWhite} />
        </mesh>
        {/* 臂顶滑轮 */}
        <mesh position={[6.3, 2.7, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.3, 0.08, 6, 12]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* 钢丝绳（细cylinder） */}
        <Beam from={[6.3, 2.7, 0]} to={[6.3, -1, 0]} radius={0.03} color="#1e293b" metalness={0.9} roughness={0.1} />
        {/* 吊钩 */}
        <mesh position={[6.3, -1.2, 0]}>
          <boxGeometry args={[0.3, 0.3, 0.3]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.6} roughness={0.3} emissive="#f59e0b" emissiveIntensity={0.1} />
          <Edges color={COLORS.edgeGold} />
        </mesh>
      </group>

      <Html position={[0, 3, 0]}>
        <div style={labelStyle('#94a3b8')}>起重机 Crane</div>
      </Html>
    </group>
  );
}

// ============= 8. 隔水管（Riser） =============
function Riser() {
  // 张力器（小圆柱环绕）
  const tensioners = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2;
      return [Math.cos(a) * 1.0, 0, Math.sin(a) * 1.0] as [number, number, number];
    });
  }, []);

  return (
    <group>
      {/* 主隔水管（从海面到海底） */}
      <mesh position={[0, -13, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 22, 20]} />
        <meshStandardMaterial
          color={COLORS.riser}
          metalness={0.3}
          roughness={0.4}
          transparent
          opacity={0.55}
          emissive={COLORS.riser}
          emissiveIntensity={0.1}
        />
        <Edges color={COLORS.edgeBlue} />
      </mesh>

      {/* 隔水管接头环（每隔一段一个） */}
      {[-3, -9, -15, -21].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <cylinderGeometry args={[0.58, 0.58, 0.4, 16]} />
          <meshStandardMaterial color="#60a5fa" metalness={0.5} roughness={0.3} />
          <Edges color={COLORS.edgeBlue} />
        </mesh>
      ))}

      {/* 张力器（海面附近的环绕小圆柱） */}
      <group position={[0, -1, 0]}>
        {tensioners.map((tp, i) => (
          <Beam
            key={i}
            from={[tp[0] * 1.5, 1, tp[2] * 1.5]}
            to={[tp[0], -1, tp[2]]}
            radius={0.08}
            color="#64748b"
            metalness={0.7}
            roughness={0.3}
          />
        ))}
      </group>

      <Html position={[1, -10, 0]}>
        <div style={labelStyle(COLORS.edgeBlue)}>隔水管 Riser</div>
      </Html>
    </group>
  );
}

// ============= BOP 防喷器 =============
function BOP() {
  return (
    <group position={[0, -2, 0]}>
      {/* 主体粗圆柱 */}
      <mesh>
        <cylinderGeometry args={[1.2, 1.2, 2.5, 20]} />
        <meshStandardMaterial color={COLORS.bop} metalness={0.5} roughness={0.4} emissive={COLORS.bop} emissiveIntensity={0.1} />
        <Edges color={COLORS.edgeWhite} />
      </mesh>
      {/* 侧面阀门 */}
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 1.3, 0, Math.sin(a) * 1.3]} rotation={[0, -a, Math.PI / 2]}>
          <cylinderGeometry args={[0.2, 0.2, 0.6, 10]} />
          <meshStandardMaterial color="#7f1d1d" metalness={0.6} roughness={0.3} />
          <Edges color={COLORS.edgeWhite} />
        </mesh>
      ))}
      {/* 顶部法兰 */}
      <mesh position={[0, 1.4, 0]}>
        <cylinderGeometry args={[1.4, 1.4, 0.4, 20]} />
        <meshStandardMaterial color="#991b1b" metalness={0.6} roughness={0.3} />
        <Edges color={COLORS.edgeWhite} />
      </mesh>
      <Html position={[2, 0, 0]}>
        <div style={labelStyle('#ef4444')}>BOP 防喷器</div>
      </Html>
    </group>
  );
}

// ============= 9. 设备组（甲板上） =============

// 泥浆泵组
function MudPumps() {
  const pos: [number, number, number] = [-8, 9.5, 2];
  return (
    <group position={pos}>
      {/* 泵主体 */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[2.5, 1.2, 1.8]} />
        <meshStandardMaterial color={COLORS.equipment} metalness={0.5} roughness={0.4} />
        <Edges color={COLORS.edgeWhite} />
      </mesh>
      {/* 泵电机 */}
      <mesh position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.6, 12]} />
        <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
        <Edges color={COLORS.edgeWhite} />
      </mesh>
      {/* 管道连接 */}
      <mesh position={[1.5, 0.5, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.2, 0.2, 1, 10]} />
        <meshStandardMaterial color="#3b82f6" metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[1.8, 1.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 1, 8]} />
        <meshStandardMaterial color="#3b82f6" metalness={0.5} roughness={0.3} />
      </mesh>
      <Html position={[0, 2.2, 0]}>
        <div style={labelStyle('#8b5cf6')}>泥浆泵组</div>
      </Html>
    </group>
  );
}

// 固井设备
function CementingEquipment() {
  const pos: [number, number, number] = [8, 9.5, 2];
  return (
    <group position={pos}>
      {/* 设备主体 */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[2, 0.8, 1.5]} />
        <meshStandardMaterial color={COLORS.equipment} metalness={0.5} roughness={0.4} />
        <Edges color={COLORS.edgeWhite} />
      </mesh>
      {/* 罐体 */}
      <mesh position={[0, 1.4, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.6, 0.6, 1.8, 16]} />
        <meshStandardMaterial color="#22c55e" metalness={0.4} roughness={0.4} emissive="#22c55e" emissiveIntensity={0.05} />
        <Edges color={COLORS.edgeGreen} />
      </mesh>
      {/* 罐顶 */}
      <mesh position={[0.9, 1.4, 0]}>
        <sphereGeometry args={[0.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#16a34a" metalness={0.4} roughness={0.4} />
      </mesh>
      <Html position={[0, 2.4, 0]}>
        <div style={labelStyle(COLORS.edgeGreen)}>固井设备</div>
      </Html>
    </group>
  );
}

// 节流管汇
function ChokeManifold() {
  const pos: [number, number, number] = [6, 9.5, -3];
  return (
    <group position={pos}>
      {/* 管道基座 */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[2, 0.4, 1]} />
        <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.5} />
        <Edges color={COLORS.edgeWhite} />
      </mesh>
      {/* 水平管道 */}
      <mesh position={[0, 0.7, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.15, 0.15, 1.8, 10]} />
        <meshStandardMaterial color="#ef4444" metalness={0.5} roughness={0.3} />
      </mesh>
      {/* 阀门组 */}
      {[-0.6, 0, 0.6].map((x, i) => (
        <group key={i} position={[x, 0.7, 0]}>
          <mesh>
            <boxGeometry args={[0.25, 0.5, 0.25]} />
            <meshStandardMaterial color="#dc2626" metalness={0.5} roughness={0.3} />
            <Edges color={COLORS.edgeWhite} />
          </mesh>
          {/* 阀门手轮 */}
          <mesh position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.15, 0.03, 6, 12]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.7} roughness={0.2} />
          </mesh>
        </group>
      ))}
      <Html position={[0, 1.3, 0]}>
        <div style={labelStyle('#ef4444')}>节流管汇</div>
      </Html>
    </group>
  );
}

// 振动筛
function ShaleShaker() {
  const pos: [number, number, number] = [-6, 9.5, -3];
  const shakeRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (shakeRef.current) {
      shakeRef.current.position.z = Math.sin(state.clock.elapsedTime * 15) * 0.02;
    }
  });

  return (
    <group position={pos}>
      <group ref={shakeRef}>
        {/* 倾斜的筛网箱体 */}
        <mesh position={[0, 0.6, 0]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[2.2, 0.6, 1.5]} />
          <meshStandardMaterial color={COLORS.equipment} metalness={0.5} roughness={0.4} />
          <Edges color={COLORS.edgeWhite} />
        </mesh>
        {/* 筛网表面 */}
        <mesh position={[0, 0.92, 0.15]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[2.0, 0.04, 1.3]} />
          <meshStandardMaterial color="#1e293b" metalness={0.3} roughness={0.7} />
        </mesh>
        {/* 进料口 */}
        <mesh position={[0, 1.0, -0.6]}>
          <cylinderGeometry args={[0.25, 0.25, 0.4, 10]} />
          <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.4} />
          <Edges color={COLORS.edgeWhite} />
        </mesh>
      </group>
      <Html position={[0, 1.5, 0]}>
        <div style={labelStyle('#f59e0b')}>振动筛</div>
      </Html>
    </group>
  );
}

// 发电机组
function Generators() {
  const pos: [number, number, number] = [0, 9.5, -6];
  return (
    <group position={pos}>
      {/* 主发电机箱体 */}
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[3.5, 1.2, 2]} />
        <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.4} />
        <Edges color={COLORS.edgeWhite} />
      </mesh>
      {/* 排气管（向上延伸的圆柱） */}
      {[-1.2, 1.2].map((x, i) => (
        <group key={i}>
          <mesh position={[x, 2.5, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 3, 10]} />
            <meshStandardMaterial color="#52525b" metalness={0.7} roughness={0.3} />
            <Edges color={COLORS.edgeWhite} />
          </mesh>
          {/* 排气管顶帽 */}
          <mesh position={[x, 4.1, 0]}>
            <cylinderGeometry args={[0.25, 0.2, 0.3, 10]} />
            <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {/* 控制面板 */}
      <mesh position={[0, 0.6, 1.05]}>
        <boxGeometry args={[2.5, 0.6, 0.08]} />
        <meshStandardMaterial color="#0f172a" metalness={0.3} roughness={0.5} />
      </mesh>
      {/* 面板指示灯 */}
      {[-0.8, -0.3, 0.2, 0.7].map((x, i) => (
        <mesh key={i} position={[x, 0.7, 1.1]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color={i < 2 ? '#22c55e' : '#fbbf24'} emissive={i < 2 ? '#22c55e' : '#fbbf24'} emissiveIntensity={0.5} />
        </mesh>
      ))}
      <Html position={[0, 4.5, 0]}>
        <div style={labelStyle('#fbbf24')}>发电机组</div>
      </Html>
    </group>
  );
}

// 钻井绞车 + 转盘（甲板中央井口区域）
function DrawworksAndRotary() {
  return (
    <group>
      {/* 钻井绞车 */}
      <group position={[0, 9.5, 2.5]}>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[2, 1, 1.5]} />
          <meshStandardMaterial color={COLORS.equipment} metalness={0.6} roughness={0.3} />
          <Edges color={COLORS.edgeWhite} />
        </mesh>
        {/* 绞车卷筒 */}
        <mesh position={[0, 0.5, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.4, 0.4, 1.8, 16]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
          <Edges color={COLORS.edgeWhite} />
        </mesh>
      </group>

      {/* 转盘（甲板中央井口） */}
      <group position={[0, 9.3, 0]}>
        <mesh>
          <cylinderGeometry args={[1.0, 1.2, 0.5, 20]} />
          <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
          <Edges color={COLORS.edgeGold} />
        </mesh>
        {/* 转盘内孔 */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.4, 0.4, 0.6, 16]} />
          <meshStandardMaterial color="#1e293b" metalness={0.3} roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
}

// ============= 故障发光包裹器 =============
function FaultGlow({ isFaulty, children }: { isFaulty: boolean; children: ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  const originalEmissive = useRef<Map<THREE.Mesh, { color: THREE.Color; intensity: number }>>(new Map());

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    const pulse = isFaulty ? 0.2 + 0.7 * Math.abs(Math.sin(t * 5)) : 0;

    groupRef.current.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const mat = child.material as THREE.MeshStandardMaterial;
      if (!mat || !mat.emissive) return;

      if (!originalEmissive.current.has(child)) {
        originalEmissive.current.set(child, {
          color: mat.emissive.clone(),
          intensity: mat.emissiveIntensity ?? 0,
        });
      }

      if (isFaulty) {
        mat.emissive.setRGB(1, 0.05, 0.05);
        mat.emissiveIntensity = pulse;
      } else {
        const orig = originalEmissive.current.get(child);
        if (orig) {
          mat.emissive.copy(orig.color);
          mat.emissiveIntensity = orig.intensity;
        }
      }
    });
  });

  return <group ref={groupRef}>{children}</group>;
}

// ============= 可点击设备区域（3D 交互核心） =============
function ClickableZones() {
  const selectEquipment = useUIStore((s) => s.selectEquipment);
  const selectedEquipmentId = useUIStore((s) => s.selectedEquipmentId);
  const equipments = useEquipmentStore((s) => s.equipments);
  const selectedEq = equipments.find((e) => e.id === selectedEquipmentId);

  const RADII: Record<string, number> = {
    'RIG-DCR-101': 2.0,
    'RIG-RST-101': 1.5,
    'RIG-MP-101': 2.0,
    'RIG-BOP-101': 2.5,
    'RIG-DER-101': 5.0,
    'RIG-RIS-101': 4.0,
    'RIG-CS-101': 2.0,
    'RIG-CK-101': 2.0,
    'RIG-SH-101': 2.0,
    'RIG-FLR-101': 3.5,
    'RIG-PWR-101': 2.5,
    'RIG-Heli-101': 3.5,
  };

  return (
    <group>
      {Object.entries(EQUIP_3D_POS).map(([eqId, pos]) => {
        const isSelected = selectedEquipmentId === eqId;
        const name = EQUIP_NAMES[eqId] || eqId;
        const radius = RADII[eqId] ?? 2.5;

        return (
          <mesh
            key={eqId}
            position={pos}
            onClick={(e) => {
              e.stopPropagation();
              selectEquipment(eqId);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
              document.body.style.cursor = 'default';
            }}
          >
            <sphereGeometry args={[radius, 12, 12]} />
            <meshStandardMaterial
              color={isSelected ? '#22c55e' : '#3b82f6'}
              emissive={isSelected ? '#22c55e' : '#000000'}
              emissiveIntensity={isSelected ? 0.3 : 0}
              transparent
              opacity={isSelected ? 0.15 : 0.02}
              depthWrite={false}
            />
            {isSelected && <Edges color="#22c55e" />}
            {isSelected && (
              <Html position={[0, radius + 1.5, 0]}>
                <div style={{
                  background: 'rgba(34, 197, 94, 0.9)',
                  color: '#fff',
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                  border: '1px solid #86efac',
                }}>
                   {name} · 已选中
                </div>
              </Html>
            )}
            {/* 参数浮窗 */}
            {isSelected && selectedEq && (
              <Html position={[0, -(radius + 0.5), 0]}>
                <div style={{
                  background: 'rgba(10, 25, 41, 0.95)',
                  borderRadius: 8, padding: '8px 12px', minWidth: 160,
                  border: '1px solid rgba(34, 197, 94, 0.5)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                  transform: 'translate(-50%, 0)',
                  pointerEvents: 'none',
                }}>
                  <div style={{
                    color: '#22c55e', fontSize: 10, fontWeight: 700,
                    marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>
                    {selectedEq.name}
                  </div>
                  {selectedEq.parameters.slice(0, 4).map((p) => {
                    const isOutOfRange = p.value < p.min || p.value > p.max;
                    return (
                      <div key={p.id} style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', gap: 12, marginBottom: 3,
                      }}>
                        <span style={{ color: '#94a3b8', fontSize: 10 }}>{p.name}</span>
                        <span style={{
                          color: isOutOfRange ? '#ef4444' : '#e2e8f0',
                          fontSize: 11, fontWeight: 600,
                          fontFamily: 'monospace',
                        }}>
                          {p.value.toFixed(p.unit === '%' ? 1 : 2)}{p.unit && ` ${p.unit}`}
                        </span>
                      </div>
                    );
                  })}
                  <div style={{
                    marginTop: 5, paddingTop: 5,
                    borderTop: '1px solid rgba(148,163,184,0.2)',
                    color: '#64748b', fontSize: 9, textAlign: 'center',
                  }}>
                    点击右侧面板调整参数 →
                  </div>
                </div>
              </Html>
            )}
          </mesh>
        );
      })}
    </group>
  );
}

// ============= 10. 管道3D流动效果 =============
function Pipelines3D() {
  const particleRefs = useRef<THREE.Mesh[]>([]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    particleRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const def = PIPE_DEFS[i];
      const phase = (t * 0.35 + i * 0.15) % 1;
      mesh.position.set(
        def.from[0] + (def.to[0] - def.from[0]) * phase,
        def.from[1] + (def.to[1] - def.from[1]) * phase,
        def.from[2] + (def.to[2] - def.from[2]) * phase,
      );
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.6 + 0.4 * Math.sin(t * 3 + i);
    });
  });

  return (
    <group>
      {PIPE_DEFS.map((def, i) => {
        const mid: [number, number, number] = [
          (def.from[0] + def.to[0]) / 2 + (i % 2 === 0 ? 2 : -2),
          (def.from[1] + def.to[1]) / 2 + 1,
          (def.from[2] + def.to[2]) / 2,
        ];
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(...def.from),
          new THREE.Vector3(...mid),
          new THREE.Vector3(...def.to),
        ]);
        const points = curve.getPoints(24);
        const geom = new THREE.BufferGeometry().setFromPoints(points);
        return (
          <group key={i}>
            {/* 管道线 */}
            <line>
              <primitive object={geom} attach="geometry" />
              <lineBasicMaterial color={def.color} transparent opacity={0.5} />
            </line>
            {/* 流动粒子 */}
            <mesh
              ref={(m) => { if (m) particleRefs.current[i] = m; }}
            >
              <sphereGeometry args={[def.radius * 2, 8, 8]} />
              <meshStandardMaterial
                color={def.color}
                emissive={def.color}
                emissiveIntensity={0.8}
                transparent
                opacity={0.9}
              />
            </mesh>
            {/* 管道标签 */}
            <Html position={mid}>
              <div style={{
                ...labelStyle(def.color),
                fontSize: 9, padding: '1px 5px', opacity: 0.7,
              }}>
                {def.name}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

// ============= A3: 故障简报卡片 =============
function FaultBriefingCard({ fault, onClose }: { fault: { id: string; title: string; description: string; hint: string } | null; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (fault) {
      setVisible(true);
      setCollapsed(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCollapsed(true), 4000);
    } else {
      setVisible(false);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [fault]);

  if (!visible || !fault) return null;

  if (collapsed) {
    return (
      <div style={{
        position: 'absolute', top: 48, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(127, 29, 29, 0.92)', color: '#fff',
        padding: '6px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
        border: '1px solid #fca5a5', boxShadow: '0 0 16px rgba(239,68,68,0.4)',
        display: 'flex', alignItems: 'center', gap: 8,
        zIndex: 100,
      }} onClick={() => setCollapsed(false)}>
        <span>! {fault.title}</span>
        <span style={{ opacity: 0.6, fontSize: 10 }}>点击展开</span>
      </div>
    );
  }

  return (
    <div style={{
      position: 'absolute', top: 48, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(10, 25, 41, 0.96)', color: '#fff',
      padding: '16px 24px', borderRadius: 10, fontSize: 13,
      border: '1px solid #ef4444', boxShadow: '0 4px 24px rgba(239,68,68,0.3)',
      maxWidth: 560, zIndex: 100,
      animation: 'faultSlideIn 0.3s ease',
    }}>
      <style>{`
        @keyframes faultSlideIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ color: '#ef4444', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          ! {fault.title}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ color: '#64748b', fontSize: 10, cursor: 'pointer' }} onClick={() => setCollapsed(true)}>收起</span>
          <span style={{ color: '#64748b', fontSize: 14, cursor: 'pointer', lineHeight: 1 }} onClick={onClose}>x</span>
        </div>
      </div>
      <div style={{ color: '#cbd5e1', fontSize: 12, marginBottom: 8, lineHeight: 1.5 }}>
        {fault.description}
      </div>
      <div style={{
        background: 'rgba(239, 68, 68, 0.15)', borderRadius: 6, padding: '8px 12px',
        border: '1px solid rgba(239, 68, 68, 0.3)',
      }}>
        <span style={{ color: '#fca5a5', fontSize: 11, fontWeight: 600 }}>处理要点：</span>
        <span style={{ color: '#fef3c7', fontSize: 11, marginLeft: 4 }}>{fault.hint}</span>
      </div>
    </div>
  );
}

// ============= 场景内容 =============
function SceneContent() {
  const activeTpl = useUIStore((s) => s.activeTemplate);
  const isDrillRunning = useDrillStore((s) => s.isRunning);
  const currentFault = useDrillStore((s) => s.currentFault);

  if (activeTpl !== 'offshore') {
    return (
      <Html center>
        <div style={{ color: '#94a3b8', fontSize: 14 }}>
          请先在左侧选择"海上钻井平台"场景
        </div>
      </Html>
    );
  }

  const faultySet = new Set(isDrillRunning && currentFault ? currentFault.affectedEquipments : []);

  return (
    <>
      {/* 光照：环境 + 主光 + 补光 */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[20, 30, 15]} intensity={0.8} color="#fef3c7" />
      <directionalLight position={[-15, 20, -10]} intensity={0.3} color="#60a5fa" />
      {/* 甲板工作灯 */}
      <pointLight position={[0, 12, 0]} intensity={0.8} color="#ffffff" distance={30} />
      <pointLight position={[8, 11, 2]} intensity={0.5} color="#fbbf24" distance={20} />
      <pointLight position={[-8, 11, -2]} intensity={0.5} color="#fbbf24" distance={20} />

      {/* 海洋 + 深水 + 海底 */}
      <Ocean />
      <DeepWater />
      <SeaFloor />

      {/* 平台主体 */}
      <PlatformHull />

      {/* 井架 + 钻井绞车 + 转盘 */}
      <FaultGlow isFaulty={faultySet.has('RIG-DER-101') || faultySet.has('RIG-DCR-101') || faultySet.has('RIG-RST-101')}>
        <Derrick />
        <DrawworksAndRotary />
      </FaultGlow>

      {/* 隔水管 */}
      <FaultGlow isFaulty={faultySet.has('RIG-RIS-101')}>
        <Riser />
      </FaultGlow>

      {/* BOP 防喷器 */}
      <FaultGlow isFaulty={faultySet.has('RIG-BOP-101')}>
        <BOP />
      </FaultGlow>

      {/* 泥浆泵 */}
      <FaultGlow isFaulty={faultySet.has('RIG-MP-101')}>
        <MudPumps />
      </FaultGlow>

      {/* 固井设备 */}
      <FaultGlow isFaulty={faultySet.has('RIG-CS-101')}>
        <CementingEquipment />
      </FaultGlow>

      {/* 节流管汇 */}
      <FaultGlow isFaulty={faultySet.has('RIG-CK-101')}>
        <ChokeManifold />
      </FaultGlow>

      {/* 振动筛 */}
      <FaultGlow isFaulty={faultySet.has('RIG-SH-101')}>
        <ShaleShaker />
      </FaultGlow>

      {/* 发电机组 */}
      <FaultGlow isFaulty={faultySet.has('RIG-PWR-101')}>
        <Generators />
      </FaultGlow>

      {/* 火炬塔 */}
      <FaultGlow isFaulty={faultySet.has('RIG-FLR-101')}>
        <FlareTower />
      </FaultGlow>

      {/* 直升机甲板 */}
      <FaultGlow isFaulty={faultySet.has('RIG-Heli-101')}>
        <Helideck />
      </FaultGlow>

      {/* 居住区 + 起重机（非交互设备，无FaultGlow） */}
      <LivingQuarters />
      <Crane />

      {/* 可点击设备区域 */}
      <ClickableZones />

      {/* 6条管道3D流动效果 */}
      <Pipelines3D />
    </>
  );
}

// ============= 主组件 =============
export function OffshoreRigScene3D() {
  const [viewId, setViewId] = useState('overview');
  const [dismissedFaultId, setDismissedFaultId] = useState<string | null>(null);

  const isDrillRunning = useDrillStore((s) => s.isRunning);
  const currentFault = useDrillStore((s) => s.currentFault);

  const faultBriefing = useMemo(() => {
    if (!isDrillRunning || !currentFault) return null;
    if (dismissedFaultId === currentFault.id) return null;
    return {
      id: currentFault.id,
      title: currentFault.name,
      description: currentFault.description,
      hint: currentFault.steps.find((s) => s.correct)?.action ?? '请查看参数面板进行调整',
    };
  }, [isDrillRunning, currentFault, dismissedFaultId]);

  useEffect(() => {
    if (currentFault) setDismissedFaultId(null);
  }, [currentFault?.id]);

  const preset = VIEW_PRESETS.find((v) => v.id === viewId) ?? VIEW_PRESETS[0];

  return (
    <Scene3DErrorBoundary>
      <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0a1929' }}>
        <Canvas
          camera={{ position: preset.pos, fov: 50, near: 0.1, far: 300 }}
          key={viewId}
          gl={{ antialias: true, alpha: false }}
          onPointerMissed={() => useUIStore.getState().selectEquipment(null)}
        >
          <color attach="background" args={['#0a1929']} />
          <fog attach="fog" args={['#0a1929', 60, 180]} />
          <Suspense fallback={null}>
            <SceneContent />
          </Suspense>
          <OrbitControls
            enablePan enableZoom enableRotate
            minDistance={8}
            maxDistance={80}
            maxPolarAngle={Math.PI * 0.49}
            target={preset.target}
          />
        </Canvas>

        {/* 视角预设按钮 */}
        <div style={{
          position: 'absolute', right: 12, top: 48, display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {VIEW_PRESETS.map((v) => (
            <button
              key={v.id}
              onClick={() => setViewId(v.id)}
              style={{
                background: viewId === v.id ? 'rgba(56, 189, 248, 0.2)' : 'rgba(10,25,41,0.7)',
                color: viewId === v.id ? '#38bdf8' : '#94a3b8',
                border: viewId === v.id ? '1px solid #38bdf8' : '1px solid rgba(148,163,184,0.2)',
                borderRadius: 6, padding: '6px 10px', fontSize: 11, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: 14 }}>{v.icon}</span>
              {v.label}
            </button>
          ))}
        </div>

        {/* 故障简报卡片 */}
        <FaultBriefingCard fault={faultBriefing} onClose={() => setDismissedFaultId(currentFault?.id ?? null)} />

        {/* 顶部提示 */}
        <div style={{
          position: 'absolute', top: 12, left: 12, color: '#94a3b8',
          background: 'rgba(10,25,41,0.7)', padding: '6px 10px', borderRadius: 6, fontSize: 12,
          border: '1px solid rgba(148,163,184,0.2)',
        }}>
           海上钻井平台 3D · 鼠标拖动旋转 / 滚轮缩放 / 右键平移
        </div>

        {/* 版本标签 */}
        <div style={{
          position: 'absolute', bottom: 12, right: 12, color: '#38bdf8',
          background: 'rgba(10,25,41,0.7)', padding: '4px 8px', borderRadius: 4, fontSize: 10,
        }}>
          v1.0 offshore-3d (视角预设+参数浮窗+故障简报)
        </div>
      </div>
    </Scene3DErrorBoundary>
  );
}
