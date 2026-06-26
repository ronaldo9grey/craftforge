/**
 * TBM 盾构机 3D 主场景 (v3 - 视觉大幅优化版)
 * 核心改动（解决"看不出轮廓及样子"）：
 *  1. 所有关键部件加 Edges 亮色描边线 → 轮廓清晰可辨
 *  2. 相机调整为侧前俯视角度 → 同时看清刀盘正面 + 盾体侧面 + 台车
 *  3. 地层极度透明(0.08~0.12) → 不遮挡盾构机
 *  4. 盾构机整体放大1.2倍 → 占画面更大比例
 *  5. 增强emissive自发光 → 暗背景下部件醒目
 *  6. 刀盘正对相机方向 → 刀齿分布一目了然
 */
import { Suspense, useRef, Component, type ReactNode } from 'react';
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

const COLORS = {
  soil1: '#92704f',
  soil2: '#c4956a',
  soil3: '#4a7a95',
  soil4: '#5a6470',
  // 盾构机分段颜色（更鲜明）
  frontShield: '#f59e0b',   // 前盾：亮琥珀
  midShield: '#ea580c',     // 中盾：橙红
  tailShield: '#c2410c',    // 尾盾：深橙红
  cutterDisk: '#7c2d12',    // 刀盘盘体：深红棕
  cutterDiskInner: '#9a3412',
  cutterArm: '#94a3b8',     // 辐条：银灰
  cutterTooth: '#fde047',   // 刀齿：亮金
  cutterToothWorn: '#ef4444', // 磨损刀齿：红
  cutterHub: '#1e293b',     // 中心毂：深灰蓝
  segment: '#d6d3d1',       // 管片：浅混凝土
  screwShell: '#78350f',    // 螺旋外壳
  screwBlade: '#fbbf24',    // 螺旋叶片
  backup: '#475569',        // 后配套台车
  backupTop: '#64748b',     // 台车顶部设备
  hydraulic: '#eab308',     // 液压油缸：黄
  // 描边颜色
  edgeGold: '#fde047',
  edgeWhite: '#f1f5f9',
  edgeOrange: '#fb923c',
};

function labelStyle(color: string): React.CSSProperties {
  return {
    background: 'rgba(15, 23, 42, 0.92)',
    color, padding: '3px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600,
    border: `1px solid ${color}`, whiteSpace: 'nowrap',
    transform: 'translate(-50%, -50%)', pointerEvents: 'none',
  };
}

// ============= 地层（极度透明，仅做背景暗示） =============
function SoilLayers() {
  return (
    <group>
      {/* 杂填土 */}
      <mesh position={[0, -1.5, -10]}>
        <boxGeometry args={[36, 3, 50]} />
        <meshStandardMaterial color={COLORS.soil1} roughness={0.95} transparent opacity={0.1} />
      </mesh>
      {/* 砂质粉土 */}
      <mesh position={[0, -7.5, -10]}>
        <boxGeometry args={[36, 9, 50]} />
        <meshStandardMaterial color={COLORS.soil2} roughness={0.95} transparent opacity={0.08} />
      </mesh>
      {/* 含水砂层 */}
      <mesh position={[0, -15, -10]}>
        <boxGeometry args={[36, 6, 50]} />
        <meshStandardMaterial color={COLORS.soil3} roughness={0.9} transparent opacity={0.09} />
      </mesh>
      {/* 风化岩 */}
      <mesh position={[0, -24, -10]}>
        <boxGeometry args={[36, 12, 50]} />
        <meshStandardMaterial color={COLORS.soil4} roughness={0.95} transparent opacity={0.1} />
      </mesh>

      {/* 地层标签（放在远处边缘） */}
      <Html position={[15, -1.5, -30]}>
        <div style={labelStyle('#c4956a')}>杂填土 0~-3m</div>
      </Html>
      <Html position={[15, -7.5, -30]}>
        <div style={labelStyle('#c4956a')}>砂质粉土 -3~-12m</div>
      </Html>
      <Html position={[15, -15, -30]}>
        <div style={labelStyle('#4a7a95')}>含水砂层 -12~-18m 💧</div>
      </Html>
      <Html position={[15, -24, -30]}>
        <div style={labelStyle('#7a8290')}>风化岩 -18~-30m</div>
      </Html>
    </group>
  );
}

