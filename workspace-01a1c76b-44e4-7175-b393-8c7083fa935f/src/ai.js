import * as THREE from 'three';
import { resolveArenaPhysics } from './maps.js';
import { sfx } from './audio.js';

export const AI_MODES = {
  adaptive: {
    id: 'adaptive',
    label: '🧠 Learning NPC',
    sub: 'Trains you and adapts as you play!'
  },
  easy: {
    id: 'easy',
    label: 'Rookie Bot',
    sub: 'Fixed easy level'
  },
  normal: {
    id: 'normal',
    label: 'Rival Bot',
    sub: 'Fixed medium level'
  },
  hard: {
    id: 'hard',
    label: 'Champion Bot',
    sub: 'Fixed pro level'
  }
};

export function computeAdaptiveStats(mem) {
  const eloNorm = Math.max(0, Math.min(1.2, (mem.elo - 80) / 220));
  // Betanító fázis (1–2. szint): lassabb dobás, pontatlanabb célzás, kevesebb parry
  const beginner = mem.level <= 2;
  const totalActs = Math.max(1, mem.playerSlashes + mem.playerThrows);
  const throwRatio = mem.playerThrows / totalActs;
  const mobilityRate = Math.min(1, mem.playerSlidesAndDashes / Math.max(3, mem.roundsPlayed * 2.5));

  const moveSpeed = 6.8 + eloNorm * 4.2;
  const throwCooldown = Math.max(1.65, 3.6 - eloNorm * 1.65) + (beginner ? 0.8 : 0);
  const throwWindupTime = Math.max(0.34, 0.56 - eloNorm * 0.18);
  const throwSpeed = 22 + eloNorm * 14;
  const aimJitter = Math.max(0.015, 0.095 - eloNorm * 0.072) * (beginner ? 1.5 : 1);
  const meleeCooldown = Math.max(0.45, 0.88 - eloNorm * 0.36);

  let parryChance = (0.04 + eloNorm * 0.22) * (beginner ? 0.5 : 1);
  if (throwRatio > 0.55 && mem.roundsPlayed >= 2) {
    parryChance += 0.16;
  }

  const slideChance = Math.min(0.65, 0.08 + mobilityRate * 0.35 + eloNorm * 0.25);
  const dashCooldown = Math.max(1.7, 4.6 - mobilityRate * 1.4 - eloNorm * 1.3);

  const prefersKiting = throwRatio < 0.35 && mem.roundsPlayed >= 2;
  const extraStrafe = throwRatio > 0.55 ? 1.0 : 0.75;

  let counterLane = 0;
  const maxLane = Math.max(mem.laneLeft, mem.laneMid, mem.laneRight);
  if (maxLane >= 2) {
    if (mem.laneLeft === maxLane) counterLane = -1;
    else if (mem.laneRight === maxLane) counterLane = 1;
    else counterLane = 0;
  }

  return {
    id: 'adaptive',
    label: `NPC Lv.${mem.level}`,
    moveSpeed,
    throwCooldown,
    throwWindupTime,
    throwSpeed,
    aimJitter,
    meleeCooldown,
    parryChance,
    dashCooldown,
    slideChance,
    prefersKiting,
    extraStrafe,
    counterLane,
    headshotAimChance: beginner ? 0 : Math.min(0.45, eloNorm * 0.35),
    beginner
  };
}

