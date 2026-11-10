import * as THREE from 'three';

// Knife wraps ("fólia"): a cosmetic film applied over the blade and handle.
// Each wrap can be bought directly in the Armory or dropped from the knife dropboxes.
// Direct price = 1.75 x the price of the dropbox tier that drops this rarity.
export const WRAP_DIRECT_MULT = 1.75;
export const WRAP_DROP_CHANCE = 0.2; // share of dropbox rolls that give a wrap instead of a knife

const RARITY_COLORS = {
  COMMON: '#38bdf8',
  RARE: '#a855f7',
  EPIC: '#ff2a55',
  LEGENDARY: '#fbbf24',
  MYTHIC: '#10f587'
};

// Dropbox tier that a rarity belongs to (matches DROPBOXES in skins.js)
const BOX_BY_RARITY = {
  COMMON: { boxId: 'basic_box', boxPrice: 100 },
  RARE: { boxId: 'basic_box', boxPrice: 100 },
  EPIC: { boxId: 'rival_box', boxPrice: 250 },
  LEGENDARY: { boxId: 'champion_box', boxPrice: 500 },
  MYTHIC: { boxId: 'champion_box', boxPrice: 500 }
};

const RAW_WRAPS = [
  {
    id: 'wrap_none',
    name: 'No Wrap (Stock)',
    rarityKey: 'COMMON',
    pattern: 'none',
    desc: 'Your knife with its original finish.',
    unlockedByDefault: true
  },
  {
    id: 'wrap_carbon',
    name: 'Carbon Weave Wrap',
    rarityKey: 'COMMON',
    pattern: 'carbon',
    color: '#1f2937',
    accent: '#94a3b8',
    metalness: 0.35,
    roughness: 0.55,
    desc: 'Matte carbon-fibre vinyl for a tactical look.'
  },
  {
    id: 'wrap_camo',
    name: 'Urban Camo Wrap',
    rarityKey: 'RARE',
    pattern: 'camo',
    color: '#3f4d2e',
    accent: '#6b7f3f',
    metalness: 0.2,
    roughness: 0.7,
    desc: 'Woodland camo film, fits any blade in the streets.'
  },
  {
    id: 'wrap_hazard',
    name: 'Hazard Stripe Wrap',
    rarityKey: 'RARE',
    pattern: 'stripes',
    color: '#facc15',
    accent: '#111827',
    metalness: 0.2,
    roughness: 0.5,
    desc: 'Yellow-black hazard stripes on a glossy film.'
  },
  {
    id: 'wrap_chrome',
    name: 'Chrome Mirror Wrap',
    rarityKey: 'EPIC',
    pattern: 'solid',
    color: '#e2e8f0',
    accent: '#ffffff',
    metalness: 1.0,
    roughness: 0.05,
    desc: 'A mirror-finish film that reflects the whole arena.'
  },
  {
    id: 'wrap_spectrum',
    name: 'Spectrum Film Wrap',
    rarityKey: 'RARE',
    pattern: 'spectrum',
    color: '#e5e7eb',
    accent: '#ffffff',
    metalness: 0.45,
    roughness: 0.25,
    desc: 'Small rainbow film: the whole spectrum runs along the blade and shifts with the viewing angle.'
  },
  {
    id: 'wrap_holo',
    name: 'Holo Prism Wrap',
    rarityKey: 'LEGENDARY',
    pattern: 'holo',
    color: '#c4b5fd',
    accent: '#22d3ee',
    metalness: 0.6,
    roughness: 0.15,
    desc: 'Iridescent holographic film that shifts colour as you move.'
  },
  {
    id: 'wrap_living',
    name: 'Living Current Wrap',
    rarityKey: 'MYTHIC',
    pattern: 'living',
    color: '#0f172a',
    accent: '#38bdf8',
    metalness: 0.5,
    roughness: 0.2,
    desc: 'An animated current of light that flows along the blade from tip to handle.'
  },
  {
    id: 'wrap_lava',
    name: 'Molten Lava Wrap',
    rarityKey: 'MYTHIC',
    pattern: 'lava',
    color: '#7f1d1d',
    accent: '#f97316',
    metalness: 0.3,
    roughness: 0.4,
    desc: 'Glowing lava-flow film, hot to the touch.'
  },
  {
    id: 'wrap_fissure',
    name: 'Fissure Wrap',
    rarityKey: 'MYTHIC',
    pattern: 'fissure',
    color: '#0c0a09',
    accent: '#f97316',
    metalness: 0.4,
    roughness: 0.35,
    exclusive: 'tutorial',
    desc: 'Black zig-zag film with molten cracks. Only from the tutorial.'
  },
  {
    id: 'wrap_anodized',
    name: 'Anodized Prism Wrap',
    rarityKey: 'EPIC',
    pattern: 'anodized',
    color: '#111827',
    accent: '#22d3ee',
    metalness: 0.9,
    roughness: 0.18,
    desc: 'Anodized titanium-style film: a rainbow sheen that shifts along the blade.'
  },
  {
    id: 'wrap_marble',
    name: 'Marble Wrap',
    rarityKey: 'RARE',
    pattern: 'marble',
    color: '#e5e7eb',
    accent: '#334155',
    metalness: 0.1,
    roughness: 0.35,
    desc: 'Polished stone film with grey veins.'
  },
  {
    id: 'wrap_obsidian',
    name: 'Obsidian Crack Wrap',
    rarityKey: 'LEGENDARY',
    pattern: 'obsidian',
    color: '#050505',
    accent: '#f97316',
    metalness: 0.5,
    roughness: 0.12,
    desc: 'Black volcanic glass with glowing lava cracks.'
  },
  {
    id: 'wrap_rgb_chase',
    name: 'RGB Chase Wrap',
    rarityKey: 'LEGENDARY',
    pattern: 'rgbchase',
    color: '#0a0a0a',
    accent: '#ffffff',
    metalness: 0.15,
    roughness: 0.5,
    desc: 'Three RGB lights race along the blade from tip to handle, like a gaming keyboard.'
  },
  {
    id: 'wrap_neon_pulse',
    name: 'Neon Pulse Wrap',
    rarityKey: 'EPIC',
    pattern: 'neonpulse',
    color: '#05050a',
    accent: '#f0abfc',
    metalness: 0.2,
    roughness: 0.4,
    desc: 'The whole blade breathes with a cycling neon colour.'
  },
  {
    id: 'wrap_plasma_veins',
    name: 'Plasma Veins Wrap',
    rarityKey: 'LEGENDARY',
    pattern: 'plasma',
    color: '#04060c',
    accent: '#67e8f9',
    metalness: 0.3,
    roughness: 0.35,
    desc: 'Electric veins crawl across a dark blade and flicker with live current.'
  },
  {
    id: 'wrap_aurora_drift',
    name: 'Aurora Drift Wrap',
    rarityKey: 'EPIC',
    pattern: 'aurora',
    color: '#050812',
    accent: '#34d399',
    metalness: 0.3,
    roughness: 0.3,
    desc: 'Northern-light bands drift slowly along the blade in green, teal and violet.'
  },
  {
    id: 'wrap_ember_flow',
    name: 'Ember Flow Wrap',
    rarityKey: 'LEGENDARY',
    pattern: 'ember',
    color: '#120402',
    accent: '#fb923c',
    metalness: 0.3,
    roughness: 0.4,
    desc: 'Glowing embers rise in waves along the blade, from handle to tip.'
  },
  {
    id: 'wrap_glitch_scan',
    name: 'Glitch Scan Wrap',
    rarityKey: 'RARE',
    pattern: 'glitch',
    color: '#06080c',
    accent: '#e879f9',
    metalness: 0.2,
    roughness: 0.5,
    desc: 'Digital scanlines sweep the blade with brief magenta and cyan glitches.'
  }
];