// ============= 地表建筑单体 =============
// 写字楼：高层玻璃幕墙 + 窗户网格线 + 顶部天线
function OfficeBuilding({ x, z }: { x: number; z: number }) {
  const w = 3.5, h = 14, d = 3.5;
  const floors = 7;
  return (
    <group position={[x, 0, z - 10]}>
      {/* 主体 */}
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#1e3a5f" metalness={0.4} roughness={0.3} />
        <Edges color={COLORS.edgeWhite} />
      </mesh>
      {/* 玻璃幕墙窗户线（每层一条横线 + 竖向分隔） */}
      {Array.from({ length: floors }, (_, f) => {
        const y = 1.5 + f * 1.7;
        return (
          <group key={f}>
            {/* 横向窗带（亮色发光条） */}
            <mesh position={[0, y, d / 2 + 0.01]}>
              <boxGeometry args={[w - 0.3, 0.6, 0.02]} />
              <meshStandardMaterial color="#67e8f9" emissive="#67e8f9" emissiveIntensity={0.3} />
            </mesh>
            <mesh position={[0, y, -d / 2 - 0.01]}>
              <boxGeometry args={[w - 0.3, 0.6, 0.02]} />
              <meshStandardMaterial color="#67e8f9" emissive="#67e8f9" emissiveIntensity={0.3} />
            </mesh>
            <mesh position={[w / 2 + 0.01, y, 0]}>
              <boxGeometry args={[0.02, 0.6, d - 0.3]} />
              <meshStandardMaterial color="#67e8f9" emissive="#67e8f9" emissiveIntensity={0.2} />
            </mesh>
            <mesh position={[-w / 2 - 0.01, y, 0]}>
              <boxGeometry args={[0.02, 0.6, d - 0.3]} />
              <meshStandardMaterial color="#67e8f9" emissive="#67e8f9" emissiveIntensity={0.2} />
            </mesh>
          </group>
        );
      })}
      {/* 顶部天线 */}
      <mesh position={[0, h + 1, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 2, 6]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.8} />
      </mesh>
      <mesh position={[0, h + 2.2, 0]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.8} />
      </mesh>
      <Html position={[0, h + 3.5, 0]}>
        <div style={labelStyle('#67e8f9')}>写字楼</div>
      </Html>
    </group>
  );
}

// 商场：矮宽建筑 + 招牌 + 入口雨棚
function ShoppingMall({ x, z }: { x: number; z: number }) {
  const w = 6, h = 5, d = 5;
  return (
    <group position={[x, 0, z - 10]}>
      {/* 主体 */}
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#7f1d1d" metalness={0.3} roughness={0.5} />
        <Edges color={COLORS.edgeWhite} />
      </mesh>
      {/* 屋顶 */}
      <mesh position={[0, h + 0.15, 0]}>
        <boxGeometry args={[w + 0.6, 0.3, d + 0.6]} />
        <meshStandardMaterial color="#52525b" roughness={0.7} />
      </mesh>
      {/* 招牌（发光条） */}
      <mesh position={[0, h - 1, d / 2 + 0.05]}>
        <boxGeometry args={[w - 1, 1.2, 0.08]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.5} />
      </mesh>
      {/* 入口雨棚 */}
      <mesh position={[0, 1.2, d / 2 + 0.8]}>
        <boxGeometry args={[3, 0.15, 1.5]} />
        <meshStandardMaterial color="#334155" metalness={0.5} />
      </mesh>
      {/* 入口柱子 ×2 */}
      {[-1.2, 1.2].map((cx, i) => (
        <mesh key={i} position={[cx, 0.6, d / 2 + 1.2]}>
          <cylinderGeometry args={[0.12, 0.12, 1.2, 8]} />
          <meshStandardMaterial color="#64748b" metalness={0.6} />
        </mesh>
      ))}
      {/* 侧面窗户 */}
      {[0, 1, 2].map((f) => (
        <mesh key={f} position={[w / 2 + 0.02, 1.5 + f * 1.2, 0]}>
          <boxGeometry args={[0.04, 0.7, d - 1.5]} />
          <meshStandardMaterial color="#67e8f9" emissive="#67e8f9" emissiveIntensity={0.25} />
        </mesh>
      ))}
      <Html position={[0, h + 1, 0]}>
        <div style={labelStyle('#fbbf24')}>商场</div>
      </Html>
    </group>
  );
}