export function updateBotLearningAfterRound(mem, { playerWon, roundDuration }) {
  mem.roundsPlayed += 1;
  if (playerWon) {
    mem.playerRoundWins += 1;
    const speedBonus = roundDuration < 15 ? 8 : 0;
    mem.elo = Math.min(360, mem.elo + 16 + speedBonus);
    mem.xp += 40;
  } else {
    mem.botRoundWins += 1;
    mem.elo = Math.max(75, mem.elo - 9);
    mem.xp += 18;
  }

  while (mem.xp >= 100) {
    mem.xp -= 100;
    mem.level += 1;
  }

  if (mem.roundsPlayed >= 3) {
    mem.tutorialCompleted = true;
  }

  const totalActs = Math.max(1, mem.playerSlashes + mem.playerThrows);
  const throwPct = Math.round((mem.playerThrows / totalActs) * 100);
  let habitMsg = '';

  if (mem.roundsPlayed < 2) {
    habitMsg = 'The bot is still learning your style. Try a headshot and a parry!';
  } else if (throwPct >= 58) {
    habitMsg = `Observation: you throw a lot (${throwPct}%) → the bot strafes wider and parries more often!`;
  } else if (throwPct <= 34) {
    habitMsg = `Observation: you rush in melee (${100 - throwPct}% slashes) → the bot backs off, throws and dodges!`;
  } else if (mem.playerHeadshots >= 2) {
    habitMsg = `Observation: you aim for the head (${mem.playerHeadshots} headshots) → the bot slides and jumps more!`;
  } else {
    const laneName =
      mem.laneLeft > mem.laneMid && mem.laneLeft >= mem.laneRight
        ? 'left flank'
        : mem.laneRight > mem.laneMid && mem.laneRight > mem.laneLeft
        ? 'right flank'
        : 'center bridge';
    habitMsg = `Observation: you favor the ${laneName} → the bot pre-guards that route!`;
  }

  mem.lastAdaptSummary = `Bot Level ${mem.level} (IQ: ${Math.round(mem.elo)}) • ${habitMsg}`;
}

export function getCoachTipForRound(mem, roundNumber) {
  if (!mem.coachTipsEnabled) return null;

  if (mem.roundsPlayed === 0 && roundNumber === 1) {
    return '🎓 TRAINING #1: Aim for the bot YELLOW ROBLOX HEAD with a [Right Click] throw or a stab for an instant HEADSHOT (+bonus $)!';
  }
  if (mem.roundsPlayed === 1 || (mem.playerParries === 0 && roundNumber === 2)) {
    return '🎓 TRAINING #2: When the bot hand FLASHES RED and chimes, it is about to throw! Press [E] to PARRY it back!';
  }
  if (mem.roundsPlayed === 2 || (mem.playerSlidesAndDashes === 0 && roundNumber === 3)) {
    return '🎓 TRAINING #3: While running, [C / SHIFT] = slide, [Q] = Dash dodge, [SPACE x2] = double jump! The bot learns your moves as you play!';
  }
  return `🧠 ${mem.lastAdaptSummary}`;
}

const STATIC_PRESETS = {
  easy: {
    id: 'easy',
    label: 'Rookie Bot',
    moveSpeed: 7.0,
    throwCooldown: 3.5,
    throwWindupTime: 0.54,
    throwSpeed: 23,
    aimJitter: 0.088,
    meleeCooldown: 0.85,
    parryChance: 0.05,
    dashCooldown: 4.5,
    slideChance: 0.12,
    prefersKiting: false,
    extraStrafe: 0.75,
    counterLane: 0,
    headshotAimChance: 0.05
  },
  normal: {
    id: 'normal',
    label: 'Rival Bot',
    moveSpeed: 9.2,
    throwCooldown: 2.5,
    throwWindupTime: 0.42,
    throwSpeed: 29,
    aimJitter: 0.042,
    meleeCooldown: 0.62,
    parryChance: 0.22,
    dashCooldown: 2.8,
    slideChance: 0.35,
    prefersKiting: false,
    extraStrafe: 0.82,
    counterLane: 0,
    headshotAimChance: 0.18
  },
  hard: {
    id: 'hard',
    label: 'Champion Bot',
    moveSpeed: 10.9,
    throwCooldown: 1.9,
    throwWindupTime: 0.35,
    throwSpeed: 35,
    aimJitter: 0.018,
    meleeCooldown: 0.48,
    parryChance: 0.38,
    dashCooldown: 1.85,
    slideChance: 0.55,
    prefersKiting: false,
    extraStrafe: 0.95,
    counterLane: 0,
    headshotAimChance: 0.35
  }
};

export class RivalAI {
  // Learning-bot damage ramps with its level: 55% at level 1, +9% per level, full strength from level 6.
  // Fixed presets are unaffected (multiplier 1).
  _damageMul() {
    if (this.modeId !== 'adaptive' || !this.botMemory) return 1;
    return Math.min(1, 0.55 + (this.botMemory.level - 1) * 0.09);
  }

