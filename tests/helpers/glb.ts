/**
 * Builds a minimal, self-contained binary glTF 2.0 box (flat-shaded, one mesh) for tests and
 * local verification. The box spans x/z = ±width/2, depth/2 and y = yMin..yMax (metres).
 */
export function buildBoxGlb(opts: {
  width: number;
  depth: number;
  yMin: number;
  yMax: number;
  color?: [number, number, number];
}): Uint8Array {
  const { width, depth, yMin, yMax } = opts;
  const x = width / 2;
  const z = depth / 2;
  const corners = (sx: number, sy: number, sz: number) => [sx ? x : -x, sy ? yMax : yMin, sz ? z : -z];
  // Each face: 4 corner flags [sx,sy,sz] (counter-clockwise from outside) + outward normal.
  const faces: Array<{ quad: number[][]; normal: number[] }> = [
    { quad: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], normal: [0, 0, 1] },
    { quad: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], normal: [0, 0, -1] },
    { quad: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], normal: [1, 0, 0] },
    { quad: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], normal: [-1, 0, 0] },
    { quad: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], normal: [0, 1, 0] },
    { quad: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], normal: [0, -1, 0] },
  ];

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  faces.forEach((f, i) => {
    f.quad.forEach(([a, b, c]) => {
      positions.push(...corners(a!, b!, c!));
      normals.push(...f.normal);
    });
    const o = i * 4;
    indices.push(o, o + 1, o + 2, o, o + 2, o + 3);
  });

  const posBytes = new Float32Array(positions);
  const normBytes = new Float32Array(normals);
  const idxBytes = new Uint16Array(indices);
  const bin = new Uint8Array(posBytes.byteLength + normBytes.byteLength + idxBytes.byteLength);
  bin.set(new Uint8Array(posBytes.buffer), 0);
  bin.set(new Uint8Array(normBytes.buffer), posBytes.byteLength);
  bin.set(new Uint8Array(idxBytes.buffer), posBytes.byteLength + normBytes.byteLength);

  const min = [-x, yMin, -z];
  const max = [x, yMax, z];
  const json = {
    asset: { version: "2.0", generator: "calcart-test-fixture" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "garment" }],
    materials: [
      {
        pbrMetallicRoughness: {
          baseColorFactor: [...(opts.color ?? [0.8, 0.2, 0.2]), 1],
          metallicFactor: 0,
          roughnessFactor: 0.9,
        },
      },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
    buffers: [{ byteLength: bin.byteLength }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posBytes.byteLength, target: 34962 },
      { buffer: 0, byteOffset: posBytes.byteLength, byteLength: normBytes.byteLength, target: 34962 },
      {
        buffer: 0,
        byteOffset: posBytes.byteLength + normBytes.byteLength,
        byteLength: idxBytes.byteLength,
        target: 34963,
      },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 24, type: "VEC3", min, max },
      { bufferView: 1, componentType: 5126, count: 24, type: "VEC3" },
      { bufferView: 2, componentType: 5123, count: 36, type: "SCALAR" },
    ],
  };

  const jsonText = JSON.stringify(json);
  const jsonBytes = new TextEncoder().encode(jsonText + " ".repeat((4 - (jsonText.length % 4)) % 4));
  const binPadded = new Uint8Array(Math.ceil(bin.byteLength / 4) * 4);
  binPadded.set(bin);

  const total = 12 + 8 + jsonBytes.length + 8 + binPadded.length;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonBytes.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);
  const binStart = 20 + jsonBytes.length;
  view.setUint32(binStart, binPadded.length, true);
  view.setUint32(binStart + 4, 0x004e4942, true);
  out.set(binPadded, binStart + 8);
  return out;
}