// 住宅楼：中等高度 + 阳台凸出
function ResidentialBuilding({ x, z }: { x: number; z: number }) {
  const w = 4, h = 9, d = 3.5;
  const floors = 5;
  return (
    <group position={[x, 0, z - 10]}>
      {/* 主体 */}
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#78716c" roughness={0.8} />
        <Edges color={COLORS.edgeWhite} />
      </mesh>
      {/* 每层阳台（正面凸出小盒） */}
      {Array.from({ length: floors }, (_, f) => (
        <group key={f}>
          {/* 左阳台 */}
          <mesh position={[-w / 4, 1 + f * 1.6, d / 2 + 0.4]}>
            <boxGeometry args={[1.2, 0.5, 0.8]} />
            <meshStandardMaterial color="#a8a29e" roughness={0.7} />
            <Edges color="#57534e" />
          </mesh>
          {/* 右阳台 */}
          <mesh position={[w / 4, 1 + f * 1.6, d / 2 + 0.4]}>
            <boxGeometry args={[1.2, 0.5, 0.8]} />
            <meshStandardMaterial color="#a8a29e" roughness={0.7} />
            <Edges color="#57534e" />
          </mesh>
          {/* 窗户（阳台之间） */}
          <mesh position={[0, 1.3 + f * 1.6, d / 2 + 0.01]}>
            <boxGeometry args={[1.0, 0.6, 0.02]} />
            <meshStandardMaterial color="#fef3c7" emissive="#fef3c7" emissiveIntensity={0.15} />
          </mesh>
        </group>
      ))}
      {/* 顶部水箱 */}
      <mesh position={[w / 4, h + 0.6, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 1.2, 12]} />
        <meshStandardMaterial color="#57534e" roughness={0.6} />
      </mesh>
      <Html position={[0, h + 1.5, 0]}>
        <div style={labelStyle('#a8a29e')}>住宅楼</div>
      </Html>
    </group>
  );
}

// ============= 地表 =============
function GroundSurface({ settlement }: { settlement: number }) {
  const monitorZs = [-22, -10, 2, 14, 24];
  const isAlert = Math.abs(settlement) > 10;
  return (
    <group>
      {/* 地表路面 */}
      <mesh position={[0, 0.01, -10]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[36, 50]} />
        <meshStandardMaterial color="#1e293b" roughness={0.95} />
      </mesh>
      {/* 地表建筑物（精细版） */}
      <OfficeBuilding x={-12} z={-20} />
      <ShoppingMall x={-3} z={-14} />
      <ResidentialBuilding x={7} z={-9} />

      {/* 沉降监测点（立杆+传感器盒，更直观） */}
      {monitorZs.map((z, i) => {
        const color = isAlert ? '#ef4444' : '#22c55e';
        return (
          <group key={i} position={[10, 0, z - 10]}>
            {/* 立杆 */}
            <mesh position={[0, 1.0, 0]}>
              <cylinderGeometry args={[0.08, 0.08, 2.0, 6]} />
              <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.4} />
            </mesh>
            {/* 传感器盒 */}
            <mesh position={[0, 2.1, 0]}>
              <boxGeometry args={[0.6, 0.4, 0.4]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isAlert ? 0.6 : 0.2} />
              <Edges color={COLORS.edgeWhite} />
            </mesh>
            {/* 底座 */}
            <mesh position={[0, 0.1, 0]}>
              <boxGeometry args={[0.8, 0.2, 0.8]} />
              <meshStandardMaterial color="#334155" roughness={0.7} />
            </mesh>
            <Html position={[0, 2.8, 0]}>
              <div style={{
                background: isAlert ? '#7f1d1d' : '#14532d',
                color: '#fff', padding: '2px 6px', borderRadius: 3, fontSize: 10,
                whiteSpace: 'nowrap', transform: 'translate(-50%, -50%)', pointerEvents: 'none',
                border: `1px solid ${color}`,
              }}>
                M{i + 1}: {settlement.toFixed(1)}mm
              </div>
            </Html>
          </group>
        );
      })}
      <Html position={[10, 3.5, -10]}>
        <div style={labelStyle('#22c55e')}>沉降监测点 ×5</div>
      </Html>
    </group>
  );
}

