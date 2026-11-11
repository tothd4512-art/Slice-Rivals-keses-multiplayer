import * as THREE from 'three';
import { createGunMesh } from './gunmodels.js';
import { createKnifeMesh } from './skins.js';
import { createHatMesh } from './cosmetics.js';
import { getPackById, samplePose } from './emotePacks.js';
import {
  createRobloxHeadTexture,
  createRobloxPlasticStudTexture,
  createGlintTexture
} from './textures.js';

export const VICTORY_EMOTES = [
  {
    id: 'blade_flourish',
    name: '✨ Blade Toss & Spin',
    desc: 'Tosses the spinning knife high, does a 360° turn, then catches it!'
  },
  {
    id: 'backflip_pose',
    name: '🤸 Backflip & Hero Pose',
    desc: 'A flashy backflip in the air, a superhero landing and a victory blade!'
  },
  {
    id: 'levitate_zen',
    name: '🧘 Champion Levitation',
    desc: 'Floating in midair, telekinetically orbiting a glowing blade in front of you!'
  },
  {
    id: 'rivals_dance',
    name: '🕺 Rivals Victory Dance',
    desc: 'A classic, spinning Roblox R6 victory dance with knife spins!'
  },
  {
    id: 'cinema_freeze',
    name: '🎬 Cinema Freeze',
    desc: 'Snaps into a dramatic freeze-frame pose, then breathes in slow motion. Absolute Cinema energy!'
  },
  {
    id: 'disco_robot',
    name: '🤖 Disco Robot',
    desc: 'Stepped, snappy robot pops that hit on every beat.'
  },
  {
    id: 'orbit_shuffle',
    name: '🌀 Orbit Shuffle',
    desc: 'A side-to-side shuffle while your knife orbits your head.'
  },
  {
    id: 'drum_flex',
    name: '🥁 Drum Flex',
    desc: 'Alternating arm flexes and a bouncing beat, like a drummer hitting the cymbals.'
  }
];

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function damp(current, target, lambda, dt) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/**
 * Literal Classic Roblox R6 Blocky Character Rig (Used for BOTH Player in 3rd Person & Rival NPC!)
 */
