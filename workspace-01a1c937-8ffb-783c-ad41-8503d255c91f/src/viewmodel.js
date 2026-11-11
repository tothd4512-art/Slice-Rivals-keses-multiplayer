import * as THREE from 'three';
import { createGunMesh } from './gunmodels.js';
import { createKnifeMesh, getSkinById } from './skins.js';
import { sfx } from './audio.js';

export class ViewmodelController {
  constructor(aspect = 16 / 9) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(68, aspect, 0.03, 8);

    // Crisp dedicated FPS weapon lighting
    const amb = new THREE.AmbientLight(0xffffff, 0.95);
    this.scene.add(amb);

    const key = new THREE.DirectionalLight(0xfffbeb, 1.65);
    key.position.set(1.5, 2.5, 1.8);
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0x38bdf8, 1.1);
    rim.position.set(-2.0, 0.8, -1.0);
    this.scene.add(rim);

    // Master sway/bob container
    this.rig = new THREE.Group();
    this.scene.add(this.rig);

    // Right arm + gloved hand + knife mount
    this.rightHandGroup = new THREE.Group();
    this.baseRightPos = new THREE.Vector3(0.31, -0.27, -0.52);
    this.rightHandGroup.position.copy(this.baseRightPos);
    this.rig.add(this.rightHandGroup);

    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.45, metalness: 0.06 });
    const robloxHandMat = new THREE.MeshStandardMaterial({ color: 0xf5cd30, roughness: 0.42, metalness: 0.04 });

    // Classic Blocky Roblox R6 Right Arm + Yellow Blocky Hand
    const rForearmGeo = new THREE.BoxGeometry(0.145, 0.145, 0.42);
    const rForearm = new THREE.Mesh(rForearmGeo, sleeveMat);
    rForearm.position.set(0.05, -0.07, 0.24);
    rForearm.rotation.set(0.16, -0.14, 0);
    this.rightHandGroup.add(rForearm);

    const rPalmGeo = new THREE.BoxGeometry(0.146, 0.146, 0.15);
    const rPalm = new THREE.Mesh(rPalmGeo, robloxHandMat);
    rPalm.position.set(0, -0.02, -0.01);
    this.rightHandGroup.add(rPalm);

    // Knife mount inside right Roblox hand
    this.knifeMount = new THREE.Group();
    this.knifeMount.position.set(-0.01, 0.035, -0.05);
    this.knifeMount.rotation.set(0.22, 0.25, 0.08);
    this.rightHandGroup.add(this.knifeMount);

    // Gun mount (gun mode): same hand socket as the knife
    this.gunMount = new THREE.Group();
    this.gunMount.position.set(-0.01, 0.035, -0.05);
    this.gunMount.rotation.set(0.22, 0.25, 0.08);
    this.gunMount.visible = false;
    this.rightHandGroup.add(this.gunMount);
    this.gunParts = null;
    this.gunKick = 0;
    this.flashT = 0;
    this.setGunModel('gun_pistol');

    // Left Roblox Blocky Arm + Yellow Hand
    this.leftHandGroup = new THREE.Group();
    this.baseLeftPos = new THREE.Vector3(-0.34, -0.38, -0.48);
    this.leftHandGroup.position.copy(this.baseLeftPos);
    this.rig.add(this.leftHandGroup);

    const lForearm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.38), sleeveMat);
    lForearm.position.set(-0.04, -0.06, 0.2);
    lForearm.rotation.set(0.15, 0.18, 0);
    this.leftHandGroup.add(lForearm);

    const lFist = new THREE.Mesh(new THREE.BoxGeometry(0.142, 0.142, 0.145), robloxHandMat);
    lFist.position.set(0, -0.015, -0.01);
    this.leftHandGroup.add(lFist);

    // Slash Ribbon Arc VFX in front of camera
    const arcGeo = new THREE.RingGeometry(0.32, 0.48, 20, 1, -Math.PI * 0.42, Math.PI * 0.84);
    this.slashArcMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0
    });
    this.slashArc = new THREE.Mesh(arcGeo, this.slashArcMat);
    this.slashArc.position.set(0, -0.04, -0.62);
    this.scene.add(this.slashArc);

    // Parry energy rim in front of blade
    this.parryShieldMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0
    });
    this.parryShield = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.24, 6), this.parryShieldMat);
    this.parryShield.position.set(0, -0.02, -0.52);
    this.scene.add(this.parryShield);

    // Animation state
    this.skinId = 'karambit_crimson';
    this.skin = getSkinById(this.skinId);
    this.knifeMesh = null;
    this.setSkin(this.skinId);

    this.swayX = 0;
    this.swayY = 0;
    this.bobTime = 0;

    this.animMode = 'idle'; // 'idle' | 'equip' | 'slash' | 'jab' | 'charge' | 'throwRelease' | 'parry' | 'parryHit' | 'inspect'
    this.animTimer = 0;
    this.animDuration = 0.25;
    this.comboStep = 0;
    this.chargeTime = 0;
    this.inspectClickStage = 0;
  }

  setAspect(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  setGunModel(gunId) {
    while (this.gunMount.children.length > 0) this.gunMount.remove(this.gunMount.children[0]);
    this.gunParts = createGunMesh(gunId);
    this.gunMount.add(this.gunParts.group);
  }

  playGunShot(kick = 0.02) {
    this.gunKick = Math.min(0.1, this.gunKick + kick * 3);
    this.flashT = 0.05;
  }

  setSkin(skinId, wrapId = null) {
    this.skinId = skinId;
    this.wrapId = wrapId;
    this.skin = getSkinById(skinId);
    while (this.knifeMount.children.length > 0) {
      this.knifeMount.remove(this.knifeMount.children[0]);
    }
    this.knifeMesh = createKnifeMesh(skinId, wrapId);
    this.knifeMesh.scale.setScalar(1.22);
    this.knifeMount.add(this.knifeMesh);
    this.slashArcMat.color.setHex(this.skin.trailColor);
    this.playEquip();
  }

  addMouseSway(dx, dy) {
    this.swayX = THREE.MathUtils.clamp(this.swayX - dx * 0.00018, -0.06, 0.06);
    this.swayY = THREE.MathUtils.clamp(this.swayY + dy * 0.00018, -0.06, 0.06);
  }

  playEquip() {
    this.resetKnifeSubTransforms();
    this.animMode = 'equip';
    this.animDuration = 0.34;
    this.animTimer = 0;
  }

  playSlash(comboStep = 0) {
    this.resetKnifeSubTransforms();
    // Nunchaku: the trailing knife gets a kick on each slash
    this.chainSpring = this.chainSpring || { a: 0, v: 0 };
    this.chainSpring.v += comboStep % 2 ? -14 : 14;
    this.comboStep = comboStep % 3;
    this.animMode = 'slash';
    this.animDuration = 0.26;
    this.animTimer = 0;

    // Flash slash arc
    this.slashArcMat.opacity = 0.72;
    if (this.comboStep === 0) {
      this.slashArc.rotation.set(1.15, 0.15, -0.45);
    } else if (this.comboStep === 1) {
      this.slashArc.rotation.set(1.15, -0.15, 2.65);
    } else {
      this.slashArc.rotation.set(1.48, 0, 0);
    }
  }

  playQuickJab() {
    this.resetKnifeSubTransforms();
    this.animMode = 'jab';
    this.animDuration = 0.24;
    this.animTimer = 0;
  }

  startCharge() {
    this.resetKnifeSubTransforms();
    this.animMode = 'charge';
    this.chargeTime = 0;
  }

  playThrowRelease() {
    this.resetKnifeSubTransforms();
    this.animMode = 'throwRelease';
    this.animDuration = 0.24;
    this.animTimer = 0;
  }

  playParry() {
    this.resetKnifeSubTransforms();
    this.animMode = 'parry';
    this.animDuration = 0.45;
    this.animTimer = 0;
    this.parryShieldMat.color.setHex(0x00f0ff);
    this.parryShieldMat.opacity = 0.78;
  }

  playParrySuccess() {
    this.resetKnifeSubTransforms();
    this.animMode = 'parryHit';
    this.animDuration = 0.35;
    this.animTimer = 0;
    this.parryShieldMat.color.setHex(0xffd166);
    this.parryShieldMat.opacity = 1.0;
  }

  playVault() {
    this.resetKnifeSubTransforms();
    this.animMode = 'vault';
    this.animDuration = 0.32;
    this.animTimer = 0;
  }

  playInspect() {
    if (this.animMode !== 'idle' && this.animMode !== 'inspect') return;
    this.resetKnifeSubTransforms();
    this.animMode = 'inspect';
    this.animDuration = 1.45;
    this.animTimer = 0;
    this.inspectClickStage = 0;
    sfx.playInspectClick();
  }

  resetKnifeSubTransforms() {
    if (!this.knifeMesh) return;
    this.knifeMesh.position.set(0, 0, 0);
    this.knifeMesh.rotation.set(0, 0, 0);
    const sp = this.knifeMesh.userData.spinPivot;
    if (sp) sp.rotation.set(0, 0, 0);
    if (this.knifeMesh.userData.safeHandle) this.knifeMesh.userData.safeHandle.rotation.set(0, 0, 0);
    if (this.knifeMesh.userData.biteHandle) this.knifeMesh.userData.biteHandle.rotation.set(0, 0, 0);
  }

  update(dt, playerState) {
    // Nunchaku trailing blade: damped spring that lags behind hand movement and slash kicks
    const swing = this.knifeMesh && this.knifeMesh.userData.chainSwing;
    if (swing) {
      // The second knife is only on the chain while a charge is still in hand
      swing.visible = (playerState.knifeCharges ?? 2) >= 2;
      const sp = this.chainSpring || (this.chainSpring = { a: 0, v: 0 });
      const target = THREE.MathUtils.clamp(-playerState.vel.x * 0.025 - playerState.vel.y * 0.01, -0.35, 0.35);
      const K = 70; const C = 4.5;
      sp.v += (K * (target - sp.a) - C * sp.v) * dt;
      sp.a += sp.v * dt;
      swing.rotation.z = sp.a;
      swing.rotation.x = sp.a * 0.6;
    }
    // Dual knife: the right-hand knife disappears while it is thrown
    const throwHand = this.knifeMesh && this.knifeMesh.userData.throwHand;
    if (throwHand) throwHand.visible = (playerState.knifeCharges ?? 1) >= 1;
    // Decay slash arc & parry shield
    if (this.slashArcMat.opacity > 0) {
      this.slashArcMat.opacity = Math.max(0, this.slashArcMat.opacity - dt * 4.5);
    }
    if (this.parryShieldMat.opacity > 0 && this.animMode !== 'parry') {
      this.parryShieldMat.opacity = Math.max(0, this.parryShieldMat.opacity - dt * 4.0);
    }
    this.parryShield.rotation.z += dt * 7;

    // Weapon sway + movement bob
    this.swayX = THREE.MathUtils.lerp(this.swayX, 0, dt * 10);
    this.swayY = THREE.MathUtils.lerp(this.swayY, 0, dt * 10);

    const speed = Math.hypot(playerState.vel.x, playerState.vel.z);
    if (playerState.grounded && !playerState.sliding && speed > 0.5) {
      this.bobTime += dt * (8 + speed * 0.45);
    }
    const bobX = Math.cos(this.bobTime * 0.5) * 0.014 * Math.min(1, speed / 9);
    const bobY = Math.abs(Math.sin(this.bobTime)) * -0.016 * Math.min(1, speed / 9);
    const slideRoll = playerState.sliding ? -0.18 : 0;

    this.rig.position.set(
      THREE.MathUtils.lerp(this.rig.position.x, this.swayX + bobX, dt * 14),
      THREE.MathUtils.lerp(this.rig.position.y, this.swayY + bobY + (playerState.grounded ? 0 : -0.025), dt * 14),
      0
    );
    this.rig.rotation.z = THREE.MathUtils.lerp(this.rig.rotation.z, slideRoll, dt * 12);

    this.knifeMount.visible = (playerState.hasKnife || this.animMode === 'charge') && !playerState.gunMode;
    this.gunMount.visible = !!playerState.gunMode;
    if (this.gunParts) this.gunParts.flash.visible = this.flashT > 0;
    if (this.flashT > 0) this.flashT -= dt;
    this.gunKick = THREE.MathUtils.lerp(this.gunKick, 0, Math.min(1, dt * 14));
    this.gunMount.position.set(-0.01, 0.035, -0.05 + this.gunKick);

    // Default target poses
    let rx = this.baseRightPos.x;
    let ry = this.baseRightPos.y;
    let rz = this.baseRightPos.z;
    let rRotX = 0;
    let rRotY = 0;
    let rRotZ = 0;

    let lx = this.baseLeftPos.x;
    let ly = this.baseLeftPos.y;
    let lz = this.baseLeftPos.z;
    let lRotX = 0;

    if (!playerState.hasKnife && this.animMode === 'idle') {
      // Unarmed combat guard (fists ready while knife recharges)
      ry = -0.32;
      ly = -0.28;
      lz = -0.44;
    }

    if (this.animMode === 'equip') {
      this.animTimer += dt;
      const p = Math.min(1, this.animTimer / this.animDuration);
      const ease = 1 - Math.pow(1 - p, 3);
      ry = -0.52 + 0.25 * ease;
      const sp = this.knifeMesh.userData.spinPivot;
      if (sp) sp.rotation.x = (1 - ease) * Math.PI * 2;
      if (p >= 1) {
        this.resetKnifeSubTransforms();
        this.animMode = 'idle';
      }
    } else if (this.animMode === 'slash') {
      this.animTimer += dt;
      const p = Math.min(1, this.animTimer / this.animDuration);
      const swing = Math.sin(p * Math.PI);
      if (this.comboStep === 0) {
        // Right-to-left wide slash
        rx = 0.36 - p * 0.68;
        ry = -0.16 - p * 0.16;
        rz = -0.52 - swing * 0.16;
        rRotY = 0.85 - p * 1.65;
        rRotZ = -0.75;
        rRotX = -0.35;
      } else if (this.comboStep === 1) {
        // Left-to-right backhand slash
        rx = -0.28 + p * 0.68;
        ry = -0.24 + swing * 0.08;
        rz = -0.52 - swing * 0.16;
        rRotY = -0.85 + p * 1.65;
        rRotZ = 0.85;
        rRotX = -0.25;
      } else {
        // Forward Lunge Thrust!
        rx = 0.14 - swing * 0.1;
        ry = -0.22 + swing * 0.05;
        rz = -0.48 - swing * 0.36;
        rRotX = -0.65 * swing;
        rRotY = 0.25;
      }
      if (p >= 1) this.animMode = 'idle';
    } else if (this.animMode === 'jab') {
      this.animTimer += dt;
      const p = Math.min(1, this.animTimer / this.animDuration);
      const punch = Math.sin(p * Math.PI);
      lx = -0.28 + punch * 0.22;
      ly = -0.24 + punch * 0.12;
      lz = -0.44 - punch * 0.34;
      lRotX = -0.35 * punch;
      ry = -0.35;
      if (p >= 1) this.animMode = 'idle';
    } else if (this.animMode === 'charge') {
      this.chargeTime += dt;
      const c = Math.min(1, this.chargeTime / 0.35);
      const tremor = c >= 1 ? Math.sin(this.chargeTime * 55) * 0.004 : 0;
      rx = 0.24 + c * 0.08 + tremor;
      ry = -0.22 + c * 0.24 + tremor;
      rz = -0.46 + c * 0.12;
      rRotX = 0.85 * c;
      rRotY = -0.15 * c;
      // Left hand aims forward
      lx = -0.22;
      ly = -0.24;
      lz = -0.52;
    } else if (this.animMode === 'throwRelease') {
      this.animTimer += dt;
      const p = Math.min(1, this.animTimer / this.animDuration);
      rx = 0.3 - p * 0.22;
      ry = 0.02 - p * 0.38;
      rz = -0.34 - Math.sin(p * Math.PI) * 0.32;
      rRotX = 0.85 - p * 1.6;
      if (p >= 1) this.animMode = 'idle';
    } else if (this.animMode === 'parry') {
      this.animTimer += dt;
      const p = Math.min(1, this.animTimer / this.animDuration);
      rx = 0.04;
      ry = -0.14;
      rz = -0.48;
      rRotZ = 1.18;
      rRotY = 0.35;
      rRotX = 0.15;
      lx = -0.14;
      ly = -0.18;
      lz = -0.46;
      if (p >= 1) this.animMode = 'idle';
    } else if (this.animMode === 'parryHit') {
      this.animTimer += dt;
      const p = Math.min(1, this.animTimer / this.animDuration);
      const burst = Math.sin(p * Math.PI);
      rx = 0.04 + p * 0.28;
      ry = -0.12 + burst * 0.18;
      rz = -0.52 - burst * 0.16;
      rRotZ = 1.18 - p * 1.4;
      if (p >= 1) this.animMode = 'idle';
    } else if (this.animMode === 'inspect') {
      this.animTimer += dt;
      const p = Math.min(1, this.animTimer / this.animDuration);
      const arch = Math.sin(p * Math.PI);

      // Bring hand slightly closer to center so user gets an awesome view of their skin!
      rx = 0.31 - arch * 0.18;
      ry = -0.27 + arch * 0.12;
      rz = -0.52 - arch * 0.04;
      rRotY = arch * 0.55;
      rRotZ = arch * 0.25;

      const sp = this.knifeMesh.userData.spinPivot;
      if (this.skin.type === 'karambit' || this.skin.type === 'kunai') {
        // Double 360° finger-ring spin!
        const spinEase = p < 0.85 ? 1 - Math.pow(1 - p / 0.85, 2.2) : 1;
        if (sp) sp.rotation.x = spinEase * Math.PI * 4;
        if (p > 0.35 && this.inspectClickStage === 0) {
          this.inspectClickStage = 1;
          sfx.playInspectClick();
        }
        if (p > 0.72 && this.inspectClickStage === 1) {
          this.inspectClickStage = 2;
          sfx.playInspectClick();
        }
      } else if (this.skin.type === 'balisong') {
        // Authentic butterfly handle fan + flip!
        const sh = this.knifeMesh.userData.safeHandle;
        const bh = this.knifeMesh.userData.biteHandle;
        const openAngle = Math.sin(p * Math.PI * 2) * 2.2;
        if (sh) sh.rotation.x = Math.max(0, openAngle);
        if (bh) bh.rotation.x = -Math.max(0, openAngle);
        if (sp) sp.rotation.z = Math.sin(p * Math.PI) * Math.PI * 2;
        if (p > 0.45 && this.inspectClickStage === 0) {
          this.inspectClickStage = 1;
          sfx.playInspectClick();
        }
        if (p > 0.88 && this.inspectClickStage === 1) {
          this.inspectClickStage = 2;
          sfx.playInspectClick();
        }
      } else {
        // Aerial palm toss + 720° blade flip & catch!
        const toss = Math.sin(p * Math.PI);
        this.knifeMesh.position.y = toss * 0.16;
        if (sp) sp.rotation.x = p * Math.PI * 4;
        if (p > 0.86 && this.inspectClickStage === 0) {
          this.inspectClickStage = 1;
          sfx.playInspectClick();
        }
      }

      if (p >= 1) {
        this.resetKnifeSubTransforms();
        this.animMode = 'idle';
      }
    } else if (this.animMode === 'vault') {
      this.animTimer += dt;
      const p = Math.min(1, this.animTimer / this.animDuration);
      const push = Math.sin(p * Math.PI);
      // Left Roblox hand pushes down off the vaulted barrier while right hand tucks!
      lx = -0.14;
      ly = -0.12 - p * 0.16;
      lz = -0.58 + p * 0.14;
      lRotX = 0.85 * push;

      rx = this.baseRightPos.x + 0.08 * push;
      ry = this.baseRightPos.y - 0.08 * push;
      rRotZ = -0.35 * push;
      if (p >= 1) this.animMode = 'idle';
    }

    const lerpSpeed = this.animMode === 'idle' ? 14 : 26;
    this.rightHandGroup.position.lerp(new THREE.Vector3(rx, ry, rz), Math.min(1, dt * lerpSpeed));
    this.rightHandGroup.rotation.x = THREE.MathUtils.lerp(this.rightHandGroup.rotation.x, rRotX, Math.min(1, dt * lerpSpeed));
    this.rightHandGroup.rotation.y = THREE.MathUtils.lerp(this.rightHandGroup.rotation.y, rRotY, Math.min(1, dt * lerpSpeed));
    this.rightHandGroup.rotation.z = THREE.MathUtils.lerp(this.rightHandGroup.rotation.z, rRotZ, Math.min(1, dt * lerpSpeed));

    this.leftHandGroup.position.lerp(new THREE.Vector3(lx, ly, lz), Math.min(1, dt * lerpSpeed));
    this.leftHandGroup.rotation.x = THREE.MathUtils.lerp(this.leftHandGroup.rotation.x, lRotX, Math.min(1, dt * lerpSpeed));
  }

  render(renderer) {
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }
}
