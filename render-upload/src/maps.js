import * as THREE from 'three';
import { createBlueprintTexture, createPrototypeBlockTexture } from './textures.js';

export const MAPS = [
  {
    id: 'blueprint_cad',
    name: 'Blue Blueprint (CAD)',
    subtitle: 'Engineering Blueprint Test Range',
    badge: 'BLUEPRINT #01',
    skyTop: '#061a33',
    skyBottom: '#134e88',
    fogColor: 0x0b2d52,
    ambientColor: 0xe0f2fe,
    ambientIntensity: 0.95,
    sunColor: 0xffffff,
    sunIntensity: 1.25,
    floorBg: '#0d3b66',
    subGrid: 'rgba(186, 230, 253, 0.16)',
    majorGrid: 'rgba(224, 242, 254, 0.62)',
    crossColor: 'rgba(255, 255, 255, 0.85)',
    wallBg: '#082542',
    platBg: '#155e95',
    platAccent: '#38bdf8',
    crateBg: '#ea580c',
    crateBorder: '#ffffff',
    edgeLineColor: 0xbae6fd
  },
  {
    id: 'rivals_dev',
    name: 'Dev-Grid Test Arena',
    subtitle: 'Grey-Orange Rivals Prototype',
    badge: 'TEST RANGE #02',
    skyTop: '#2563eb',
    skyBottom: '#93c5fd',
    fogColor: 0x60a5fa,
    ambientColor: 0xf8fafc,
    ambientIntensity: 0.95,
    sunColor: 0xfffbeb,
    sunIntensity: 1.35,
    floorBg: '#334155',
    subGrid: 'rgba(255, 255, 255, 0.12)',
    majorGrid: 'rgba(255, 255, 255, 0.48)',
    crossColor: 'rgba(255, 255, 255, 0.78)',
    wallBg: '#1e293b',
    platBg: '#ea580c',
    platAccent: '#fb923c',
    crateBg: '#d97706',
    crateBorder: '#ffffff',
    edgeLineColor: 0xffffff
  },
  {
    id: 'mega_range',
    layout: 'mega',
    name: 'Mega Blueprint Range',
    subtitle: 'Long lanes, 22 obstacles, vault walls',
    badge: 'MEGA #04',
    skyTop: '#0b1e3a',
    skyBottom: '#1d4ed8',
    fogColor: 0x102a4d,
    ambientColor: 0xdbeafe,
    ambientIntensity: 0.9,
    sunColor: 0xfff7ed,
    sunIntensity: 1.3,
    floorBg: '#0f3d3e',
    subGrid: 'rgba(167, 243, 208, 0.14)',
    majorGrid: 'rgba(209, 250, 229, 0.6)',
    crossColor: 'rgba(255, 255, 255, 0.85)',
    wallBg: '#0a2f2f',
    platBg: '#0e7490',
    platAccent: '#22d3ee',
    crateBg: '#f97316',
    crateBorder: '#ffffff',
    edgeLineColor: 0xa7f3d0
  },
  {
    id: 'rooftop_district',
    layout: 'city',
    name: 'Rooftop District',
    subtitle: 'Four buildings, solid staircases and rooftop cover',
    badge: 'CITY #05',
    skyTop: '#1e1b4b',
    skyBottom: '#7c3aed',
    fogColor: 0x2e1065,
    ambientColor: 0xede9fe,
    ambientIntensity: 0.9,
    sunColor: 0xfff1e6,
    sunIntensity: 1.3,
    floorBg: '#3f3f46',
    subGrid: 'rgba(255, 255, 255, 0.12)',
    majorGrid: 'rgba(255, 255, 255, 0.5)',
    crossColor: 'rgba(255, 255, 255, 0.8)',
    wallBg: '#27272a',
    platBg: '#6d28d9',
    platAccent: '#c4b5fd',
    crateBg: '#f59e0b',
    crateBorder: '#ffffff',
    edgeLineColor: 0xddd6fe
  },
  {
    id: 'ziggurat_tiers',
    layout: 'tiers',
    name: 'Ziggurat Tiers',
    subtitle: 'Three-tier stepped temple with stairs on every side',
    badge: 'TIERS #06',
    skyTop: '#422006',
    skyBottom: '#f59e0b',
    fogColor: 0x78350f,
    ambientColor: 0xfef3c7,
    ambientIntensity: 0.95,
    sunColor: 0xffedd5,
    sunIntensity: 1.35,
    floorBg: '#57534e',
    subGrid: 'rgba(255, 255, 255, 0.12)',
    majorGrid: 'rgba(255, 255, 255, 0.5)',
    crossColor: 'rgba(255, 255, 255, 0.8)',
    wallBg: '#44403c',
    platBg: '#b45309',
    platAccent: '#fbbf24',
    crateBg: '#0f766e',
    crateBorder: '#ffffff',
    edgeLineColor: 0xfde68a
  },
  {
    id: 'prophunt_district',
    layout: 'prop',
    name: 'Prop Hunt District',
    subtitle: '6 buildings with roof stairs, containers and vault walls',
    badge: 'PROP HUNT #05',
    skyTop: '#1f2937',
    skyBottom: '#64748b',
    fogColor: 0x334155,
    ambientColor: 0xf1f5f9,
    ambientIntensity: 0.9,
    sunColor: 0xfff7ed,
    sunIntensity: 1.2,
    floorBg: '#3f4a3c',
    subGrid: 'rgba(226, 232, 240, 0.14)',
    majorGrid: 'rgba(241, 245, 249, 0.5)',
    crossColor: 'rgba(255, 255, 255, 0.8)',
    wallBg: '#475569',
    platBg: '#78716c',
    platAccent: '#fbbf24',
    crateBg: '#a16207',
    crateBorder: '#ffffff',
    edgeLineColor: 0xe2e8f0
  },
  {
    id: 'studio_baseplate',
    name: 'Studio Baseplate',
    subtitle: 'Classic White-Grey Roblox Lab',
    badge: 'ROBLOX #03',
    skyTop: '#0284c7',
    skyBottom: '#bae6fd',
    fogColor: 0x93c5fd,
    ambientColor: 0xffffff,
    ambientIntensity: 1.0,
    sunColor: 0xffffff,
    sunIntensity: 1.25,
    floorBg: '#475569',
    subGrid: 'rgba(255, 255, 255, 0.16)',
    majorGrid: 'rgba(255, 255, 255, 0.55)',
    crossColor: 'rgba(255, 255, 255, 0.85)',
    wallBg: '#334155',
    platBg: '#2563eb',
    platAccent: '#38bdf8',
    crateBg: '#e11d48',
    crateBorder: '#ffffff',
    edgeLineColor: 0xffffff
  }
];

