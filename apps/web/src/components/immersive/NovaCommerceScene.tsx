"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Float, OrbitControls, Sparkles, Environment } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

function CommerceObject({ position, color, scale = 1, rotation = [0, 0, 0] }: { position: [number, number, number]; color: string; scale?: number; rotation?: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  const material = useMemo(() => new THREE.MeshPhysicalMaterial({ color, metalness: 0.58, roughness: 0.18, transmission: 0.18, thickness: 0.7, clearcoat: 1 }), [color]);
  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.18;
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.45 + position[0]) * 0.08 + rotation[0];
  });
  return (
    <Float speed={1.2} rotationIntensity={0.18} floatIntensity={0.6}>
      <group ref={ref} position={position} rotation={rotation} scale={scale}>
        <mesh material={material} castShadow>
          <icosahedronGeometry args={[0.7, 2]} />
        </mesh>
        <mesh position={[0, -0.62, 0]} rotation={[0, 0.2, 0]} material={material} castShadow>
          <torusGeometry args={[0.38, 0.035, 16, 64]} />
        </mesh>
      </group>
    </Float>
  );
}

function SceneContent({ density }: { density: "hero" | "storefront" | "catalog" }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!group.current) return;
    const targetX = (state.pointer.x * 0.16);
    const targetY = (state.pointer.y * 0.1);
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetX, 0.035);
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -targetY, 0.035);
  });
  const objects = density === "catalog"
    ? [[-1.4, 0.2, 0.2, "#a875ff", 0.7], [0.1, -0.2, -0.1, "#a8d8ff", 0.9], [1.45, 0.35, 0.1, "#6558f5", 0.65]]
    : density === "storefront"
      ? [[-1.2, 0.15, 0, "#a8d8ff", 0.9], [0.65, 0.5, -0.3, "#a875ff", 0.7]]
      : [[-1.45, 0.2, 0, "#a8d8ff", 0.8], [0, 0.55, -0.5, "#6558f5", 1.05], [1.45, -0.1, 0.1, "#a875ff", 0.76]];
  return (
    <group ref={group}>
      {objects.map(([x, y, z, color, scale], index) => <CommerceObject key={index} position={[x as number, y as number, z as number]} color={color as string} scale={scale as number} rotation={[0, index * 0.6, index * 0.2]} />)}
      <Sparkles count={density === "catalog" ? 34 : 58} scale={[7, 4, 3]} size={2.2} speed={0.2} color="#a8d8ff" />
    </group>
  );
}

export function NovaCommerceScene({ density = "hero", className = "" }: { density?: "hero" | "storefront" | "catalog"; className?: string }) {
  return (
    <div className={`nova-3d-scene ${className}`} aria-hidden="true">
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.2, 6], fov: 42 }} shadows>
        <Suspense fallback={null}>
          <color attach="background" args={["#090b13"]} />
          <ambientLight intensity={0.7} color="#a8d8ff" />
          <directionalLight position={[3, 4, 5]} intensity={2.2} color="#a875ff" castShadow />
          <pointLight position={[-3, 0, 2]} intensity={20} distance={8} color="#6558f5" />
          <SceneContent density={density} />
          <ContactShadows position={[0, -1.45, 0]} opacity={0.35} scale={7} blur={2.8} far={4} />
          <Environment preset="night" />
          <OrbitControls enableZoom={false} enablePan={false} enableRotate={false} />
        </Suspense>
      </Canvas>
    </div>
  );
}
