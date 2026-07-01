/**
 * 高炉炼铁 3D 主场景 (v1.0 blastfurnace-3d)
 *
 * 基于 @react-three/fiber + @react-three/drei + three.js
 * 全部使用程序化几何体，无外部模型
 *
 * 视觉策略（严格参考 TBM / offshore 已有场景的风格）：
 *  1. 复用 Scene3DErrorBoundary / labelStyle / Beam 辅助
 *  2. 复用 ClickableZones / FaultGlow / Pipelines3D / FaultBriefingCard 交互组件
 *  3. VIEW_PRESETS: 远景全景 / 出铁口特写 / 炉顶俯视 / 控制室视角
 *  4. 特色几何：
 *     - 高炉本体 = 炉喉/炉腹/炉缸 三段圆柱（橙红金属材质 + Edges 描边）
 *     - 3 座热风炉 = 圆柱蓄热室，emissive 交替脉动模拟"两烧一送"
 *     - 熔铁流 = vertex displacement 波形（参考 offshore Ocean 改色）
 *     - 上料车 = useFrame sin 周期沿斜轨道上下
 *     - 鱼雷罐车 = 胶囊型胶囊几何体沿铁轨匀速平移
 *     - 烟囱蒸汽 = 上升+扩散粒子（改自 TBM CuttingDebris）
 *     - 出铁口火花 = FlareTower + ScrewDischarge 融合
 *     - 炉顶火焰 = FlareTower flame 系统微调
 *     - 热风环管 = 橙色相位粒子
 *  5. 故障视觉：
 *     - cold-furnace 触发：铁水流 emissive 减弱、烟囱顶温异常发红
 *     - hanging-furnace 触发：料车悬停、探尺红色闪烁；60s 内未降风 →
 *       全屏红色 overlay + shake 动画 + toast，强制退出演练（调用 useDrillStore.endDrill）
 *     - tap-hole-cake 触发：熔铁流位移幅度降到 30%、装载速率显著降低
 */
import { Suspense, useRef, useState, useEffect, useMemo, Component, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Edges } from '@react-three/drei';
import * as THREE from 'three';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useUIStore } from '@/stores/uiStore';
import { useDrillStore } from '@/stores/drillStore';

// ============= 错误边界（参考 TBM/offshore 风格） =============
class Scene3DErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message || String(error) };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[BlastFurnace3D] 3D 场景渲染错误:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: '#1a0a05', color: '#fbbf24', padding: 24, textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⛰️</div>
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

// ============= 颜色常量：熔铁橙工厂配色 =============
const COLORS = {
  bgSky: '#1a0f08',
  bgFloor: '#0a0806',
  // 高炉本体三段渐深橙红
  furnaceThroat: '#f97316',
  furnaceBelly:  '#ea580c',
  furnaceHearth: '#7c2d12',
  furnaceShell:  '#3f3f46',
  // 热风炉
  stoveShell:    '#78350f',
  stoveHot:      '#f59e0b',
  // 鼓风机
  blower:        '#475569',
  // 上料车 / 轨道
  chargingCar:   '#facc15',
  rail:          '#52525b',
  // 出铁口 / 铁水
  moltenIron:    '#ff6b1f',
  moltenIronHot: '#fef08a',
  // 排烟囱 / 蒸汽
  stackShell:    '#52525b',
  smoke:         '#94a3b8',
  // 鱼雷罐车
  torpedo:       '#1f2937',
  torpedoEdge:   '#facc15',
  // 探尺
  probe:         '#94a3b8',
  // 火焰粒子
  flame1: '#fef08a',
  flame2: '#fb923c',
  flame3: '#ef4444',
  // 描边
  edgeGold:  '#fde047',
  edgeWhite: '#f1f5f9',
  edgeOrange: '#fb923c',
};

// ============= 标签样式辅助 =============
function labelStyle(color: string): React.CSSProperties {
  return {
    background: 'rgba(15, 23, 42, 0.92)',
    color, padding: '3px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600,
    border: `1px solid ${color}`, whiteSpace: 'nowrap',
    transform: 'translate(-50%, -50%)', pointerEvents: 'none',
  };
}

// ============= 设备 ID → 3D 位置映射 =============
// 布局：中心 X=0 是高炉本体；左侧是热风炉/鼓风机；右侧是出铁口/鱼雷罐/排烟囱
const EQUIP_3D_POS: Record<string, [number, number, number]> = {
  'BF-BODY':  [0,   8,  0],
  'STOVE':    [-14, 6,  0],
  'BLOWER':   [-22, 2,  2],
  'CHARGE':   [0,   18, 0],
  'TAP-HOLE': [4.5, 2,  0],
  'STACK':    [6,   22, -6],
  'TORPEDO':  [12,  1,  3],
  'PROBE-1':  [1.6, 15, 0],
};

const EQUIP_NAMES: Record<string, string> = {
  'BF-BODY':  '高炉本体',
  'STOVE':    '热风炉群',
  'BLOWER':   '鼓风机',
  'CHARGE':   '上料料斗',
  'TAP-HOLE': '出铁口',
  'STACK':    '排烟囱',
  'TORPEDO':  '鱼雷罐车',
  'PROBE-1':  '探尺',
};

// ============= 4 段主干管路的 3D 走线 =============
const PIPE_DEFS: Array<{
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  name: string;
  radius: number;
}> = [
  { from: [-22, 3, 2],  to: [-16, 6, 0],    color: '#3b82f6', name: '冷风',     radius: 0.20 },
  { from: [-12, 6, 0],  to: [-2.5, 7, 0],   color: '#ef4444', name: '热风',     radius: 0.22 },
  { from: [2, 4, 0],    to: [4.5, 2.5, 0],  color: '#f97316', name: '铁水',     radius: 0.20 },
  { from: [0, 14, 0],   to: [6, 20, -6],    color: '#84cc16', name: '炉顶煤气', radius: 0.18 },
];

