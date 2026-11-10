import * as THREE from 'three';

export class ParticleSystem {
  constructor(scene, overlayContainer) {
    this.scene = scene;
    this.overlay = overlayContainer;
    this.particles = [];
    this.rings = [];
    this.specialFx = [];
    this.floatingLabels = [];

    this.sparkGeo = new THREE.BoxGeometry(0.08, 0.08, 0.22);
    this.voxelGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
    this.confettiGeo = new THREE.BoxGeometry(0.18, 0.03, 0.12);
    this.iceShardGeo = new THREE.ConeGeometry(0.16, 0.62, 5);
  }

  spawnVoxelBurst(pos, palette = [0xf5cd30, 0xe11d48, 0x1e3a8a, 0xffffff], count = 18) {
    for (let i = 0; i < count; i++) {
      const color = palette[i % palette.length];
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.4,
        transparent: true,
        opacity: 1
      });
      const mesh = new THREE.Mesh(this.voxelGeo, mat);
      mesh.position.copy(pos).add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.6,
          (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 0.6
        )
      );

      const angle = Math.random() * Math.PI * 2;
      const horiz = 2.5 + Math.random() * 6.5;
      const vel = new THREE.Vector3(
        Math.cos(angle) * horiz,
        4.5 + Math.random() * 6.5,
        Math.sin(angle) * horiz
      );

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        mat,
        vel,
        gravity: 18,
        spin: new THREE.Vector3(
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12
        ),
        life: 0,
        maxLife: 0.78 + Math.random() * 0.45
      });
    }
  }

  /**
   * Triggers any of the 6 unlockable 3D Kill Effects / Finishers!
   */
  triggerKillEffect(effectId = 'voxel_classic', pos, palette = [0xf5cd30, 0xe11d48, 0x1e3a8a, 0xffffff]) {
    const floorPos = new THREE.Vector3(pos.x, Math.max(0.05, pos.y - 1.25), pos.z);

    if (effectId === 'lightning_strike') {
      // Tall 3D Jagged Sky Lightning Bolt + Ground Shock Ring + Electric Sparks!
      const boltGroup = new THREE.Group();
      const segs = 9;
      const boltMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 1
      });
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1
      });

      let prev = new THREE.Vector3(pos.x, pos.y + 18, pos.z);
      for (let i = 1; i <= segs; i++) {
        const t = i / segs;
        const next = new THREE.Vector3(
          pos.x + (i < segs ? (Math.random() - 0.5) * 1.8 : 0),
          pos.y + 18 * (1 - t) - 0.6,
          pos.z + (i < segs ? (Math.random() - 0.5) * 1.8 : 0)
        );
        const segVec = next.clone().sub(prev);
        const len = segVec.length();
        const mid = prev.clone().addScaledVector(segVec, 0.5);

        const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, len, 6), boltMat);
        outer.position.copy(mid);
        outer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), segVec.clone().normalize());
        boltGroup.add(outer);

        const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, len, 6), coreMat);
        inner.position.copy(mid);
        inner.quaternion.copy(outer.quaternion);
        boltGroup.add(inner);
        prev = next;
      }
      this.scene.add(boltGroup);
      this.specialFx.push({
        type: 'lightning',
        group: boltGroup,
        mats: [boltMat, coreMat],
        life: 0,
        maxLife: 0.52
      });

      this.spawnShockwave(pos, 0x00f0ff, 4.4);
      this.spawnSparks(pos, 0x00f0ff, 34, 13);
      this.spawnVoxelBurst(pos, [0x00f0ff, 0xc084fc, 0xffffff, 0x38bdf8], 16);
      return;
    }

    if (effectId === 'ice_shatter') {
      // Translucent Crystalline Ice Spires + Flying Frost Shards!
      const iceGroup = new THREE.Group();
      iceGroup.position.copy(floorPos);
      const iceMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.55,
        roughness: 0.1,
        metalness: 0.3,
        transparent: true,
        opacity: 0.88
      });

      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const h = i === 0 ? 2.6 : 1.5 + Math.random() * 0.7;
        const spire = new THREE.Mesh(new THREE.ConeGeometry(0.42, h, 5), iceMat);
        spire.position.set(
          i === 0 ? 0 : Math.cos(ang) * 0.45,
          h * 0.48,
          i === 0 ? 0 : Math.sin(ang) * 0.45
        );
        if (i > 0) {
          spire.rotation.z = -Math.cos(ang) * 0.32;
          spire.rotation.x = Math.sin(ang) * 0.32;
        }
        iceGroup.add(spire);
      }
      this.scene.add(iceGroup);
      this.specialFx.push({
        type: 'ice',
        group: iceGroup,
        mats: [iceMat],
        life: 0,
        maxLife: 0.95
      });

      for (let i = 0; i < 24; i++) {
        const shardMat = new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0xbae6fd : 0x38bdf8,
          transparent: true,
          opacity: 0.95
        });
        const mesh = new THREE.Mesh(this.iceShardGeo, shardMat);
        mesh.position.copy(pos);
        const a = Math.random() * Math.PI * 2;
        const spd = 3.5 + Math.random() * 8;
        const vel = new THREE.Vector3(Math.cos(a) * spd, 4 + Math.random() * 7, Math.sin(a) * spd);
        this.scene.add(mesh);
        this.particles.push({
          mesh,
          mat: shardMat,
          vel,
          gravity: 16,
          spin: new THREE.Vector3(Math.random() * 14, Math.random() * 14, Math.random() * 14),
          life: 0,
          maxLife: 0.85
        });
      }
      this.spawnShockwave(pos, 0x7dd3fc, 3.8);
      return;
    }

    if (effectId === 'golden_statue') {
      // Gleaming Solid-Gold Roblox Monument + Bouncing Gold Bullion Bars!
      const goldGroup = new THREE.Group();
      goldGroup.position.copy(floorPos);
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xd97706,
        emissiveIntensity: 0.45,
        metalness: 0.95,
        roughness: 0.14,
        transparent: true,
        opacity: 1
      });
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.88, 0.25, 16), goldMat);
      ped.position.y = 0.12;
      const statueBody = new THREE.Mesh(new THREE.BoxGeometry(0.88, 1.55, 0.48), goldMat);
      statueBody.position.y = 1.02;
      const statueHead = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.48, 20), goldMat);
      statueHead.position.y = 2.08;
      goldGroup.add(ped, statueBody, statueHead);
      this.scene.add(goldGroup);

      this.specialFx.push({
        type: 'gold',
        group: goldGroup,
        mats: [goldMat],
        life: 0,
        maxLife: 1.25
      });

      this.spawnVoxelBurst(pos, [0xffd700, 0xfbbf24, 0xfef08a, 0xf59e0b], 26);
      this.spawnShockwave(pos, 0xffd700, 4.0);
      return;
    }

    if (effectId === 'void_vortex') {
      // Black-Hole Singularity Core + Accretion Ring + Imploding Dark-Matter Particles!
      const voidGroup = new THREE.Group();
      voidGroup.position.copy(pos);

      const coreMat = new THREE.MeshBasicMaterial({
        color: 0x090414,
        transparent: true,
        opacity: 0.98
      });
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xc084fc,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92
      });
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.68, 20, 20), coreMat);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1.45, 28), ringMat);
      ring.rotation.x = Math.PI * 0.38;
      voidGroup.add(core, ring);
      this.scene.add(voidGroup);

      this.specialFx.push({
        type: 'void',
        group: voidGroup,
        mats: [coreMat, ringMat],
        life: 0,
        maxLife: 0.92
      });

      // Spawn particles outside that get sucked INWARD toward the vortex!
      for (let i = 0; i < 28; i++) {
        const pMat = new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0xa855f7 : 0x00f0ff,
          transparent: true,
          opacity: 1
        });
        const mesh = new THREE.Mesh(this.voxelGeo, pMat);
        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * 4.6,
          (Math.random() - 0.5) * 3.4,
          (Math.random() - 0.5) * 4.6
        );
        mesh.position.copy(pos).add(offset);
        const vel = offset.clone().multiplyScalar(-2.4);
        this.scene.add(mesh);
        this.particles.push({
          mesh,
          mat: pMat,
          vel,
          gravity: 0,
          spin: new THREE.Vector3(8, 8, 8),
          life: 0,
          maxLife: 0.65
        });
      }
      this.spawnShockwave(pos, 0xa855f7, 4.5);
      return;
    }

    if (effectId === 'confetti_party') {
      const confettiColors = [0xff2a55, 0x00f0ff, 0x10f587, 0xffc83b, 0xc084fc, 0xf472b6];
      for (let i = 0; i < 42; i++) {
        const mat = new THREE.MeshBasicMaterial({
          color: confettiColors[i % confettiColors.length],
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 1
        });
        const mesh = new THREE.Mesh(this.confettiGeo, mat);
        mesh.position.copy(pos);
        const ang = Math.random() * Math.PI * 2;
        const spd = 2.0 + Math.random() * 7.5;
        const vel = new THREE.Vector3(Math.cos(ang) * spd, 6.5 + Math.random() * 7.5, Math.sin(ang) * spd);
        this.scene.add(mesh);
        this.particles.push({
          mesh,
          mat,
          vel,
          gravity: 9.5, // Slow flutter!
          spin: new THREE.Vector3(Math.random() * 18, Math.random() * 18, Math.random() * 18),
          life: 0,
          maxLife: 1.25 + Math.random() * 0.4
        });
      }
      this.spawnShockwave(pos, 0xffc83b, 3.6);
      return;
    }

    // Default: 'voxel_classic'
    this.spawnVoxelBurst(pos, palette, 22);
    this.spawnShockwave(pos, 0x10f587, 3.2);
  }

  spawnSparks(pos, color = 0x00f0ff, count = 14, speed = 7) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1
      });
      const mesh = new THREE.Mesh(this.sparkGeo, mat);
      mesh.position.copy(pos);

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const spd = speed * (0.45 + Math.random() * 0.85);
      const vel = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * spd,
        Math.abs(Math.cos(phi)) * spd * 0.8 + 1.5,
        Math.sin(phi) * Math.sin(theta) * spd
      );

      mesh.lookAt(pos.clone().add(vel));
      this.scene.add(mesh);

      this.particles.push({
        mesh,
        mat,
        vel,
        gravity: 18,
        life: 0,
        maxLife: 0.28 + Math.random() * 0.24
      });
    }
  }

  spawnShockwave(pos, color = 0xffd166, maxScale = 2.6) {
    const mat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.42, 24), mat);
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.rings.push({
      mesh,
      mat,
      life: 0,
      maxLife: 0.32,
      maxScale
    });
  }

  // Blood: crimson droplets fly along the hit direction, bounce on the floor and fade
  spawnBlood(pos, dir, count = 12, strength = 1) {
    if (!this._bloodGeo) this._bloodGeo = new THREE.SphereGeometry(0.035, 6, 5);
    const colors = [0x7f1d1d, 0xb91c1c, 0x991b1b];
    const d = dir && dir.lengthSq() > 1e-6 ? dir.clone().normalize() : new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true, opacity: 1 });
      const mesh = new THREE.Mesh(this._bloodGeo, mat);
      mesh.position.copy(pos);
      mesh.scale.setScalar(0.6 + Math.random() * 0.9);
      const spd = (3 + Math.random() * 5) * strength;
      const vel = d.clone().multiplyScalar(spd * (0.5 + Math.random() * 0.6));
      vel.x += (Math.random() - 0.5) * 2.4;
      vel.z += (Math.random() - 0.5) * 2.4;
      vel.y += 1.2 + Math.random() * 2.6;
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        mat,
        vel,
        gravity: 18,
        spin: { x: Math.random() * 9, y: Math.random() * 9, z: Math.random() * 9 },
        life: 0,
        maxLife: 0.75 + Math.random() * 0.5
      });
    }
  }

  // A dark splat that stays on the floor for a few seconds, then fades
  spawnBloodSplat(floorPos, big = false) {
    if (!this._splatGeo) this._splatGeo = new THREE.CircleGeometry(1, 10);
    const group = new THREE.Group();
    group.position.set(floorPos.x, floorPos.y, floorPos.z);
    group.rotation.y = Math.random() * Math.PI * 2;
    const mats = [];
    const blobs = big ? 7 : 4;
    for (let i = 0; i < blobs; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x5b0b0b, transparent: true, opacity: 0.92, depthWrite: false });
      const blob = new THREE.Mesh(this._splatGeo, mat);
      blob.rotation.x = -Math.PI / 2;
      const r = (big ? 0.32 : 0.22) * (0.5 + Math.random());
      blob.scale.set(r * (0.6 + Math.random() * 0.8), r, 1);
      blob.position.set((Math.random() - 0.5) * 0.6, i * 0.001, (Math.random() - 0.5) * 0.6);
      group.add(blob);
      mats.push(mat);
    }
    this.scene.add(group);
    this.specialFx.push({ type: 'splat', group, mats, life: 0, maxLife: 9 });
  }

  spawnFloatingText(worldPos, text, color = '#ffffff', isCrit = false) {
    if (!this.overlay) return;
    const el = document.createElement('div');
    el.className = 'floating-dmg' + (isCrit ? ' crit' : '');
    el.textContent = text;
    el.style.color = color;
    this.overlay.appendChild(el);

    this.floatingLabels.push({
      el,
      worldPos: worldPos.clone(),
      offsetY: 0,
      driftX: (Math.random() - 0.5) * 34,
      life: 0,
      maxLife: isCrit ? 1.05 : 0.78
    });
  }

  update(dt, camera) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        p.mat.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      const g = p.gravity !== undefined ? p.gravity : 18;
      p.vel.y -= g * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.spin) {
        p.mesh.rotation.x += p.spin.x * dt;
        p.mesh.rotation.y += p.spin.y * dt;
        p.mesh.rotation.z += p.spin.z * dt;
        if (g > 0 && p.mesh.position.y < 0.12 && p.vel.y < 0) {
          p.mesh.position.y = 0.12;
          p.vel.y *= -0.45;
        }
      }
      p.mat.opacity = 1 - p.life / p.maxLife;
    }

    for (let i = this.specialFx.length - 1; i >= 0; i--) {
      const fx = this.specialFx[i];
      fx.life += dt;
      const t = Math.min(1, fx.life / fx.maxLife);
      if (fx.life >= fx.maxLife) {
        this.scene.remove(fx.group);
        fx.mats.forEach((m) => m.dispose());
        this.specialFx.splice(i, 1);
        continue;
      }

      if (fx.type === 'lightning') {
        const flicker = Math.random() > 0.25 ? 1 - t : 0.25;
        fx.mats.forEach((m) => {
          m.opacity = Math.max(0, flicker);
        });
      } else if (fx.type === 'void') {
        fx.group.rotation.y += dt * 9;
        const scale = t < 0.7 ? 0.4 + t * 1.1 : Math.max(0.05, (1 - t) * 3.8);
        fx.group.scale.setScalar(scale);
        fx.mats.forEach((m) => {
          m.opacity = 1 - t * 0.85;
        });
      } else {
        if (t > 0.65) {
          const fade = 1 - (t - 0.65) / 0.35;
          fx.mats.forEach((m) => {
            m.opacity = Math.max(0, fade);
          });
        }
      }
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life += dt;
      if (r.life >= r.maxLife) {
        this.scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mat.dispose();
        this.rings.splice(i, 1);
        continue;
      }
      const t = r.life / r.maxLife;
      const s = 0.4 + t * r.maxScale;
      r.mesh.scale.set(s, s, s);
      r.mesh.lookAt(camera.position);
      r.mat.opacity = (1 - t) * 0.9;
    }

    const halfW = window.innerWidth / 2;
    const halfH = window.innerHeight / 2;
    const proj = new THREE.Vector3();

    for (let i = this.floatingLabels.length - 1; i >= 0; i--) {
      const lbl = this.floatingLabels[i];
      lbl.life += dt;
      if (lbl.life >= lbl.maxLife) {
        lbl.el.remove();
        this.floatingLabels.splice(i, 1);
        continue;
      }
      lbl.offsetY += dt * 1.15;
      proj.copy(lbl.worldPos);
      proj.y += lbl.offsetY;
      proj.project(camera);

      if (proj.z > 1) {
        lbl.el.style.opacity = '0';
      } else {
        const sx = proj.x * halfW + halfW + lbl.driftX * (lbl.life / lbl.maxLife);
        const sy = -proj.y * halfH + halfH;
        const fade = lbl.life > lbl.maxLife * 0.55 ? 1 - (lbl.life - lbl.maxLife * 0.55) / (lbl.maxLife * 0.45) : 1;
        lbl.el.style.transform = `translate(-50%, -50%) translate(${sx}px, ${sy}px)`;
        lbl.el.style.opacity = String(Math.max(0, fade));
      }
    }
  }

  clear() {
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
      p.mat.dispose();
    }
    this.particles = [];
    for (const fx of this.specialFx) {
      this.scene.remove(fx.group);
      fx.mats.forEach((m) => m.dispose());
    }
    this.specialFx = [];
    for (const r of this.rings) {
      this.scene.remove(r.mesh);
      r.mesh.geometry.dispose();
      r.mat.dispose();
    }
    this.rings = [];
    for (const l of this.floatingLabels) {
      l.el.remove();
    }
    this.floatingLabels = [];
  }
}
