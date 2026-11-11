import * as THREE from 'three';
import { RivalCharacter } from './character.js';
import { sfx } from './audio.js';

export class DojoController {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.dummies = [];

    this.parryTrainerActive = true;
    this.parryFireTimer = 1.6;
    this.parryWindup = 0;

    this.challengeActive = false;
    this.challengeTimer = 0;
    this.challengeScore = 0;
    this.challengeHits = 0;
    this.challengeHeadshots = 0;
    this.animTime = 0;
  }

  start(combatantsOut) {
    this.stop();
    this.active = true;
    this.animTime = 0;
    this.parryTrainerActive = true;
    this.parryFireTimer = 1.8;
    this.parryWindup = 0;
    this.challengeActive = false;

    const specs = [
      { id: 'dojo_parry', label: '⚡ PARRY TRAINER [T]', basePos: new THREE.Vector3(0, 2.2, -1.2), strafeAmp: 0, speed: 0, color: '#a855f7', hat: 'hat_samurai', isParryBot: true },
      { id: 'dojo_left', label: '🎯 TARGET #1', basePos: new THREE.Vector3(-7.5, 0.05, 4.5), strafeAmp: 3.4, speed: 1.8, color: '#f97316', hat: 'hat_bandana' },
      { id: 'dojo_right', label: '🎯 TARGET #2', basePos: new THREE.Vector3(7.5, 0.05, 3.0), strafeAmp: 3.8, speed: 2.2, color: '#e11d48', hat: 'hat_none' },
      { id: 'dojo_high', label: '🎯 HIGH TARGET', basePos: new THREE.Vector3(-3.2, 2.2, -3.5), strafeAmp: 1.4, speed: 1.5, color: '#eab308', hat: 'hat_crown' },
      { id: 'dojo_far', label: '🎯 LONG-RANGE MARKSMAN', basePos: new THREE.Vector3(0, 0.05, -15.5), strafeAmp: 6.5, speed: 2.6, color: '#ec4899', hat: 'hat_halo' }
    ];

    for (const sp of specs) {
      const char = new RivalCharacter(this.scene, 'blueprint_blade', {
        torsoColor: sp.color,
        legsColor: '#1e293b',
        angry: true,
        hatId: sp.hat
      });

      const state = {
        pos: sp.basePos.clone(),
        vel: new THREE.Vector3(),
        yaw: 0,
        pitch: 0,
        radius: 0.52,
        height: 2.35,
        hp: 100,
        maxHp: 100,
        dead: false,
        grounded: true,
        sliding: false,
        hasKnife: !!sp.isParryBot,
        throwWindup: 0,
        parryTimer: 0,
        stunTimer: 0
      };

      const dummy = {
        id: sp.id,
        name: sp.label,
        team: 'dojo_targets',
        isPlayer: false,
        isDojoDummy: true,
        isParryBot: !!sp.isParryBot,
        radarColor: sp.color,
        basePos: sp.basePos.clone(),
        strafeAmp: sp.strafeAmp,
        strafeSpeed: sp.speed,
        phaseOffset: Math.random() * Math.PI * 2,
        respawnTimer: 0,
        state,
        char
      };

      this.dummies.push(dummy);
      combatantsOut.push(dummy);
    }
  }

  toggleParryTrainer() {
    this.parryTrainerActive = !this.parryTrainerActive;
    sfx.playInspectClick();
    return this.parryTrainerActive;
  }

  startChallenge() {
    this.challengeActive = true;
    this.challengeTimer = 30.0;
    this.challengeScore = 0;
    this.challengeHits = 0;
    this.challengeHeadshots = 0;
    sfx.playCountdown(true);
  }

  recordHit({ headshot, deflected, killed }) {
    sfx.playTargetDing();
    if (!this.challengeActive) return;
    this.challengeHits++;
    if (headshot) {
      this.challengeHeadshots++;
      this.challengeScore += 150;
    } else if (deflected) {
      this.challengeScore += 250;
    } else if (killed) {
      this.challengeScore += 80;
    } else {
      this.challengeScore += 35;
    }
  }

  update(dt, player, onParryBotThrow, onChallengeEnd) {
    if (!this.active) return;
    this.animTime += dt;

    if (this.challengeActive) {
      this.challengeTimer -= dt;
      if (this.challengeTimer <= 0) {
        this.challengeActive = false;
        this.challengeTimer = 0;
        onChallengeEnd({
          score: this.challengeScore,
          hits: this.challengeHits,
          headshots: this.challengeHeadshots
        });
      }
    }

    for (const d of this.dummies) {
      const s = d.state;

      if (s.dead) {
        d.respawnTimer -= dt;
        if (d.respawnTimer <= 0) {
          s.dead = false;
          s.hp = 100;
          s.pos.copy(d.basePos);
          s.vel.set(0, 0, 0);
          d.char.bodyPivot.rotation.set(0, 0, 0);
          d.char.bodyPivot.position.set(0, 0, 0);
        }
        d.char.update(s, dt);
        continue;
      }

      if (s.stunTimer > 0) s.stunTimer = Math.max(0, s.stunTimer - dt);

      // Smooth target strafing along X
      if (d.strafeAmp > 0) {
        const prevX = s.pos.x;
        s.pos.x = d.basePos.x + Math.sin(this.animTime * d.strafeSpeed + d.phaseOffset) * d.strafeAmp;
        s.vel.x = (s.pos.x - prevX) / Math.max(0.001, dt);
      } else {
        s.vel.x = 0;
      }

      // Face player
      const dx = player.pos.x - s.pos.x;
      const dz = player.pos.z - s.pos.z;
      s.yaw = Math.atan2(-dx, -dz);

      // Parry Trainer Bot fires steady telegraphed knives so player can practice [E] Parry!
      if (d.isParryBot && this.parryTrainerActive && !player.dead && s.stunTimer <= 0) {
        const dist = Math.hypot(dx, dz);
        if (dist < 28) {
          if (s.throwWindup > 0) {
            s.throwWindup -= dt;
            if (s.throwWindup <= 0) {
              const origin = new THREE.Vector3(s.pos.x, s.pos.y + 1.85, s.pos.z);
              const aim = new THREE.Vector3(player.pos.x, player.pos.y + 1.45 + dist * 0.04, player.pos.z);
              const dir = aim.sub(origin).normalize();
              sfx.playThrow(false);
              onParryBotThrow(d.id, origin, dir, 27);
              this.parryFireTimer = 1.85;
            }
          } else {
            this.parryFireTimer -= dt;
            if (this.parryFireTimer <= 0) {
              s.throwWindup = 0.45;
              sfx.playEnemyTelegraph();
            }
          }
        }
      } else if (d.isParryBot) {
        s.throwWindup = 0;
      }

      d.char.update(s, dt);
    }
  }

  stop() {
    this.active = false;
    this.challengeActive = false;
    for (const d of this.dummies) {
      d.char.dispose();
    }
    this.dummies = [];
  }
}