export class RivalCharacter {
  constructor(
    scene,
    skinId = 'karambit_crimson',
    { torsoColor = '#e11d48', legsColor = '#1e3a8a', angry = true, hatId = 'hat_none', wrapId = null } = {}
  ) {
    this.scene = scene;
    this.wrapId = wrapId;
    this.torsoColorHex = new THREE.Color(torsoColor).getHex();
    this.legsColorHex = new THREE.Color(legsColor).getHex();
    this.root = new THREE.Group();
    scene.add(this.root);

    this.bodyPivot = new THREE.Group();
    this.root.add(this.bodyPivot);

    // Classic Roblox Materials
    this.yellowSkinMat = new THREE.MeshStandardMaterial({
      color: 0xf5cd30,
      roughness: 0.42,
      metalness: 0.05
    });
    this.headFaceMat = new THREE.MeshStandardMaterial({
      map: createRobloxHeadTexture({ skinColor: '#f5cd30', angry }),
      roughness: 0.42,
      metalness: 0.05
    });
    this.torsoMat = new THREE.MeshStandardMaterial({
      map: createRobloxPlasticStudTexture(torsoColor),
      roughness: 0.45,
      metalness: 0.08
    });
    this.legsMat = new THREE.MeshStandardMaterial({
      map: createRobloxPlasticStudTexture(legsColor),
      roughness: 0.48,
      metalness: 0.06
    });

    this.allFlashMats = [this.yellowSkinMat, this.headFaceMat, this.torsoMat, this.legsMat];

    // === ROBLOX R6 LEGS ===
    this.leftLegPivot = new THREE.Group();
    this.leftLegPivot.position.set(-0.23, 0.92, 0);
    this.rightLegPivot = new THREE.Group();
    this.rightLegPivot.position.set(0.23, 0.92, 0);
    this.bodyPivot.add(this.leftLegPivot, this.rightLegPivot);

    const legGeo = new THREE.BoxGeometry(0.44, 0.92, 0.44);
    const lLeg = new THREE.Mesh(legGeo, this.legsMat);
    lLeg.position.set(0, -0.46, 0);
    lLeg.castShadow = true;
    lLeg.receiveShadow = true;
    this.leftLegPivot.add(lLeg);

    const rLeg = new THREE.Mesh(legGeo, this.legsMat);
    rLeg.position.set(0, -0.46, 0);
    rLeg.castShadow = true;
    rLeg.receiveShadow = true;
    this.rightLegPivot.add(rLeg);

    // === ROBLOX R6 BLOCKY TORSO ===
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.set(0, 1.38, 0);
    this.bodyPivot.add(this.torsoGroup);

    const torsoGeo = new THREE.BoxGeometry(0.92, 0.92, 0.46);
    const torsoMesh = new THREE.Mesh(torsoGeo, this.torsoMat);
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    this.torsoGroup.add(torsoMesh);

    const tEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(torsoGeo),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2 })
    );
    torsoMesh.add(tEdges);

    // === ICONIC ROBLOX CYLINDER HEAD ===
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 0.47, 0);
    this.torsoGroup.add(this.headPivot);

    const headCylGeo = new THREE.CylinderGeometry(0.29, 0.29, 0.48, 28);
    const headMesh = new THREE.Mesh(headCylGeo, [
      this.headFaceMat,
      this.yellowSkinMat,
      this.yellowSkinMat
    ]);
    headMesh.position.set(0, 0.29, 0);
    headMesh.castShadow = true;
    this.headPivot.add(headMesh);

    const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.29, 0.06, 28), this.yellowSkinMat);
    topCap.position.set(0, 0.56, 0);
    this.headPivot.add(topCap);

    const botCap = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.23, 0.05, 28), this.yellowSkinMat);
    botCap.position.set(0, 0.025, 0);
    this.headPivot.add(botCap);

    const headStud = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 16), this.yellowSkinMat);
    headStud.position.set(0, 0.60, 0);
    this.headPivot.add(headStud);

    // Equippable 3D Roblox Hat / Head Accessory
    this.hatHolder = new THREE.Group();
    this.headPivot.add(this.hatHolder);
    this.setHat(hatId);

    // === ROBLOX R6 BLOCKY ARMS ===
    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.69, 0.38, 0);
    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.69, 0.38, 0);
    this.torsoGroup.add(this.leftArmPivot, this.rightArmPivot);

    const armGeo = new THREE.BoxGeometry(0.44, 0.92, 0.44);
    const lArm = new THREE.Mesh(armGeo, this.yellowSkinMat);
    lArm.position.set(0, -0.38, 0);
    lArm.castShadow = true;
    this.leftArmPivot.add(lArm);

    const rArm = new THREE.Mesh(armGeo, this.yellowSkinMat);
    rArm.position.set(0, -0.38, 0);
    rArm.castShadow = true;
    this.rightArmPivot.add(rArm);

    // Held 3D Knife
    this.knifeHolder = new THREE.Group();
    this.baseKnifePos = new THREE.Vector3(0, -0.82, -0.18);
    this.knifeHolder.position.copy(this.baseKnifePos);
    this.knifeHolder.scale.setScalar(1.65);
    this.rightArmPivot.add(this.knifeHolder);
    this.setKnifeSkin(skinId);

    // Held gun (gun mode, third person)
    this.gunHolder = new THREE.Group();
    this.gunHolder.position.copy(this.baseKnifePos);
    this.gunHolder.scale.setScalar(0.7); // gun is bulkier than the knife; 1.65 blocked the camera
    this.gunHolder.visible = false;
    this.rightArmPivot.add(this.gunHolder);
    this.setGunModel('gun_pistol');

    // Floating Prop Knife (used during aerial toss & telekinetic levitation emotes!)
    this.propKnifeHolder = new THREE.Group();
    this.propKnifeHolder.scale.setScalar(1.85);
    this.propKnifeHolder.visible = false;
    this.root.add(this.propKnifeHolder);
    this._rebuildPropKnife(skinId);

    // Throw Telegraph Glint Sprite
    const glintMat = new THREE.SpriteMaterial({
      map: createGlintTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.glintSprite = new THREE.Sprite(glintMat);
    this.glintSprite.scale.set(1.9, 1.9, 1.9);
    this.glintSprite.position.set(0, -0.85, -0.38);
    this.glintSprite.visible = false;
    this.rightArmPivot.add(this.glintSprite);

    // Parry Shield Visual Aura
    this.parryAura = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 0.9, 6),
      new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.78
      })
    );
    this.parryAura.position.set(0, 1.4, -0.78);
    this.parryAura.visible = false;
    this.bodyPivot.add(this.parryAura);

    // On-Fire Streak Ring & Victory Spotlight Ring at feet!
    this.streakRing = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 0.92, 24),
      new THREE.MeshBasicMaterial({
        color: 0xffc83b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65
      })
    );
    this.streakRing.rotation.x = -Math.PI / 2;
    this.streakRing.position.set(0, 0.05, 0);
    this.streakRing.visible = false;
    this.root.add(this.streakRing);

    this.animTime = 0;
    this.flashTimer = 0;
    this.headPopTimer = 0;
    this.slashAnim = 0;
    this.slashCombo = 0;

    // Emote State
    this.activeEmote = null;
    this.emoteTime = 0;
    this.winStreak = 0;
  }

  _rebuildPropKnife(skinId, wrapId = this.wrapId) {
    while (this.propKnifeHolder.children.length > 0) {
      this.propKnifeHolder.remove(this.propKnifeHolder.children[0]);
    }
    this.propKnifeMesh = createKnifeMesh(skinId, wrapId);
    this.propKnifeHolder.add(this.propKnifeMesh);
  }

  setGunModel(gunId) {
    while (this.gunHolder.children.length > 0) this.gunHolder.remove(this.gunHolder.children[0]);
    this.gunHolder.add(createGunMesh(gunId).group);
  }

  setKnifeSkin(skinId, wrapId = this.wrapId) {
    this.wrapId = wrapId;
    while (this.knifeHolder.children.length > 0) {
      this.knifeHolder.remove(this.knifeHolder.children[0]);
    }
    this.knifeMesh = createKnifeMesh(skinId, wrapId);
    this.knifeHolder.add(this.knifeMesh);
    if (this.propKnifeHolder) {
      this._rebuildPropKnife(skinId, wrapId);
    }
  }

  setHat(hatId = 'hat_none') {
    while (this.hatHolder.children.length > 0) {
      this.hatHolder.remove(this.hatHolder.children[0]);
    }
    this.hatMesh = createHatMesh(hatId);
    this.hatHolder.add(this.hatMesh);
  }

  setWinStreak(streak) {
    this.winStreak = streak;
    this.streakRing.visible = streak >= 2;
  }

  // RPG emote (Gun Mode only, visual only): rocket goes up, hovers, falls back on the player and explodes
  _ensureRpg() {
    if (this.rpgGroup) return;
    this.rpgGroup = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.5, metalness: 0.4 });
    const red = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.7, 10), steel);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 10), red);
    nose.position.y = 0.45;
    this.rpgFlame = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 8), new THREE.MeshBasicMaterial({ color: 0xffa500 }));
    this.rpgFlame.rotation.x = Math.PI;
    this.rpgFlame.position.y = -0.55;
    this.rpgFlame.visible = false;
    this.rpgGroup.add(body, nose, this.rpgFlame);
    for (let i = 0; i < 3; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.02), red);
      fin.position.set(0, -0.3, 0);
      fin.rotation.y = (i * Math.PI * 2) / 3;
      this.rpgGroup.add(fin);
    }
    this.rpgGroup.visible = false;
    this.root.add(this.rpgGroup);
  }

  _updateRpgEmote(t) {
    this._ensureRpg();
    if (!this.emoteEvents) this.emoteEvents = [];
    const CYCLE = 2.8;
    const tt = t % CYCLE;
    // Impact event once per cycle (main.js spawns the explosion effect)
    if (this._rpgPrevT !== undefined && (tt < this._rpgPrevT)) this._rpgPrevT = -1;
    if (this._rpgPrevT !== undefined && this._rpgPrevT < 1.95 && tt >= 1.95) this.emoteEvents.push({ type: 'rpg_boom' });
    this._rpgPrevT = tt;

    this.knifeHolder.visible = false;
    this.propKnifeHolder.visible = false;
    this.rpgGroup.visible = true;

    // Shoulder aim pose, then the recoil kick
    const aim = smoothstep(0, 0.25, tt) * (1 - smoothstep(0.45, 0.65, tt));
    const kick = Math.sin(Math.min(1, Math.max(0, (tt - 0.35) / 0.2)) * Math.PI) * (tt > 0.35 && tt < 0.55 ? 1 : 0);
    const stagger = smoothstep(1.9, 1.98, tt) * (1 - smoothstep(1.98, 2.5, tt));
    this.bodyPivot.position.set(0, 0, 0);
    this.bodyPivot.rotation.set(-0.12 * kick - 0.3 * stagger, 0, 0);
    this.rightArmPivot.rotation.set(aim * 1.9, 0, -0.25 * aim);
    this.leftArmPivot.rotation.set(aim * 1.6, 0, 0.3 * aim);
    this.leftLegPivot.rotation.set(0, 0, 0);
    this.rightLegPivot.rotation.set(0, 0, 0);

    // Rocket: on the shoulder -> launches up -> hovers -> falls back and explodes at head height
    const shoulder = new THREE.Vector3(0.45, 1.5, 0.15);
    let pos;
    let rotX;
    let visible = true;
    if (tt < 0.35) {
      pos = shoulder.clone();
      rotX = Math.PI / 2;
    } else if (tt < 1.25) {
      const rise = smoothstep(0.35, 0.95, tt);
      pos = new THREE.Vector3(0.45 * (1 - smoothstep(0.35, 0.6, tt)), 1.5 + 4.65 * rise, 0.15 * (1 - rise));
      rotX = Math.PI / 2 * (1 - smoothstep(0.35, 0.5, tt));
      if (tt >= 0.95) pos.y = 6.15 + Math.sin(tt * 8) * 0.03; // hover at apex
      this.rpgFlame.visible = tt >= 0.35;
    } else if (tt < 1.95) {
      const p = (tt - 1.25) / 0.7;
      const fall = p * p; // accelerating drop back toward the head
      pos = new THREE.Vector3(0, 6.15 - (6.15 - 1.9) * fall, 0);
      rotX = Math.PI * smoothstep(1.2, 1.35, tt);
      this.rpgFlame.visible = true;
    } else {
      visible = false;
      pos = new THREE.Vector3(0, 1.9, 0);
      rotX = Math.PI;
      this.rpgFlame.visible = false;
    }
    this.rpgGroup.visible = visible;
    this.rpgGroup.position.copy(pos);
    this.rpgGroup.rotation.set(rotX, 0, 0);
  }

  drainEmoteEvents() {
    const ev = this.emoteEvents || [];
    this.emoteEvents = [];
    return ev;
  }

  playEmote(emoteId = 'blade_flourish') {
    // "mj:<id>" plays a keyframe pack (Armory dance or imported .mj); unknown packs fall back to the default dance
    this.activePack = null;
    let id = emoteId;
    if (typeof id === 'string' && id.startsWith('mj:')) {
      const pack = getPackById(id.slice(3));
      if (pack) this.activePack = pack;
      else id = 'rivals_dance';
    }
    this.activeEmote = id;
    this.emoteTime = 0;
    this._rpgPrevT = undefined;
    if (this.rpgGroup && id !== 'rpg_launch') this.rpgGroup.visible = false;
    this.slashAnim = 0;
    this.glintSprite.visible = false;
    this.parryAura.visible = false;
  }

  stopEmote() {
    if (!this.activeEmote) return;
    this.activeEmote = null;
    this.activePack = null;
    this.emoteTime = 0;
    this.propKnifeHolder.visible = false;
    this.bodyPivot.position.set(0, 0, 0);
    this.bodyPivot.rotation.set(0, 0, 0);
    this.torsoGroup.rotation.set(0, 0, 0);
    this.knifeHolder.position.copy(this.baseKnifePos);
    this.knifeHolder.rotation.set(0, 0, 0);
  }

  triggerHitFlash(isHeadshot = false) {
    this.flashTimer = 0.13;
    const flashHex = isHeadshot ? 0xffd166 : 0xffffff;
    this.allFlashMats.forEach((m) => {
      m.emissive.setHex(flashHex);
      m.emissiveIntensity = isHeadshot ? 0.95 : 0.75;
    });
    if (isHeadshot) {
      this.headPopTimer = 0.2;
    }
  }

  triggerSlashAnim(comboStep = 0) {
    this.stopEmote();
    this.slashCombo = comboStep % 3;
    this.slashAnim = 0.28;
  }

  update(state, dt) {
    this.animTime += dt;

    if (this.hatMesh && this.hatMesh.userData.floatingHalo) {
      this.hatMesh.userData.floatingHalo.position.y = 0.78 + Math.sin(this.animTime * 4.5) * 0.04;
      this.hatMesh.userData.floatingHalo.rotation.z = this.animTime * 1.5;
    }

    if (this.streakRing.visible) {
      const pulse = 1 + Math.sin(this.animTime * 7) * 0.12;
      this.streakRing.scale.set(pulse, pulse, 1);
    }

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.allFlashMats.forEach((m) => {
          m.emissive.setHex(0x000000);
          m.emissiveIntensity = 0;
        });
      }
    }

    if (this.headPopTimer > 0) {
      this.headPopTimer = Math.max(0, this.headPopTimer - dt);
      const s = 1 + Math.sin((this.headPopTimer / 0.2) * Math.PI) * 0.28;
      this.headPivot.scale.set(s, s, s);
    } else {
      this.headPivot.scale.set(1, 1, 1);
    }

    this.root.position.copy(state.pos);
    this.root.rotation.y = state.yaw;

    if (state.dead) {
      this.stopEmote();
      this.knifeHolder.visible = false;
      this.bodyPivot.rotation.x = damp(this.bodyPivot.rotation.x, Math.PI * 0.48, 10, dt);
      this.bodyPivot.position.y = damp(this.bodyPivot.position.y, 0.25, 10, dt);
      this.glintSprite.visible = false;
      this.parryAura.visible = false;
      return;
    }

    // === SMOOTH VICTORY / POINT CELEBRATION EMOTES ===
    if (this.activeEmote) {
      this._updateEmoteAnimation(dt);
      return;
    }

    this.propKnifeHolder.visible = false;
    this.knifeHolder.visible = state.hasKnife !== false && !state.gunMode;
    this.knifeHolder.position.copy(this.baseKnifePos);
    this.knifeHolder.rotation.set(0, 0, 0);
    this.gunHolder.visible = !!state.gunMode;
    this.gunHolder.position.copy(this.baseKnifePos);
    this.gunHolder.rotation.set(0, Math.PI, 0); // barrel forward (character faces +Z)
    this.bodyPivot.rotation.y = damp(this.bodyPivot.rotation.y, 0, 12, dt);
    this.bodyPivot.rotation.z = damp(this.bodyPivot.rotation.z, 0, 12, dt);
    this.bodyPivot.position.x = damp(this.bodyPivot.position.x, 0, 12, dt);
    this.bodyPivot.position.z = damp(this.bodyPivot.position.z, 0, 12, dt);

    if (state.rageTimer > 0) {
      this.streakRing.visible = true;
      this.streakRing.material.color.setHex(0xff2a55);
    } else if (state.chronoTimer > 0) {
      this.streakRing.visible = true;
      this.streakRing.material.color.setHex(0x00f0ff);
    } else {
      this.streakRing.visible = this.winStreak >= 2;
      this.streakRing.material.color.setHex(0xffc83b);
    }

    if (state.vaulting) {
      // Smooth 3rd-Person Parkour Hurdle Vault over wall!
      this.bodyPivot.rotation.x = damp(this.bodyPivot.rotation.x, -0.32, 18, dt);
      this.bodyPivot.rotation.z = damp(this.bodyPivot.rotation.z, 0.42, 18, dt);
      this.bodyPivot.position.y = damp(this.bodyPivot.position.y, 0.25, 18, dt);
      this.leftLegPivot.rotation.x = damp(this.leftLegPivot.rotation.x, 1.05, 18, dt);
      this.rightLegPivot.rotation.x = damp(this.rightLegPivot.rotation.x, 0.85, 18, dt);
      this.leftArmPivot.rotation.x = damp(this.leftArmPivot.rotation.x, -0.95, 18, dt);
      this.rightArmPivot.rotation.x = damp(this.rightArmPivot.rotation.x, 0.85, 18, dt);
      return;
    }

    if (state.sliding) {
      this.bodyPivot.rotation.x = damp(this.bodyPivot.rotation.x, 0.58, 14, dt);
      this.bodyPivot.position.y = damp(this.bodyPivot.position.y, -0.45, 14, dt);
      this.leftLegPivot.rotation.x = damp(this.leftLegPivot.rotation.x, -0.95, 16, dt);
      this.rightLegPivot.rotation.x = damp(this.rightLegPivot.rotation.x, 0.4, 16, dt);
    } else {
      this.bodyPivot.rotation.x = damp(this.bodyPivot.rotation.x, 0, 12, dt);
      this.bodyPivot.position.y = damp(this.bodyPivot.position.y, 0, 12, dt);

      const horizSpeed = Math.hypot(state.vel.x, state.vel.z);
      if (!state.grounded) {
        this.leftLegPivot.rotation.x = damp(this.leftLegPivot.rotation.x, 0.48, 12, dt);
        this.rightLegPivot.rotation.x = damp(this.rightLegPivot.rotation.x, -0.42, 12, dt);
      } else if (horizSpeed > 0.6) {
        const swing = Math.sin(this.animTime * 12.5) * 0.78 * Math.min(1, horizSpeed / 9);
        this.leftLegPivot.rotation.x = damp(this.leftLegPivot.rotation.x, swing, 18, dt);
        this.rightLegPivot.rotation.x = damp(this.rightLegPivot.rotation.x, -swing, 18, dt);
      } else {
        this.leftLegPivot.rotation.x = damp(this.leftLegPivot.rotation.x, 0, 12, dt);
        this.rightLegPivot.rotation.x = damp(this.rightLegPivot.rotation.x, 0, 12, dt);
      }
    }

    this.leftLegPivot.rotation.z = damp(this.leftLegPivot.rotation.z, 0, 12, dt);
    this.rightLegPivot.rotation.z = damp(this.rightLegPivot.rotation.z, 0, 12, dt);
    this.leftArmPivot.rotation.z = damp(this.leftArmPivot.rotation.z, 0.08, 12, dt);
    this.rightArmPivot.rotation.z = damp(this.rightArmPivot.rotation.z, -0.08, 12, dt);

    if (state.stunTimer > 0) {
      this.torsoGroup.rotation.x = damp(this.torsoGroup.rotation.x, -0.35, 14, dt);
      this.rightArmPivot.rotation.set(0.5, 0, -0.95);
      this.leftArmPivot.rotation.set(0.5, 0, 0.95);
      this.glintSprite.visible = false;
      this.parryAura.visible = false;
      return;
    } else {
      this.torsoGroup.rotation.x = damp(this.torsoGroup.rotation.x, 0, 12, dt);
      this.torsoGroup.rotation.y = damp(this.torsoGroup.rotation.y, 0, 12, dt);
    }

    if (state.parryTimer > 0) {
      this.parryAura.visible = true;
      this.parryAura.rotation.z += dt * 8;
      this.rightArmPivot.rotation.set(1.2, 0.4, 0.65);
      this.leftArmPivot.rotation.set(0.85, -0.3, -0.3);
      this.glintSprite.visible = false;
      return;
    } else {
      this.parryAura.visible = false;
    }

    // Charging Throw (Player) or Throw Windup (AI)
    if (state.throwWindup > 0 || state.chargingThrow) {
      this.rightArmPivot.rotation.x = damp(this.rightArmPivot.rotation.x, 2.48, 18, dt);
      this.rightArmPivot.rotation.y = damp(this.rightArmPivot.rotation.y, 0, 18, dt);
      this.leftArmPivot.rotation.x = damp(this.leftArmPivot.rotation.x, 0.72, 18, dt);
      if (state.throwWindup > 0) {
        this.glintSprite.visible = true;
        const pulse = 1.6 + Math.sin(this.animTime * 35) * 0.55;
        this.glintSprite.scale.set(pulse, pulse, pulse);
      } else {
        this.glintSprite.visible = false;
      }
      return;
    } else {
      this.glintSprite.visible = false;
    }

    if (this.slashAnim > 0) {
      this.slashAnim -= dt;
      const p = 1 - Math.max(0, this.slashAnim) / 0.28;
      if (this.slashCombo === 1) {
        this.rightArmPivot.rotation.set(1.3, -0.6 + p * 1.4, 0.35);
      } else if (this.slashCombo === 2) {
        this.rightArmPivot.rotation.set(1.55, 0, 0);
        this.torsoGroup.rotation.y = Math.sin(p * Math.PI) * 0.35;
      } else {
        this.rightArmPivot.rotation.set(1.55 - p * 1.9, 0.55 - p * 1.15, -0.3);
      }
      this.leftArmPivot.rotation.x = damp(this.leftArmPivot.rotation.x, -0.35, 16, dt);
    } else {
      const horizSpeed = Math.hypot(state.vel.x, state.vel.z);
      const armSwing = Math.sin(this.animTime * 12.5) * 0.52 * Math.min(1, horizSpeed / 9);
      this.rightArmPivot.rotation.x = damp(this.rightArmPivot.rotation.x, 0.65 - armSwing * 0.4, 14, dt);
      this.rightArmPivot.rotation.y = damp(this.rightArmPivot.rotation.y, 0.12, 14, dt);
      this.leftArmPivot.rotation.x = damp(this.leftArmPivot.rotation.x, 0.2 + armSwing, 14, dt);
      this.leftArmPivot.rotation.y = damp(this.leftArmPivot.rotation.y, 0, 14, dt);
    }

    this.headPivot.rotation.x = damp(
      this.headPivot.rotation.x,
      THREE.MathUtils.clamp(state.pitch || 0, -0.55, 0.55),
      16,
      dt
    );
    this.headPivot.rotation.y = damp(this.headPivot.rotation.y, 0, 14, dt);
  }

  // Plays a keyframe pack: samples every body part at the current time and eases towards it
  _updateKeyframeEmote(dt) {
    const pack = this.activePack;
    const pose = samplePose(pack, this.emoteTime);
    this.knifeHolder.visible = pack.knife;
    this.knifeHolder.rotation.set(0, 0, 0);
    this.propKnifeHolder.visible = false;
    const targets = {
      body: this.bodyPivot,
      torso: this.torsoGroup,
      head: this.headPivot,
      leftArm: this.leftArmPivot,
      rightArm: this.rightArmPivot,
      leftLeg: this.leftLegPivot,
      rightLeg: this.rightLegPivot
    };
    for (const [name, obj] of Object.entries(targets)) {
      const p = pose[name];
      const rot = (p && p.rot) || [0, 0, 0];
      obj.rotation.x = damp(obj.rotation.x, rot[0], 16, dt);
      obj.rotation.y = damp(obj.rotation.y, rot[1], 16, dt);
      obj.rotation.z = damp(obj.rotation.z, rot[2], 16, dt);
      if (name === 'body') {
        const pos = (p && p.pos) || [0, 0, 0];
        obj.position.x = damp(obj.position.x, pos[0], 16, dt);
        obj.position.y = damp(obj.position.y, pos[1], 16, dt);
        obj.position.z = damp(obj.position.z, pos[2], 16, dt);
      }
    }
  }

  _updateEmoteAnimation(dt) {
    this.emoteTime += dt;
    if (this.activePack) {
      this._updateKeyframeEmote(dt);
      return;
    }
    const t = this.emoteTime;

    if (this.activeEmote === 'blade_flourish') {
      // Phase 1 (0..0.32s): Smooth windup dip
      // Phase 2 (0.32..1.25s): Prop knife flies up 1.55m spinning 1080° while character does a silky 360° pirouette!
      // Phase 3 (1.25s+): Catches knife into a heroic martial-arts pose with calm breathing!
      if (t < 0.32) {
        const p = smoothstep(0, 0.32, t);
        this.knifeHolder.visible = true;
        this.propKnifeHolder.visible = false;
        this.bodyPivot.position.y = damp(this.bodyPivot.position.y, -0.16 * p, 16, dt);
        this.rightArmPivot.rotation.set(damp(this.rightArmPivot.rotation.x, 0.3 + p * 1.6, 18, dt), 0, -0.15);
        this.leftArmPivot.rotation.set(damp(this.leftArmPivot.rotation.x, -0.35, 16, dt), 0, 0.25);
        this.leftLegPivot.rotation.x = damp(this.leftLegPivot.rotation.x, 0.22 * p, 14, dt);
        this.rightLegPivot.rotation.x = damp(this.rightLegPivot.rotation.x, -0.22 * p, 14, dt);
      } else if (t < 1.25) {
        const u = (t - 0.32) / (1.25 - 0.32); // 0..1
        const spinEase = smoothstep(0, 1, u);
        this.knifeHolder.visible = false;
        this.propKnifeHolder.visible = true;

        // Parabolic toss arc from y=1.8 up to y=3.35 and back to y=1.65!
        const arcH = Math.sin(u * Math.PI) * 1.55;
        this.propKnifeHolder.position.set(0.35 * (1 - u * 0.3), 1.68 + arcH, -0.38);
        this.propKnifeHolder.rotation.set(u * Math.PI * 6, 0.3, 0);

        // Smooth 360° Roblox pirouette + slight hop!
        this.bodyPivot.rotation.y = spinEase * Math.PI * 2;
        this.bodyPivot.position.y = Math.sin(u * Math.PI) * 0.28;
        this.rightArmPivot.rotation.set(1.65, 0, -0.65 * Math.sin(u * Math.PI));
        this.leftArmPivot.rotation.set(1.1, 0, 0.75 * Math.sin(u * Math.PI));
        this.leftLegPivot.rotation.x = damp(this.leftLegPivot.rotation.x, 0.15, 12, dt);
        this.rightLegPivot.rotation.x = damp(this.rightLegPivot.rotation.x, -0.15, 12, dt);
      } else {
        // Heroic catch & confident pose!
        const settle = t - 1.25;
        const breathe = Math.sin(settle * 3.5) * 0.035;
        this.knifeHolder.visible = true;
        this.propKnifeHolder.visible = false;
        this.bodyPivot.rotation.y = damp(this.bodyPivot.rotation.y, Math.PI * 2, 14, dt);
        this.bodyPivot.position.y = damp(this.bodyPivot.position.y, -0.06 + breathe, 12, dt);
        this.torsoGroup.rotation.y = damp(this.torsoGroup.rotation.y, -0.32, 12, dt);

        // Right arm presents glowing blade diagonally across chest; left arm behind back
        this.rightArmPivot.rotation.x = damp(this.rightArmPivot.rotation.x, 1.32 + breathe, 14, dt);
        this.rightArmPivot.rotation.y = damp(this.rightArmPivot.rotation.y, 0.48, 14, dt);
        this.rightArmPivot.rotation.z = damp(this.rightArmPivot.rotation.z, 0.38, 14, dt);
        this.knifeHolder.rotation.z = damp(this.knifeHolder.rotation.z, Math.PI * 0.25, 14, dt);

        this.leftArmPivot.rotation.x = damp(this.leftArmPivot.rotation.x, -0.45, 12, dt);
        this.leftArmPivot.rotation.z = damp(this.leftArmPivot.rotation.z, 0.22, 12, dt);

        this.leftLegPivot.rotation.x = damp(this.leftLegPivot.rotation.x, 0.18, 12, dt);
        this.rightLegPivot.rotation.x = damp(this.rightLegPivot.rotation.x, -0.22, 12, dt);
        this.headPivot.rotation.y = damp(this.headPivot.rotation.y, 0.28, 12, dt);
        this.headPivot.rotation.x = damp(this.headPivot.rotation.x, Math.sin(settle * 4) * 0.08, 10, dt);
      }
    } else if (this.activeEmote === 'backflip_pose') {
      this.knifeHolder.visible = true;
      this.propKnifeHolder.visible = false;

      if (t < 0.24) {
        // Anticipation crouch
        const p = smoothstep(0, 0.24, t);
        this.bodyPivot.position.set(0, -0.24 * p, 0);
        this.bodyPivot.rotation.set(0.22 * p, 0, 0);
        this.rightArmPivot.rotation.set(-0.6 * p, 0, -0.15);
        this.leftArmPivot.rotation.set(-0.6 * p, 0, 0.15);
        this.leftLegPivot.rotation.x = 0.45 * p;
        this.rightLegPivot.rotation.x = 0.45 * p;
      } else if (t < 1.02) {
        // Center-of-mass aerial 360° backflip!
        const u = (t - 0.24) / (1.02 - 0.24);
        const theta = -smoothstep(0, 1, u) * Math.PI * 2;
        const jumpH = Math.sin(u * Math.PI) * 1.55;
        const Hc = 1.2;

        this.bodyPivot.position.y = Hc * (1 - Math.cos(theta)) + jumpH;
        this.bodyPivot.position.z = -Hc * Math.sin(theta);
        this.bodyPivot.rotation.x = theta;

        // Tuck knees & arms cleanly in mid-air
        const tuck = Math.sin(u * Math.PI);
        this.leftLegPivot.rotation.x = 0.85 * tuck;
        this.rightLegPivot.rotation.x = 0.85 * tuck;
        this.rightArmPivot.rotation.set(1.8 * tuck, 0, -0.2);
        this.leftArmPivot.rotation.set(1.8 * tuck, 0, 0.2);
      } else if (t < 1.55) {
        // Superhero 3-point knee landing!
        this.bodyPivot.rotation.x = damp(this.bodyPivot.rotation.x, 0.35, 16, dt);
        this.bodyPivot.position.y = damp(this.bodyPivot.position.y, -0.34, 16, dt);
        this.bodyPivot.position.z = damp(this.bodyPivot.position.z, 0, 16, dt);
        this.leftLegPivot.rotation.x = damp(this.leftLegPivot.rotation.x, -0.85, 16, dt);
        this.rightLegPivot.rotation.x = damp(this.rightLegPivot.rotation.x, 0.65, 16, dt);
        this.rightArmPivot.rotation.set(damp(this.rightArmPivot.rotation.x, 1.05, 16, dt), 0, -0.35);
        this.leftArmPivot.rotation.set(damp(this.leftArmPivot.rotation.x, -0.5, 16, dt), 0, 0.5);
        this.headPivot.rotation.x = damp(this.headPivot.rotation.x, -0.25, 14, dt);
      } else {
        // Rise tall & raise knife skyward!
        const breathe = Math.sin((t - 1.55) * 3.5) * 0.03;
        this.bodyPivot.rotation.x = damp(this.bodyPivot.rotation.x, 0, 10, dt);
        this.bodyPivot.position.y = damp(this.bodyPivot.position.y, breathe, 10, dt);
        this.bodyPivot.position.z = damp(this.bodyPivot.position.z, 0, 10, dt);
        this.leftLegPivot.rotation.x = damp(this.leftLegPivot.rotation.x, 0.1, 10, dt);
        this.rightLegPivot.rotation.x = damp(this.rightLegPivot.rotation.x, -0.1, 10, dt);
        this.rightArmPivot.rotation.set(damp(this.rightArmPivot.rotation.x, 2.78, 12, dt), 0, -0.18);
        this.leftArmPivot.rotation.set(damp(this.leftArmPivot.rotation.x, 0.25, 12, dt), 0, 0.28);
        this.headPivot.rotation.x = damp(this.headPivot.rotation.x, -0.15, 10, dt);
      }
    } else if (this.activeEmote === 'levitate_zen') {
      // Smooth telekinetic hover + orbiting 3D knife!
      const lift = smoothstep(0, 0.55, t);
      const hover = lift * (0.82 + Math.sin(t * 3.2) * 0.12);
      this.bodyPivot.position.set(0, hover, 0);
      this.bodyPivot.rotation.set(damp(this.bodyPivot.rotation.x, -0.06, 10, dt), Math.sin(t * 1.4) * 0.18, 0);

      // Crossed floating legs & calm open palms
      this.leftLegPivot.rotation.set(damp(this.leftLegPivot.rotation.x, 0.65, 10, dt), 0, -0.35 * lift);
      this.rightLegPivot.rotation.set(damp(this.rightLegPivot.rotation.x, 0.65, 10, dt), 0, 0.35 * lift);
      this.rightArmPivot.rotation.set(damp(this.rightArmPivot.rotation.x, 1.05, 10, dt), 0.3, -0.45);
      this.leftArmPivot.rotation.set(damp(this.leftArmPivot.rotation.x, 1.05, 10, dt), -0.3, 0.45);

      // Telekinetically orbiting knife in front of character!
      this.knifeHolder.visible = false;
      this.propKnifeHolder.visible = true;
      const orbitAngle = t * 4.2;
      this.propKnifeHolder.position.set(
        Math.cos(orbitAngle) * 0.68,
        1.45 + hover + Math.sin(t * 5) * 0.08,
        -0.65 + Math.sin(orbitAngle) * 0.32
      );
      this.propKnifeHolder.rotation.set(0.4, orbitAngle + Math.PI / 2, t * 8);
    } else if (this.activeEmote === 'cinema_freeze') {
      // Snap into a 'frame' pose, then slow-motion breathing
      this.knifeHolder.visible = true;
      this.propKnifeHolder.visible = false;
      const snap = smoothstep(0, 0.25, t);
      this.bodyPivot.position.set(0, -0.05 * snap + Math.sin(t * 1.2) * 0.015, 0);
      this.bodyPivot.rotation.set(-0.12 * snap, 0, 0);
      // Two raised hands framing the shot (the Absolute Cinema pose)
      this.rightArmPivot.rotation.set(2.6 * snap, 0, -0.35 * snap);
      this.leftArmPivot.rotation.set(2.6 * snap, 0, 0.35 * snap);
      this.leftLegPivot.rotation.set(0.12 * snap, 0, 0);
      this.rightLegPivot.rotation.set(-0.12 * snap, 0, 0);
      this.knifeHolder.rotation.set(0, 0, 0);
    } else if (this.activeEmote === 'disco_robot') {
      // Sharp robot pops: the pose flips on every beat
      this.knifeHolder.visible = true;
      this.propKnifeHolder.visible = false;
      const beatIndex = Math.floor(t * 4);
      const side = beatIndex % 2 === 0 ? 1 : -1;
      const pop = smoothstep(0, 0.08, (t * 4) % 1);
      this.bodyPivot.position.set(0, 0, 0);
      this.bodyPivot.rotation.set(0, side * 0.35 * pop, 0);
      this.rightArmPivot.rotation.set(damp(this.rightArmPivot.rotation.x, side > 0 ? 1.6 : -0.2, 30, dt), 0, -0.4);
      this.leftArmPivot.rotation.set(damp(this.leftArmPivot.rotation.x, side > 0 ? -0.2 : 1.6, 30, dt), 0, 0.4);
      this.leftLegPivot.rotation.set(0.25 * pop * side, 0, 0);
      this.rightLegPivot.rotation.set(-0.25 * pop * side, 0, 0);
      this.knifeHolder.rotation.set(0, 0, 0);
    } else if (this.activeEmote === 'orbit_shuffle') {
      // Side shuffle while the prop knife orbits the head
      this.knifeHolder.visible = false;
      this.propKnifeHolder.visible = true;
      const sh = Math.sin(t * 5.5);
      this.bodyPivot.position.set(sh * 0.22, Math.abs(sh) * 0.06, 0);
      this.bodyPivot.rotation.set(0, sh * 0.2, sh * -0.12);
      this.leftLegPivot.rotation.set(sh * 0.35, 0, 0);
      this.rightLegPivot.rotation.set(-sh * 0.35, 0, 0);
      this.rightArmPivot.rotation.set(0.6, 0, -0.9);
      this.leftArmPivot.rotation.set(0.6, 0, 0.9);
      const oa = t * 5;
      this.propKnifeHolder.position.set(Math.cos(oa) * 0.7, 1.6 + Math.sin(t * 9) * 0.05, Math.sin(oa) * 0.7);
      this.propKnifeHolder.rotation.set(0.3, oa, 0);
    } else if (this.activeEmote === 'rpg_launch') {
      this._updateRpgEmote(t);
    } else if (this.activeEmote === 'drum_flex') {
      // Alternating flexes on a bouncing beat
      this.knifeHolder.visible = true;
      this.propKnifeHolder.visible = false;
      const hit = Math.sin(t * 8);
      const up = Math.max(0, hit);
      const down = Math.max(0, -hit);
      this.bodyPivot.position.set(0, Math.abs(hit) * 0.07, 0);
      this.bodyPivot.rotation.set(0, 0, 0);
      this.rightArmPivot.rotation.set(0.4 + up * 2.2, 0, -0.5);
      this.leftArmPivot.rotation.set(0.4 + down * 2.2, 0, 0.5);
      this.leftLegPivot.rotation.set(0, 0, 0.15);
      this.rightLegPivot.rotation.set(0, 0, -0.15);
      this.knifeHolder.rotation.set(0, 0, 0);
    } else {
      // 'rivals_dance' — Smooth rhythmic Roblox R6 Victory Groove!
      this.knifeHolder.visible = true;
      this.propKnifeHolder.visible = false;
      const beat = t * 7.5;
      const bounce = Math.abs(Math.sin(beat)) * 0.16;
      const sway = Math.sin(beat * 0.5) * 0.24;

      this.bodyPivot.position.set(sway, bounce - 0.05, 0);
      this.bodyPivot.rotation.set(0, Math.sin(beat * 0.5) * 0.28, Math.sin(beat * 0.5) * -0.08);
      this.rightArmPivot.rotation.set(1.45 + Math.sin(beat) * 0.65, 0.2, -0.35);
      this.leftArmPivot.rotation.set(1.45 - Math.sin(beat) * 0.65, -0.2, 0.35);
      this.knifeHolder.rotation.x = t * 12;
      this.leftLegPivot.rotation.x = Math.sin(beat) * 0.48;
      this.rightLegPivot.rotation.x = -Math.sin(beat) * 0.48;
      this.headPivot.rotation.y = Math.sin(beat * 0.5) * 0.25;
    }
  }

  getHeadWorldCenter(target = new THREE.Vector3()) {
    return target.set(
      this.root.position.x + this.bodyPivot.position.x,
      this.root.position.y + 2.14 + this.bodyPivot.position.y,
      this.root.position.z + this.bodyPivot.position.z
    );
  }

  getChestWorldCenter(target = new THREE.Vector3()) {
    return target.set(
      this.root.position.x + this.bodyPivot.position.x,
      this.root.position.y + 1.38 + this.bodyPivot.position.y,
      this.root.position.z + this.bodyPivot.position.z
    );
  }

  dispose() {
    this.scene.remove(this.root);
  }
}