  // Knife throw damage vs. the player (headshot = 1.3x this, see projectiles.js).
  // Throws are the main threat, so they ramp slower: 45% at level 1, +7% per level, capped at 85%.
  getThrowDamage() {
    if (this.modeId !== 'adaptive' || !this.botMemory) return 65;
    return Math.round(65 * Math.min(0.85, 0.45 + (this.botMemory.level - 1) * 0.07));
  }

  // Melee slash damage vs. the player
  getMeleeDamage() {
    return Math.round(45 * this._damageMul());
  }

  constructor(modeId = 'adaptive', botMemory = null, { team = 'red', barrierSide = 'red', customName = null } = {}) {
    this.modeId = modeId;
    this.botMemory = botMemory;
    this.team = team;
    this.barrierSide = barrierSide;
    this.customName = customName;
    this.refreshConfig();
    this.raycaster = new THREE.Raycaster();

    this.state = {
      pos: new THREE.Vector3(0, 0, -19.8),
      vel: new THREE.Vector3(),
      yaw: Math.PI,
      pitch: 0,
      radius: 0.52,
      height: 2.35,
      hp: 100,
      maxHp: 100,
      dead: false,
      grounded: true,
      jumpsLeft: 2,
      sliding: false,
      slideTimer: 0,
      hasKnife: true,
      knifeRecharge: 0,
      throwWindup: 0,
      throwCd: 1.2,
      meleeCd: 0,
      parryTimer: 0,
      parryCd: 0,
      stunTimer: 0,
      dashCd: 1.0
    };

    this.strafeDir = 1;
    this.strafeTimer = 1.2;
    this.laneChoice = 0;
    this.stuckTimer = 0;
    this.lastCheckPos = new THREE.Vector3();
    this.retargetTimer = 0;
    this.currentTarget = null;

    // Betanító "tempó": bizonytalan játékos ellen visszafog, majd fokozatosan felveszi a tempót
    this.pace = 1;
    this.idleTimer = 0;
    this.passiveTimer = 0;
  }

  _isBeginner() {
    return this.modeId === 'adaptive' && !!this.botMemory && this.botMemory.level <= 2;
  }

  // Cooldown szorzó: lassabb bot, ha visszafogja magát
  _paceCdMul() {
    return 1 + (1 - this.pace) * 1.2;
  }

  _updatePace(dt, tState) {
    if (!this._isBeginner()) {
      this.pace = 1;
      return;
    }
    const speed = Math.hypot(tState.vel.x, tState.vel.z);
    const attacking = !!(tState.chargingThrow || tState.slashCd > 0 || tState.parryTimer > 0);
    this.idleTimer = speed < 1.2 ? this.idleTimer + dt : 0;
    this.passiveTimer = attacking ? 0 : this.passiveTimer + dt;

    // Bizonytalan: áll, vagy egy ideje nem támad
    const unsure = this.idleTimer > 1.5 || this.passiveTimer > 3.5;
    const target = unsure ? 0.35 : 1.0;
    if (target < this.pace) {
      this.pace = Math.max(target, this.pace - 0.6 * dt); // gyorsan visszahúzódik
    } else {
      this.pace = Math.min(target, this.pace + 0.14 * dt); // lassan, fokozatosan gyorsul
    }
  }

  setMode(modeId, botMemory) {
    this.modeId = modeId;
    if (botMemory) this.botMemory = botMemory;
    this.refreshConfig();
  }

  refreshConfig() {
    if (this.modeId === 'adaptive' && this.botMemory) {
      this.cfg = computeAdaptiveStats(this.botMemory);
    } else {
      this.cfg = { ...(STATIC_PRESETS[this.modeId] || STATIC_PRESETS.normal) };
    }
    if (this.customName) {
      this.cfg.label = this.customName;
    }
  }