// ============= 视角预设 =============
const VIEW_PRESETS = [
  { id: 'overview', label: '远景全景', icon: '⛰️', pos: [24, 16, 24]  as [number, number, number], target: [0, 6, 0]   as [number, number, number] },
  { id: 'taphole',  label: '出铁口',   icon: '🔥', pos: [10, 4, 8]    as [number, number, number], target: [4.5, 2, 0] as [number, number, number] },
  { id: 'top',      label: '炉顶俯视', icon: '👁',  pos: [0.01, 28, 0] as [number, number, number], target: [0, 14, 0]  as [number, number, number] },
  { id: 'control',  label: '控制室',   icon: '🖥️', pos: [-6, 12, 20]  as [number, number, number], target: [-2, 8, 0]  as [number, number, number] },
];

// ============= 通用梁 =============
function Beam({
  from, to, radius = 0.08, color = COLORS.furnaceShell, metalness = 0.8, roughness = 0.3, edgeColor,
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
      <cylinderGeometry args={[radius, radius, length, 10]} />
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
      {edgeColor && <Edges color={edgeColor} />}
    </mesh>
  );
}

// ============= 1. 高炉本体（三段圆柱 + 外壳钢板） =============
// 三段结构参考真实高炉：炉喉（细）→ 炉腹（最宽）→ 炉缸（下部粗）
function BlastFurnaceBody({ isCold }: { isCold: boolean }) {
  return (
    <group>
      {/* 炉喉：最上端窄圆柱 */}
      <mesh position={[0, 14, 0]}>
        <cylinderGeometry args={[1.6, 2.0, 3, 24]} />
        <meshStandardMaterial
          color={COLORS.furnaceThroat}
          metalness={0.6}
          roughness={0.4}
          emissive={isCold ? '#7c2d12' : COLORS.furnaceThroat}
          emissiveIntensity={isCold ? 0.15 : 0.35}
        />
        <Edges color={COLORS.edgeGold} />
      </mesh>

      {/* 炉腹（圆锥台：上小下大） */}
      <mesh position={[0, 10, 0]}>
        <cylinderGeometry args={[2.0, 3.2, 5, 32]} />
        <meshStandardMaterial
          color={COLORS.furnaceBelly}
          metalness={0.65}
          roughness={0.35}
          emissive={isCold ? '#3f3f46' : COLORS.furnaceBelly}
          emissiveIntensity={isCold ? 0.1 : 0.4}
        />
        <Edges color={COLORS.edgeOrange} />
      </mesh>

      {/* 炉腰环形加强段 */}
      <mesh position={[0, 7.5, 0]}>
        <cylinderGeometry args={[3.2, 3.0, 1, 32]} />
        <meshStandardMaterial color={COLORS.furnaceBelly} metalness={0.65} roughness={0.35} />
        <Edges color={COLORS.edgeOrange} />
      </mesh>

      {/* 炉缸 */}
      <mesh position={[0, 5, 0]}>
        <cylinderGeometry args={[3.0, 2.6, 4, 32]} />
        <meshStandardMaterial
          color={COLORS.furnaceHearth}
          metalness={0.7}
          roughness={0.3}
          emissive={isCold ? '#1c1917' : '#9a3412'}
          emissiveIntensity={isCold ? 0.08 : 0.25}
        />
        <Edges color={COLORS.edgeWhite} />
      </mesh>

      {/* 混凝土基座 */}
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[3.5, 3.8, 2, 24]} />
        <meshStandardMaterial color="#525252" metalness={0.2} roughness={0.85} />
        <Edges color={COLORS.edgeWhite} />
      </mesh>

      {/* 6 根外部支撑立柱 */}
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i / 6) * Math.PI * 2;
        const x = Math.cos(a) * 4.0;
        const z = Math.sin(a) * 4.0;
        return (
          <mesh key={i} position={[x, 8, z]}>
            <boxGeometry args={[0.25, 12, 0.25]} />
            <meshStandardMaterial color={COLORS.furnaceShell} metalness={0.7} roughness={0.4} />
            <Edges color={COLORS.edgeWhite} />
          </mesh>
        );
      })}

      {/* 3 圈环形加强筋 */}
      {[5.5, 9, 13].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <torusGeometry args={[3.3, 0.1, 8, 32]} />
          <meshStandardMaterial color="#a1a1aa" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}

      <Html position={[0, 15.6, 0]}>
        <div style={labelStyle('#fb923c')}>⛰️ 高炉本体</div>
      </Html>
    </group>
  );
}

