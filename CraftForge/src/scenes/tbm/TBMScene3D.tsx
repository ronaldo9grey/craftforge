/**
 * TBM 盾构机 3D 主场景 (v1.2 - 错误边界 + 简化版)
 * 使用 @react-three/fiber + drei 构建，跟现有 2D FactoryCanvas 并列存在。
 * 由 FactoryCanvas 通过 sceneMeta.is3D 切换到本组件。
 */
import { Suspense, useRef, Component, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useUIStore } from '@/stores/uiStore';

// ============= 错误边界 =============
// 防止 3D 渲染错误冒泡导致整个应用 unmount 并触发认证重置（跳登录页）
class Scene3DErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message || String(error) };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[TBMScene3D] 3D 场景渲染错误:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: '#0a1426', color: '#fbbf24', padding: 24, textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🛞</div>
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

// 颜色常量
const COLORS = {
  soil1: '#a78b6c',
  soil2: '#d4a574',
  soil3: '#5b8aa0',
  soil4: '#6b7280',
  shieldBody: '#f59e0b',
  cutterHead: '#7c2d12',
  cutterTeeth: '#fbbf24',
  segment: '#9ca3af',
  screwBody: '#854d0e',
  backup: '#1f2937',
};

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
    pointerEvents: 'none',
  };
}

// ============= 地层 =============
function SoilLayers() {
  const W = 30;
  const L = 80;
  return (
    <group>
      <mesh position={[0, -1.5, 0]}>
        <boxGeometry args={[W, 3, L]} />
        <meshStandardMaterial color={COLORS.soil1} roughness={0.95} />
      </mesh>
      <mesh position={[0, -7.5, 0]}>
        <boxGeometry args={[W, 9, L]} />
        <meshStandardMaterial color={COLORS.soil2} roughness={0.95} />
      </mesh>
      <mesh position={[0, -15, 0]}>
        <boxGeometry args={[W, 6, L]} />
        <meshStandardMaterial color={COLORS.soil3} roughness={0.9} transparent opacity={0.92} />
      </mesh>
      <mesh position={[0, -24, 0]}>
        <boxGeometry args={[W, 12, L]} />
        <meshStandardMaterial color={COLORS.soil4} roughness={0.95} />
      </mesh>
      <Html position={[W / 2 + 1, -1.5, L / 2 - 5]}>
        <div style={labelStyle('#a78b6c')}>杂填土 0~-3m</div>
      </Html>
      <Html position={[W / 2 + 1, -7.5, L / 2 - 5]}>
        <div style={labelStyle('#d4a574')}>砂质粉土 -3~-12m</div>
      </Html>
      <Html position={[W / 2 + 1, -15, L / 2 - 5]}>
        <div style={labelStyle('#5b8aa0')}>含水砂层 -12~-18m 💧</div>
      </Html>
      <Html position={[W / 2 + 1, -24, L / 2 - 5]}>
        <div style={labelStyle('#6b7280')}>风化岩 -18~-30m</div>
      </Html>
    </group>
  );
}

// ============= 地表 =============
function GroundSurface({ settlement }: { settlement: number }) {
  const buildings = [
    { x: -10, z: -25, w: 4, h: 8, d: 4 },
    { x: -4, z: -20, w: 3, h: 12, d: 3 },
    { x: 4, z: -15, w: 5, h: 6, d: 5 },
    { x: 10, z: -8, w: 3, h: 10, d: 3 },
  ];
  const monitorZs = [-30, -15, 0, 15, 30];
  return (
    <group>
      {/* 道路 */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
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
        <mesh key={i} position={[b.x, b.h / 2, b.z]}>
          <boxGeometry args={[b.w, b.h, b.d]} />
          <meshStandardMaterial color="#475569" roughness={0.8} />
        </mesh>
      ))}
      {/* 沉降监测点 */}
      {monitorZs.map((z, i) => {
        const isAlert = Math.abs(settlement) > 10;
        const color = isAlert ? '#ef4444' : '#22c55e';
        return (
          <group key={i} position={[12, 0.5, z]}>
            <mesh>
              <coneGeometry args={[0.4, 1, 4]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
            </mesh>
            <Html position={[0, 1.2, 0]}>
              <div style={{
                background: isAlert ? '#7f1d1d' : '#14532d',
                color: '#fff', padding: '2px 6px', borderRadius: 3, fontSize: 10,
                whiteSpace: 'nowrap', transform: 'translate(-50%, -50%)', pointerEvents: 'none',
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

// ============= 已建隧道 =============
function CompletedTunnel({ shieldZ }: { shieldZ: number }) {
  const segs: number[] = [];
  for (let z = -38; z < shieldZ - 3; z += 1.5) segs.push(z);
  return (
    <group position={[0, -22, 0]}>
      {segs.map((z, i) => (
        <mesh key={i} position={[0, 0, z]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[3, 0.18, 8, 24]} />
          <meshStandardMaterial color={COLORS.segment} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

// ============= 刀盘 =============
function CutterHead({ rpm, wear, z }: { rpm: number; wear: number; z: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += (rpm * 2 * Math.PI / 60) * dt;
  });
  const wearColor = wear > 70 ? '#dc2626' : wear > 40 ? '#f59e0b' : COLORS.cutterTeeth;
  return (
    <group ref={ref} position={[0, -22, z + 5]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[3.14, 3.14, 0.5, 32]} />
        <meshStandardMaterial color={COLORS.cutterHead} metalness={0.7} roughness={0.4} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 1.4, 0.3, Math.sin(a) * 1.4]} rotation={[0, -a, 0]}>
            <boxGeometry args={[2.5, 0.3, 0.4]} />
            <meshStandardMaterial color="#374151" metalness={0.5} />
          </mesh>
        );
      })}
      {Array.from({ length: 32 }, (_, i) => {
        const a = (i / 32) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 2.9, 0.4, Math.sin(a) * 2.9]}>
            <coneGeometry args={[0.12, 0.4, 4]} />
            <meshStandardMaterial color={wearColor} emissive={wearColor} emissiveIntensity={wear > 70 ? 0.3 : 0.05} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 0.8, 16]} />
        <meshStandardMaterial color="#1f2937" metalness={0.8} />
      </mesh>
    </group>
  );
}

// ============= 盾体 =============
function ShieldBody({ z, roll }: { z: number; roll: number }) {
  return (
    <group position={[0, -22, z]} rotation={[0, 0, (roll * Math.PI) / 180]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[3.15, 3.15, 9, 32, 1, true]} />
        <meshStandardMaterial color={COLORS.shieldBody} metalness={0.4} roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
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
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 8, 16]} />
        <meshStandardMaterial color={COLORS.screwBody} transparent opacity={0.45} />
      </mesh>
      <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.35, 0.05, 4, 60, Math.PI * 8]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.6} />
      </mesh>
    </group>
  );
}

