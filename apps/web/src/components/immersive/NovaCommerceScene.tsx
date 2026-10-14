"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Float, OrbitControls, RoundedBox, Sparkles, Text } from "@react-three/drei";
import { Suspense, useRef } from "react";
import * as THREE from "three";

type Props = { position: [number, number, number]; scale?: number; rotation?: [number, number, number] };

function Parcel({ position, scale = 1, rotation = [0, 0, 0] }: Props) {
  return <group position={position} rotation={rotation} scale={scale}>
    <RoundedBox args={[1.35, 1.08, 1.12]} radius={0.08} smoothness={4} castShadow><meshPhysicalMaterial color="#c88955" roughness={0.7} /></RoundedBox>
    <mesh position={[0, 0, 0.57]}><planeGeometry args={[0.34, 1.06]} /><meshStandardMaterial color="#e9ba7d" /></mesh>
    <mesh position={[0, 0.56, 0]} rotation={[0, 0, 0]}><planeGeometry args={[1.3, 0.28]} /><meshStandardMaterial color="#e9ba7d" /></mesh>
    <Text position={[0, 0.05, 0.59]} fontSize={0.18} color="#34251f" anchorX="center" anchorY="middle">NOVA</Text>
  </group>;
}

function ShoppingBag({ position, scale = 1, rotation = [0, 0, 0] }: Props) {
  return <group position={position} rotation={rotation} scale={scale}>
    <RoundedBox args={[1.1, 1.38, 0.48]} radius={0.08} smoothness={4} castShadow><meshPhysicalMaterial color="#6558f5" roughness={0.32} metalness={0.18} /></RoundedBox>
    <mesh position={[0, 0.77, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.28, 0.035, 12, 32, Math.PI]} /><meshStandardMaterial color="#a8d8ff" /></mesh>
    <Text position={[0, 0, 0.27]} fontSize={0.2} color="#ffffff" anchorX="center" anchorY="middle">SHOP</Text>
  </group>;
}

function ProductBottle({ position, scale = 1, rotation = [0, 0, 0] }: Props) {
  return <group position={position} rotation={rotation} scale={scale}>
    <mesh castShadow><cylinderGeometry args={[0.34, 0.42, 1.35, 32]} /><meshPhysicalMaterial color="#a875ff" roughness={0.22} transmission={0.12} /></mesh>
    <mesh position={[0, 0.82, 0]}><cylinderGeometry args={[0.2, 0.2, 0.24, 24]} /><meshStandardMaterial color="#a8d8ff" metalness={0.4} /></mesh>
    <mesh position={[0, 0, 0.37]}><planeGeometry args={[0.48, 0.38]} /><meshStandardMaterial color="#171a27" /></mesh>
  </group>;
}

function PriceTag({ position, scale = 1, rotation = [0, 0, 0] }: Props) {
  return <group position={position} rotation={rotation} scale={scale}>
    <RoundedBox args={[0.82, 0.52, 0.08]} radius={0.06} smoothness={3} castShadow><meshStandardMaterial color="#d9f1ff" /></RoundedBox>
    <Text position={[0, 0, 0.06]} fontSize={0.14} color="#171a27" anchorX="center" anchorY="middle">$48</Text>
    <mesh position={[0.31, 0, 0.07]}><ringGeometry args={[0.04, 0.065, 20]} /><meshStandardMaterial color="#6558f5" /></mesh>
  </group>;
}

function CommerceObject({ kind, position, scale = 1, rotation = [0, 0, 0] }: Props & { kind: "parcel" | "bag" | "bottle" | "tag" }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state, delta) => { if (ref.current) { ref.current.rotation.y += delta * 0.16; ref.current.position.y += Math.sin(state.clock.elapsedTime * 0.7 + position[0]) * 0.0008; } });
  const Component = kind === "parcel" ? Parcel : kind === "bag" ? ShoppingBag : kind === "bottle" ? ProductBottle : PriceTag;
  return <Float speed={1} rotationIntensity={0.08} floatIntensity={0.35}><group ref={ref}><Component position={[0, 0, 0]} scale={scale} rotation={rotation} /></group></Float>;
}

function SceneContent({ density }: { density: "hero" | "storefront" | "catalog" }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => { if (group.current) { group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, state.pointer.x * 0.12, 0.035); group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -state.pointer.y * 0.06, 0.035); } });
  const objects = density === "catalog" ? [["parcel", -1.4, 0.15, 0.2, 0.65], ["tag", 0, -0.2, -0.1, 0.9], ["bottle", 1.4, 0.25, 0.1, 0.62]] : density === "storefront" ? [["bag", -1.15, 0.1, 0, 0.72], ["parcel", 0.65, 0.35, -0.2, 0.72]] : [["parcel", -1.4, 0.15, 0, 0.72], ["bag", 0, 0.45, -0.45, 0.78], ["bottle", 1.35, -0.05, 0.1, 0.62]];
  return <group ref={group}>{objects.map(([kind, x, y, z, scale], index) => <CommerceObject key={`${kind}-${index}`} kind={kind as "parcel" | "bag" | "bottle" | "tag"} position={[x as number, y as number, z as number]} scale={scale as number} rotation={[0, index * 0.45, index * 0.12]} />)}<Sparkles count={density === "catalog" ? 24 : 42} scale={[7, 4, 3]} size={1.4} speed={0.15} color="#a8d8ff" /></group>;
}

export function NovaCommerceScene({ density = "hero", className = "" }: { density?: "hero" | "storefront" | "catalog"; className?: string }) {
  return <div className={`nova-3d-scene ${className}`} aria-hidden="true"><Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.2, 6], fov: 42 }} shadows><Suspense fallback={null}><color attach="background" args={["transparent"]} /><ambientLight intensity={0.8} color="#d9f1ff" /><directionalLight position={[3, 4, 5]} intensity={2.4} color="#ffffff" castShadow /><pointLight position={[-3, 0, 2]} intensity={14} distance={8} color="#6558f5" /><SceneContent density={density} /><ContactShadows position={[0, -1.45, 0]} opacity={0.28} scale={7} blur={2.8} far={4} /><Environment preset="studio" /><OrbitControls enableZoom={false} enablePan={false} enableRotate={false} /></Suspense></Canvas></div>;
}
