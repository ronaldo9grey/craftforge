/**
 * TBM 盾构机 3D 主场景 (v1)
 * 使用 @react-three/fiber + drei 构建，跟现有 2D FactoryCanvas 并列存在。
 * 由 FactoryCanvas 通过 sceneMeta.is3D 切换到本组件。
 */
import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Stats, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useUIStore } from '@/stores/uiStore';

// 颜色常量
const COLORS = {
  groundSurface: '#94a3b8',
  soil1: '#a78b6c',          // 杂填土 棕
  soil2: '#d4a574',          // 砂质粉土 黄
  soil3: '#5b8aa0',          // 含水砂层 蓝灰
  soil4: '#6b7280',          // 风化岩 深灰
  shieldBody: '#f59e0b',     // 工程黄
  cutterHead: '#7c2d12',     // 暗红
  cutterTeeth: '#fbbf24',    // 刀齿
  segment: '#9ca3af',        // 管片混凝土
  chamber: '#3b82f6',        // 泥水
  screwBody: '#854d0e',      // 螺旋输送机
  backup: '#1f2937',         // 后配套
};

// ============= 地层 =============
function SoilLayers() {
  // 整条隧道走向 z 轴方向，长度 80 m；横向 x = 30 m
  // 高度方向：地表 y=0
  const W = 30;
  const L = 80;
  return (
    <group>
      {/* 杂填土 0 → -3 */}
      <mesh position={[0, -1.5, 0]} receiveShadow>
        <boxGeometry args={[W, 3, L]} />
        <meshStandardMaterial color={COLORS.soil1} roughness={0.95} />
      </mesh>
      {/* 砂质粉土 -3 → -12 */}
      <mesh position={[0, -7.5, 0]} receiveShadow>
        <boxGeometry args={[W, 9, L]} />
        <meshStandardMaterial color={COLORS.soil2} roughness={0.95} />
      </mesh>
      {/* 含水砂层 -12 → -18（有水位线） */}
      <mesh position={[0, -15, 0]} receiveShadow>
        <boxGeometry args={[W, 6, L]} />
        <meshStandardMaterial color={COLORS.soil3} roughness={0.9} transparent opacity={0.95} />
      </mesh>
      {/* 风化岩 -18 → -30 */}
      <mesh position={[0, -24, 0]} receiveShadow>
        <boxGeometry args={[W, 12, L]} />
        <meshStandardMaterial color={COLORS.soil4} roughness={0.95} />
      </mesh>

      {/* 地层标签 */}
      <Html position={[W / 2 + 1, -1.5, L / 2 - 5]} style={{ pointerEvents: 'none' }}>
        <div style={labelStyle('#a78b6c')}>杂填土 0~-3m</div>
      </Html>
      <Html position={[W / 2 + 1, -7.5, L / 2 - 5]} style={{ pointerEvents: 'none' }}>
        <div style={labelStyle('#d4a574')}>砂质粉土 -3~-12m</div>
      </Html>
      <Html position={[W / 2 + 1, -15, L / 2 - 5]} style={{ pointerEvents: 'none' }}>
        <div style={labelStyle('#5b8aa0')}>含水砂层 -12~-18m 💧</div>
      </Html>
      <Html position={[W / 2 + 1, -24, L / 2 - 5]} style={{ pointerEvents: 'none' }}>
        <div style={labelStyle('#6b7280')}>风化岩 -18~-30m</div>
      </Html>
    </group>
  );
}

function labelStyle(color: string): React.CSSProperties {
  return {
    background: 'rgba(15, 23, 42, 0.85)',
    color,
    padding: '4px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    border: `1px solid ${color}`,
    whiteSpace: 'nowrap',
    transform: 'translate(-50%, -50%)',
  };
}