  resetForRound(spawnPos, initialYaw = Math.PI) {
    this.refreshConfig();
    const s = this.state;
    s.pos.copy(spawnPos);
    s.vel.set(0, 0, 0);
    // Új körben a betanító bot visszafogottan indul
    this.pace = this._isBeginner() ? 0.35 : 1;
    this.idleTimer = 0;
    this.passiveTimer = 0;
    s.yaw = initialYaw;
    s.pitch = 0;
    s.hp = 100;
    s.dead = false;
    s.grounded = true;
    s.jumpsLeft = 2;
    s.sliding = false;
    s.slideTimer = 0;
    s.hasKnife = true;
    s.knifeRecharge = 0;
    s.throwWindup = 0;
    s.throwCd = 0.9 + Math.random() * 0.9;
    s.meleeCd = 0;
    s.parryTimer = 0;
    s.parryCd = 0;
    s.stunTimer = 0;
    s.dashCd = 0.8;

    if (this.modeId === 'adaptive' && Math.random() < 0.65) {
      this.laneChoice = this.cfg.counterLane;
    } else {
      const lanes = [-1, 0, 0, 1];
      this.laneChoice = lanes[Math.floor(Math.random() * lanes.length)];
    }

    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.lastCheckPos.copy(spawnPos);
    this.stuckTimer = 0;
    this.retargetTimer = 0;
    this.currentTarget = null;
  }

  hasLineOfSight(targetPos, arena) {
    const eyeFrom = new THREE.Vector3(this.state.pos.x, this.state.pos.y + 1.95, this.state.pos.z);
    const eyeTo = new THREE.Vector3(targetPos.x, targetPos.y + 1.5, targetPos.z);
    const dir = eyeTo.clone().sub(eyeFrom);
    const dist = dir.length();
    if (dist < 0.5) return true;
    dir.normalize();
    this.raycaster.set(eyeFrom, dir);
    this.raycaster.far = dist - 0.35;
    const hits = this.raycaster.intersectObjects(arena.worldMeshes, false);
    return hits.length === 0;
  }