// ============= 2. 热风炉群（3 座 · 两烧一送轮换脉动） =============
// 3 座蓄热室相位错开 → 视觉上呈"两烧一送"轮换
function HotStoves() {
  // 用 refs 数组直接持有核心材质，动画时改 emissiveIntensity
  const coreRefs = useRef<THREE.MeshStandardMaterial[]>([]);
  const stovePositions: [number, number, number][] = [
    [-16, 6, -3],
    [-14, 6,  0],
    [-16, 6,  3],
  ];

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    coreRefs.current.forEach((mat, i) => {
      if (!mat) return;
      // 3 座相位错开 2π/3
      const phase = t * 0.6 + i * (Math.PI * 2 / 3);
      mat.emissiveIntensity = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(phase));
    });
  });

  return (
    <group>
      {stovePositions.map((pos, i) => (
        <group key={i} position={pos}>
          {/* 蓄热室外壳 */}
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[1.3, 1.3, 8, 20]} />
            <meshStandardMaterial color={COLORS.stoveShell} metalness={0.6} roughness={0.4} />
            <Edges color={COLORS.edgeWhite} />
          </mesh>
          {/* 内芯发光柱：脉动的核心 —— 用 ref 记录材质便于动画 */}
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[1.0, 1.0, 7.4, 20]} />
            <meshStandardMaterial
              ref={(m) => { if (m) coreRefs.current[i] = m as THREE.MeshStandardMaterial; }}
              color={COLORS.stoveHot}
              emissive={COLORS.stoveHot}
              emissiveIntensity={0.5}
              transparent
              opacity={0.6}
            />
          </mesh>
          {/* 顶部半球封头 */}
          <mesh position={[0, 4.2, 0]}>
            <sphereGeometry args={[1.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={COLORS.stoveShell} metalness={0.6} roughness={0.4} />
          </mesh>
          {/* 出口热风管：本地坐标系下从蓄热室右侧朝高炉延伸 */}
          <Beam
            from={[1.3, 0, 0]}
            to={[2.5, 0, 0]}
            radius={0.25}
            color="#dc2626"
            edgeColor={COLORS.edgeWhite}
          />
        </group>
      ))}
      <Html position={[-14, 11, 0]}>
        <div style={labelStyle('#f59e0b')}>🔥 热风炉群 (3 座)</div>
      </Html>
    </group>
  );
}

// ============= 3. 鼓风机 =============
function Blower() {
  const rotorRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (rotorRef.current) rotorRef.current.rotation.z = state.clock.elapsedTime * 4;
  });
  return (
    <group position={[-22, 2, 2]}>
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[3, 2, 2.5]} />
        <meshStandardMaterial color={COLORS.blower} metalness={0.6} roughness={0.4} />
        <Edges color={COLORS.edgeWhite} />
      </mesh>
      <mesh ref={rotorRef} position={[1.55, 1, 0]}>
        <cylinderGeometry args={[0.8, 0.8, 0.4, 16]} />
        <meshStandardMaterial color="#374151" metalness={0.7} roughness={0.3} />
        <Edges color={COLORS.edgeGold} />
      </mesh>
      <Beam from={[0, 2, 0]} to={[0, 3, 0]} radius={0.35} color={COLORS.blower} />
      <Html position={[0, 3.6, 0]}>
        <div style={labelStyle('#94a3b8')}>💨 鼓风机</div>
      </Html>
    </group>
  );
}

// ============= 4. 上料车（沿倾斜轨道周期上下 / 悬料时悬停） =============
function ChargingCar({ hanging }: { hanging: boolean }) {
  const carRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!carRef.current) return;
    if (hanging) {
      // 悬料时上料车悬停在半路
      const phase = 0.5;
      carRef.current.position.set(-1 + 3 * phase, 6 + 10 * phase, 0);
      return;
    }
    // 正弦周期：从底部 y=6 到炉顶 y=16 来回
    const t = state.clock.elapsedTime;
    const phase = (Math.sin(t * 0.4) + 1) / 2;
    carRef.current.position.set(-1 + 3 * phase, 6 + 10 * phase, 0);
  });

  return (
    <group>
      {/* 倾斜双轨 */}
      {[-0.4, 0.4].map((zOffset, i) => (
        <Beam
          key={i}
          from={[-1, 6, zOffset]}
          to={[2, 16, zOffset]}
          radius={0.06}
          color={COLORS.rail}
          edgeColor={COLORS.edgeWhite}
        />
      ))}
      <group ref={carRef}>
        <mesh>
          <boxGeometry args={[1.2, 0.8, 1.0]} />
          <meshStandardMaterial
            color={COLORS.chargingCar}
            metalness={0.5}
            roughness={0.4}
            emissive={COLORS.chargingCar}
            emissiveIntensity={0.15}
          />
          <Edges color={COLORS.edgeGold} />
        </mesh>
        {/* 料堆（焦炭+矿石堆） */}
        <mesh position={[0, 0.5, 0]}>
          <coneGeometry args={[0.5, 0.4, 8]} />
          <meshStandardMaterial color="#292524" roughness={0.9} />
        </mesh>
      </group>
      <Html position={[2.5, 17, 0]}>
        <div style={labelStyle('#facc15')}>🚋 上料料斗{hanging ? ' · ⚠️ 悬停' : ''}</div>
      </Html>
    </group>
  );
}