// ============= 已建隧道管片（加描边） =============
function CompletedTunnel({ shieldZ }: { shieldZ: number }) {
  const segs: number[] = [];
  for (let z = -28; z < shieldZ - 4; z += 1.5) segs.push(z);
  return (
    <group position={[0, -14, 0]}>
      {segs.map((z, i) => (
        <group key={i} position={[0, 0, z]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[3.2, 0.25, 8, 32]} />
            <meshStandardMaterial color={COLORS.segment} roughness={0.8} />
            <Edges color="#a8a29e" />
          </mesh>
          {i % 3 === 0 && [0, 1, 2, 3].map((j) => {
            const a = (j / 4) * Math.PI * 2;
            return (
              <mesh key={j} position={[Math.cos(a) * 3.2, 0, Math.sin(a) * 3.2]}>
                <sphereGeometry args={[0.12, 8, 8]} />
                <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.3} />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
}

// ============= 刀盘（精细化 + 描边，正对相机方向） =============
function CutterHead({ rpm, wear, z }: { rpm: number; wear: number; z: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += (rpm * 2 * Math.PI / 60) * dt;
  });
  const wearColor = wear > 70 ? COLORS.cutterToothWorn : wear > 40 ? '#f59e0b' : COLORS.cutterTooth;
  const wearEmissive = wear > 70 ? 0.5 : 0.15;

  return (
    <group ref={ref} position={[0, -14, z + 3.8]} rotation={[Math.PI / 2, 0, 0]}>
      {/* 外层主盘体（厚实，带描边） */}
      <mesh>
        <cylinderGeometry args={[3.5, 3.5, 0.7, 48]} />
        <meshStandardMaterial color={COLORS.cutterDisk} metalness={0.6} roughness={0.4} emissive={COLORS.cutterDisk} emissiveIntensity={0.1} />
        <Edges color={COLORS.edgeGold} />
      </mesh>
      {/* 内层副盘 */}
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[2.8, 2.8, 0.5, 36]} />
        <meshStandardMaterial color={COLORS.cutterDiskInner} metalness={0.5} roughness={0.5} />
        <Edges color={COLORS.edgeOrange} />
      </mesh>

      {/* 6 条粗辐条（带描边） */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 1.5, 0.15, Math.sin(a) * 1.5]} rotation={[0, -a, 0]}>
            <boxGeometry args={[3.0, 0.5, 0.6]} />
            <meshStandardMaterial color={COLORS.cutterArm} metalness={0.7} roughness={0.3} />
            <Edges color={COLORS.edgeWhite} />
          </mesh>
        );
      })}

      {/* 外圈 36 把滚刀（带刀座 + 描边） */}
      {Array.from({ length: 36 }, (_, i) => {
        const a = (i / 36) * Math.PI * 2;
        return (
          <group key={i} position={[Math.cos(a) * 3.1, 0.5, Math.sin(a) * 3.1]} rotation={[0, -a, 0]}>
            <mesh>
              <boxGeometry args={[0.5, 0.3, 0.4]} />
              <meshStandardMaterial color="#374151" metalness={0.8} roughness={0.3} />
              <Edges color={COLORS.edgeWhite} />
            </mesh>
            <mesh position={[0, 0.35, 0]}>
              <coneGeometry args={[0.18, 0.5, 8]} />
              <meshStandardMaterial color={wearColor} emissive={wearColor} emissiveIntensity={wearEmissive} metalness={0.6} />
            </mesh>
          </group>
        );
      })}

      {/* 内圈 12 把切刀 */}
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 1.9, 0.4, Math.sin(a) * 1.9]} rotation={[0, -a, 0]}>
            <coneGeometry args={[0.12, 0.35, 6]} />
            <meshStandardMaterial color={wearColor} emissive={wearColor} emissiveIntensity={wearEmissive * 0.8} />
          </mesh>
        );
      })}

      {/* 中心毂（大法兰盘 + 描边） */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.9, 1.0, 1.2, 24]} />
        <meshStandardMaterial color={COLORS.cutterHub} metalness={0.85} roughness={0.2} />
        <Edges color={COLORS.edgeGold} />
      </mesh>
      {/* 中心毂螺栓 */}
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.65, 0.8, Math.sin(a) * 0.65]}>
            <cylinderGeometry args={[0.08, 0.08, 0.2, 6]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.15} />
          </mesh>
        );
      })}

      <Html position={[0, 0, 4.2]}>
        <div style={labelStyle('#fde047')}>🛞 刀盘 · {rpm.toFixed(1)} rpm</div>
      </Html>
    </group>
  );
}

