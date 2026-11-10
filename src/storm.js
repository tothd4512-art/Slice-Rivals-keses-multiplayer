import * as THREE from 'three';
import { sfx } from './audio.js';

function createStormWallTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(147, 51, 234, 0.12)');
  grad.addColorStop(0.5, 'rgba(192, 38, 211, 0.36)');
  grad.addColorStop(0.92, 'rgba(168, 85, 247, 0.58)');
  grad.addColorStop(1, 'rgba(232, 121, 249, 0.85)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Electric Fortnite storm vertical streaks & hex grid lines
  ctx.strokeStyle = 'rgba(240, 171, 252, 0.38)';
  ctx.lineWidth = 2;
  for (let x = 0; x < 256; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 12, 128);
    ctx.lineTo(x - 6, 256);
    ctx.stroke();
  }
  for (let y = 0; y < 256; y += 32) {
    ctx.strokeStyle = 'rgba(216, 180, 254, 0.22)';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class StormController {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.mode = 'ffa'; // 'ffa' | 'sudden_death'

    this.currentCenter = new THREE.Vector2(0, 0);
    this.currentRadius = 28;
    this.startCenter = new THREE.Vector2(0, 0);
    this.startRadius = 28;
    this.nextCenter = new THREE.Vector2(0, 0);
    this.nextRadius = 18;

    this.phaseIndex = 0;
    this.phaseState = 'waiting'; // 'waiting' | 'shrinking' | 'final'
    this.phaseTimer = 0;
    this.phaseDuration = 10;
    this.dps = 4;
    this.tickTimer = 0;
    this.animTime = 0;

    // 3D Storm Wall Mesh
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);

    this.wallTex = createStormWallTexture();
    this.wallMat = new THREE.MeshBasicMaterial({
      map: this.wallTex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.72,
      depthWrite: false
    });
    const cylGeo = new THREE.CylinderGeometry(1, 1, 28, 56, 1, true);
    this.wallMesh = new THREE.Mesh(cylGeo, this.wallMat);
    this.wallMesh.position.y = 14;
    this.group.add(this.wallMesh);

    // Storm Boundary Floor Ring (Bright Magenta)
    this.stormRingMat = new THREE.MeshBasicMaterial({
      color: 0xe879f9,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    });
    this.stormRing = new THREE.Mesh(new THREE.RingGeometry(0.985, 1.015, 64), this.stormRingMat);
    this.stormRing.rotation.x = -Math.PI / 2;
    this.stormRing.position.y = 0.07;
    this.group.add(this.stormRing);

    // Next Safe Zone Floor Ring (Crisp White)
    this.safeRingMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55
    });
    this.safeRing = new THREE.Mesh(new THREE.RingGeometry(0.985, 1.01, 64), this.safeRingMat);
    this.safeRing.rotation.x = -Math.PI / 2;
    this.safeRing.position.y = 0.06;
    this.group.add(this.safeRing);
  }

  startFFAStorm() {
    this.active = true;
    this.mode = 'ffa';
    this.animTime = 0;
    this.tickTimer = 0;

    this.phases = [
      { wait: 6, shrink: 13, targetR: 18.0, shiftMax: 3.5, dps: 5 },
      { wait: 5, shrink: 12, targetR: 11.2, shiftMax: 4.2, dps: 8 },
      { wait: 4, shrink: 10, targetR: 5.8, shiftMax: 3.2, dps: 12 },
      { wait: 3, shrink: 10, targetR: 1.6, shiftMax: 2.0, dps: 18 }
    ];

    this.currentCenter.set(0, 0);
    this.currentRadius = 27.5;
    this.phaseIndex = 0;
    this._setupPhase(0);
    this.group.visible = true;
    this._syncMeshes();
  }

  startSuddenDeathStorm() {
    if (this.active) return;
    this.active = true;
    this.mode = 'sudden_death';
    this.animTime = 0;
    this.tickTimer = 0;

    this.phases = [
      { wait: 1.5, shrink: 16, targetR: 4.2, shiftMax: 0, dps: 9 }
    ];

    this.currentCenter.set(0, 0);
    this.currentRadius = 24.5;
    this.phaseIndex = 0;
    this._setupPhase(0);
    this.group.visible = true;
    this._syncMeshes();
    sfx.playStormPhaseAlert();
  }

  stop() {
    this.active = false;
    this.group.visible = false;
  }

  _setupPhase(idx) {
    const p = this.phases[idx];
    this.phaseIndex = idx;
    this.phaseState = 'waiting';
    this.phaseTimer = p.wait;
    this.phaseDuration = p.wait;
    this.dps = p.dps;

    this.startCenter.copy(this.currentCenter);
    this.startRadius = this.currentRadius;

    const ang = Math.random() * Math.PI * 2;
    const dist = Math.random() * p.shiftMax;
    const nx = THREE.MathUtils.clamp(this.currentCenter.x + Math.cos(ang) * dist, -9, 9);
    const nz = THREE.MathUtils.clamp(this.currentCenter.y + Math.sin(ang) * dist, -10, 10);
    this.nextCenter.set(nx, nz);
    this.nextRadius = p.targetR;
  }

  isOutside(pos, margin = 0) {
    if (!this.active) return false;
    const d = Math.hypot(pos.x - this.currentCenter.x, pos.z - this.currentCenter.y);
    return d > this.currentRadius - margin;
  }

  getStatusText() {
    if (!this.active) return '';
    const sec = Math.max(0, Math.ceil(this.phaseTimer));
    const pNum = this.phaseIndex + 1;
    if (this.phaseState === 'waiting') {
      return `🌪️ ${pNum}. STORM ZONE INCOMING: ${sec}s (${this.dps} DMG/s)`;
    }
    if (this.phaseState === 'shrinking') {
      return `⚠️ THE STORM ZONE IS SHRINKING! ${sec}s (${this.dps} DMG/s)`;
    }
    return `☠️ FINAL STORM ZONE ACTIVE! (${this.dps} DMG/s)`;
  }

  _syncMeshes() {
    const r = Math.max(0.5, this.currentRadius);
    this.wallMesh.position.set(this.currentCenter.x, 14, this.currentCenter.y);
    this.wallMesh.scale.set(r, 1, r);

    this.stormRing.position.set(this.currentCenter.x, 0.08, this.currentCenter.y);
    this.stormRing.scale.set(r, r, 1);

    const nr = Math.max(0.4, this.nextRadius);
    this.safeRing.visible = this.phaseState !== 'final';
    this.safeRing.position.set(this.nextCenter.x, 0.06, this.nextCenter.y);
    this.safeRing.scale.set(nr, nr, 1);
  }

  update(dt, combatants, onStormDamage) {
    if (!this.active) return;

    this.animTime += dt;
    this.wallTex.offset.x = (this.animTime * 0.08) % 1;
    this.wallTex.offset.y = -(this.animTime * 0.22) % 1;
    this.wallMat.opacity = 0.62 + Math.sin(this.animTime * 4) * 0.1;

    if (this.phaseState === 'waiting') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        const p = this.phases[this.phaseIndex];
        this.phaseState = 'shrinking';
        this.phaseTimer = p.shrink;
        this.phaseDuration = p.shrink;
        sfx.playStormPhaseAlert();
      }
    } else if (this.phaseState === 'shrinking') {
      this.phaseTimer -= dt;
      const progress = 1 - Math.max(0, this.phaseTimer) / Math.max(0.01, this.phaseDuration);
      this.currentRadius = THREE.MathUtils.lerp(this.startRadius, this.nextRadius, progress);
      this.currentCenter.lerpVectors(this.startCenter, this.nextCenter, progress);

      if (this.phaseTimer <= 0) {
        this.currentRadius = this.nextRadius;
        this.currentCenter.copy(this.nextCenter);
        if (this.phaseIndex + 1 < this.phases.length) {
          this._setupPhase(this.phaseIndex + 1);
        } else {
          this.phaseState = 'final';
          this.phaseTimer = 0;
        }
      }
    }

    this._syncMeshes();

    // Storm Tick Damage every 0.5s
    this.tickTimer += dt;
    if (this.tickTimer >= 0.5) {
      this.tickTimer -= 0.5;
      const tickDmg = Math.max(1, Math.round(this.dps * 0.5));
      for (const c of combatants) {
        if (c.state.dead) continue;
        if (this.isOutside(c.state.pos)) {
          onStormDamage(c, tickDmg);
        }
      }
    }
  }

  renderRadar(canvasEl, arena, combatants, playerYaw) {
    if (!canvasEl || !this.active) return;
    const ctx = canvasEl.getContext('2d');
    const w = canvasEl.width;
    const h = canvasEl.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = (w * 0.44) / Math.max(arena.arenaW * 0.5, arena.arenaL * 0.5, 25);

    ctx.clearRect(0, 0, w, h);

    // Radar Background + Purple Storm Fill
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.48, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = 'rgba(88, 28, 135, 0.68)';
    ctx.fillRect(0, 0, w, h);

    // Cut out Safe Current Storm Circle (Dark Blueprint Blue)
    const scx = cx + this.currentCenter.x * scale;
    const scy = cy + this.currentCenter.y * scale;
    const sr = Math.max(2, this.currentRadius * scale);

    ctx.beginPath();
    ctx.arc(scx, scy, sr, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(11, 25, 48, 0.92)';
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#e879f9';
    ctx.stroke();

    // Arena Bounds Box
    const aw = arena.arenaW * scale;
    const al = arena.arenaL * scale;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - aw / 2, cy - al / 2, aw, al);

    // Next Safe Zone White Dashed Ring
    if (this.phaseState !== 'final') {
      const ncx = cx + this.nextCenter.x * scale;
      const ncy = cy + this.nextCenter.y * scale;
      const nr = Math.max(2, this.nextRadius * scale);
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(ncx, ncy, nr, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // Draw Living Fighters!
    for (const c of combatants) {
      if (c.state.dead) continue;
      const px = cx + c.state.pos.x * scale;
      const py = cy + c.state.pos.z * scale;

      if (c.isPlayer) {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(-playerYaw);
        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(4.5, 5);
        ctx.lineTo(0, 2.5);
        ctx.lineTo(-4.5, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(px, py, 3.6, 0, Math.PI * 2);
        ctx.fillStyle = c.radarColor || '#ff2a55';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    ctx.restore();

    // Outer Radar Rim
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.48, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(232, 121, 249, 0.65)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  dispose() {
    this.scene.remove(this.group);
  }
}