// ============= 地表 + 建筑 + 沉降监测点 =============
function GroundSurface({ settlement }: { settlement: number }) {
  // settlement: 当前最大地表沉降 mm
  const buildings = [
    { x: -10, z: -25, w: 4, h: 8, d: 4 },
    { x: -4,  z: -20, w: 3, h: 12, d: 3 },
    { x: 4,   z: -15, w: 5, h: 6,  d: 5 },
    { x: 10,  z: -8,  w: 3, h: 10, d: 3 },
  ];
  const monitorPoints = [-30, -15, 0, 15, 30].map((z) => ({ z }));
  return (
    <group>
      {/* 道路 */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 80]} />
        <meshStandardMaterial color="#1f2937" roughness={0.95} />
      </mesh>
      {/* 道路虚线 */}
      {[-30, -20, -10, 0, 10, 20, 30].map((z, i) => (
        <mesh key={i} position={[0, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.3, 4]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>
      ))}
      {/* 建筑物 */}
      {buildings.map((b, i) => (
        <mesh key={i} position={[b.x, b.h / 2, b.z]} castShadow receiveShadow>
          <boxGeometry args={[b.w, b.h, b.d]} />
          <meshStandardMaterial color="#475569" roughness={0.8} />
        </mesh>
      ))}
      {/* 沉降监测点：红色 = 沉降超标，绿色 = 正常 */}
      {monitorPoints.map((p, i) => {
        const isAlert = Math.abs(settlement) > 10;
        return (
          <group key={i} position={[12, 0.5, p.z]}>
            <mesh>
              <coneGeometry args={[0.4, 1, 4]} />
              <meshStandardMaterial color={isAlert ? '#ef4444' : '#22c55e'} emissive={isAlert ? '#ef4444' : '#22c55e'} emissiveIntensity={0.4} />
            </mesh>
            <Html position={[0, 1.2, 0]} style={{ pointerEvents: 'none' }}>
              <div style={{
                background: isAlert ? '#7f1d1d' : '#14532d',
                color: '#fff', padding: '2px 6px', borderRadius: 3, fontSize: 10, whiteSpace: 'nowrap', transform: 'translate(-50%, -50%)',
              }}>
                M{i + 1}: {settlement.toFixed(1)} mm
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

// ============= 已建隧道（管片） =============
function CompletedTunnel({ shieldZ }: { shieldZ: number }) {
  // 从 z=-40 到 shieldZ-2 的位置布满管片
  const segments: { z: number }[] = [];
  for (let z = -38; z < shieldZ - 3; z += 1.5) {
    segments.push({ z });
  }
  return (
    <group position={[0, -22, 0]}>
      {segments.map((s, i) => (
        <mesh key={i} position={[0, 0, s.z]} rotation={[0, 0, Math.PI / 2]} receiveShadow>
          <torusGeometry args={[3, 0.18, 8, 24]} />
          <meshStandardMaterial color={COLORS.segment} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

// ============= 刀盘（旋转动画） =============
function CutterHead({ rpm, wear }: { rpm: number; wear: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) {
      // RPM 转换为弧度/秒：rpm * 2π / 60
      ref.current.rotation.z += (rpm * 2 * Math.PI / 60) * dt;
    }
  });
  // 磨损度颜色：从亮金 -> 红
  const wearColor = wear > 70 ? '#dc2626' : wear > 40 ? '#f59e0b' : COLORS.cutterTeeth;
  return (
    <group ref={ref} position={[0, -22, 5]} rotation={[Math.PI / 2, 0, 0]}>
      {/* 主盘体 */}
      <mesh castShadow>
        <cylinderGeometry args={[3.14, 3.14, 0.5, 32]} />
        <meshStandardMaterial color={COLORS.cutterHead} metalness={0.7} roughness={0.4} />
      </mesh>
      {/* 6 个辐条 */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 1.4, 0.3, Math.sin(a) * 1.4]} rotation={[0, -a, 0]}>
            <boxGeometry args={[2.5, 0.3, 0.4]} />
            <meshStandardMaterial color="#374151" metalness={0.5} />
          </mesh>
        );
      })}
      {/* 60 把刀齿（在外圈） */}
      {Array.from({ length: 32 }, (_, i) => {
        const a = (i / 32) * Math.PI * 2;
        return (
          <mesh key={`tooth-${i}`} position={[Math.cos(a) * 2.9, 0.4, Math.sin(a) * 2.9]}>
            <coneGeometry args={[0.12, 0.4, 4]} />
            <meshStandardMaterial color={wearColor} emissive={wearColor} emissiveIntensity={wear > 70 ? 0.3 : 0.05} />
          </mesh>
        );
      })}
      {/* 中央毂 */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 0.8, 16]} />
        <meshStandardMaterial color="#1f2937" metalness={0.8} />
      </mesh>
    </group>
  );
}

// ============= 盾体（圆筒外壳） =============
function ShieldBody({ z, roll }: { z: number; roll: number }) {
  return (
    <group position={[0, -22, z]} rotation={[0, 0, (roll * Math.PI) / 180]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[3.15, 3.15, 9, 32, 1, true]} />
        <meshStandardMaterial color={COLORS.shieldBody} metalness={0.4} roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      {/* 16 个推进油缸（环形）位于盾体后部 */}
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 2.6, Math.sin(a) * 2.6, -4]}>
            <cylinderGeometry args={[0.15, 0.15, 1.5, 8]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.7} />
          </mesh>
        );
      })}
    </group>
  );
}

