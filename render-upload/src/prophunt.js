// Prop Hunt: client-side visuals and HUD. The rules live on the server (server/core.js).
import * as THREE from 'three';
import { createBlueprintTexture } from './textures.js';

// Disguises: a prop takes the texture of a building wall. The ids are checked by the server too.
export const PROP_DISGUISES = [
  { id: 'wall_concrete', label: 'Concrete', bg: '#64748b' },
  { id: 'wall_brick', label: 'Brick', bg: '#9a3412' },
  { id: 'wall_plaster', label: 'Plaster', bg: '#d6d3d1' },
  { id: 'wall_slate', label: 'Slate', bg: '#334155' }
];

// Pose = block size in metres (width along the yaw axis, height, depth)
export const PROP_POSES = {
  stand: { size: [1.0, 1.8, 0.6], label: 'Stand' },
  sit: { size: [1.0, 1.0, 0.6], label: 'Sit' },
  lie: { size: [1.8, 0.5, 0.6], label: 'Lie down' }
};
export const PROP_POSE_ORDER = ['stand', 'sit', 'lie'];

export const PROP_BLIND_MS = 30000;
export const PROP_SHOT_COOLDOWN_MS = 1500;
export const PROP_SHOT_RANGE = 120;

const disguiseMats = new Map();
const ghostMats = new Map();
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const edgeGeo = new THREE.EdgesGeometry(unitBox);
const edgeMat = new THREE.LineBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.6 });
const live = new Set();

function disguiseTexture(entry) {
  return createBlueprintTexture({
    bg: entry.bg,
    subGrid: 'rgba(255,255,255,0.14)',
    majorGrid: 'rgba(255,255,255,0.5)',
    crossColor: 'rgba(255,255,255,0.7)',
    studs: false,
    label: 'WALL',
    repeatX: 2,
    repeatY: 2
  });
}

export function disguiseMaterial(id, ghost = false) {
  const cache = ghost ? ghostMats : disguiseMats;
  if (cache.has(id)) return cache.get(id);
  const entry = PROP_DISGUISES.find((d) => d.id === id) || PROP_DISGUISES[0];
  const mat = new THREE.MeshStandardMaterial({
    map: disguiseTexture(entry),
    roughness: 0.85,
    metalness: 0.05,
    transparent: ghost,
    opacity: ghost ? 0.3 : 1,
    depthWrite: !ghost
  });
  cache.set(id, mat);
  return mat;
}

// One prop body: a wall-textured block with blueprint edges. Shared geometry, cached materials.
export function createPropBlock(scene) {
  const mesh = new THREE.Mesh(unitBox, disguiseMaterial(PROP_DISGUISES[0].id));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.add(new THREE.LineSegments(edgeGeo, edgeMat));
  mesh.visible = false;
  scene.add(mesh);
  live.add(mesh);
  return mesh;
}

// Place a block at a feet position (y = bottom of the block), facing yaw
export function setPropBlock(mesh, { x, y, z, yaw, pose, disguise, ghost = false, visible = true }) {
  const dims = PROP_POSES[pose] || PROP_POSES.stand;
  const [w, h, d] = dims.size;
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y + h / 2, z);
  mesh.rotation.y = yaw;
  const mat = disguiseMaterial(disguise, ghost);
  if (mesh.material !== mat) mesh.material = mat;
  mesh.visible = visible;
}

export function removeAllPropBlocks() {
  for (const mesh of live) {
    if (mesh.parent) mesh.parent.remove(mesh);
  }
  live.clear();
}

// ---- DOM HUD: blind overlay for the hunter and the role line ----
const el = (id) => document.getElementById(id);

export function showPropBlind(secondsLeft) {
  const box = el('prop-blind');
  if (!box) return;
  if (secondsLeft <= 0) {
    box.classList.add('hidden');
    return;
  }
  box.classList.remove('hidden');
  el('prop-blind-count').textContent = String(Math.ceil(secondsLeft));
}

export function setPropHud(role, hint) {
  const box = el('prop-hud');
  if (!box) return;
  box.classList.remove('hidden');
  el('prop-role').textContent = role;
  el('prop-hint').textContent = hint;
}

export function hidePropUi() {
  el('prop-hud')?.classList.add('hidden');
  el('prop-blind')?.classList.add('hidden');
}