// ============= 盾体（分段 + 描边 + 油缸） =============
function ShieldBody({ z, roll }: { z: number; roll: number }) {
  return (
    <group position={[0, -14, z]} rotation={[0, 0, (roll * Math.PI) / 180]}>
      {/* —— 前盾（刀盘驱动区，最粗，带描边） —— */}
      <mesh position={[0, 0, 1.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[3.5, 3.5, 3, 36, 1, true]} />
        <meshStandardMaterial color={COLORS.frontShield} metalness={0.5} roughness={0.4} emissive={COLORS.frontShield} emissiveIntensity={0.12} side={THREE.DoubleSide} />
        <Edges color={COLORS.edgeGold} />
      </mesh>
      {/* 前盾法兰圈 */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.5, 0.22, 8, 36]} />
        <meshStandardMaterial color="#92651a" metalness={0.7} roughness={0.3} />
        <Edges color={COLORS.edgeGold} />
      </mesh>

      {/* —— 中盾（推进油缸 + 拼装机区，带描边） —— */}
      <mesh position={[0, 0, -2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[3.4, 3.4, 4, 36, 1, true]} />
        <meshStandardMaterial color={COLORS.midShield} metalness={0.5} roughness={0.4} emissive={COLORS.midShield} emissiveIntensity={0.12} side={THREE.DoubleSide} />
        <Edges color={COLORS.edgeOrange} />
      </mesh>
      {/* 中盾法兰圈 */}
      <mesh position={[0, 0, -4]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.4, 0.2, 8, 36]} />
        <meshStandardMaterial color="#7a5610" metalness={0.7} roughness={0.3} />
        <Edges color={COLORS.edgeOrange} />
      </mesh>

      {/* —— 尾盾（密封区，稍细，带描边） —— */}
      <mesh position={[0, 0, -5.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[3.3, 3.2, 3, 36, 1, true]} />
        <meshStandardMaterial color={COLORS.tailShield} metalness={0.5} roughness={0.4} emissive={COLORS.tailShield} emissiveIntensity={0.1} side={THREE.DoubleSide} />
        <Edges color={COLORS.edgeOrange} />
      </mesh>
      {/* 尾盾末端圆环 */}
      <mesh position={[0, 0, -7]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.2, 0.24, 8, 36]} />
        <meshStandardMaterial color="#6b4010" metalness={0.7} roughness={0.3} />
        <Edges color={COLORS.edgeOrange} />
      </mesh>

      {/* —— 16 个推进油缸（中盾内壁环布，带描边） —— */}
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        const x = Math.cos(a) * 2.9;
        const y = Math.sin(a) * 2.9;
        return (
          <group key={i} position={[x, y, -1.5]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.18, 0.18, 2.5, 10]} />
              <meshStandardMaterial color={COLORS.hydraulic} metalness={0.8} roughness={0.2} emissive={COLORS.hydraulic} emissiveIntensity={0.15} />
              <Edges color={COLORS.edgeGold} />
            </mesh>
            <mesh position={[0, 0, 1.5]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 1.2, 8]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.1} />
            </mesh>
          </group>
        );
      })}

      {/* 设备标签 */}
      <Html position={[0, 3.8, 1.5]}>
        <div style={labelStyle('#f59e0b')}>前盾 · 刀盘驱动</div>
      </Html>
      <Html position={[0, 3.7, -2]}>
        <div style={labelStyle('#ea580c')}>中盾 · 推进/拼装</div>
      </Html>
      <Html position={[0, 3.6, -5.5]}>
        <div style={labelStyle('#c2410c')}>尾盾 · 密封</div>
      </Html>
    </group>
  );
}

// ============= 螺旋输送机（加描边） =============
function ScrewConveyor({ z, screwRpm }: { z: number; screwRpm: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += (screwRpm * 2 * Math.PI / 60) * dt;
  });
  return (
    <group position={[2.5, -16, z - 1]} rotation={[Math.PI / 2.5, 0, 0.3]}>
      {/* 外壳（半透明，看到内部螺旋） */}
      <mesh>
        <cylinderGeometry args={[0.65, 0.65, 7, 16, 1, true]} />
        <meshStandardMaterial color={COLORS.screwShell} transparent opacity={0.45} side={THREE.DoubleSide} />
        <Edges color={COLORS.edgeOrange} />
      </mesh>
      {/* 螺旋叶片 */}
      <mesh ref={ref}>
        <torusGeometry args={[0.45, 0.06, 4, 80, Math.PI * 14]} />
        <meshStandardMaterial color={COLORS.screwBlade} metalness={0.7} roughness={0.2} emissive={COLORS.screwBlade} emissiveIntensity={0.1} />
      </mesh>
      {/* 出土口 */}
      <mesh position={[0, -4, 0]}>
        <cylinderGeometry args={[0.5, 0.35, 1.5, 12]} />
        <meshStandardMaterial color="#4a3020" roughness={0.8} />
        <Edges color={COLORS.edgeWhite} />
      </mesh>
      <Html position={[0, 0.8, 0]}>
        <div style={labelStyle('#fbbf24')}>螺旋输送机</div>
      </Html>
    </group>
  );
}

