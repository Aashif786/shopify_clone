import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

const loader = new GLTFLoader();
const cache = new Map<string, Promise<THREE.Object3D>>();

export class GarmentLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GarmentLoadError";
  }
}

/**
 * Loads (and caches by URL) the parsed garment scene. Switching back to a product that was
 * already loaded does not refetch or reparse it. Failed loads are evicted so they can be retried.
 */
function loadTemplate(url: string): Promise<THREE.Object3D> {
  let pending = cache.get(url);
  if (!pending) {
    pending = loader
      .loadAsync(url)
      .then((gltf) => gltf.scene)
      .catch(() => {
        cache.delete(url);
        throw new GarmentLoadError("The garment model could not be loaded.");
      });
    cache.set(url, pending);
  }
  return pending;
}

export interface LoadedGarment {
  /** Instance owned by the caller. Add to the scene, then `disposeGarment` when removed. */
  root: THREE.Group;
}

/** Returns a private instance (cloned materials) so fades and disposal never touch the cache. */
export async function loadGarment(url: string): Promise<LoadedGarment> {
  const template = await loadTemplate(url);
  const instance = cloneSkinned(template);
  instance.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((m) => m.clone())
      : mesh.material.clone();
  });
  const root = new THREE.Group();
  root.name = "garment";
  root.add(instance);
  return { root };
}

function materialsOf(root: THREE.Object3D): THREE.Material[] {
  const out: THREE.Material[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (Array.isArray(mesh.material)) out.push(...mesh.material);
    else out.push(mesh.material);
  });
  return out;
}

/** Frees only the per-instance materials; geometries/textures belong to the cached template. */
export function disposeGarment(root: THREE.Object3D): void {
  materialsOf(root).forEach((m) => m.dispose());
}

/**
 * Cross-fades by animating material opacity. Calls `onFrame` so an on-demand renderer can redraw.
 * Resolves when finished. Honours reduced motion by completing immediately.
 */
export function fadeGarment(
  root: THREE.Object3D,
  from: number,
  to: number,
  onFrame: () => void,
  durationMs = 260,
): Promise<void> {
  const mats = materialsOf(root);
  const apply = (o: number) => {
    mats.forEach((m) => {
      m.transparent = o < 1;
      m.opacity = o;
      m.needsUpdate = true;
    });
  };
  const reduced =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduced || durationMs <= 0) {
    apply(to);
    onFrame();
    return Promise.resolve();
  }
  apply(from);
  onFrame();
  return new Promise((resolve) => {
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      apply(from + (to - from) * eased);
      onFrame();
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}