// ============= 5. 出铁口（含火花粒子） =============
function TapHole({ ironFlowScale }: { ironFlowScale: number }) {
  const sparkRef = useRef<THREE.Group>(null);
  const sparkCount = 12;
  const sparks = useRef(
    Array.from({ length: sparkCount }, () => ({
      pos: new THREE.Vector3(
        4.5 + (Math.random() - 0.5) * 0.4,
        2 + Math.random() * 0.3,
        (Math.random() - 0.5) * 0.4,
      ),
      vel: new THREE.Vector3(
        0.4 + Math.random() * 0.6,
        0.8 + Math.random() * 0.6,
        (Math.random() - 0.5) * 0.6,
      ),
      life: Math.random(),
    })),
  );

  useFrame((_, dt) => {
    if (!sparkRef.current) return;
    sparkRef.current.children.forEach((child, i) => {
      const s = sparks.current[i];
      if (!s) return;
      s.life += dt * (0.5 + ironFlowScale);
      if (s.life > 1) {
        s.life = 0;
        s.pos.set(4.5, 2.0, 0);
        s.vel.set(
          0.4 + Math.random() * 0.6,
          0.8 + Math.random() * 0.6,
          (Math.random() - 0.5) * 0.6,
        );
      }
      s.pos.addScaledVector(s.vel, dt);
      s.vel.y -= 1.2 * dt;  // 重力
      child.position.copy(s.pos);
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = (1 - s.life) * ironFlowScale;
      mesh.scale.setScalar((0.6 + Math.random() * 0.4) * ironFlowScale);
    });
  });

  return (
    <group>
      {/* 出铁口耐火砖凸台 */}
      <mesh position={[4, 2, 0]}>
        <boxGeometry args={[0.6, 0.8, 1.2]} />
        <meshStandardMaterial color="#57534e" roughness={0.9} />
        <Edges color={COLORS.edgeWhite} />
      </mesh>
      {/* 出铁沟 */}
      <mesh position={[5.5, 1.8, 0]} rotation={[0, 0, -0.2]}>
        <boxGeometry args={[2.5, 0.25, 0.8]} />
        <meshStandardMaterial color="#292524" roughness={0.9} />
        <Edges color={COLORS.edgeWhite} />
      </mesh>
      {/* 火花粒子 */}
      <group ref={sparkRef}>
        {sparks.current.map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.06, 6, 6]} />
            <meshStandardMaterial
              color={COLORS.flame1}
              emissive={COLORS.flame1}
              emissiveIntensity={1.2}
              transparent
              opacity={0.9}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
      <pointLight position={[4.5, 2.2, 0]} intensity={1.2 * ironFlowScale} color={COLORS.moltenIron} distance={8} />
      <Html position={[4.5, 3.4, 0]}>
        <div style={labelStyle('#ff6b1f')}>🔥 出铁口</div>
      </Html>
    </group>
  );
}

// ============= 6. 熔铁流（vertex displacement 波形，参考 offshore Ocean 改色） =============
// 铁水从出铁口沿斜面流下：倾斜的 planeGeometry + 顶点位移
// flowScale=1 波形正常；结瘤 flowScale=0.3 → 波幅只有 30% + emissive 减弱
function MoltenIronStream({ flowScale }: { flowScale: number }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const mesh = meshRef.current;
    if (!mesh) return;
    const geo = mesh.geometry;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const amp = 0.15 * flowScale;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const wave = Math.sin(x * 2 + t * 3) * amp + Math.cos(y * 1.5 + t * 2) * amp * 0.5;
      pos.setZ(i, wave);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    const mat = mesh.material as THREE.MeshStandardMaterial;
    // 结瘤/炉凉时铁水暗淡：emissive 跟随 flowScale
    mat.emissiveIntensity = 0.7 * flowScale;
    mat.opacity = 0.6 + 0.3 * flowScale;
  });

  return (
    <mesh
      ref={meshRef}
      position={[6, 1.6, 0]}
      rotation={[-Math.PI / 2, 0, -0.15]}
    >
      <planeGeometry args={[3.5, 0.9, 24, 8]} />
      <meshStandardMaterial
        color={COLORS.moltenIron}
        emissive={COLORS.moltenIronHot}
        emissiveIntensity={0.7}
        metalness={0.4}
        roughness={0.35}
        transparent
        opacity={0.9}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ============= 7. 鱼雷罐车（胶囊 + 铁轨 + 满 250t 切换下一节） =============
function TorpedoLadle({ load }: { load: number }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    // load > 250 → 切换到下一节：向右滑出 3 单位
    const shift = load > 250 ? 3 : 0;
    // 微小对位晃动
    groupRef.current.position.x = 12 + shift + Math.sin(t * 0.3) * 0.05;
  });

  return (
    <group ref={groupRef} position={[12, 1, 3]}>
      {/* 铁轨（4 段拼接） */}
      {[-4, 0, 4, 8].map((x) => (
        <mesh key={x} position={[x, -0.4, 0]}>
          <boxGeometry args={[3.6, 0.06, 0.06]} />
          <meshStandardMaterial color="#78716c" metalness={0.8} roughness={0.4} />
        </mesh>
      ))}
      {/* 枕木 */}
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={i} position={[-5 + i * 2, -0.55, 0]}>
          <boxGeometry args={[0.4, 0.15, 1.0]} />
          <meshStandardMaterial color="#3f3f46" roughness={0.9} />
        </mesh>
      ))}

      {/* 鱼雷罐主体（横放圆柱 + 两端半球） */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.8, 0.8, 3.5, 20]} />
        <meshStandardMaterial color={COLORS.torpedo} metalness={0.5} roughness={0.5} />
        <Edges color={COLORS.torpedoEdge} />
      </mesh>
      <mesh position={[-1.75, 0, 0]}>
        <sphereGeometry args={[0.8, 16, 12]} />
        <meshStandardMaterial color={COLORS.torpedo} metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[1.75, 0, 0]}>
        <sphereGeometry args={[0.8, 16, 12]} />
        <meshStandardMaterial color={COLORS.torpedo} metalness={0.5} roughness={0.5} />
      </mesh>

      {/* 顶部装料口（发光铁水） */}
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 0.15, 12]} />
        <meshStandardMaterial
          color={COLORS.moltenIron}
          emissive={COLORS.moltenIronHot}
          emissiveIntensity={0.6}
        />
      </mesh>

      {/* 4 组车轮 */}
      {[-1.3, 1.3].map((x) =>
        [-0.4, 0.4].map((z, j) => (
          <mesh key={`${x}-${j}`} position={[x, -0.35, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.18, 0.18, 0.1, 12]} />
            <meshStandardMaterial color="#525252" metalness={0.7} roughness={0.3} />
          </mesh>
        )),
      )}

      <Html position={[0, 1.7, 0]}>
        <div style={labelStyle(COLORS.torpedoEdge)}>🚂 鱼雷罐车 · {load.toFixed(0)}/350 t</div>
      </Html>
    </group>
  );
}