// ============= 后配套台车 =============
function BackupCars({ z }: { z: number }) {
  return (
    <group position={[0, -22, z]}>
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i} position={[0, 0, -8 - i * 3.5]}>
          <mesh>
            <boxGeometry args={[2.5, 1.8, 3]} />
            <meshStandardMaterial color={COLORS.backup} metalness={0.5} />
          </mesh>
          <mesh position={[0, 1.2, 0]}>
            <boxGeometry args={[2, 0.5, 2.5]} />
            <meshStandardMaterial color="#fbbf24" />
          </mesh>
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

// ============= 整体场景内容 =============
function SceneContent() {
  const equipments = useEquipmentStore((s) => s.equipments);
  const activeTpl = useUIStore((s) => s.activeTemplate);

  const cutterEq = equipments.find((e) => e.id === 'TBM-CHE-101');
  const shieldEq = equipments.find((e) => e.id === 'TBM-SHL-101');
  const screwEq = equipments.find((e) => e.id === 'TBM-SCR-101');
  const monitorEq = equipments.find((e) => e.id === 'TBM-MON-101');

  const rpm = cutterEq?.parameters.find((p) => p.id === 'rpm')?.value ?? 1.2;
  const wear = cutterEq?.parameters.find((p) => p.id === 'wear')?.value ?? 12;
  const roll = shieldEq?.parameters.find((p) => p.id === 'roll')?.value ?? 0;
  const screwRpm = screwEq?.parameters.find((p) => p.id === 'screw_rpm')?.value ?? 8;
  const settlement = monitorEq?.parameters.find((p) => p.id === 'settlement_max')?.value ?? 3;
  const advanceSpeed = shieldEq?.parameters.find((p) => p.id === 'speed')?.value ?? 20;

  const shieldZRef = useRef(0);
  useFrame((_, dt) => {
    shieldZRef.current += (advanceSpeed / 1000 / 60) * dt * 1500;
    if (shieldZRef.current > 35) shieldZRef.current = 0;
  });
  const shieldZ = shieldZRef.current;

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
      <ambientLight intensity={0.55} />
      <directionalLight position={[15, 25, 12]} intensity={1.0} />
      <pointLight position={[0, -22, 5]} intensity={0.6} color="#fbbf24" />

      <SoilLayers />
      <GroundSurface settlement={settlement} />
      <CompletedTunnel shieldZ={shieldZ} />
      <ShieldBody z={shieldZ} roll={roll} />
      <CutterHead rpm={rpm} wear={wear} z={shieldZ} />
      <ScrewConveyor z={shieldZ} screwRpm={screwRpm} />
      <BackupCars z={shieldZ} />
    </>
  );
}

// ============= 主组件 =============
export function TBMScene3D() {
  return (
    <Scene3DErrorBoundary>
      <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0f172a' }}>
        <Canvas
          camera={{ position: [25, 8, 25], fov: 50, near: 0.1, far: 200 }}
          gl={{ antialias: true, alpha: false }}
          onCreated={({ gl }) => {
            console.log('[TBM3D] WebGL 上下文创建成功');
            void gl;
          }}
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
        </Canvas>

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
          v1.2 tbm-3d (错误边界 · 简化稳定版)
        </div>
      </div>
    </Scene3DErrorBoundary>
  );
}