  _pickBestTarget(combatants, arena) {
    let best = null;
    let bestScore = Infinity;

    for (const c of combatants) {
      if (c.team === this.team || c.state.dead) continue;
      const d = Math.hypot(c.state.pos.x - this.state.pos.x, c.state.pos.z - this.state.pos.z);
      const visPenalty = d < 24 && this.hasLineOfSight(c.state.pos, arena) ? 0 : 9.5;
      const score = d + visPenalty;
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
  }

  update(dt, { arena, combatants, storm = null, roundLive, callbacks }) {
    const s = this.state;
    s.vel.y -= 28 * dt;

    if (s.dead) {
      s.vel.x *= Math.max(0, 1 - 4 * dt);
      s.vel.z *= Math.max(0, 1 - 4 * dt);
      resolveArenaPhysics(s, arena, dt, this.barrierSide);
      return;
    }

    if (s.meleeCd > 0) s.meleeCd -= dt;
    if (s.throwCd > 0) s.throwCd -= dt;
    if (s.parryTimer > 0) s.parryTimer -= dt;
    if (s.parryCd > 0) s.parryCd -= dt;
    if (s.dashCd > 0) s.dashCd -= dt;

    if (!s.hasKnife) {
      s.knifeRecharge -= dt;
      if (s.knifeRecharge <= 0) s.hasKnife = true;
    }

    this.retargetTimer -= dt;
    if (this.retargetTimer <= 0 || !this.currentTarget || this.currentTarget.state.dead) {
      this.currentTarget = this._pickBestTarget(combatants, arena);
      this.retargetTimer = 0.35 + Math.random() * 0.25;
    }

    const targetCombatant = this.currentTarget;
    if (!targetCombatant) {
      s.vel.x *= Math.max(0, 1 - 8 * dt);
      s.vel.z *= Math.max(0, 1 - 8 * dt);
      resolveArenaPhysics(s, arena, dt, this.barrierSide);
      return;
    }

    const tState = targetCombatant.state;
    if (targetCombatant.isPlayer) this._updatePace(dt, tState);
    const dxToTarget = tState.pos.x - s.pos.x;
    const dzToTarget = tState.pos.z - s.pos.z;
    const distToTarget = Math.hypot(dxToTarget, dzToTarget);
    const targetYaw = Math.atan2(-dxToTarget, -dzToTarget);
    s.yaw = lerpAngle(s.yaw, targetYaw, Math.min(1, dt * 12));
    s.pitch = Math.atan2((tState.pos.y + 1.5) - (s.pos.y + 1.85), Math.max(1, distToTarget));

    if (!roundLive) {
      this.strafeTimer -= dt;
      if (this.strafeTimer <= 0) {
        this.strafeDir *= -1;
        this.strafeTimer = 0.45 + Math.random() * 0.4;
        if (s.grounded && Math.random() < 0.35) {
          s.vel.y = 9.2;
          s.grounded = false;
        }
      }
      s.vel.x = this.strafeDir * 5.8;
      s.vel.z = this.barrierSide === 'red' ? 2.0 : this.barrierSide === 'blue' ? -2.0 : 0;
      resolveArenaPhysics(s, arena, dt, this.barrierSide);
      return;
    }

    if (s.stunTimer > 0) {
      s.stunTimer -= dt;
      s.throwWindup = 0;
      s.vel.x *= Math.max(0, 1 - 8 * dt);
      s.vel.z *= Math.max(0, 1 - 8 * dt);
      resolveArenaPhysics(s, arena, dt, this.barrierSide);
      return;
    }

    const canSeeTarget = this.hasLineOfSight(tState.pos, arena);

    if (s.throwWindup > 0) {
      s.throwWindup -= dt;
      s.vel.x *= 0.92;
      s.vel.z *= 0.92;

      if (s.throwWindup <= 0 && (s.hasKnife || this.gunMode) && !tState.dead) {
        // Gun mode: no knife is consumed, the bot just fires again after its cooldown
        if (!this.gunMode) {
          s.hasKnife = false;
          s.knifeRecharge = 2.0;
        }
        s.throwCd = this.cfg.throwCooldown * (0.85 + Math.random() * 0.35) * this._paceCdMul();

        const origin = new THREE.Vector3(s.pos.x, s.pos.y + 1.85, s.pos.z);
        const leadTime = Math.min(0.45, distToTarget / this.cfg.throwSpeed) * 0.65;
        const aimHead = Math.random() < this.cfg.headshotAimChance;
        const targetHeight = tState.sliding ? 0.9 : aimHead ? 1.66 : 1.28;
        const aimPoint = new THREE.Vector3(
          tState.pos.x + tState.vel.x * leadTime,
          tState.pos.y + targetHeight + distToTarget * 0.045,
          tState.pos.z + tState.vel.z * leadTime
        );
        const dir = aimPoint.sub(origin).normalize();
        dir.x += (Math.random() - 0.5) * this.cfg.aimJitter;
        dir.y += (Math.random() - 0.5) * this.cfg.aimJitter * 0.6;
        dir.z += (Math.random() - 0.5) * this.cfg.aimJitter;
        dir.normalize();

        sfx.playThrow(false);
        callbacks.onBotThrow(origin, dir, this.cfg.throwSpeed);
      }

      resolveArenaPhysics(s, arena, dt, this.barrierSide);
      return;
    }

    // Reactive Parry
    const enemyCharging = !!(tState.chargingThrow || tState.throwWindup > 0);
    if (
      s.parryCd <= 0 &&
      canSeeTarget &&
      ((enemyCharging && distToTarget < 22) || distToTarget < 3.4) &&
      Math.random() < this.cfg.parryChance * dt * 5.5
    ) {
      s.parryTimer = 0.45;
      s.parryCd = 3.0;
      sfx.playParryStance();
    }

    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) {
      this.strafeDir = Math.random() < 0.5 ? -1 : 1;
      this.strafeTimer = 0.55 + Math.random() * 0.75;
    }

    let goalX = tState.pos.x;
    let goalZ = tState.pos.z;
    let escapingStorm = false;

    // FORTNITE STORM ZONE AWARENESS! If outside or near the Storm Wall, sprint into the Safe Circle!
    if (storm && storm.active && storm.isOutside(s.pos, 2.2)) {
      goalX = storm.nextCenter.x;
      goalZ = storm.nextCenter.y;
      escapingStorm = true;
    } else if (!canSeeTarget) {
      goalX = this.laneChoice * 6.8;
      if (Math.abs(s.pos.z - tState.pos.z) > 12) {
        goalZ = (s.pos.z + tState.pos.z) * 0.4;
      } else {
        goalX = tState.pos.x;
        goalZ = tState.pos.z;
      }
    }

    const toGoalX = goalX - s.pos.x;
    const toGoalZ = goalZ - s.pos.z;
    const goalLen = Math.hypot(toGoalX, toGoalZ) || 1;
    const fwdX = toGoalX / goalLen;
    const fwdZ = toGoalZ / goalLen;
    const rightX = -fwdZ;
    const rightZ = fwdX;

    let forwardWeight = 1.0;
    if (!escapingStorm && canSeeTarget) {
      if (this.cfg.prefersKiting && distToTarget < 8.5) {
        forwardWeight = -0.65;
        if (distToTarget < 4.2 && s.dashCd <= 0) {
          s.dashCd = this.cfg.dashCooldown;
          s.vel.x = -fwdX * 18 + rightX * this.strafeDir * 8;
          s.vel.z = -fwdZ * 18 + rightZ * this.strafeDir * 8;
          s.vel.y = 3.8;
          sfx.playDash();
        }
      } else if (!s.hasKnife && distToTarget < 8) {
        forwardWeight = -0.55;
      } else if (distToTarget < 2.2) {
        forwardWeight = 0.15;
      } else if (s.hasKnife && s.throwCd <= 0.4 && distToTarget > 7 && distToTarget < 19) {
        forwardWeight = 0.35;
      }
    }

    const strafeWeight = escapingStorm ? 0.12 : (canSeeTarget ? this.cfg.extraStrafe : 0.25) * this.strafeDir;
    let moveX = fwdX * forwardWeight + rightX * strafeWeight;
    let moveZ = fwdZ * forwardWeight + rightZ * strafeWeight;
    const mLen = Math.hypot(moveX, moveZ) || 1;
    moveX /= mLen;
    moveZ /= mLen;

    if (s.sliding) {
      s.slideTimer -= dt;
      if (s.slideTimer <= 0) s.sliding = false;
    } else {
      const spd = escapingStorm ? this.cfg.moveSpeed * 1.12 : this.cfg.moveSpeed;
      s.vel.x = THREE.MathUtils.lerp(s.vel.x, moveX * spd, Math.min(1, dt * 11));
      s.vel.z = THREE.MathUtils.lerp(s.vel.z, moveZ * spd, Math.min(1, dt * 11));
    }

    if (s.grounded && !s.sliding && ((canSeeTarget && distToTarget > 5 && distToTarget < 16) || escapingStorm)) {
      if (Math.random() < (escapingStorm ? 0.65 : this.cfg.slideChance) * dt) {
        s.sliding = true;
        s.slideTimer = 0.48;
        s.vel.x = moveX * (this.cfg.moveSpeed * 1.48);
        s.vel.z = moveZ * (this.cfg.moveSpeed * 1.48);
      } else if (!escapingStorm && s.dashCd <= 0 && Math.random() < 0.5 * dt) {
        s.dashCd = this.cfg.dashCooldown;
        s.vel.x = rightX * this.strafeDir * 18;
        s.vel.z = rightZ * this.strafeDir * 18;
        s.vel.y = 3.5;
        sfx.playDash();
      }
    }

    this.stuckTimer += dt;
    if (this.stuckTimer >= 0.45) {
      const moved = Math.hypot(s.pos.x - this.lastCheckPos.x, s.pos.z - this.lastCheckPos.z);
      if (moved < 0.45 && s.grounded) {
        s.vel.y = 10.4;
        s.grounded = false;
        this.strafeDir *= -1;
      }
      this.lastCheckPos.copy(s.pos);
      this.stuckTimer = 0;
    }

    if (canSeeTarget && distToTarget < 2.95 && Math.abs(tState.pos.y - s.pos.y) < 2.2 && s.meleeCd <= 0 && !tState.dead) {
      s.meleeCd = this.cfg.meleeCooldown * this._paceCdMul();
      callbacks.onBotMelee(targetCombatant);
    } else if (
      canSeeTarget &&
      (s.hasKnife || this.gunMode) &&
      s.throwCd <= 0 &&
      distToTarget >= (this.gunMode ? 4.0 : 5.0) &&
      distToTarget <= (this.gunMode ? 48 : 26) &&
      !tState.dead
    ) {
      s.throwWindup = this.cfg.throwWindupTime;
      if (targetCombatant.isPlayer) sfx.playEnemyTelegraph();
    }

    const hitPad = resolveArenaPhysics(s, arena, dt, this.barrierSide);
    if (s.grounded) s.jumpsLeft = 2;
    if (hitPad && distToTarget < 22) sfx.playJumpPad();
  }
}

function lerpAngle(a, b, t) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