// ============= 8. 排烟囱（蒸汽粒子 + 顶温异常发红） =============
function Stack({ topTemp }: { topTemp: number }) {
  const smokeRef = useRef<THREE.Group>(null);
  const smokeCount = 18;
  const smokes = useRef(
    Array.from({ length: smokeCount }, () => ({
      pos: new THREE.Vector3(
        6 + (Math.random() - 0.5) * 0.4,
        22 + Math.random() * 2,
        -6 + (Math.random() - 0.5) * 0.4,
      ),
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        0.4 + Math.random() * 0.3,
        (Math.random() - 0.5) * 0.3,
      ),
      life: Math.random(),
    })),
  );

  // 顶温 > 350°C → 烟气异常发红（cold-furnace 触发时会出现）
  const isAbnormal = topTemp > 350;
  const smokeColor = isAbnormal ? '#ef4444' : COLORS.smoke;

  useFrame((_, dt) => {
    if (!smokeRef.current) return;
    smokeRef.current.children.forEach((child, i) => {
      const s = smokes.current[i];
      if (!s) return;
      s.life += dt * 0.3;
      if (s.life > 1) {
        s.life = 0;
        s.pos.set(
          6 + (Math.random() - 0.5) * 0.4,
          22,
          -6 + (Math.random() - 0.5) * 0.4,
        );
        s.vel.set(
          (Math.random() - 0.5) * 0.3,
          0.4 + Math.random() * 0.3,
          (Math.random() - 0.5) * 0.3,
        );
      }
      s.pos.addScaledVector(s.vel, dt);
      // 逐渐扩散
      s.vel.x += (Math.random() - 0.5) * dt * 0.5;
      s.vel.z += (Math.random() - 0.5) * dt * 0.5;
      child.position.copy(s.pos);
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = (1 - s.life) * 0.6;
      mat.color.set(smokeColor);
      mesh.scale.setScalar(0.4 + s.life * 0.8);
    });
  });

  return (
    <group>
      {/* 烟囱主体 */}
      <mesh position={[6, 12, -6]}>
        <cylinderGeometry args={[0.6, 0.9, 20, 20]} />
        <meshStandardMaterial color={COLORS.stackShell} metalness={0.6} roughness={0.4} />
        <Edges color={COLORS.edgeWhite} />
      </mesh>
      <mesh position={[6, 22, -6]}>
        <torusGeometry args={[0.6, 0.1, 8, 24]} />
        <meshStandardMaterial color="#a1a1aa" metalness={0.8} roughness={0.2} />
      </mesh>
      <group ref={smokeRef}>
        {smokes.current.map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.5, 8, 8]} />
            <meshStandardMaterial
              color={smokeColor}
              transparent
              opacity={0.5}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
      <Html position={[6, 24, -6]}>
        <div style={labelStyle(isAbnormal ? '#ef4444' : '#94a3b8')}>
          🏭 排烟囱 · 顶温 {topTemp.toFixed(0)}°C {isAbnormal ? '⚠️' : ''}
        </div>
      </Html>
    </group>
  );
}

// ============= 9. 探尺（悬料时红色闪烁） =============
function Probe1({ hanging }: { hanging: boolean }) {
  const rodRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!rodRef.current) return;
    const mat = rodRef.current.material as THREE.MeshStandardMaterial;
    if (hanging) {
      // 悬料时探尺卡在 1.2m 位置不动 + 红色闪烁
      rodRef.current.position.y = 15;
      mat.emissive.setRGB(1, 0, 0);
      mat.emissiveIntensity = 0.3 + 0.6 * Math.abs(Math.sin(state.clock.elapsedTime * 5));
      return;
    }
    // 正常：缓慢往复模拟测料
    const t = state.clock.elapsedTime;
    rodRef.current.position.y = 15 + Math.sin(t * 0.5) * 1.5;
    mat.emissiveIntensity = 0;
  });
  return (
    <group>
      <mesh ref={rodRef} position={[1.6, 15, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 3, 8]} />
        <meshStandardMaterial color={COLORS.probe} metalness={0.8} roughness={0.3} emissive="#000000" />
      </mesh>
      <mesh position={[1.6, 17, 0]}>
        <torusGeometry args={[0.15, 0.04, 6, 12]} />
        <meshStandardMaterial color="#a1a1aa" metalness={0.9} roughness={0.2} />
      </mesh>
      <Html position={[1.6, 17.8, 0]}>
        <div style={labelStyle(hanging ? '#ef4444' : '#94a3b8')}>
          📏 探尺{hanging ? ' · ⚠️ 卡住' : ''}
        </div>
      </Html>
    </group>
  );
}

// ============= 10. 炉顶火焰（俯视可见的橙红脉动粒子） =============
function FurnaceTopFlame({ isCold }: { isCold: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const particles = useMemo(() => {
    return Array.from({ length: 10 }, () => ({
      offset: [
        (Math.random() - 0.5) * 1.6,
        Math.random() * 0.8,
        (Math.random() - 0.5) * 1.6,
      ] as [number, number, number],
      baseScale: 0.3 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
      speed: 2 + Math.random() * 2,
      color: [COLORS.flame1, COLORS.flame2, COLORS.flame3][Math.floor(Math.random() * 3)],
    }));
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, i) => {
      const p = particles[i];
      if (!p) return;
      const mesh = child as THREE.Mesh;
      const pulse = 0.7 + 0.3 * Math.sin(t * p.speed + p.phase);
      // 炉凉时火焰规模缩小到 40%
      const scale = p.baseScale * pulse * (isCold ? 0.4 : 1.0);
      mesh.scale.set(scale, scale * 1.4, scale);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = (0.5 + 0.4 * Math.abs(Math.sin(t * p.speed + p.phase))) * (isCold ? 0.4 : 1);
      mat.emissiveIntensity = (0.7 + 0.4 * pulse) * (isCold ? 0.35 : 1);
    });
  });

  return (
    <group ref={groupRef} position={[0, 16, 0]}>
      {particles.map((p, i) => (
        <mesh key={i} position={p.offset}>
          <coneGeometry args={[0.25, 0.6, 6]} />
          <meshStandardMaterial
            color={p.color}
            emissive={COLORS.flame2}
            emissiveIntensity={0.9}
            transparent
            opacity={0.75}
            depthWrite={false}
          />
        </mesh>
      ))}
      <pointLight position={[0, 0.5, 0]} intensity={isCold ? 0.3 : 1.5} color={COLORS.flame2} distance={12} />
    </group>
  );
}

