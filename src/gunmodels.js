import * as THREE from 'three';

// Procedurális fegyvermodellek (pisztoly, shotgun, AR).
// A csöves rész a helyi -Z tengely mentén áll, a markolat -Y felé néz.
const METAL = new THREE.MeshStandardMaterial({ color: 0x1d2127, roughness: 0.42, metalness: 0.72 });
const DARK = new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.6, metalness: 0.4 });
const WOOD = new THREE.MeshStandardMaterial({ color: 0x7c4a1e, roughness: 0.7, metalness: 0.05 });
const OLIVE = new THREE.MeshStandardMaterial({ color: 0x3f5a2a, roughness: 0.55, metalness: 0.3 });
const STEEL = new THREE.MeshStandardMaterial({ color: 0xaab4c0, roughness: 0.25, metalness: 0.9 });
const FLASH = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.95 });

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// Henger, a Z tengely mentén (rotation.x = π/2 után)
function barrel(r, len, mat, x, y, zCenter) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), mat);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, zCenter);
  m.castShadow = true;
  return m;
}

// Visszaadja: { group, muzzleZ, flash }
export function createGunMesh(gunId) {
  const g = new THREE.Group();
  let muzzleZ = -0.2;

  if (gunId === 'gun_shotgun') {
    g.add(box(0.06, 0.09, 0.42, METAL, 0, 0, -0.14));           // receiver
    g.add(barrel(0.022, 0.62, METAL, 0, 0.012, -0.5));          // barrel
    g.add(barrel(0.026, 0.2, DARK, 0, -0.03, -0.42));            // magazine tube
    g.add(box(0.05, 0.035, 0.12, WOOD, 0, -0.012, -0.44));       // pump
    g.add(box(0.05, 0.12, 0.06, WOOD, 0, -0.07, 0.04));          // grip
    g.add(box(0.05, 0.08, 0.26, WOOD, 0, 0.0, 0.25));            // stock
    g.add(box(0.034, 0.06, 0.025, STEEL, 0, 0.06, -0.78));       // front sight
    muzzleZ = -0.84;
  } else if (gunId === 'gun_ar') {
    g.add(box(0.055, 0.085, 0.42, OLIVE, 0, 0, -0.1));          // upper receiver
    g.add(barrel(0.017, 0.36, METAL, 0, 0.01, -0.48));          // barrel
    g.add(box(0.04, 0.13, 0.06, DARK, 0, -0.1, -0.16));          // magazine
    g.add(box(0.05, 0.1, 0.06, DARK, 0, -0.06, 0.06));           // grip
    g.add(box(0.05, 0.07, 0.24, OLIVE, 0, -0.005, 0.22));        // stock
    g.add(box(0.03, 0.05, 0.1, DARK, 0, 0.075, -0.06));          // carry handle / optic
    g.add(box(0.025, 0.04, 0.03, STEEL, 0, 0.06, -0.62));        // front sight
    muzzleZ = -0.67;
  } else {
    // pisztoly (alapértelmezett)
    g.add(box(0.045, 0.045, 0.22, METAL, 0, 0.02, -0.1));       // slide
    g.add(barrel(0.011, 0.04, STEEL, 0, 0.02, -0.23));          // muzzle
    g.add(box(0.04, 0.1, 0.055, DARK, 0, -0.04, -0.02));        // grip
    g.add(box(0.03, 0.012, 0.05, DARK, 0, -0.015, -0.07));      // trigger guard
    g.add(box(0.028, 0.02, 0.03, STEEL, 0, 0.045, -0.2));       // front sight
    muzzleZ = -0.25;
  }

  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), FLASH);
  flash.position.set(0, 0.012, muzzleZ);
  flash.visible = false;
  g.add(flash);

  return { group: g, muzzleZ, flash };
}