// ============= 后配套台车（精细版 + 描边） =============
function BackupCars({ z }: { z: number }) {
  return (
    <group position={[0, -14, z]}>
      {[0, 1, 2, 3, 4].map((i) => {
        const cz = -9 - i * 3.8;
        return (
          <group key={i} position={[0, 0, cz]}>
            {/* 台车主体（带描边） */}
            <mesh>
              <boxGeometry args={[4.8, 2.4, 3.4]} />
              <meshStandardMaterial color={COLORS.backup} metalness={0.5} roughness={0.4} />
              <Edges color={COLORS.edgeWhite} />
            </mesh>
            {/* 顶部设备（带描边） */}
            <mesh position={[0, 1.5, 0]}>
              <boxGeometry args={[3.8, 0.9, 2.8]} />
              <meshStandardMaterial color={COLORS.backupTop} metalness={0.6} roughness={0.3} />
              <Edges color={COLORS.edgeWhite} />
            </mesh>
            {/* 顶部小设备（每节不同） */}
            {i === 0 && (
              <mesh position={[0, 2.2, 0]}>
                <cylinderGeometry args={[0.5, 0.5, 0.6, 12]} />
                <meshStandardMaterial color="#fbbf24" metalness={0.7} emissive="#fbbf24" emissiveIntensity={0.2} />
                <Edges color={COLORS.edgeGold} />
              </mesh>
            )}
            {i === 1 && (
              <mesh position={[-1, 2.2, 0]}>
                <boxGeometry args={[0.8, 0.6, 0.8]} />
                <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.15} />
                <Edges color={COLORS.edgeWhite} />
              </mesh>
            )}
            {i === 2 && (
              <mesh position={[1, 2.2, 0]}>
                <cylinderGeometry args={[0.4, 0.4, 0.8, 8]} />
                <meshStandardMaterial color="#3b82f6" metalness={0.6} emissive="#3b82f6" emissiveIntensity={0.15} />
                <Edges color={COLORS.edgeWhite} />
              </mesh>
            )}
            {i === 3 && (
              <mesh position={[0, 2.2, 0]}>
                <boxGeometry args={[1.5, 0.5, 1.0]} />
                <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.1} />
                <Edges color={COLORS.edgeWhite} />
              </mesh>
            )}
            {/* 轮子（4个，带描边） */}
            {[[-2, -1.3], [2, -1.3], [-2, 1.3], [2, 1.3]].map(([wx, wz], j) => (
              <mesh key={j} position={[wx, -1.3, wz]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.45, 0.45, 0.35, 14]} />
                <meshStandardMaterial color="#0f172a" metalness={0.4} roughness={0.6} />
                <Edges color="#475569" />
              </mesh>
            ))}
            {/* 台车间连接通道 */}
            {i < 4 && (
              <mesh position={[0, 0, -2.1]}>
                <boxGeometry args={[3.2, 1.6, 1.4]} />
                <meshStandardMaterial color="#1e293b" metalness={0.3} roughness={0.6} />
                <Edges color="#334155" />
              </mesh>
            )}
            {/* 台车编号标签 */}
            <Html position={[2.6, 0, 0]}>
              <div style={labelStyle('#94a3b8')}>T{i + 1}</div>
            </Html>
          </group>
        );
      })}
      <Html position={[0, 2.5, z - 20]}>
        <div style={labelStyle('#94a3b8')}>后配套台车 ×5</div>
      </Html>
    </group>
  );
}

// ============= 管片拼装机（中盾内，新增可见部件） =============
function Erector({ z }: { z: number }) {
  return (
    <group position={[0, -14, z - 3]}>
      {/* 拼装机旋转环 */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.5, 0.3, 8, 32]} />
        <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.3} />
        <Edges color={COLORS.edgeWhite} />
      </mesh>
      {/* 拼装臂 */}
      <mesh position={[0, 0, 0.3]} rotation={[0, 0, 0]}>
        <boxGeometry args={[4.5, 0.4, 0.5]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.4} />
        <Edges color={COLORS.edgeWhite} />
      </mesh>
      {/* 真空吸盘 */}
      <mesh position={[2.0, 0, 0.3]}>
        <cylinderGeometry args={[0.5, 0.6, 0.5, 12]} />
        <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.5} />
        <Edges color={COLORS.edgeGold} />
      </mesh>
      <Html position={[2.0, 1.2, 0.3]}>
        <div style={labelStyle('#94a3b8')}>管片拼装机</div>
      </Html>
    </group>
  );
}

