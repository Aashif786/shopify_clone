"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { AvatarParams } from "@calcart/customers";
import { buildAvatarGroup, disposeObject } from "./avatar-geometry";
import { computeGarmentFit, type GarmentReference, type GarmentSlot } from "./garment-fit";
import { disposeGarment, fadeGarment, loadGarment } from "./garment-loader";
import { prepareGarmentSkin } from "./garment-texture";
import { buildGeneratedGarment, type GeneratedFit, type GeneratedTemplate } from "./generated-garment";

/** `id` changes whenever the garment changes; it is the identity used for transitions. */
export type ViewerGarment =
  | {
      id: string;
      kind: "glb";
      url: string;
      slot: GarmentSlot;
      reference: GarmentReference;
    }
  | {
      id: string;
      kind: "generated";
      template: GeneratedTemplate;
      fit: GeneratedFit;
      /** Product photo the garment is textured from; null uses a flat default colour. */
      textureUrl: string | null;
    };

export type GarmentStatus = "none" | "loading" | "ready" | "error";

export interface AvatarViewerProps {
  params: AvatarParams;
  /** Garment fitted onto the avatar. Changing it swaps the garment without rebuilding the avatar. */
  garment?: ViewerGarment | null;
  onGarmentStatus?: (status: GarmentStatus) => void;
  className?: string;
}

interface SceneHandle {
  scene: THREE.Scene;
  requestRender: () => void;
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Interactive 3D avatar with an optional fitted garment. Drag to rotate, scroll/pinch to zoom.
 * Renders on demand (no continuous loop) and caps pixel ratio on touch devices.
 */
export function AvatarViewer({ params, garment = null, onGarmentStatus, className }: AvatarViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<SceneHandle | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unsupported" | "error">("loading");
  const [sceneVersion, setSceneVersion] = useState(0);
  const statusCb = useRef(onGarmentStatus);
  statusCb.current = onGarmentStatus;
  // Effects key on the garment's identity, not its object, so re-renders never reload it.
  const garmentRef = useRef(garment);
  garmentRef.current = garment;
  const garmentKey = garment?.id ?? null;

  // Scene + avatar: rebuilt only when the avatar parameters change.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!webglAvailable()) {
      setState("unsupported");
      return;
    }

    let renderer: THREE.WebGLRenderer | null = null;
    let controls: OrbitControls | null = null;
    let avatar: THREE.Group | null = null;
    let observer: ResizeObserver | null = null;
    let frame = 0;
    let disposed = false;

    try {
      const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
      renderer = new THREE.WebGLRenderer({ antialias: !coarse, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
      renderer.domElement.style.display = "block";
      renderer.domElement.style.touchAction = "none";
      renderer.domElement.setAttribute("role", "img");
      renderer.domElement.setAttribute("aria-label", "3D avatar preview. Drag to rotate, scroll to zoom.");
      // A lost GPU context (driver reset, memory pressure) can't be drawn to: show the error state.
      renderer.domElement.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        if (!disposed) setState("error");
      });
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f98, 1.1));
      const key = new THREE.DirectionalLight(0xffffff, 1.6);
      key.position.set(2, 3, 4);
      scene.add(key);

      avatar = buildAvatarGroup(params);
      scene.add(avatar);

      const heightM = params.heightCm / 100;
      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
      camera.position.set(0, heightM * 0.55, heightM * 2.6);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, heightM * 0.5, 0);
      controls.enablePan = false;
      controls.enableDamping = false;
      controls.minDistance = heightM * 1.1;
      controls.maxDistance = heightM * 4;
      controls.minPolarAngle = Math.PI * 0.2;
      controls.maxPolarAngle = Math.PI * 0.62;
      controls.update();

      const render = () => {
        frame = 0;
        if (disposed || !renderer) return;
        renderer.render(scene, camera);
      };
      const requestRender = () => {
        if (!frame && !disposed) frame = requestAnimationFrame(render);
      };
      controls.addEventListener("change", requestRender);

      const resize = () => {
        if (!renderer) return;
        const w = Math.max(container.clientWidth, 1);
        const h = Math.max(container.clientHeight, 1);
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        requestRender();
      };
      observer = new ResizeObserver(resize);
      observer.observe(container);
      resize();

      handleRef.current = { scene, requestRender };
      setSceneVersion((v) => v + 1);
      setState("ready");
    } catch {
      setState("error");
    }

    return () => {
      disposed = true;
      handleRef.current = null;
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      controls?.dispose();
      if (avatar) disposeObject(avatar);
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
    };
  }, [params]);

  // Garment: swapped in place (cross-fade) without touching the avatar or the camera.
  const current = useRef<THREE.Group | null>(null);
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle || state !== "ready") return;
    const { scene, requestRender } = handle;
    let cancelled = false;

    const removeCurrent = (fade: boolean) => {
      const old = current.current;
      current.current = null;
      if (!old) return;
      const finish = () => {
        scene.remove(old);
        disposeGarment(old);
        requestRender();
      };
      if (fade) void fadeGarment(old, 1, 0, requestRender, 200).then(finish);
      else finish();
    };

    const garment = garmentRef.current;
    if (!garment) {
      removeCurrent(true);
      statusCb.current?.("none");
      return () => {
        cancelled = true;
      };
    }

    statusCb.current?.("loading");
    const build = async (): Promise<THREE.Group> => {
      if (garment.kind === "glb") {
        const { root } = await loadGarment(garment.url);
        const fit = computeGarmentFit(params, garment.reference, garment.slot);
        root.scale.set(fit.scale.x, fit.scale.y, fit.scale.z);
        return root;
      }
      // Generated garments are built from this avatar's own body, so no scaling is needed.
      const skin = garment.textureUrl ? await prepareGarmentSkin(garment.textureUrl) : undefined;
      return buildGeneratedGarment(params, garment.template, garment.fit, skin);
    };

    build()
      .then((root) => {
        if (cancelled) {
          disposeGarment(root);
          return;
        }
        removeCurrent(true);
        scene.add(root);
        current.current = root;
        void fadeGarment(root, 0, 1, requestRender, 260);
        statusCb.current?.("ready");
      })
      .catch(() => {
        if (cancelled) return;
        removeCurrent(true);
        statusCb.current?.("error");
      });

    return () => {
      cancelled = true;
    };
    // `params` is intentionally included: the garment is re-fitted when the avatar changes.
  }, [garmentKey, params, sceneVersion, state]);

  // Remove the garment when the whole viewer unmounts.
  useEffect(
    () => () => {
      const old = current.current;
      if (old) disposeGarment(old);
      current.current = null;
    },
    [],
  );

  return (
    <div className={className} style={{ position: "relative", minHeight: 280 }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      {state === "loading" && (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground" role="status">
          Preparing your avatar…
        </p>
      )}
      {(state === "unsupported" || state === "error") && (
        <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground" role="alert">
          {state === "unsupported"
            ? "Your browser or device doesn't support 3D graphics, so the avatar can't be shown. You can keep shopping as usual."
            : "The 3D preview couldn't be displayed. Try reloading the page."}
        </p>
      )}
    </div>
  );
}
