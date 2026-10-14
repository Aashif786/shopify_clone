"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Float, OrbitControls, Sparkles, Environment } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

function CommerceObject({
  position,
  color,
  scale = 1,
  rotation = [0, 0, 0],
  reducedMotion = false,
}: {
  position: [number, number, number];
  color: string;
  scale?: number;
  rotation?: [number, number, number];
  reducedMotion?: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color,
        metalness: 0.58,
        roughness: 0.18,
        transmission: 0.18,
        thickness: 0.7,
        clearcoat: 1,
      }),
    [color],
  );

  useFrame((state, delta) => {
    if (!ref.current || reducedMotion) return;
    ref.current.rotation.y += delta * 0.18;
    ref.current.rotation.x =
      Math.sin(state.clock.elapsedTime * 0.45 + position[0]) * 0.08 + rotation[0];
  });

  if (reducedMotion) {
    return (
      <group ref={ref} position={position} rotation={rotation} scale={scale}>
        <mesh material={material}>
          <icosahedronGeometry args={[0.7, 2]} />
        </mesh>
        <mesh position={[0, -0.62, 0]} rotation={[0, 0.2, 0]} material={material}>
          <torusGeometry args={[0.38, 0.035, 16, 64]} />
        </mesh>
      </group>
    );
  }

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

function SceneContent({
  density,
  reducedMotion = false,
}: {
  density: "hero" | "storefront" | "catalog";
  reducedMotion?: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!group.current || reducedMotion) return;
    const targetX = state.pointer.x * 0.16;
    const targetY = state.pointer.y * 0.1;
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetX, 0.035);
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -targetY, 0.035);
  });

  const objects =
    density === "catalog"
      ? [
          [-1.4, 0.2, 0.2, "#a875ff", 0.7],
          [0.1, -0.2, -0.1, "#a8d8ff", 0.9],
          [1.45, 0.35, 0.1, "#6558f5", 0.65],
        ]
      : density === "storefront"
        ? [
            [-1.2, 0.15, 0, "#a8d8ff", 0.9],
            [0.65, 0.5, -0.3, "#a875ff", 0.7],
          ]
        : [
            [-1.45, 0.2, 0, "#a8d8ff", 0.8],
            [0, 0.55, -0.5, "#6558f5", 1.05],
            [1.45, -0.1, 0.1, "#a875ff", 0.76],
          ];

  return (
    <group ref={group}>
      {objects.map(([x, y, z, color, scale], index) => (
        <CommerceObject
          key={index}
          position={[x as number, y as number, z as number]}
          color={color as string}
          scale={scale as number}
          rotation={[0, index * 0.6, index * 0.2]}
          reducedMotion={reducedMotion}
        />
      ))}
      {!reducedMotion && (
        <Sparkles
          count={density === "catalog" ? 24 : 40}
          scale={[7, 4, 3]}
          size={2.2}
          speed={0.2}
          color="#a8d8ff"
        />
      )}
    </group>
  );
}

function checkWebGLSupport(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

export function NovaCommerceScene({
  density = "hero",
  className = "",
}: {
  density?: "hero" | "storefront" | "catalog";
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isSupported, setIsSupported] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsSupported(checkWebGLSupport());

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(motionQuery.matches);
    const motionHandler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    motionQuery.addEventListener("change", motionHandler);

    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry?.isIntersecting ?? false);
      },
      { rootMargin: "100px" },
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      motionQuery.removeEventListener("change", motionHandler);
      window.removeEventListener("resize", checkMobile);
      observer.disconnect();
    };
  }, []);

  // Graceful fallback when WebGL is unavailable
  if (!isSupported) {
    return (
      <div
        ref={containerRef}
        className={`nova-3d-scene nova-3d-scene-fallback ${className}`}
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(168, 117, 255, 0.15) 0%, transparent 70%)",
        }}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={`nova-3d-scene ${className}`}
      aria-hidden="true"
    >
      <Canvas
        dpr={isMobile ? 1 : [1, 1.5]}
        camera={{ position: [0, 0.2, 6], fov: 42 }}
        shadows={!isMobile && !reducedMotion}
        frameloop={isVisible && !reducedMotion ? "always" : "demand"}
        gl={{
          alpha: true,
          powerPreference: "low-power",
          antialias: !isMobile,
        }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.7} color="#a8d8ff" />
          <directionalLight
            position={[3, 4, 5]}
            intensity={2.2}
            color="#a875ff"
            castShadow={!isMobile}
          />
          <pointLight position={[-3, 0, 2]} intensity={20} distance={8} color="#6558f5" />
          <SceneContent density={density} reducedMotion={reducedMotion} />
          <ContactShadows
            position={[0, -1.45, 0]}
            opacity={0.35}
            scale={7}
            blur={2.8}
            far={4}
          />
          <Environment preset="night" />
          <OrbitControls enableZoom={false} enablePan={false} enableRotate={false} />
        </Suspense>
      </Canvas>
    </div>
  );
}
