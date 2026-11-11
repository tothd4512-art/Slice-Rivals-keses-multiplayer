import * as THREE from 'three';
import { createKnifeMesh, getSkinById } from './skins.js';
import { getKnifeTrailById } from './cosmetics.js';
import { sfx } from './audio.js';

// ================= v5 THROW BALANCE =================
// Normal: body 75–100 (charged), headshot 150
// Ranked: body 36–50 (linear scale of the Normal body range), headshot 78
export const NORMAL_HEADSHOT_DAMAGE = 150;
export const RANKED_HEADSHOT_DAMAGE = 78;

export function rankedBodyDamage(raw) {
  const v = 36 + (raw - 75) * (14 / 25);
  return Math.max(1, Math.round(v));
}

export class ProjectileManager {
  constructor(scene, particles) {
    this._fires = [];
    this._combatants = [];
    this._player = null;
    this.scene = scene;
    this.particles = particles;
    this.knives = [];
    this.raycaster = new THREE.Raycaster();
  }

  /**
   * Spawns one thrown knife. Multiple knives may be airborne at the same time
   * (rapid Ranked throws, Triple Fan, Sorozat-Késdobás). Each knife owns its own
   * meshes/trail and is removed through the dead-flag sweep, so no index bookkeeping
   * can break when several knives die in the same frame.
   *
   * @param {number}  damage      raw body damage before ranked scaling / powerMult
   * @param {boolean} rankedThrow true when thrown by the player in a Ranked match
   * @param {number}  powerMult   1.0 normal, 1.5 Rage, 1.25 Chrono, product when stacked
   */
  spawnThrownKnife({
    ownerId = 'player',
    team = 'blue',
    origin,
    direction,
    speed,
    damage,
    skinId,
    wrapId = null,
    trailId = 'trail_skin',
    charged = false,
    rankedThrow = false,
    powerMult = 1.0,
    burst = false,
    ghost = false
  }) {
    const skin = getSkinById(skinId);
    const trailCfg = getKnifeTrailById(trailId);

    const holder = new THREE.Group();
    holder.position.copy(origin);
    holder.lookAt(origin.clone().add(direction));

    const spinGroup = new THREE.Group();
    holder.add(spinGroup);

    const mesh = createKnifeMesh(skinId, wrapId, { single: true });
    mesh.rotation.y = Math.PI;
    mesh.scale.setScalar(1.75);
    spinGroup.add(mesh);
    this.scene.add(holder);

    // Ribbon trail (12 smooth segments)
    const trailCount = 12;
    const trailHistory = [];
    for (let i = 0; i < trailCount; i++) {
      trailHistory.push(origin.clone());
    }
    const trailPositions = new Float32Array((trailCount - 1) * 6 * 3);
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));

    let initColor = skin.trailColor;
    if (ownerId !== 'player' && trailId === 'trail_skin') {
      initColor = team === 'blue' ? 0x00f0ff : 0xff2a55;
    } else if (trailCfg.color !== null) {
      initColor = trailCfg.color;
    }

    const trailMat = new THREE.MeshBasicMaterial({
      color: initColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: charged || trailCfg.widthScale > 1.1 || powerMult > 1 ? 0.86 : 0.6,
      depthWrite: false
    });
    const trailMesh = new THREE.Mesh(trailGeo, trailMat);
    trailMesh.frustumCulled = false;
    this.scene.add(trailMesh);

    // Pickup ring for player's stuck knife
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75
    });
    const pickupRing = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.62, 24), ringMat);
    pickupRing.rotation.x = -Math.PI / 2;
    pickupRing.visible = false;
    this.scene.add(pickupRing);

    const knifeObj = {
      kind: skin.type,
      ghost, // visual-only copy of another player's knife (multiplayer): never deals damage here
      ownerId,
      originalOwnerId: ownerId,
      skinId, // enemy knives unlock this skin when picked up
      team,
      pos: origin.clone(),
      vel: direction.clone().normalize().multiplyScalar(speed),
      damage,
      charged,
      rankedThrow,
      powerMult,
      burst,
      skinType: skin.type,
      bounces: 0,
      fuse: -1,
      deflected: false,
      stuck: false,
      dead: false,
      age: 0,
      sparkAcc: 0,
      trailCfg,
      holder,
      spinGroup,
      spinRate: 62, // fast spin-up on release, then settles to a steady tumble
      // Visual smoothing: the drawn knife eases toward the simulated pose (no frame-time jitter)
      visPos: origin.clone(),
      visQuat: holder.quaternion.clone(),
      targetQuat: new THREE.Quaternion(),
      trailHistory,
      trailGeo,
      trailMat,
      trailMesh,
      pickupRing,
      ringMat
    };

    // Grappling hook: a chain line from the thrower to the flying hook (player throws only)
    if (skin.type === 'grapple' && ownerId === 'player') {
      const chainGeo = new THREE.BufferGeometry();
      chainGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      knifeObj.chain = new THREE.Line(chainGeo, new THREE.LineBasicMaterial({ color: 0xa78bfa }));
      knifeObj.chain.frustumCulled = false;
      this.scene.add(knifeObj.chain);
    }

    this.knives.push(knifeObj);
    return knifeObj;
  }

  /** Count of player-owned knives currently in the world (flying or stuck). */
  getPlayerKnifeCount() {
    let n = 0;
    for (const k of this.knives) {
      if (!k.dead && k.originalOwnerId === 'player') n++;
    }
    return n;
  }

  removePlayerStuckKnives() {
    for (const k of this.knives) {
      if (k.stuck && k.originalOwnerId === 'player') k.dead = true;
    }
    this._sweepDead();
  }

  _markDead(k) {
    k.dead = true;
  }

  _sweepDead() {
    for (let i = this.knives.length - 1; i >= 0; i--) {
      if (this.knives[i].dead) this._destroyKnife(i);
    }
  }

  _removeChain(k) {
    if (!k.chain) return;
    this.scene.remove(k.chain);
    k.chain.geometry.dispose();
    k.chain.material.dispose();
    k.chain = null;
  }

  _destroyKnife(idx) {
    const k = this.knives[idx];
    this._removeChain(k);
    this.scene.remove(k.holder);
    this.scene.remove(k.trailMesh);
    this.scene.remove(k.pickupRing);
    k.trailGeo.dispose();
    k.trailMat.dispose();
    k.pickupRing.geometry.dispose();
    k.ringMat.dispose();
    this.knives.splice(idx, 1);
  }

  _updateTrailGeometry(k) {
    const hist = k.trailHistory;
    const posArr = k.trailGeo.attributes.position.array;
    const baseHalf = k.deflected ? 0.14 : 0.088 * (k.trailCfg.widthScale || 1.0);
    let ptr = 0;

    for (let i = 0; i < hist.length - 1; i++) {
      const p0 = hist[i];
      const p1 = hist[i + 1];
      const taper0 = 1 - i / hist.length;
      const taper1 = 1 - (i + 1) / hist.length;
      const w0 = baseHalf * taper0;
      const w1 = baseHalf * taper1;

      posArr[ptr++] = p0.x; posArr[ptr++] = p0.y + w0; posArr[ptr++] = p0.z;
      posArr[ptr++] = p0.x; posArr[ptr++] = p0.y - w0; posArr[ptr++] = p0.z;
      posArr[ptr++] = p1.x; posArr[ptr++] = p1.y + w1; posArr[ptr++] = p1.z;

      posArr[ptr++] = p0.x; posArr[ptr++] = p0.y - w0; posArr[ptr++] = p0.z;
      posArr[ptr++] = p1.x; posArr[ptr++] = p1.y - w1; posArr[ptr++] = p1.z;
      posArr[ptr++] = p1.x; posArr[ptr++] = p1.y + w1; posArr[ptr++] = p1.z;
    }
    k.trailGeo.attributes.position.needsUpdate = true;
  }

  /** Final damage for a knife hitting a bot / dojo target (after Ranked + powerMult). */
  _computeTargetDamage(k, { headshot, legsCloser }) {
    if (headshot) {
      return Math.round((k.rankedThrow ? RANKED_HEADSHOT_DAMAGE : NORMAL_HEADSHOT_DAMAGE) * k.powerMult);
    }
    let base = legsCloser ? Math.round(k.damage * 0.85) : k.damage;
    if (k.burst) {
      // Salvo knives: 10 × 5 = half of a full health bar; Ranked halves the body damage like the normal curve
      if (k.rankedThrow) base = k.damage * 0.5;
    } else if (k.rankedThrow) {
      base = rankedBodyDamage(base);
    }
    return Math.max(1, Math.round(base * k.powerMult));
  }

  update(dt, { arena, player, playerTeam = 'blue', combatants = [], callbacks, rankedMode = false }) {
    this._player = player;
    this._combatants = combatants;
    this._updateFires(dt, callbacks);
    const prevPos = new THREE.Vector3();
    const stepVec = new THREE.Vector3();
    const headCenter = new THREE.Vector3();
    const chestCenter = new THREE.Vector3();

    for (let i = this.knives.length - 1; i >= 0; i--) {
      const k = this.knives[i];
      if (k.dead) continue;
      k.age += dt;

      if (k.stuck) {
        this._removeChain(k);
        k.trailMat.opacity = Math.max(0, k.trailMat.opacity - dt * 3.5);

        // Only ENEMY knives can be picked up (own knives stay on the map and expire).
        // Picking one up unlocks its skin in the profile ("Owned"), usable from the Armory.
        const isEnemyKnife = k.originalOwnerId !== 'player' && k.team !== playerTeam && k.team !== 'dojo_targets';
        if (isEnemyKnife && !player.dead) {
          k.pickupRing.visible = true;
          const s = 1 + Math.sin(k.age * 9) * 0.18;
          k.pickupRing.scale.set(s, s, 1);

          const dx = player.pos.x - k.pos.x;
          const dz = player.pos.z - k.pos.z;
          const dy = player.pos.y + 1.0 - k.pos.y;
          if (dx * dx + dz * dz < 2.5 * 2.5 && Math.abs(dy) < 2.5) {
            callbacks.onPickupEnemyKnife({ pos: k.pos, skinId: k.skinId });
            this._markDead(k);
            continue;
          }
        } else {
          k.pickupRing.visible = false;
        }

        if (k.age > 4.5) {
          this._markDead(k);
        }
        continue;
      }

      // Flying state: subtle gravity + rapid blade spin
      prevPos.copy(k.pos);
      if (k.skinType === 'homing' && !k.deflected && !k.ghost) {
        this._steerHoming(k, combatants, dt);
      } else {
        k.vel.y -= 5.8 * dt;
      }
      k.pos.addScaledVector(k.vel, dt);

      k.holder.position.copy(k.pos);
      k.holder.lookAt(k.pos.clone().add(k.vel));
      k.targetQuat.copy(k.holder.quaternion);
      const aSmooth = 1 - Math.exp(-dt * 40);
      k.visPos.lerp(k.pos, aSmooth);
      k.visQuat.slerp(k.targetQuat, aSmooth);
      k.holder.position.copy(k.visPos);
      k.holder.quaternion.copy(k.visQuat);
      k.spinRate += (34 - k.spinRate) * (1 - Math.exp(-dt * 2.5));
      k.spinGroup.rotation.x -= dt * k.spinRate;
      k.spinGroup.rotation.z += dt * k.spinRate * 0.22; // wobble so the spin reads from every angle

      if (k.chain) {
        const cp = k.chain.geometry.attributes.position;
        cp.setXYZ(0, player.pos.x, player.pos.y + 1.2, player.pos.z);
        cp.setXYZ(1, k.pos.x, k.pos.y, k.pos.z);
        cp.needsUpdate = true;
      }

      // Dynamic Rainbow / Trail Sparks!
      if (!k.deflected && k.trailCfg.rainbow) {
        k.trailMat.color.setHSL((k.age * 2.6) % 1, 1.0, 0.58);
      }
      if (k.trailCfg.sparkColor) {
        k.sparkAcc += dt;
        if (k.sparkAcc >= 0.035) {
          k.sparkAcc = 0;
          const spCol = k.trailCfg.rainbow
            ? new THREE.Color().setHSL((k.age * 2.6 + 0.2) % 1, 1.0, 0.6).getHex()
            : k.trailCfg.sparkColor;
          this.particles.spawnSparks(k.pos, spCol, 2, 2.8);
        }
      }

      for (let t = k.trailHistory.length - 1; t > 0; t--) {
        k.trailHistory[t].copy(k.trailHistory[t - 1]);
      }
      k.trailHistory[0].copy(k.visPos);
      this._updateTrailGeometry(k);

      // 1) Mid-air knife vs knife clash check (flag-based: safe with many airborne knives)
      let clashed = false;
      for (let j = i - 1; j >= 0; j--) {
        const other = this.knives[j];
        if (other.dead || other.stuck || !!other.ghost !== !!k.ghost) continue;
        if (other.team !== k.team && k.pos.distanceToSquared(other.pos) < 0.72 * 0.72) {
          const mid = k.pos.clone().lerp(other.pos, 0.5);
          this.particles.spawnSparks(mid, 0xffd166, 24, 10);
          this.particles.spawnShockwave(mid, 0xffffff, 2.2);
          this.particles.spawnFloatingText(mid, '⚔️ BLADE CLASH!', '#ffd166', true);
          sfx.playParrySuccess(false);
          this._markDead(k);
          this._markDead(other);
          clashed = true;
          break;
        }
      }
      if (clashed) continue;

      // 2) Hit / Parry check against ALL opposing Combatants!
      let hitSomeone = false;
      for (const target of (k.ghost ? [] : combatants)) {
        if (target.state.dead || target.team === k.team || target.id === k.ownerId) continue;

        if (target.isPlayer) {
          const playerEyeY = player.sliding ? player.pos.y + 0.95 : player.pos.y + 1.62;
          const playerHead = new THREE.Vector3(player.pos.x, playerEyeY, player.pos.z);
          const playerTorso = new THREE.Vector3(player.pos.x, player.pos.y + (player.sliding ? 0.6 : 1.05), player.pos.z);

          const distParryZone = distanceSegmentToPoint(prevPos, k.pos, playerHead);
          if (player.parryTimer > 0 && distParryZone < 1.8) {
            const prevThrowerId = k.ownerId;
            k.ownerId = 'player';
            k.team = playerTeam;
            k.deflected = true;
            // A deflected knife is now the player's throw: Ranked rules apply to it too
            k.rankedThrow = !!rankedMode;
            k.damage = 125;
            k.trailMat.color.setHex(0xffd166);
            k.trailMat.opacity = 1.0;

            // Find original thrower or nearest living enemy to home back onto!
            let aimTarget = combatants.find((c) => c.id === prevThrowerId && !c.state.dead);
            if (!aimTarget) {
              aimTarget = combatants.find((c) => !c.isPlayer && c.team !== playerTeam && !c.state.dead);
            }
            if (aimTarget && aimTarget.char) {
              aimTarget.char.getChestWorldCenter(chestCenter);
              chestCenter.addScaledVector(aimTarget.state.vel, 0.14);
              k.vel.copy(chestCenter.sub(k.pos).normalize().multiplyScalar(46));
            } else {
              // Reflect along player look direction!
              const look = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ'));
              k.vel.copy(look.multiplyScalar(46));
            }

            callbacks.onPlayerDeflect(k.pos.clone());
            hitSomeone = true;
            break;
          }

          const distHead = distanceSegmentToPoint(prevPos, k.pos, playerHead);
          const distBody = distanceSegmentToPoint(prevPos, k.pos, playerTorso);
          if (distHead < 0.44 || distBody < 0.58) {
            const isHeadshot = distHead < 0.44;
            callbacks.onHitCombatant({
              kind: k.kind,
              attackerId: k.ownerId,
              victim: target,
              damage: isHeadshot ? Math.round(k.damage * 1.3) : k.damage,
              headshot: isHeadshot,
              deflected: k.deflected,
              method: k.deflected ? 'deflect' : 'throw',
              hitPos: k.pos.clone()
            });
            this._impactEffects(k, callbacks);
            this._markDead(k);
            hitSomeone = true;
            break;
          }
        } else {
          // AI Bot or Dojo Target!
          target.char.getHeadWorldCenter(headCenter);
          target.char.getChestWorldCenter(chestCenter);
          const legsCenter = new THREE.Vector3(chestCenter.x, chestCenter.y - 0.75, chestCenter.z);

          const distHead = distanceSegmentToPoint(prevPos, k.pos, headCenter);
          const distBody = distanceSegmentToPoint(prevPos, k.pos, chestCenter);
          const distLegs = distanceSegmentToPoint(prevPos, k.pos, legsCenter);

          if (distHead < 0.44 || distBody < 0.65 || distLegs < 0.52) {
            if (target.state.parryTimer > 0 && !k.deflected) {
              const prevAttacker = combatants.find((c) => c.id === k.ownerId && !c.state.dead);
              k.ownerId = target.id;
              k.team = target.team;
              k.deflected = true;
              k.rankedThrow = false;
              k.damage = 95;
              k.trailMat.color.setHex(0xff2a55);
              k.trailMat.opacity = 0.95;

              const bounceTo = prevAttacker
                ? new THREE.Vector3(prevAttacker.state.pos.x, prevAttacker.state.pos.y + 1.45, prevAttacker.state.pos.z)
                : k.pos.clone().sub(k.vel);
              k.vel.copy(bounceTo.sub(k.pos).normalize().multiplyScalar(34));

              this.particles.spawnSparks(k.pos, 0x00f0ff, 20, 8);
              this.particles.spawnShockwave(k.pos, 0x00f0ff, 2.2);
              this.particles.spawnFloatingText(k.pos, 'PARRIED!', '#00f0ff', true);
              sfx.playParrySuccess(true);
              hitSomeone = true;
              break;
            }

            const isHeadshot = distHead < 0.44 && distHead <= distBody + 0.08;
            const legsCloser = distLegs < distBody && !isHeadshot;
            const finalDmg = this._computeTargetDamage(k, { headshot: isHeadshot, legsCloser });

            callbacks.onHitCombatant({
              kind: k.kind,
              attackerId: k.ownerId,
              victim: target,
              damage: finalDmg,
              headshot: isHeadshot,
              deflected: k.deflected,
              method: k.deflected ? 'deflect' : 'throw',
              hitPos: isHeadshot ? headCenter.clone() : k.pos.clone()
            });
            this._impactEffects(k, callbacks);
            this._markDead(k);
            hitSomeone = true;
            break;
          }
        }
      }
      if (hitSomeone) continue;

      // 3) World geometry raycast
      stepVec.subVectors(k.pos, prevPos);
      const stepLen = stepVec.length();
      if (stepLen > 0.0001) {
        this.raycaster.set(prevPos, stepVec.clone().normalize());
        this.raycaster.far = stepLen + 0.25;
        const hits = this.raycaster.intersectObjects(arena.worldMeshes, false);
        if (hits.length > 0) {
          const hit = hits[0];
          const dirNorm = stepVec.clone().normalize();
          if (k.skinType === 'ricochet' && k.bounces < 2 && hit.face) {
            this._bounce(k, hit, combatants);
            continue;
          }
          // Hunter Hawk: bounces off walls and keeps homing (it only sticks after 5 wall hits)
          if (k.skinType === 'homing' && k.bounces < 5 && hit.face) {
            this._bounce(k, hit, combatants, { restitution: 0.6, retarget: false, minSpeed: 20 });
            continue;
          }
          k.pos.copy(hit.point);
          k.holder.position.copy(hit.point).addScaledVector(dirNorm, -0.14);
          k.spinGroup.rotation.set(0, 0, 0);
          k.stuck = true;
          k.age = 0;
          if (k.skinType === 'c4') k.fuse = 1.6;
          if (k.skinType === 'fire' && !k.ghost) this._spawnFireZone(hit.point, k.ownerId, k.team);

          k.pickupRing.position.set(hit.point.x, Math.max(0.06, hit.point.y + 0.05), hit.point.z);
          this.particles.spawnSparks(hit.point, 0xe2e8f0, 9, 5);
          sfx.playKnifeStick();
          continue;
        }
      }

      if (k.age > 6.0 || k.pos.y < -10) {
        this._markDead(k);
      }
    }

    // C4 fuses and blink
    for (const k of this.knives) {
      if (k.dead || !k.stuck || !(k.fuse > 0)) continue;
      k.fuse -= dt;
      if (k.ringMat) k.ringMat.color.setHex(Math.floor(k.fuse * 8) % 2 ? 0xff2a2a : 0xffffff);
      if (k.fuse <= 0) this._explode(k, callbacks);
    }

    this._sweepDead();
  }

  // ---- Trick knives (ricochet, homing, C4, fire) ----
  _combatantCenter(target, out) {
    if (target.isPlayer) return out.set(this._player.pos.x, this._player.pos.y + 1.05, this._player.pos.z);
    target.char.getChestWorldCenter(out);
    return out;
  }

  _nearestEnemy(k, combatants, maxDist, from) {
    let best = null;
    let bestD = maxDist * maxDist;
    const c = new THREE.Vector3();
    for (const t of combatants) {
      if (t.state.dead || t.team === k.team) continue;
      this._combatantCenter(t, c);
      const d = c.distanceToSquared(from);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  _steerHoming(k, combatants, dt) {
    const target = this._nearestEnemy(k, combatants, 30, k.pos);
    if (!target) return;
    const speed = k.vel.length();
    const desired = this._combatantCenter(target, new THREE.Vector3()).sub(k.pos).normalize();
    k.vel.lerp(desired.multiplyScalar(speed), 1 - Math.exp(-dt * 2.4));
    if (k.vel.lengthSq() > 1e-6) k.vel.setLength(speed);
  }

  _bounce(k, hit, combatants, { restitution = 0.85, retarget = true, minSpeed = 26 } = {}) {
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    const speed = k.vel.length();
    k.vel.addScaledVector(n, -2 * k.vel.dot(n)).multiplyScalar(restitution);
    if (retarget) {
      // Ricochet: bank toward the nearest enemy within 24 m, if there is one
      const target = this._nearestEnemy(k, combatants, 24, hit.point);
      if (target) {
        const aim = this._combatantCenter(target, new THREE.Vector3()).sub(hit.point).normalize();
        k.vel.copy(aim.multiplyScalar(Math.max(speed * 0.85, minSpeed)));
      }
    }
    if (k.vel.lengthSq() < minSpeed * minSpeed) k.vel.setLength(minSpeed);
    k.pos.copy(hit.point).addScaledVector(n, 0.08);
    k.bounces++;
    this.particles.spawnSparks(hit.point, 0xa3e635, 14, 9);
  }

  _impactEffects(k, callbacks) {
    if (k.skinType === 'c4') this._explode(k, callbacks);
    else if (k.skinType === 'fire' && !k.ghost) this._spawnFireZone(k.pos, k.ownerId, k.team);
  }

  _explode(k, callbacks) {
    const center = k.pos.clone();
    this.particles.spawnShockwave(center, 0xff8a00, 5.5);
    this.particles.spawnSparks(center, 0xffb020, 60, 16);
    this.particles.spawnFloatingText(center, 'BOOM!', '#ff8a00', true);
    const c = new THREE.Vector3();
    for (const t of this._combatants) {
      if (k.ghost) break; // remote knife: the thrower's client decides the damage
      if (t.state.dead || t.team === k.team) continue;
      this._combatantCenter(t, c);
      const d = c.distanceTo(center);
      if (d > 4.5) continue;
      // 95 damage at the centre, 25 at the edge of the 4.5 m radius
      const damage = Math.round(95 - (95 - 25) * (d / 4.5));
      callbacks.onHitCombatant({
        kind: 'c4',
        attackerId: k.ownerId,
        victim: t,
        damage,
        headshot: false,
        deflected: false,
        method: 'throw',
        hitPos: c.clone()
      });
    }
    this._markDead(k);
  }

  _spawnFireZone(pos, ownerId, team, spreadsLeft = 2) {
    if (this._fires.length >= 14) return;
    const geo = new THREE.CircleGeometry(2.2, 18);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff6a00,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, 0.06, pos.z);
    this.scene.add(mesh);
    this._fires.push({
      pos: new THREE.Vector3(pos.x, 0, pos.z),
      radius: 2.2,
      life: 6,
      t: 0,
      tick: 0,
      spreadsLeft,
      nextSpread: spreadsLeft > 0 ? 1.2 : Infinity,
      ownerId,
      team,
      mesh,
      mat,
      geo
    });
    this.particles.spawnSparks(new THREE.Vector3(pos.x, 0.3, pos.z), 0xff8a00, 20, 6);
  }

  _updateFires(dt, callbacks) {
    const c = new THREE.Vector3();
    for (let i = this._fires.length - 1; i >= 0; i--) {
      const f = this._fires[i];
      f.t += dt;
      if (f.t >= f.life) {
        this._removeFire(i);
        continue;
      }
      const pulse = 1 + 0.08 * Math.sin(f.t * 9);
      f.mesh.scale.set(pulse, 1, pulse);
      f.mat.opacity = 0.55 * Math.min(1, (f.life - f.t) / 1.5);

      // The flames jump to a nearby patch of ground
      if (f.spreadsLeft > 0 && f.t >= f.nextSpread) {
        f.spreadsLeft--;
        f.nextSpread = f.t + 1.4;
        const ang = Math.random() * Math.PI * 2;
        this._spawnFireZone(
          new THREE.Vector3(f.pos.x + Math.cos(ang) * 3.2, 0, f.pos.z + Math.sin(ang) * 3.2),
          f.ownerId,
          f.team,
          f.spreadsLeft
        );
      }

      // Burns every enemy standing in the flames: 3 damage twice a second
      f.tick += dt;
      if (f.tick >= 0.5) {
        f.tick = 0;
        for (const t of this._combatants) {
          if (t.state.dead || t.team === f.team) continue;
          this._combatantCenter(t, c);
          const dx = c.x - f.pos.x;
          const dz = c.z - f.pos.z;
          if (dx * dx + dz * dz > (f.radius + 0.3) * (f.radius + 0.3)) continue;
          callbacks.onHitCombatant({
            kind: 'fire',
            attackerId: f.ownerId,
            victim: t,
            damage: 3,
            headshot: false,
            deflected: false,
            method: 'throw',
            hitPos: c.clone()
          });
        }
      }
    }
  }

  _removeFire(i) {
    const f = this._fires[i];
    this.scene.remove(f.mesh);
    f.geo.dispose();
    f.mat.dispose();
    this._fires.splice(i, 1);
  }

  _clearFires() {
    for (let i = this._fires.length - 1; i >= 0; i--) this._removeFire(i);
  }

  clear() {
    this._clearFires();
    while (this.knives.length > 0) {
      this._destroyKnife(this.knives.length - 1);
    }
  }
}

function distanceSegmentToPoint(a, b, p) {
  const abX = b.x - a.x;
  const abY = b.y - a.y;
  const abZ = b.z - a.z;
  const lenSq = abX * abX + abY * abY + abZ * abZ;
  if (lenSq < 1e-6) return a.distanceTo(p);
  let t = ((p.x - a.x) * abX + (p.y - a.y) * abY + (p.z - a.z) * abZ) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + abX * t - p.x;
  const cy = a.y + abY * t - p.y;
  const cz = a.z + abZ * t - p.z;
  return Math.sqrt(cx * cx + cy * cy + cz * cz);
}