// ============= 11. 热风环管（橙色相位粒子） =============
// 从热风炉群到高炉本体的圆环状热风管道
function HotBlastPipe() {
  const particleRefs = useRef<THREE.Mesh[]>([]);
  const COUNT = 8;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    particleRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const phase = ((t * 0.3 + i / COUNT) % 1);
      const angle = phase * Math.PI * 2;
      const r = 3.4;
      mesh.position.set(Math.cos(angle) * r, 7.5, Math.sin(angle) * r);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.8 + 0.4 * Math.sin(t * 3 + i);
    });
  });

  return (
    <group>
      {/* 环管本体（torus） */}
      <mesh position={[0, 7.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.4, 0.15, 12, 32]} />
        <meshStandardMaterial color="#ea580c" metalness={0.6} roughness={0.4} emissive="#ea580c" emissiveIntensity={0.3} />
      </mesh>
      {/* 8 个流动粒子 */}
      {Array.from({ length: COUNT }).map((_, i) => (
        <mesh key={i} ref={(m) => { if (m) particleRefs.current[i] = m; }}>
          <sphereGeometry args={[0.14, 8, 8]} />
          <meshStandardMaterial
            color="#fbbf24"
            emissive="#fbbf24"
            emissiveIntensity={1.0}
            transparent
            opacity={0.85}
          />
        </mesh>
      ))}
    </group>
  );
}

// ============= 12. 故障发光包裹器（参考 offshore FaultGlow） =============
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