// Prop Hunt spawn ring: outside the buildings, on the outer yard
const PROP_SPAWNS = [
  [-28, -36], [-28, -12], [-28, 12], [-28, 36],
  [28, -36], [28, -12], [28, 12], [28, 36]
].map(([x, z]) => new THREE.Vector3(x, 0.05, z));

export function buildArena(scene, mapId = 'blueprint_cad', options = {}) {
  const cfg = MAPS.find((m) => m.id === mapId) || MAPS[0];
  const group = new THREE.Group();
  scene.add(group);
  const isMega = !options.wideFFA && cfg.layout === 'mega';
  const isCustom = !options.wideFFA && (cfg.layout === 'city' || cfg.layout === 'tiers');
  const isProp = !options.wideFFA && cfg.layout === 'prop';

  // Crisp Roblox Sky Gradient
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 32;
  skyCanvas.height = 256;
  const sctx = skyCanvas.getContext('2d');
  const grad = sctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, cfg.skyTop);
  grad.addColorStop(0.75, cfg.skyBottom);
  grad.addColorStop(1, cfg.floorBg);
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 32, 256);
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = skyTex;
  scene.fog = new THREE.FogExp2(cfg.fogColor, 0.0052);

  // Clean Bright Roblox Studio Lighting
  const hemi = new THREE.HemisphereLight(cfg.ambientColor, 0x1e293b, cfg.ambientIntensity);
  group.add(hemi);

  const dirLight = new THREE.DirectionalLight(cfg.sunColor, cfg.sunIntensity);
  dirLight.position.set(20, 38, 24);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 2;
  dirLight.shadow.camera.far = 105;
  const d = isProp ? 44 : options.wideFFA || isMega ? 34 : 28;
  dirLight.shadow.camera.left = -d;
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = -d;
  dirLight.shadow.bias = -0.0008;
  group.add(dirLight);

  const boxes = [];
  const ramps = [];
  const jumpPads = [];
  const worldMeshes = [];

  const arenaW = options.wideFFA ? 46 : isMega ? 46 : isProp ? 60 : 34;
  const arenaL = options.wideFFA ? 52 : isMega ? 60 : isProp ? 80 : 46;

  // Blueprint / Dev-Grid Materials (matte roughness so gridlines are super crisp!)
  const floorTex = createBlueprintTexture({
    bg: cfg.floorBg,
    subGrid: cfg.subGrid,
    majorGrid: cfg.majorGrid,
    crossColor: cfg.crossColor,
    studs: true,
    label: '2x2 STUDS',
    repeatX: isProp ? 22 : 17,
    repeatY: isMega || isProp ? 30 : 23
  });
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: 0.88,
    metalness: 0.05
  });

  const wallTex = createBlueprintTexture({
    bg: cfg.wallBg,
    subGrid: cfg.subGrid,
    majorGrid: cfg.majorGrid,
    crossColor: cfg.crossColor,
    studs: false,
    label: 'WALL // 8.5m',
    repeatX: 12,
    repeatY: 3
  });
  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTex,
    roughness: 0.85,
    metalness: 0.08
  });

  const platTex = createBlueprintTexture({
    bg: cfg.platBg,
    subGrid: 'rgba(255,255,255,0.2)',
    majorGrid: 'rgba(255,255,255,0.72)',
    crossColor: '#ffffff',
    studs: true,
    label: 'MID // +2.2m',
    repeatX: 5,
    repeatY: 4
  });
  const platMat = new THREE.MeshStandardMaterial({
    map: platTex,
    roughness: 0.78,
    metalness: 0.1
  });

  const crateTex = createPrototypeBlockTexture({
    bg: cfg.crateBg,
    border: cfg.crateBorder,
    inner: 'rgba(255,255,255,0.28)',
    tag: 'DEV // BLOCK'
  });
  const crateMat = new THREE.MeshStandardMaterial({
    map: crateTex,
    roughness: 0.75,
    metalness: 0.1
  });

  const edgeLineMat = new THREE.LineBasicMaterial({
    color: cfg.edgeLineColor,
    transparent: true,
    opacity: 0.55
  });

  const neonMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  function addBox(cx, cy, cz, sx, sy, sz, mat, solid = true, castShadow = true, showBlueprintOutline = true) {
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, cy, cz);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    group.add(mesh);

    // CAD Blueprint crisp edge wireframe outline!
    if (showBlueprintOutline) {
      const edges = new THREE.EdgesGeometry(geo);
      const line = new THREE.LineSegments(edges, edgeLineMat);
      mesh.add(line);
    }

    if (solid) {
      worldMeshes.push(mesh);
      boxes.push({
        minX: cx - sx / 2,
        maxX: cx + sx / 2,
        minY: cy - sy / 2,
        maxY: cy + sy / 2,
        minZ: cz - sz / 2,
        maxZ: cz + sz / 2
      });
    }
    return mesh;
  }

  function addRampZ(cx, cz, sx, sz, bottomY, topY, dirZ, mat) {
    const h = topY - bottomY;
    const x0 = cx - sx / 2;
    const x1 = cx + sx / 2;
    const z0 = cz - sz / 2;
    const z1 = cz + sz / 2;
    const yAtZ0 = dirZ > 0 ? bottomY : topY;
    const yAtZ1 = dirZ > 0 ? topY : bottomY;

    const vertices = new Float32Array([
      x0, yAtZ0, z0,  x0, yAtZ1, z1,  x1, yAtZ1, z1,
      x0, yAtZ0, z0,  x1, yAtZ1, z1,  x1, yAtZ0, z0,
      x0, bottomY, z0,  x1, bottomY, z0,  x1, bottomY, z1,
      x0, bottomY, z0,  x1, bottomY, z1,  x0, bottomY, z1,
      x0, bottomY, z0,  x0, bottomY, z1,  x0, yAtZ1, z1,
      x0, bottomY, z0,  x0, yAtZ1, z1,  x0, yAtZ0, z0,
      x1, bottomY, z0,  x1, yAtZ0, z0,  x1, yAtZ1, z1,
      x1, bottomY, z0,  x1, yAtZ1, z1,  x1, bottomY, z1,
      ...(dirZ > 0
        ? [x0, bottomY, z1, x1, bottomY, z1, x1, topY, z1, x0, bottomY, z1, x1, topY, z1, x0, topY, z1]
        : [x0, bottomY, z0, x0, topY, z0, x1, topY, z0, x0, bottomY, z0, x1, topY, z0, x1, bottomY, z0])
    ]);
    const wGeo = new THREE.BufferGeometry();
    wGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    wGeo.computeVertexNormals();

    const uvs = new Float32Array((vertices.length / 3) * 2);
    for (let i = 0; i < vertices.length / 3; i++) {
      uvs[i * 2] = (vertices[i * 3] - x0) * 0.35;
      uvs[i * 2 + 1] = (vertices[i * 3 + 2] - z0) * 0.35;
    }
    wGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

    const mesh = new THREE.Mesh(wGeo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    const edges = new THREE.EdgesGeometry(wGeo);
    mesh.add(new THREE.LineSegments(edges, edgeLineMat));

    worldMeshes.push(mesh);
    ramps.push({
      minX: x0,
      maxX: x1,
      minZ: z0,
      maxZ: z1,
      bottomY,
      topY,
      dirZ,
      height: h
    });
  }

  // Solid staircase: every step is a full column, so each 0.5 m riser is walkable.
  // Step i sits at (start + dir * (i*depth + depth/2)) and has top = baseY + (i+1)*stepH.
  function addStairs(sx, sz, dx, dz, count, width, mat, baseY = 0, stepH = 0.5, depth = 0.8) {
    const alongX = Math.abs(dx) > 0;
    for (let i = 0; i < count; i++) {
      const run = i * depth + depth / 2;
      const h = baseY + (i + 1) * stepH;
      addBox(
        sx + dx * run,
        h / 2,
        sz + dz * run,
        alongX ? depth : width,
        h,
        alongX ? width : depth,
        mat
      );
    }
  }

  // Two-floor-high block: 4 walls (one side has a 2.2 m door), a flat roof you can walk onto, and a crate inside.
  function addBuilding(cx, cz, w, d, doorSide) {
    const wallH = 3.0;
    const t = 0.4;
    const x0 = cx - w / 2;
    const x1 = cx + w / 2;
    const z0 = cz - d / 2;
    const z1 = cz + d / 2;
    const seg = (a0, a1, fixed, along, y0, y1) => {
      if (a1 - a0 < 0.05) return;
      const c = (a0 + a1) / 2;
      const yc = (y0 + y1) / 2;
      const yh = y1 - y0;
      if (along === 'x') addBox(c, yc, fixed, a1 - a0, yh, t, wallMat);
      else addBox(fixed, yc, c, t, yh, a1 - a0, wallMat);
    };
    const sides = [
      { side: 'south', along: 'x', fixed: z0, lo: x0, hi: x1 },
      { side: 'north', along: 'x', fixed: z1, lo: x0, hi: x1 },
      { side: 'west', along: 'z', fixed: x0, lo: z0, hi: z1 },
      { side: 'east', along: 'z', fixed: x1, lo: z0, hi: z1 }
    ];
    const doorW = 2.2;
    sides.forEach(({ side, along, fixed, lo, hi }) => {
      if (side !== doorSide) {
        seg(lo, hi, fixed, along, 0, wallH);
      } else {
        const mid = (lo + hi) / 2;
        seg(lo, mid - doorW / 2, fixed, along, 0, wallH);
        seg(mid + doorW / 2, hi, fixed, along, 0, wallH);
        seg(mid - doorW / 2, mid + doorW / 2, fixed, along, 2.3, wallH); // lintel above the door
      }
    });
    // Roof slab whose top sits exactly at wallH (walkable and level with the stair tops)
    addBox(cx, wallH - 0.15, cz, w, 0.3, d, platMat);
    // Interior cover crate on the ground floor
    addBox(cx, 0.6, cz, 1.6, 1.2, 1.6, crateMat);
  }

  // Baseplate Floor
  addBox(0, -0.5, 0, arenaW, 1, arenaL, floorMat, true, false, false);

  // Crisp White Center Axis Line (Z = 0, X = 0 Blueprint Axes!)
  addBox(0, 0.012, 0, arenaW - 0.4, 0.02, 0.18, neonMat, false, false, false);
  addBox(0, 0.011, 0, 0.14, 0.02, arenaL - 0.4, neonMat, false, false, false);

  // Perimeter Blueprint Test Walls
  const wallH = 8.5;
  addBox(0, wallH / 2, -arenaL / 2 - 0.5, arenaW + 2, wallH, 1, wallMat);
  addBox(0, wallH / 2, arenaL / 2 + 0.5, arenaW + 2, wallH, 1, wallMat);
  addBox(-arenaW / 2 - 0.5, wallH / 2, 0, 1, wallH, arenaL, wallMat);
  addBox(arenaW / 2 + 0.5, wallH / 2, 0, 1, wallH, arenaL, wallMat);

  if (!isCustom) {
  // Central Elevated Prototype Bridge (X: -5..5, Z: -4.25..4.25, Y: 0..2.2)
  const platH = 2.2;
  addBox(0, platH / 2, 0, 10, platH, 8.5, platMat);

  // Sloped Ramps on both sides
  addRampZ(0, 7.0, 4.6, 5.5, 0, platH, -1, platMat);
  addRampZ(0, -7.0, 4.6, 5.5, 0, platH, 1, platMat);

  // Low Prototype Cover Blocks on top of Mid Bridge
  addBox(-3.6, platH + 0.65, 0, 1.8, 1.3, 1.8, crateMat);
  addBox(3.6, platH + 0.65, 0, 1.8, 1.3, 1.8, crateMat);

  // Symmetrical Flank Cover Towers & Step-Up Blocks
  [-10.5, 10.5].forEach((xSign) => {
    addBox(xSign, 1.8, 7.5, 2.6, 3.6, 2.6, crateMat);
    addBox(xSign, 1.8, -7.5, 2.6, 3.6, 2.6, crateMat);

    const innerX = xSign > 0 ? xSign - 2.2 : xSign + 2.2;
    addBox(innerX, 0.85, 7.5, 1.8, 1.7, 1.8, platMat);
    addBox(innerX, 0.85, -7.5, 1.8, 1.7, 1.8, platMat);
  });

  // Spawn Sightline Walls (2.05m tall -> cleanly Vaultable!)
  [-5.2, 5.2].forEach((sx) => {
    addBox(sx, 1.025, 14.2, 3.2, 2.05, 1.1, crateMat);
    addBox(sx, 1.025, -14.2, 3.2, 2.05, 1.1, crateMat);
  });

  // Dedicated Parkour Vault Hurdle Barricades (1.42m chest-high walls with glowing top strip!)
  const vaultBarricades = [
    [0, 12.0, 3.4, 0.85],
    [0, -12.0, 3.4, 0.85],
    [-8.2, 3.2, 3.0, 0.85],
    [8.2, -3.2, 3.0, 0.85]
  ];
  vaultBarricades.forEach(([vx, vz, vw, vd]) => {
    addBox(vx, 0.71, vz, vw, 1.42, vd, platMat);
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(vw + 0.04, 0.08, vd + 0.04),
      neonMat
    );
    strip.position.set(vx, 1.43, vz);
    group.add(strip);
  });

  }

  // Flank Jump Pads (plus 2 extra diagonal Jump Pads in wide FFA/4v4 mode!)
  const megaPads = [
    [-17, -2],
    [17, 2],
    [-9, 15.5],
    [9, -15.5]
  ];
  const padCoords = isMega
    ? megaPads
    : options.wideFFA
    ? [
        [-15.5, 0],
        [15.5, 0],
        [-14.5, 14.5],
        [14.5, -14.5]
      ]
    : [
        [-13.5, 0],
        [13.5, 0]
      ];

  padCoords.forEach(([jx, jz]) => {
    const padBase = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.24, 2.8),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 })
    );
    padBase.position.set(jx, 0.12, jz);
    group.add(padBase);

    const padGlow = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.28, 2.2),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    padGlow.position.set(jx, 0.15, jz);
    group.add(padGlow);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.15, 4),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
    );
    ring.rotation.x = Math.PI / 2;
    ring.rotation.z = Math.PI / 4;
    ring.position.set(jx, 0.35, jz);
    group.add(ring);

    jumpPads.push({ x: jx, z: jz, radius: 1.7, boostY: 14.2, ringMesh: ring });
  });

  // MEGA layout: longer lanes, staggered vault walls, pillars, steps and corner cover
  if (isMega) {
    [[-15, 11, 4.2], [15, 11, 4.2], [-15, -11, 4.2], [15, -11, 4.2], [-6, 18, 3.4], [6, 18, 3.4], [-6, -18, 3.4], [6, -18, 3.4]].forEach(([vx, vz, vw]) => {
      addBox(vx, 0.71, vz, vw, 1.42, 0.85, platMat);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(vw + 0.04, 0.08, 0.89), neonMat);
      strip.position.set(vx, 1.43, vz);
      group.add(strip);
    });
    [[-12, 21], [12, 21], [-12, -21], [12, -21]].forEach(([px, pz]) => addBox(px, 1.8, pz, 2.4, 3.6, 2.4, crateMat));
    [[-19, 27], [19, 27], [-19, -27], [19, -27]].forEach(([cx, cz]) => addBox(cx, 1.1, cz, 2.2, 2.2, 2.2, crateMat));
    [-20.5, 20.5].forEach((sx) => addBox(sx, 0.55, 0, 2.6, 1.1, 5, platMat));
    [-18.5, 18.5].forEach((sx) => {
      addBox(sx, 1.1, 16, 2.2, 2.2, 2.2, crateMat);
      addBox(sx, 1.1, -16, 2.2, 2.2, 2.2, crateMat);
    });
  }

  // ROOFTOP DISTRICT: 4 buildings (roofs at 3.0 m), solid staircases up to each roof, a raised centre deck
  if (isCustom && cfg.layout === 'city') {
    addBuilding(-7, -6, 9, 7, 'east');
    addBuilding(-7, 6, 9, 7, 'east');
    addBuilding(7, 6, 9, 7, 'west');
    addBuilding(7, -6, 9, 7, 'west');
    // Stairs climb onto the roof edges (the wall tops are level with the roof)
    addStairs(-16.3, -6, 1, 0, 6, 2.6, platMat); // west of the south-west building
    addStairs(-16.3, 6, 1, 0, 6, 2.6, platMat); // west of the north-west building
    addStairs(16.3, 6, -1, 0, 6, 2.6, platMat); // east of the north-east building
    addStairs(16.3, -6, -1, 0, 6, 2.6, platMat); // east of the south-east building
    // Rooftop cover crates
    [[-7, -6], [-7, 6], [7, 6], [7, -6]].forEach(([rx, rz]) => addBox(rx, 3.5, rz, 1.6, 1.0, 1.6, crateMat));
    // Centre deck: 1.0 m high, stairs at both ends, crate on top
    addBox(0, 0.5, 0, 4, 1.0, 6.4, platMat);
    addStairs(0, -4.8, 0, 1, 2, 4, platMat);
    addStairs(0, 4.8, 0, -1, 2, 4, platMat);
    addBox(0, 1.6, 0, 1.4, 1.2, 1.4, crateMat);
    // Vault barricades across the lanes
    [[0, 11.5, 4.6], [0, -11.5, 4.6]].forEach(([vx, vz, vw]) => {
      addBox(vx, 0.71, vz, vw, 1.42, 0.85, platMat);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(vw + 0.04, 0.08, 0.89), neonMat);
      strip.position.set(vx, 1.43, vz);
      group.add(strip);
    });
    [[-13, -13], [13, 13]].forEach(([cx, cz]) => addBox(cx, 1.1, cz, 2.2, 2.2, 2.2, crateMat));
  }

  // ZIGGURAT TIERS: three stepped tiers (1.0 / 2.0 / 3.0 m), each reached by 2-step stairs on all four sides
  if (isCustom && cfg.layout === 'tiers') {
    const tiers = [
      { half: 6, top: 1.0, mat: platMat },
      { half: 4, top: 2.0, mat: platMat },
      { half: 2, top: 3.0, mat: crateMat }
    ];
    tiers.forEach((t, idx) => {
      const baseY = idx === 0 ? 0 : tiers[idx - 1].top;
      addBox(0, t.top / 2, 0, t.half * 2, t.top, t.half * 2, t.mat);
      const out = t.half + 2 * 0.8; // stairs start outside the tier, 2 steps out
      addStairs(0, out, 0, -1, 2, 2.6, t.mat, baseY); // +z side
      addStairs(0, -out, 0, 1, 2, 2.6, t.mat, baseY); // -z side
      addStairs(out, 0, -1, 0, 2, 2.6, t.mat, baseY); // +x side
      addStairs(-out, 0, 1, 0, 2, 2.6, t.mat, baseY); // -x side
    });
    // Corner cover crates and vault barricades
    [[-11, -12], [11, -12], [-11, 12], [11, 12]].forEach(([cx, cz]) => addBox(cx, 1.1, cz, 2.2, 2.2, 2.2, crateMat));
    [[0, 12.5, 4.6], [0, -12.5, 4.6]].forEach(([vx, vz, vw]) => {
      addBox(vx, 0.71, vz, vw, 1.42, 0.85, platMat);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(vw + 0.04, 0.08, 0.89), neonMat);
      strip.position.set(vx, 1.43, vz);
      group.add(strip);
    });
  }

  // PROP HUNT DISTRICT: 6 buildings (doors face the outer yard, roof stairs face the centre lane),
  // containers in the yard, and vault walls across the centre lane
  if (isProp) {
    [-24, 0, 24].forEach((bz) => {
      addBuilding(-16, bz, 10, 8, 'west');
      addStairs(-6.2, bz, -1, 0, 6, 2.6, platMat); // climbs onto the west roofs from the centre lane
      addBox(-16, 3.5, bz, 1.6, 1.0, 1.6, crateMat); // roof cover
      addBuilding(16, bz, 10, 8, 'east');
      addStairs(6.2, bz, 1, 0, 6, 2.6, platMat); // climbs onto the east roofs from the centre lane
      addBox(16, 3.5, bz, 1.6, 1.0, 1.6, crateMat);
    });
    [[-24.5, -30], [-24.5, -4], [-24.5, 8], [-24.5, 26], [24.5, -26], [24.5, -2], [24.5, 14], [24.5, 32]].forEach(([cx, cz]) =>
      addBox(cx, 1.2, cz, 2.4, 2.4, 2.4, crateMat)
    );
    [[-3.5, -34], [3.5, 34], [-2.5, 6], [2.5, -6]].forEach(([cx, cz]) => addBox(cx, 0.55, cz, 1.6, 1.1, 1.6, platMat));
    [[0, -14], [0, 14]].forEach(([vx, vz]) => {
      addBox(vx, 0.71, vz, 4.6, 1.42, 0.85, platMat);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(4.64, 0.08, 0.89), neonMat);
      strip.position.set(vx, 1.43, vz);
      group.add(strip);
    });
  }

  // Pre-round Spawn Forcefields
  const barrierMatPlayer = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const barrierMatEnemy = new THREE.MeshBasicMaterial({
    color: 0xff2a55,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  const playerBarrier = new THREE.Mesh(new THREE.PlaneGeometry(arenaW, 5.5), barrierMatPlayer);
  const barrierZ = isMega || isProp ? arenaL / 2 - 6.2 : 16.8;
  playerBarrier.position.set(0, 2.75, barrierZ);
  group.add(playerBarrier);

  const enemyBarrier = new THREE.Mesh(new THREE.PlaneGeometry(arenaW, 5.5), barrierMatEnemy);
  enemyBarrier.position.set(0, 2.75, -barrierZ);
  group.add(enemyBarrier);

  const blueZ = arenaL / 2 - 3.2;
  const redZ = -arenaL / 2 + 3.2;

  return {
    group,
    dirLight,
    boxes,
    ramps,
    jumpPads,
    worldMeshes,
    arenaW,
    arenaL,
    playerSpawn: new THREE.Vector3(0, 0.05, blueZ),
    enemySpawn: new THREE.Vector3(0, 0.05, redZ),
    blueTeamSpawns: [
      new THREE.Vector3(0, 0.05, blueZ),
      new THREE.Vector3(-4.5, 0.05, blueZ),
      new THREE.Vector3(4.5, 0.05, blueZ),
      new THREE.Vector3(-9.0, 0.05, blueZ)
    ],
    redTeamSpawns: [
      new THREE.Vector3(0, 0.05, redZ),
      new THREE.Vector3(-4.5, 0.05, redZ),
      new THREE.Vector3(4.5, 0.05, redZ),
      new THREE.Vector3(9.0, 0.05, redZ)
    ],
    ffaSpawns: isProp ? PROP_SPAWNS.map((v) => v.clone()) : [
      new THREE.Vector3(0, 0.05, 21.5),
      new THREE.Vector3(18.5, 0.05, 11.5),
      new THREE.Vector3(18.5, 0.05, -11.5),
      new THREE.Vector3(0, 0.05, -21.5),
      new THREE.Vector3(-18.5, 0.05, -11.5),
      new THREE.Vector3(-18.5, 0.05, 11.5),
      new THREE.Vector3(-12.5, 0.05, 20.0),
      new THREE.Vector3(12.5, 0.05, -20.0)
    ],
    barriers: {
      active: true,
      playerZ: barrierZ,
      enemyZ: -barrierZ,
      playerMesh: playerBarrier,
      enemyMesh: enemyBarrier
    },
    dispose() {
      scene.remove(group);
    }
  };
}

export function resolveArenaPhysics(entity, arena, dt, barrierSide = 'blue') {
  if (barrierSide === true) barrierSide = 'red';
  else if (barrierSide === false) barrierSide = 'blue';

  const r = entity.radius;
  const h = entity.height;

  entity.pos.x += entity.vel.x * dt;
  resolveHorizontal(entity, arena, 'x', r, h);

  entity.pos.z += entity.vel.z * dt;
  resolveHorizontal(entity, arena, 'z', r, h);

  if (arena.barriers.active) {
    if (barrierSide === 'blue' && entity.pos.z - r < arena.barriers.playerZ) {
      entity.pos.z = arena.barriers.playerZ + r;
      if (entity.vel.z < 0) entity.vel.z = 0;
    } else if (barrierSide === 'red' && entity.pos.z + r > arena.barriers.enemyZ) {
      entity.pos.z = arena.barriers.enemyZ - r;
      if (entity.vel.z > 0) entity.vel.z = 0;
    }
  }

  const maxW = arena.arenaW / 2 - r;
  const maxL = arena.arenaL / 2 - r;
  entity.pos.x = Math.max(-maxW, Math.min(maxW, entity.pos.x));
  entity.pos.z = Math.max(-maxL, Math.min(maxL, entity.pos.z));

  entity.pos.y += entity.vel.y * dt;
  entity.grounded = false;

  let supportY = 0;
  for (const b of arena.boxes) {
    if (
      entity.pos.x + r > b.minX &&
      entity.pos.x - r < b.maxX &&
      entity.pos.z + r > b.minZ &&
      entity.pos.z - r < b.maxZ
    ) {
      if (entity.pos.y >= b.maxY - 0.55 && entity.vel.y <= 0.5) {
        if (b.maxY > supportY) supportY = b.maxY;
      } else if (entity.pos.y + h > b.minY && entity.pos.y < b.minY && entity.vel.y > 0) {
        entity.pos.y = b.minY - h;
        entity.vel.y = 0;
      }
    }
  }

  for (const ramp of arena.ramps) {
    if (
      entity.pos.x + r * 0.6 > ramp.minX &&
      entity.pos.x - r * 0.6 < ramp.maxX &&
      entity.pos.z >= ramp.minZ - 0.15 &&
      entity.pos.z <= ramp.maxZ + 0.15
    ) {
      const t = Math.max(0, Math.min(1, (entity.pos.z - ramp.minZ) / (ramp.maxZ - ramp.minZ)));
      const rampY = ramp.dirZ > 0
        ? ramp.bottomY + t * ramp.height
        : ramp.topY - t * ramp.height;
      if (entity.pos.y <= rampY + 0.35 && entity.pos.y >= rampY - 0.75 && entity.vel.y <= 2.5) {
        if (rampY > supportY) supportY = rampY;
      }
    }
  }

  if (entity.pos.y <= supportY + 0.02 && entity.vel.y <= 0) {
    entity.pos.y = supportY;
    entity.vel.y = 0;
    entity.grounded = true;
  }

  let hitJumpPad = false;
  for (const pad of arena.jumpPads) {
    const dx = entity.pos.x - pad.x;
    const dz = entity.pos.z - pad.z;
    if (dx * dx + dz * dz < pad.radius * pad.radius && entity.pos.y < 1.1 && entity.vel.y <= 4.0) {
      entity.vel.y = pad.boostY;
      entity.grounded = false;
      hitJumpPad = true;
    }
  }
  return hitJumpPad;
}

function resolveHorizontal(entity, arena, axis, r, h) {
  const stepTolerance = 0.52;

  for (const b of arena.boxes) {
    if (b.maxY <= 0.05) continue;
    if (entity.pos.y >= b.maxY - stepTolerance || entity.pos.y + h <= b.minY + 0.05) {
      continue;
    }

    if (
      entity.pos.x + r > b.minX &&
      entity.pos.x - r < b.maxX &&
      entity.pos.z + r > b.minZ &&
      entity.pos.z - r < b.maxZ
    ) {
      if (axis === 'x') {
        const penLeft = entity.pos.x + r - b.minX;
        const penRight = b.maxX - (entity.pos.x - r);
        entity.pos.x = penLeft < penRight ? b.minX - r : b.maxX + r;
        entity.vel.x = 0;
      } else {
        const penFront = entity.pos.z + r - b.minZ;
        const penBack = b.maxZ - (entity.pos.z - r);
        entity.pos.z = penFront < penBack ? b.minZ - r : b.maxZ + r;
        entity.vel.z = 0;
      }
    }
  }
}