// ============= 故障设备高亮（红色闪烁球体） =============
// 设备ID → 3D空间位置映射（相对于盾构机 shieldZ）
const EQUIP_3D_POS: Record<string, [number, number, number]> = {
  'TBM-CHE-101': [0, 0, 3.8],      // 刀盘
  'TBM-DRV-101': [0, 0, 2.5],      // 主驱动（前盾内）
  'TBM-SHL-101': [0, 0, -2],       // 盾体（中盾）
  'TBM-CHB-101': [0, 0, 1.5],      // 泥水仓（前盾内）
  'TBM-SCR-101': [2.5, -2, -1],    // 螺旋输送机
  'TBM-ERE-101': [0, 0, -3],       // 管片拼装机
  'TBM-INJ-101': [0, 0, -5.5],     // 同步注浆（尾盾）
  'TBM-SEAL-101': [0, 0, -7],      // 盾尾密封（尾盾末端）
  'TBM-NAV-101': [0, 1, -2],       // 导向系统（盾体上方）
  'TBM-BCK-101': [0, 0, -15],      // 后配套台车
  'TBM-MON-101': [10, 2, 5],       // 地表沉降监测（地表）
};
const EQUIP_NAMES: Record<string, string> = {
  'TBM-CHE-101': '刀盘',
  'TBM-DRV-101': '主驱动',
  'TBM-SHL-101': '盾体',
  'TBM-CHB-101': '泥水仓',
  'TBM-SCR-101': '螺旋输送机',
  'TBM-ERE-101': '管片拼装机',
  'TBM-INJ-101': '同步注浆',
  'TBM-SEAL-101': '盾尾密封',
  'TBM-NAV-101': '导向系统',
  'TBM-BCK-101': '后配套台车',
  'TBM-MON-101': '地表监测',
};