// ============= 13. 可点击设备区域（3D 交互核心） =============
// 复用 offshore/tbm ClickableZones 骨架
function ClickableZones() {
  const selectEquipment = useUIStore((s) => s.selectEquipment);
  const selectedEquipmentId = useUIStore((s) => s.selectedEquipmentId);
  const equipments = useEquipmentStore((s) => s.equipments);
  const selectedEq = equipments.find((e) => e.id === selectedEquipmentId);

  const RADII: Record<string, number> = {
    'BF-BODY': 4.5,
    'STOVE': 3.2,
    'BLOWER': 2.2,
    'CHARGE': 1.5,
    'TAP-HOLE': 1.8,
    'STACK': 2.0,
    'TORPEDO': 2.5,
    'PROBE-1': 1.5,
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
                  ✓ {name} · 已选中
                </div>
              </Html>
            )}
            {isSelected && selectedEq && (
              <Html position={[0, -(radius + 0.5), 0]}>
                <div style={{
                  background: 'rgba(15, 23, 42, 0.95)',
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

// ============= 14. 管道 3D 流动效果（参考 offshore/tbm Pipelines3D） =============
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
          (def.from[0] + def.to[0]) / 2 + (i % 2 === 0 ? 1.5 : -1.5),
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
            <line>
              <primitive object={geom} attach="geometry" />
              <lineBasicMaterial color={def.color} transparent opacity={0.55} />
            </line>
            <mesh ref={(m) => { if (m) particleRefs.current[i] = m; }}>
              <sphereGeometry args={[def.radius * 2, 8, 8]} />
              <meshStandardMaterial
                color={def.color}
                emissive={def.color}
                emissiveIntensity={0.8}
                transparent
                opacity={0.9}
              />
            </mesh>
            <Html position={mid}>
              <div style={{ ...labelStyle(def.color), fontSize: 9, padding: '1px 5px', opacity: 0.75 }}>
                {def.name}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

// ============= 15. 故障简报卡片（4s 自动收起，参考 offshore） =============
function FaultBriefingCard({
  fault, onClose,
}: {
  fault: { id: string; title: string; description: string; hint: string } | null;
  onClose: () => void;
}) {
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
        display: 'flex', alignItems: 'center', gap: 8, zIndex: 100,
      }} onClick={() => setCollapsed(false)}>
        <span>⚠️ {fault.title}</span>
        <span style={{ opacity: 0.6, fontSize: 10 }}>点击展开</span>
      </div>
    );
  }

  return (
    <div style={{
      position: 'absolute', top: 48, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(15, 23, 42, 0.96)', color: '#e2e8f0',
      padding: '16px 24px', borderRadius: 10, fontSize: 13,
      border: '1px solid #ef4444', boxShadow: '0 4px 24px rgba(239,68,68,0.35)',
      maxWidth: 560, zIndex: 100, animation: 'bfFaultSlideIn 0.3s ease',
    }}>
      <style>{`
        @keyframes bfFaultSlideIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ color: '#ef4444', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          ⚠️ {fault.title}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ color: '#94a3b8', fontSize: 10, cursor: 'pointer' }} onClick={() => setCollapsed(true)}>收起</span>
          <span style={{ color: '#94a3b8', fontSize: 14, cursor: 'pointer', lineHeight: 1 }} onClick={onClose}>×</span>
        </div>
      </div>
      <div style={{ color: '#cbd5e1', fontSize: 12, marginBottom: 8, lineHeight: 1.5 }}>
        {fault.description}
      </div>
      <div style={{
        background: 'rgba(239, 68, 68, 0.12)', borderRadius: 6, padding: '8px 12px',
        border: '1px solid rgba(239, 68, 68, 0.35)',
      }}>
        <span style={{ color: '#f87171', fontSize: 11, fontWeight: 600 }}>处理要点：</span>
        <span style={{ color: '#fecaca', fontSize: 11, marginLeft: 4 }}>{fault.hint}</span>
      </div>
    </div>
  );
}

// ============= 16. 场景内容（组合所有几何 + 参数读取 + 故障视觉切换） =============
function SceneContent() {
  const equipments = useEquipmentStore((s) => s.equipments);
  const activeTpl = useUIStore((s) => s.activeTemplate);
  const isDrillRunning = useDrillStore((s) => s.isRunning);
  const currentFault = useDrillStore((s) => s.currentFault);

  // —— 读取关键参数用于驱动 3D 视觉 ——
  const tapHole = equipments.find((e) => e.id === 'TAP-HOLE');
  const stack   = equipments.find((e) => e.id === 'STACK');
  const torpedo = equipments.find((e) => e.id === 'TORPEDO');

  const tTap    = tapHole?.parameters.find((p) => p.id === 'T-tap')?.value    ?? 1490;
  const tapFlow = tapHole?.parameters.find((p) => p.id === 'tap-flow')?.value ?? 5.6;
  const tTop    = stack?.parameters.find((p) => p.id === 'T-top')?.value      ?? 220;
  const load    = torpedo?.parameters.find((p) => p.id === 'LOAD')?.value     ?? 120;

  // —— 故障视觉切换 ——
  // cold-furnace：铁水温度 < 1470 判定为炉凉 → 铁水暗淡 + 顶温异常
  const isCold = currentFault?.id === 'BFF001' || tTap < 1470;
  // hanging-furnace：料线卡住 → 上料车悬停 + 探尺红闪
  const isHanging = currentFault?.id === 'BFF002' && isDrillRunning;
  // tap-hole-cake：铁水流量 < 3.5 → 熔铁流波形幅度只有 30%
  const isCake = currentFault?.id === 'BFF003' || tapFlow < 3.5;
  const ironFlowScale = isCake ? 0.3 : 1.0;

  if (activeTpl !== 'blastfurnace') {
    return (
      <Html center>
        <div style={{ color: '#94a3b8', fontSize: 14 }}>
          请先在左侧选择"高炉炼铁"场景
        </div>
      </Html>
    );
  }

  const faultySet = new Set(isDrillRunning && currentFault ? currentFault.affectedEquipments : []);

  return (
    <>
      {/* 光照：炉膛橙红氛围 + 车间白光 */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[20, 30, 15]} intensity={0.9} color="#fef3c7" />
      <directionalLight position={[-15, 20, -10]} intensity={0.35} color="#fdba74" />
      <pointLight position={[0, 10, 0]} intensity={1.2} color="#f97316" distance={20} />
      <pointLight position={[4.5, 3, 0]} intensity={1.5} color="#ff6b1f" distance={12} />

      {/* 车间地面（深色平板） */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, 60]} />
        <meshStandardMaterial color={COLORS.bgFloor} roughness={0.95} />
      </mesh>

      {/* 高炉本体（三段圆柱 + 支撑立柱） */}
      <FaultGlow isFaulty={faultySet.has('BF-BODY')}>
        <BlastFurnaceBody isCold={isCold} />
      </FaultGlow>

      {/* 热风环管：热风从热风炉进入炉腹 */}
      <HotBlastPipe />

      {/* 热风炉群（3 座轮换脉动） */}
      <FaultGlow isFaulty={faultySet.has('STOVE')}>
        <HotStoves />
      </FaultGlow>

      {/* 鼓风机 */}
      <FaultGlow isFaulty={faultySet.has('BLOWER')}>
        <Blower />
      </FaultGlow>

      {/* 上料车（悬料时悬停） */}
      <FaultGlow isFaulty={faultySet.has('CHARGE')}>
        <ChargingCar hanging={isHanging} />
      </FaultGlow>

      {/* 出铁口 + 火花粒子 */}
      <FaultGlow isFaulty={faultySet.has('TAP-HOLE')}>
        <TapHole ironFlowScale={ironFlowScale} />
      </FaultGlow>

      {/* 熔铁流（vertex displacement 波形；结瘤时幅度骤减） */}
      <MoltenIronStream flowScale={ironFlowScale} />

      {/* 鱼雷罐车 */}
      <FaultGlow isFaulty={faultySet.has('TORPEDO')}>
        <TorpedoLadle load={load} />
      </FaultGlow>

      {/* 排烟囱 + 蒸汽 */}
      <FaultGlow isFaulty={faultySet.has('STACK')}>
        <Stack topTemp={tTop} />
      </FaultGlow>

      {/* 探尺（悬料时红闪） */}
      <FaultGlow isFaulty={faultySet.has('PROBE-1')}>
        <Probe1 hanging={isHanging} />
      </FaultGlow>

      {/* 炉顶火焰（俯视可见；炉凉时缩小） */}
      <FurnaceTopFlame isCold={isCold} />

      {/* 可点击设备区域 */}
      <ClickableZones />

      {/* 4 段主干管路的粒子流 */}
      <Pipelines3D />
    </>
  );
}

// ============= 17. 主组件：Canvas + 视角切换 + 故障简报 + 崩料事故惩罚 =============
export function BlastFurnace3D() {
  const [viewId, setViewId] = useState('overview');
  const [dismissedFaultId, setDismissedFaultId] = useState<string | null>(null);
  // 崩料事故 overlay 状态：悬料故障 60s 内未降风 → 全屏红色 + shake + toast
  const [crashed, setCrashed] = useState(false);

  const isDrillRunning = useDrillStore((s) => s.isRunning);
  const currentFault = useDrillStore((s) => s.currentFault);
  const equipments = useEquipmentStore((s) => s.equipments);
  const endDrill = useDrillStore((s) => s.endDrill);

  // 故障简报数据
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
    if (currentFault) {
      setDismissedFaultId(null);
      setCrashed(false);  // 每次新故障重置崩料状态
    }
  }, [currentFault?.id]);

  // —— 崩料事故守卫：悬料故障触发时启动 60s 倒计时
  //     倒计时期间如果学员降风到 3000 以下，取消倒计时
  //     否则时间到 → 触发崩料事故 → endDrill 强制结束演练
  useEffect(() => {
    if (!isDrillRunning || currentFault?.id !== 'BFF002') return;
    const startTs = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = (Date.now() - startTs) / 1000;
      const blower = equipments.find((e) => e.id === 'BLOWER');
      const maf = blower?.parameters.find((p) => p.id === 'MAF')?.value ?? 3800;
      // 学员已经把风量降到 3000 以下 —— 处置有效，撤销倒计时
      if (maf < 3000) {
        clearInterval(timer);
        return;
      }
      if (elapsed >= 60 && !crashed) {
        // 触发崩料事故
        setCrashed(true);
        // 全局 toast（走 window.dispatchEvent 兜底，前端框架自行捕获）
        try {
          window.dispatchEvent(new CustomEvent('bf:crash', {
            detail: { message: '🚨 崩料事故！你差点把老三高炉给炸了！' },
          }));
        } catch { /* ignore */ }
        // 强制退出演练（3s 后调用 endDrill，给用户看清 overlay 再退出）
        window.setTimeout(() => {
          try { endDrill(); } catch { /* ignore */ }
        }, 3000);
        clearInterval(timer);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [isDrillRunning, currentFault?.id, equipments, crashed, endDrill]);

  const preset = VIEW_PRESETS.find((v) => v.id === viewId) ?? VIEW_PRESETS[0];

  return (
    <Scene3DErrorBoundary>
      <div style={{
        width: '100%', height: '100%', position: 'relative',
        background: COLORS.bgSky,
        // 崩料时全屏抖动
        animation: crashed ? 'bfShake 0.15s ease-in-out infinite' : undefined,
      }}>
        <style>{`
          @keyframes bfShake {
            0%   { transform: translate(0, 0); }
            25%  { transform: translate(3px, -2px); }
            50%  { transform: translate(-2px, 3px); }
            75%  { transform: translate(2px, 2px); }
            100% { transform: translate(0, 0); }
          }
        `}</style>
        <Canvas
          camera={{ position: preset.pos, fov: 50, near: 0.1, far: 300 }}
          key={viewId}
          gl={{ antialias: true, alpha: false }}
          onPointerMissed={() => useUIStore.getState().selectEquipment(null)}
        >
          <color attach="background" args={[COLORS.bgSky]} />
          <fog attach="fog" args={[COLORS.bgSky, 40, 130]} />
          <Suspense fallback={null}>
            <SceneContent />
          </Suspense>
          <OrbitControls
            enablePan enableZoom enableRotate
            minDistance={6}
            maxDistance={70}
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
                background: viewId === v.id ? 'rgba(249, 115, 22, 0.2)' : 'rgba(15, 23, 42, 0.7)',
                color: viewId === v.id ? '#f97316' : '#94a3b8',
                border: viewId === v.id ? '1px solid #f97316' : '1px solid rgba(148,163,184,0.2)',
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
        <FaultBriefingCard
          fault={faultBriefing}
          onClose={() => setDismissedFaultId(currentFault?.id ?? null)}
        />

        {/* 顶部提示 */}
        <div style={{
          position: 'absolute', top: 12, left: 12, color: '#f97316',
          background: 'rgba(15, 23, 42, 0.7)', padding: '6px 10px', borderRadius: 6, fontSize: 12,
          border: '1px solid rgba(249, 115, 22, 0.3)',
        }}>
          ⛰️ 高炉炼铁 3D · 鼠标拖动旋转 / 滚轮缩放 / 右键平移
        </div>

        {/* 版本标签 */}
        <div style={{
          position: 'absolute', bottom: 12, right: 12, color: '#f97316',
          background: 'rgba(15, 23, 42, 0.7)', padding: '4px 8px', borderRadius: 4, fontSize: 10,
        }}>
          v1.0 blastfurnace-3d (三段炉体 + 熔铁波 + 鱼雷罐车 + 崩料事故守卫)
        </div>

        {/* —— 崩料事故 overlay（全屏红色 + toast） —— */}
        {crashed && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1000,
            background: 'rgba(220, 38, 38, 0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 16, pointerEvents: 'none',
            animation: 'bfCrashFadeIn 0.3s ease',
          }}>
            <style>{`
              @keyframes bfCrashFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
            `}</style>
            <div style={{
              background: 'rgba(15, 23, 42, 0.95)', color: '#fef2f2',
              padding: '20px 32px', borderRadius: 12,
              border: '2px solid #ef4444',
              boxShadow: '0 0 40px rgba(239, 68, 68, 0.8)',
              fontSize: 22, fontWeight: 700,
              textAlign: 'center',
              maxWidth: 560,
            }}>
              🚨 崩料事故！
              <div style={{ fontSize: 15, color: '#fca5a5', marginTop: 12, fontWeight: 500 }}>
                你差点把老三高炉给炸了！
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 12, fontWeight: 400 }}>
                悬料时必须立即降风，3 秒后强制退出演练...
              </div>
            </div>
          </div>
        )}
      </div>
    </Scene3DErrorBoundary>
  );
}