export const WRAPS = RAW_WRAPS.map((w) => {
  const box = BOX_BY_RARITY[w.rarityKey] || BOX_BY_RARITY.COMMON;
  const direct = w.pattern === 'none' ? 0 : Math.round(box.boxPrice * WRAP_DIRECT_MULT);
  return {
    ...w,
    rarity: w.rarityKey,
    rarityColor: RARITY_COLORS[w.rarityKey],
    category: 'wrap',
    icon: '🎞️',
    boxId: box.boxId,
    price: direct
  };
});

export function getWrapById(id) {
  if (!id) return null;
  const w = WRAPS.find((x) => x.id === id);
  if (!w || w.pattern === 'none') return null;
  return w;
}

// ---- procedural pattern textures (cached per wrap) ----
const textureCache = new Map();

function paintPattern(ctx, size, w) {
  const { pattern, color, accent } = w;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);

  if (pattern === 'carbon') {
    // Twill weave: diagonal fibre bands alternating direction on every tile, with a shadow line for depth
    const T = 16;
    ctx.lineWidth = 5;
    for (let y = -T; y < size + T; y += T) {
      for (let x = -T; x < size + T; x += T) {
        const flip = ((x / T) + (y / T)) % 2 !== 0;
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        if (!flip) { ctx.moveTo(x, y); ctx.lineTo(x + T, y + T); }
        else { ctx.moveTo(x + T, y); ctx.lineTo(x, y + T); }
        ctx.stroke();
        ctx.strokeStyle = '#000000';
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (!flip) { ctx.moveTo(x + 3, y); ctx.lineTo(x + T + 3, y + T); }
        else { ctx.moveTo(x + T + 3, y); ctx.lineTo(x + 3, y + T); }
        ctx.stroke();
        ctx.lineWidth = 5;
      }
    }
    ctx.globalAlpha = 1;
  } else if (pattern === 'camo') {
    const blobCols = ['#2f3b22', '#6b7f3f', '#8a7a4a', '#1c2516'];
    for (let i = 0; i < 46; i++) {
      ctx.fillStyle = blobCols[i % blobCols.length];
      ctx.beginPath();
      ctx.ellipse(
        Math.random() * size,
        Math.random() * size,
        14 + Math.random() * 26,
        10 + Math.random() * 18,
        Math.random() * Math.PI,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  } else if (pattern === 'stripes') {
    ctx.fillStyle = accent;
    for (let x = -size; x < size * 2; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 24, 0);
      ctx.lineTo(x + 24 + size, size);
      ctx.lineTo(x + size, size);
      ctx.closePath();
      ctx.fill();
    }
  } else if (pattern === 'marble') {
    // Sinusoidal veins with seamless tiling (frequencies are whole cycles per tile)
    for (let k = 0; k < 9; k++) {
      ctx.strokeStyle = k % 3 === 0 ? accent : '#94a3b8';
      ctx.globalAlpha = 0.25 + Math.random() * 0.45;
      ctx.lineWidth = 1 + Math.random() * 5;
      const y0 = Math.random() * size;
      const amp = 12 + Math.random() * 28;
      const freq = (1 + Math.floor(Math.random() * 3)) * Math.PI * 2 / size;
      const ph = Math.random() * 6.28;
      ctx.beginPath();
      for (let x = 0; x <= size; x += 4) {
        const y = y0 + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 2.7 + ph * 1.3) * amp * 0.35;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (pattern === 'obsidian') {
    // Black glass with glowing lava cracks (random walks with a bright core and a soft glow)
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, '#0a0a0a');
    g.addColorStop(0.5, '#1c1917');
    g.addColorStop(1, '#050505');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    for (let c = 0; c < 9; c++) {
      let x = Math.random() * size;
      let y = Math.random() * size;
      let ang = Math.random() * 6.28;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let st = 0; st < 7; st++) {
        ang += (Math.random() - 0.5) * 1.1;
        x += Math.cos(ang) * (14 + Math.random() * 16);
        y += Math.sin(ang) * (14 + Math.random() * 16);
        ctx.lineTo(x, y);
      }
      ctx.shadowColor = accent;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
  } else if (pattern === 'lava') {
    for (let i = 0; i < 26; i++) {
      const g = ctx.createRadialGradient(
        Math.random() * size,
        Math.random() * size,
        2,
        Math.random() * size,
        Math.random() * size,
        30 + Math.random() * 40
      );
      g.addColorStop(0, '#fde047');
      g.addColorStop(0.5, accent);
      g.addColorStop(1, 'rgba(127,29,29,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
  }
}

function getWrapTexture(w) {
  if (textureCache.has(w.id)) return textureCache.get(w.id);
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  paintPattern(ctx, size, w);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  textureCache.set(w.id, tex);
  return tex;
}

/**
 * Applies a wrap to a knife material. `isHandle` uses the accent colour on the grip.
 * Returns the material for chaining. A null wrap leaves the material untouched.
 */
// ---- shader wraps (spectrum, holo, living) ----
// One shared clock for every animated wrap: main.js calls updateWrapTime() each frame.
const WRAP_TIME = { value: 0 };
export function updateWrapTime(seconds) {
  WRAP_TIME.value = seconds;
}

const WRAP_GLSL_HSV = `
vec3 wrapHsv(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}`;

const SHADER_WRAP_MODES = {
  spectrum: `
    float fres = 1.0 - abs(normalize(vViewPosition).z);
    float h = fract(vWrapPos.y * 0.6 + vWrapPos.x * 0.5 + fres * 0.7);
    diffuseColor.rgb = mix(diffuseColor.rgb, wrapHsv(vec3(h, 0.8, 1.0)), 0.9);`,
  holo: `
    float fres = 1.0 - abs(normalize(vViewPosition).z);
    float h = fract(fres * 1.3 + vWrapPos.y * 0.25 + uWrapTime * 0.03);
    diffuseColor.rgb = mix(diffuseColor.rgb, wrapHsv(vec3(h, 0.55, 1.0)), 0.7);`,
  living: `
    float run = fract(uWrapTime * 0.7 - vWrapPos.y * 3.0);
    float band = smoothstep(0.0, 0.12, run) * (1.0 - smoothstep(0.12, 0.4, run));
    vec3 glow = wrapHsv(vec3(fract(vWrapPos.y * 0.4 + uWrapTime * 0.08), 0.85, 1.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, glow, band * 0.95);`,
  fissure: `
    vec3 fissureGlow = vec3(0.0);
    // Matte black base with chevron ridges, like the reference grip
    float ridge = abs(fract(vWrapPos.z * 12.0 + abs(vWrapPos.x) * 9.0 + vWrapPos.y * 4.0) - 0.5) * 2.0;
    vec3 fissureBase = mix(vec3(0.01, 0.01, 0.012), vec3(0.2, 0.2, 0.22), smoothstep(0.5, 0.95, ridge));
    // Voronoi crack network: the cracks sit where the two nearest cell points are equally close
    vec2 q = vec2(vWrapPos.z * 19.0 + vWrapPos.y * 4.0, vWrapPos.x * 19.0 - vWrapPos.y * 3.0);
    vec2 ci = floor(q);
    vec2 cf = fract(q);
    float f1 = 8.0;
    float f2 = 8.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 o = fract(sin(vec2(dot(ci + g, vec2(127.1, 311.7)), dot(ci + g, vec2(269.5, 183.3)))) * 43758.5453);
        vec2 r = g + o - cf;
        float d = dot(r, r);
        if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
      }
    }
    float edge = sqrt(f2) - sqrt(f1);
    float crack = 1.0 - smoothstep(0.0, 0.14, edge);
    // Lava flows along the cracks: a travelling wave over the distance to the cell centre
    float flow = 0.5 + 0.5 * sin(sqrt(f1) * 9.0 - uWrapTime * 4.0);
    vec3 lavaCol = mix(vec3(1.0, 0.36, 0.05), vec3(1.0, 0.92, 0.45), flow * flow);
    diffuseColor.rgb = mix(fissureBase, lavaCol, crack);
    fissureGlow = lavaCol * crack * (1.1 + 0.9 * flow);`,
  anodized: `
    float fres = 1.0 - abs(normalize(vViewPosition).z);
    float h = fract(vWrapPos.y * 3.2 + vWrapPos.x * 2.4 + vWrapPos.z * 1.7 + fres * 1.6 + uWrapTime * 0.05);
    diffuseColor.rgb = wrapHsv(vec3(h, 0.9, 1.0));`,
  rgbchase: `
    vec3 rgbGlow = vec3(0.0);
    float pos = vWrapPos.z * 8.0 - uWrapTime * 2.0;
    float idx = mod(floor(pos), 3.0);
    vec3 lightCol = idx < 0.5 ? vec3(1.0, 0.1, 0.12) : (idx < 1.5 ? vec3(0.15, 1.0, 0.25) : vec3(0.15, 0.4, 1.0));
    float f = fract(pos);
    float bead = smoothstep(0.0, 0.06, f) * (1.0 - smoothstep(0.2, 0.36, f));
    diffuseColor.rgb = mix(vec3(0.004), lightCol, bead);
    rgbGlow = lightCol * bead;`,
  neonpulse: `
    vec3 neonGlow = vec3(0.0);
    float breath = 0.5 + 0.5 * sin(uWrapTime * 3.2 - vWrapPos.y * 2.0);
    vec3 neonCol = wrapHsv(vec3(fract(uWrapTime * 0.18 + vWrapPos.y * 0.15), 1.0, 1.0));
    diffuseColor.rgb = mix(vec3(0.01, 0.005, 0.02), neonCol, 0.15 + 0.85 * breath);
    neonGlow = neonCol * breath;`,
  plasma: `
    vec3 plasmaGlow = vec3(0.0);
    float pw = vWrapPos.z * 8.0 + vWrapPos.x * 6.0 + sin(vWrapPos.x * 20.0 + uWrapTime * 1.5) * 0.6;
    float pv = abs(fract(pw) - 0.5) * 2.0;
    float vein = smoothstep(0.7, 1.0, pv);
    float flick = 0.75 + 0.25 * sin(uWrapTime * 7.0 + vWrapPos.y * 3.0);
    vec3 plasmaCol = mix(vec3(0.3, 0.9, 1.0), vec3(0.75, 0.4, 1.0), 0.5 + 0.5 * sin(uWrapTime * 0.7));
    diffuseColor.rgb = mix(vec3(0.03, 0.04, 0.07), plasmaCol, vein * flick);
    plasmaGlow = plasmaCol * vein * flick;`,
  aurora: `
    vec3 auroraGlow = vec3(0.0);
    float aw = vWrapPos.z * 3.0 + sin(vWrapPos.y * 4.0 + uWrapTime * 0.8) * 0.35 + uWrapTime * 0.25;
    float band = 0.5 + 0.5 * sin(aw * 6.2831);
    vec3 auroraCol = wrapHsv(vec3(0.33 + 0.25 * sin(aw * 3.1416), 0.75, 1.0));
    diffuseColor.rgb = mix(vec3(0.02, 0.03, 0.06), auroraCol, 0.25 + 0.6 * band * band);
    auroraGlow = auroraCol * band * band * 0.6;`,
  ember: `
    vec3 emberGlow = vec3(0.0);
    float ef = fract(vWrapPos.z * 5.0 - uWrapTime * 1.1 + sin(vWrapPos.x * 17.0 + uWrapTime * 2.0) * 0.08);
    float emberBand = smoothstep(0.0, 0.3, ef) * (1.0 - smoothstep(0.3, 0.85, ef));
    vec3 emberCol = mix(vec3(1.0, 0.25, 0.02), vec3(1.0, 0.6, 0.12), emberBand);
    diffuseColor.rgb = mix(vec3(0.22, 0.05, 0.02), emberCol, 0.35 + 0.65 * emberBand);
    emberGlow = emberCol * emberBand;`,
  glitch: `
    vec3 glitchGlow = vec3(0.0);
    float scan = step(0.42, fract(vWrapPos.z * 16.0 - uWrapTime * 2.5));
    float slot = floor(uWrapTime * 10.0);
    float hit = step(0.9, fract(sin(slot * 78.233) * 43758.5453));
    vec3 glitchCol = mix(vec3(0.15, 0.95, 1.0), vec3(0.91, 0.47, 0.98), hit);
    diffuseColor.rgb = mix(vec3(0.09, 0.1, 0.12), glitchCol, scan * (0.6 + 0.4 * hit));
    glitchGlow = glitchCol * scan * (0.3 + 0.7 * hit);`
};

// Extra fragment code (emissive glow) per shader wrap, run after emissive is set
const SHADER_WRAP_EMISSIVE = {
  fissure: 'totalEmissiveRadiance += fissureGlow * 1.4;',
  rgbchase: 'totalEmissiveRadiance += rgbGlow * 2.2;',
  neonpulse: 'totalEmissiveRadiance += neonGlow * 1.5;',
  plasma: 'totalEmissiveRadiance += plasmaGlow * 0.9;',
  aurora: 'totalEmissiveRadiance += auroraGlow;',
  ember: 'totalEmissiveRadiance += emberGlow * 0.5;',
  glitch: 'totalEmissiveRadiance += glitchGlow * 1.2;'
};

function applyShaderWrap(mat, pattern) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWrapTime = WRAP_TIME;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWrapPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWrapPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWrapPos;\nuniform float uWrapTime;\n${WRAP_GLSL_HSV}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${SHADER_WRAP_MODES[pattern]}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${SHADER_WRAP_EMISSIVE[pattern] || ''}`);
  };
  mat.customProgramCacheKey = () => `wrap-${pattern}`;
}

export function applyWrapToMaterial(mat, wrap, isHandle = false) {
  if (!wrap) return mat;
  if (SHADER_WRAP_MODES[wrap.pattern]) {
    mat.map = null;
    mat.color.set(0xffffff);
    applyShaderWrap(mat, wrap.pattern);
  } else if (wrap.pattern === 'solid') {
    mat.color.set(isHandle ? wrap.accent : wrap.color);
  } else {
    mat.map = getWrapTexture(wrap);
    mat.color.set(0xffffff);
  }
  mat.metalness = isHandle ? Math.min(0.5, wrap.metalness) : wrap.metalness;
  mat.roughness = wrap.roughness;
  mat.needsUpdate = true;
  return mat;
}
