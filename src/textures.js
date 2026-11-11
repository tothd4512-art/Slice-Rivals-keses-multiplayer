import * as THREE from 'three';

function makeCanvas(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  return { canvas, ctx };
}

function finishTexture(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  return tex;
}

/**
 * Iconic Roblox Rivals / Source Dev "Tesztpálya / Tervrajz" (Blueprint & Prototype Grid) Texture!
 */
export function createBlueprintTexture({
  bg = '#2b3442',
  subGrid = 'rgba(255, 255, 255, 0.10)',
  majorGrid = 'rgba(255, 255, 255, 0.42)',
  crossColor = 'rgba(255, 255, 255, 0.65)',
  studs = true,
  label = '1x1m',
  repeatX = 1,
  repeatY = 1
} = {}) {
  const S = 512;
  const { canvas, ctx } = makeCanvas(S);

  // Solid matte dev-surface base
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);

  // Fine 8x8 millimeter/sub-stud blueprint grid
  ctx.strokeStyle = subGrid;
  ctx.lineWidth = 1.5;
  const stepFine = S / 8;
  for (let i = stepFine; i < S; i += stepFine) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, S);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(S, i);
    ctx.stroke();
  }

  // Medium 2x2 quad division dashed/solid line
  ctx.strokeStyle = majorGrid;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 6]);
  ctx.beginPath();
  ctx.moveTo(S / 2, 0);
  ctx.lineTo(S / 2, S);
  ctx.moveTo(0, S / 2);
  ctx.lineTo(S, S / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Optional classic Roblox circular top-studs subtle imprint
  if (studs) {
    for (let y = S / 8; y < S; y += S / 4) {
      for (let x = S / 8; x < S; x += S / 4) {
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.stroke();
      }
    }
  }

  // Bold outer tile blueprint border
  ctx.strokeStyle = majorGrid;
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, S - 6, S - 6);

  // Technical ruler ticks along outer border
  ctx.strokeStyle = crossColor;
  ctx.lineWidth = 2;
  for (let i = stepFine; i < S; i += stepFine) {
    // Top & Bottom ticks
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 10);
    ctx.moveTo(i, S - 10);
    ctx.lineTo(i, S);
    // Left & Right ticks
    ctx.moveTo(0, i);
    ctx.lineTo(10, i);
    ctx.moveTo(S - 10, i);
    ctx.lineTo(S, i);
    ctx.stroke();
  }

  // Center '+' architectural crosshair
  ctx.strokeStyle = crossColor;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(S / 2 - 14, S / 2);
  ctx.lineTo(S / 2 + 14, S / 2);
  ctx.moveTo(S / 2, S / 2 - 14);
  ctx.lineTo(S / 2, S / 2 + 14);
  ctx.stroke();

  // Tiny technical blueprint spec label in corner
  if (label) {
    ctx.fillStyle = crossColor;
    ctx.font = 'bold 18px monospace';
    ctx.fillText(label, 16, 30);
  }

  return finishTexture(canvas, repeatX, repeatY);
}

/**
 * Prototype Block / Crate Texture (Source / Roblox Dev Block with crisp X-diagonals & dimension label)
 */
export function createPrototypeBlockTexture({
  bg = '#ea580c',
  border = 'rgba(255, 255, 255, 0.82)',
  inner = 'rgba(255, 255, 255, 0.25)',
  tag = 'COVER // DEV'
} = {}) {
  const S = 512;
  const { canvas, ctx } = makeCanvas(S);

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);

  // Inner grid
  ctx.strokeStyle = inner;
  ctx.lineWidth = 2;
  for (let i = S / 4; i < S; i += S / 4) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, S);
    ctx.moveTo(0, i);
    ctx.lineTo(S, i);
    ctx.stroke();
  }

  // Blueprint diagonal cross lines inside inset box
  ctx.strokeStyle = inner;
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 28, S - 56, S - 56);
  ctx.beginPath();
  ctx.moveTo(28, 28);
  ctx.lineTo(S - 28, S - 28);
  ctx.moveTo(S - 28, 28);
  ctx.lineTo(28, S - 28);
  ctx.stroke();

  // Crisp bright outer prototype outline
  ctx.strokeStyle = border;
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, S - 10, S - 10);

  // Corner brackets
  ctx.fillStyle = border;
  ctx.font = 'bold 24px monospace';
  ctx.fillText(tag, 42, 62);

  return finishTexture(canvas, 1, 1);
}

/**
 * Classic Roblox Yellow Head Cylindrical Wrap Texture (draws classic Roblox eyes + confident Rivals smirk on front!)
 * Note: Three.js CylinderGeometry wraps UV U=0..1 around circumference; U=0.5 faces +Z or -Z depending on rotation.
 */
export function createRobloxHeadTexture({ skinColor = '#f5cd30', angry = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = skinColor;
  ctx.fillRect(0, 0, 512, 256);

  // Center of face at x = 256, y = 132
  const cx = 256;
  const cy = 128;

  // Classic Roblox oval dark eyes
  ctx.fillStyle = '#111317';
  ctx.beginPath();
  ctx.ellipse(cx - 32, cy - 10, 9, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(cx + 32, cy - 10, 9, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Crisp white eye catchlights
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx - 35, cy - 15, 3.5, 0, Math.PI * 2);
  ctx.arc(cx + 29, cy - 15, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Determined Rivals eyebrows
  if (angry) {
    ctx.strokeStyle = '#111317';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 46, cy - 34);
    ctx.lineTo(cx - 18, cy - 26);
    ctx.moveTo(cx + 46, cy - 34);
    ctx.lineTo(cx + 18, cy - 26);
    ctx.stroke();
  }

  // Classic Roblox confident smirk mouth
  ctx.strokeStyle = '#111317';
  ctx.lineWidth = 6.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 26, cy + 26);
  ctx.quadraticCurveTo(cx + 4, cy + 40, cx + 32, cy + 18);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Classic Roblox Studded Plastic Material Texture for Torso/Limbs
 */
export function createRobloxPlasticStudTexture(hexColor = '#e11d48') {
  const { canvas, ctx } = makeCanvas(128);
  ctx.fillStyle = hexColor;
  ctx.fillRect(0, 0, 128, 128);

  // Subtle plastic bevel border
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 124, 124);

  // 2x2 Roblox studs
  for (let y = 32; y < 128; y += 64) {
    for (let x = 32; x < 128; x += 64) {
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.stroke();
    }
  }

  return finishTexture(canvas, 1, 1);
}

export function createGlintTexture() {
  const { canvas, ctx } = makeCanvas(128);
  const cx = 64;
  const cy = 64;

  const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 58);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,90,110,0.9)');
  grad.addColorStop(0.65, 'rgba(255,42,85,0.25)');
  grad.addColorStop(1, 'rgba(255,42,85,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(cx, 2);
  ctx.lineTo(cx + 6, cy - 6);
  ctx.lineTo(126, cy);
  ctx.lineTo(cx + 6, cy + 6);
  ctx.lineTo(cx, 126);
  ctx.lineTo(cx - 6, cy + 6);
  ctx.lineTo(2, cy);
  ctx.lineTo(cx - 6, cy - 6);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