function FaultHighlight({ affectedEquipments, shieldZ }: { affectedEquipments: string[]; shieldZ: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const matRefs = useRef<THREE.MeshStandardMaterial[]>([]);
  useFrame((state) => {
    // 闪烁动画：emissiveIntensity + opacity + scale 三重脉动，确保肉眼可见
    const t = state.clock.elapsedTime;
    const wave = Math.sin(t * 5);
    const emissivePulse = 0.4 + 0.5 * wave;
    const opacityPulse = 0.12 + 0.3 * Math.abs(wave);
    matRefs.current.forEach((mat) => {
      if (mat) {
        mat.emissiveIntensity = emissivePulse;
        mat.opacity = opacityPulse;
      }
    });
    // 整体缩放脉动
    if (groupRef.current) {
      const s = 1 + 0.08 * wave;
      groupRef.current.scale.setScalar(s);
    }
  });

  return (
    <group ref={groupRef}>
      {affectedEquipments.map((eqId, idx) => {
        const pos = EQUIP_3D_POS[eqId];
        if (!pos) return null;
        const name = EQUIP_NAMES[eqId] || eqId;
        const isMonitor = eqId === 'TBM-MON-101';
        const actualPos: [number, number, number] = isMonitor
          ? [pos[0], pos[1], pos[2]]
          : [pos[0], pos[1] - 14, pos[2] + shieldZ];
        return (
          <group key={eqId} position={actualPos}>
            {/* 红色半透明闪烁球体 */}
            <mesh>
              <sphereGeometry args={[4.5, 16, 16]} />
              <meshStandardMaterial
                ref={(m) => { if (m) matRefs.current[idx] = m; }}
                color="#ef4444"
                emissive="#ef4444"
                emissiveIntensity={0.6}
                transparent
                opacity={0.25}
                depthWrite={false}
              />
            </mesh>
            {/* 故障标签 */}
            <Html position={[0, 5, 0]}>
              <div style={{
                background: 'rgba(239, 68, 68, 0.9)',
                color: '#fff',
                padding: '4px 10px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
                border: '1px solid #fca5a5',
                boxShadow: '0 0 12px rgba(239,68,68,0.6)',
              }}>
                ⚠ {name} · 故障
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

// ============= 可点击设备区域（3D 交互核心） =============
// 为每个设备创建半透明点击球体，点击后选中设备并弹出参数面板
function ClickableZones({ shieldZ }: { shieldZ: number }) {
  const selectEquipment = useUIStore((s) => s.selectEquipment);
  const selectedEquipmentId = useUIStore((s) => s.selectedEquipmentId);

  // 设备点击区域大小（根据设备体积差异化）
  const RADII: Record<string, number> = {
    'TBM-CHE-101': 4.2,  // 刀盘
    'TBM-SHL-101': 4.5,  // 盾体（最大）
    'TBM-CHB-101': 3.5,  // 泥水仓
    'TBM-SCR-101': 3.5,  // 螺旋输送机
    'TBM-ERE-101': 3.0,  // 管片拼装机
    'TBM-DRV-101': 3.5,  // 主驱动
    'TBM-INJ-101': 3.0,  // 同步注浆
    'TBM-SEAL-101': 3.0, // 盾尾密封
    'TBM-NAV-101': 3.0,  // 导向系统
    'TBM-BCK-101': 4.0,  // 后配套台车
    'TBM-MON-101': 4.0,  // 地表监测
  };

  return (
    <group>
      {Object.entries(EQUIP_3D_POS).map(([eqId, pos]) => {
        const isMonitor = eqId === 'TBM-MON-101';
        const actualPos: [number, number, number] = isMonitor
          ? [pos[0], pos[1], pos[2]]
          : [pos[0], pos[1] - 14, pos[2] + shieldZ];
        const isSelected = selectedEquipmentId === eqId;
        const name = EQUIP_NAMES[eqId] || eqId;
        const radius = RADII[eqId] ?? 3.5;

        return (
          <mesh
            key={eqId}
            position={actualPos}
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
            {isSelected && (
              <Edges color="#22c55e" />
            )}
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
          </mesh>
        );
      })}
    </group>
  );
}

// ============= 场景内容 =============
function SceneContent() {
  const equipments = useEquipmentStore((s) => s.equipments);
  const activeTpl = useUIStore((s) => s.activeTemplate);
  const isDrillRunning = useDrillStore((s) => s.isRunning);
  const currentFault = useDrillStore((s) => s.currentFault);

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
    shieldZRef.current += (advanceSpeed / 1000 / 60) * dt * 800;
    if (shieldZRef.current > 25) shieldZRef.current = -5;
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
      {/* 光照：环境 + 主光 + 补光 */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[15, 25, 15]} intensity={0.9} />
      <pointLight position={[0, -10, shieldZ + 6]} intensity={1.5} color="#fbbf24" distance={35} />
      <pointLight position={[10, -8, shieldZ]} intensity={1.0} color="#ffffff" distance={30} />
      <pointLight position={[-10, -8, shieldZ]} intensity={0.8} color="#60a5fa" distance={30} />
      {/* 刀盘前方工作灯（模拟施工照明） */}
      <spotLight position={[0, -8, shieldZ + 10]} target-position={[0, -14, shieldZ + 3]} intensity={2} color="#fef3c7" angle={0.6} penumbra={0.5} distance={25} />

      {/* 整体放大1.2倍，让盾构机占画面更大比例 */}
      <group scale={1.2}>
        <SoilLayers />
        <GroundSurface settlement={settlement} />
        <CompletedTunnel shieldZ={shieldZ} />
        <ShieldBody z={shieldZ} roll={roll} />
        <CutterHead rpm={rpm} wear={wear} z={shieldZ} />
        <Erector z={shieldZ} />
        <ScrewConveyor z={shieldZ} screwRpm={screwRpm} />
        <BackupCars z={shieldZ} />

        {/* 可点击设备区域：点击选中设备 → 弹出参数面板 */}
        <ClickableZones shieldZ={shieldZ} />

        {/* 演练中：故障设备红色闪烁高亮 */}
        {isDrillRunning && currentFault && (
          <FaultHighlight affectedEquipments={currentFault.affectedEquipments} shieldZ={shieldZ} />
        )}
      </group>
    </>
  );
}

// ============= 主组件 =============
export function TBMScene3D() {
  return (
    <Scene3DErrorBoundary>
      <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0a1426' }}>
        <Canvas
          /* 相机：侧前俯视角度，同时看清刀盘正面 + 盾体侧面 + 台车 */
          camera={{ position: [18, -3, 22], fov: 50, near: 0.1, far: 200 }}
          gl={{ antialias: true, alpha: false }}
          /* 点击空白区域取消选中 → 关闭参数面板 */
          onPointerMissed={() => useUIStore.getState().selectEquipment(null)}
        >
          <color attach="background" args={['#0a1426']} />
          <fog attach="fog" args={['#0a1426', 50, 140]} />
          <Suspense fallback={null}>
            <SceneContent />
          </Suspense>
          <OrbitControls
            enablePan enableZoom enableRotate
            minDistance={8}
            maxDistance={60}
            maxPolarAngle={Math.PI * 0.49}
            target={[0, -14, -6]}
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
          v3.3 tbm-3d (描边+点击交互+故障闪烁+动力学)
        </div>
      </div>
    </Scene3DErrorBoundary>
  );
}