// ============= 螺旋输送机 =============
function ScrewConveyor({ z, screwRpm }: { z: number; screwRpm: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += (screwRpm * 2 * Math.PI / 60) * dt;
  });
  return (
    <group position={[1.5, -23.5, z - 2]} rotation={[0, 0, -Math.PI / 9]}>
      {/* 外壳 */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 8, 16]} />
        <meshStandardMaterial color={COLORS.screwBody} transparent opacity={0.45} />
      </mesh>
      {/* 内部螺旋叶片 */}
      <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.35, 0.05, 4, 60, Math.PI * 8]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.6} />
      </mesh>
    </group>
  );
}

// ============= 后配套台车 =============
function BackupCars({ z }: { z: number }) {
  // 5 节台车，z 从 z-8 到 z-25
  return (
    <group position={[0, -22, z]}>
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i} position={[0, 0, -8 - i * 3.5]}>
          {/* 车体 */}
          <mesh castShadow>
            <boxGeometry args={[2.5, 1.8, 3]} />
            <meshStandardMaterial color={COLORS.backup} metalness={0.5} />
          </mesh>
          {/* 顶部设备 */}
          <mesh position={[0, 1.2, 0]}>
            <boxGeometry args={[2, 0.5, 2.5]} />
            <meshStandardMaterial color="#fbbf24" />
          </mesh>
          {/* 轮子（在 mesh 上 rotation 而非 geometry 上） */}
          {[-1, 1].map((sign) => (
            <mesh key={sign} position={[sign * 1.1, -0.9, -1]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.35, 0.35, 0.3, 12]} />
              <meshStandardMaterial color="#0f172a" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

// ============= 切削粒子流 =============
function CuttingParticles({ z, active }: { z: number; active: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const COUNT = 80;
  const positions = useRef(new Float32Array(COUNT * 3));
  const velocities = useRef(new Float32Array(COUNT * 3));

  // 初始化粒子
  if (positions.current[0] === 0 && positions.current[1] === 0) {
    for (let i = 0; i < COUNT; i++) {
      positions.current[i * 3]     = (Math.random() - 0.5) * 5;
      positions.current[i * 3 + 1] = (Math.random() - 0.5) * 5;
      positions.current[i * 3 + 2] = z + 5 + Math.random() * 2;
      velocities.current[i * 3]     = (Math.random() - 0.5) * 0.05;
      velocities.current[i * 3 + 1] = -0.02 - Math.random() * 0.05;
      velocities.current[i * 3 + 2] = -0.1 - Math.random() * 0.1;
    }
  }

  useFrame(() => {
    if (!active || !ref.current) return;
    const arr = positions.current;
    const vel = velocities.current;
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3]     += vel[i * 3];
      arr[i * 3 + 1] += vel[i * 3 + 1];
      arr[i * 3 + 2] += vel[i * 3 + 2];
      // 边界回收：回到刀盘前方
      if (arr[i * 3 + 2] < z - 5 || Math.abs(arr[i * 3 + 1]) > 5) {
        arr[i * 3]     = (Math.random() - 0.5) * 5;
        arr[i * 3 + 1] = (Math.random() - 0.5) * 5;
        arr[i * 3 + 2] = z + 5;
      }
    }
    (ref.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <points ref={ref} position={[0, -22, 0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions.current, 3]} count={COUNT} />
      </bufferGeometry>
      <pointsMaterial size={0.18} color="#d4a574" sizeAttenuation />
    </points>
  );
}

// ============= 整体场景内容 =============
function SceneContent() {
  const equipments = useEquipmentStore((s) => s.equipments);
  const activeTpl = useUIStore((s) => s.activeTemplate);

  // 从设备读取实时参数（动力学引擎驱动的值）
  const cutterEq    = equipments.find((e) => e.id === 'TBM-CHE-101');
  const shieldEq    = equipments.find((e) => e.id === 'TBM-SHL-101');
  const screwEq     = equipments.find((e) => e.id === 'TBM-SCR-101');
  const monitorEq   = equipments.find((e) => e.id === 'TBM-MON-101');

  const rpm    = cutterEq?.parameters.find((p) => p.id === 'rpm')?.value ?? 1.2;
  const wear   = cutterEq?.parameters.find((p) => p.id === 'wear')?.value ?? 12;
  const roll   = shieldEq?.parameters.find((p) => p.id === 'roll')?.value ?? 0;
  const screwRpm = screwEq?.parameters.find((p) => p.id === 'screw_rpm')?.value ?? 8;
  const settlement = monitorEq?.parameters.find((p) => p.id === 'settlement_max')?.value ?? 3;
  const advanceSpeed = shieldEq?.parameters.find((p) => p.id === 'speed')?.value ?? 20;

  // 盾构机沿 z 轴推进的"位置"，慢慢累加（mm/min -> m/s）
  const shieldZRef = useRef(0);
  useFrame((_, dt) => {
    shieldZRef.current += (advanceSpeed / 1000 / 60) * dt * 1500;  // 加速 1500 倍便于演示
    if (shieldZRef.current > 35) shieldZRef.current = 0;
  });
  const shieldZ = shieldZRef.current;

  // 当 TBM 还没作为 active 时，依然显示一个占位场景
  if (activeTpl !== 'tbm') {
    return (
      <Html center>
        <div style={{ color: '#94a3b8', fontSize: 14 }}>
          请先在左侧选择"盾构机隧道掘进"场景
        </div>
      </Html>
    );
  }

  return (
    <>
      {/* 环境光 + 平行光 + 地表辅助光 */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[15, 25, 12]} intensity={1.0} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <pointLight position={[0, -22, 5]} intensity={0.6} color="#fbbf24" />

      {/* 网格底面（隐喻地图） */}
      <Grid args={[80, 80]} position={[0, 0.005, 0]} cellColor="#475569" sectionColor="#64748b" cellSize={2} sectionSize={10} infiniteGrid={false} fadeDistance={120} />

      <SoilLayers />
      <GroundSurface settlement={settlement} />
      <CompletedTunnel shieldZ={shieldZ} />
      <ShieldBody z={shieldZ} roll={roll} />
      <CutterHead rpm={rpm} wear={wear} />
      <ScrewConveyor z={shieldZ} screwRpm={screwRpm} />
      <BackupCars z={shieldZ} />
      <CuttingParticles z={shieldZ} active={rpm > 0.1} />
    </>
  );
}

// ============= 主组件 =============
export function TBMScene3D() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0f172a' }}>
      <Canvas
        shadows
        camera={{ position: [25, 8, 25], fov: 50, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#0a1426']} />
        <fog attach="fog" args={['#0a1426', 60, 150]} />
        <Suspense fallback={null}>
          <SceneContent />
        </Suspense>
        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          minDistance={8}
          maxDistance={80}
          maxPolarAngle={Math.PI * 0.49}
          target={[0, -10, 0]}
        />
        {import.meta.env.DEV && <Stats />}
      </Canvas>

      {/* HUD 角标 */}
      <div style={{
        position: 'absolute', top: 12, left: 12, color: '#94a3b8',
        background: 'rgba(15,23,42,0.7)', padding: '6px 10px', borderRadius: 6, fontSize: 12,
        border: '1px solid rgba(148,163,184,0.2)',
      }}>
        🛞 TBM 3D · 鼠标拖动旋转 / 滚轮缩放 / 右键平移
      </div>
      <div style={{
        position: 'absolute', bottom: 12, right: 12, color: '#fbbf24',
        background: 'rgba(15,23,42,0.7)', padding: '4px 8px', borderRadius: 4, fontSize: 10,
      }}>
        v1 tbm-3d (Three.js + r3f)
      </div>
    </div>
  );
}
