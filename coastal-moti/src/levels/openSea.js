import * as THREE from 'three';
import { smoothstep, distSegPoint } from '../engine/mathx.js';
import { ENV_SEA_NIGHT } from '../engine/environments.js';

// OPEN SEA + THE ISLAND (placeholder art), for Mission 1.
// A long stretch of dark water with sea rocks to hide behind, and at the north end the island
// with the "Teen-Ungli Chattan": a rock with three finger-like pillars. North is -Z.

const ISLAND = { x: 0, z: -150 };
const CHATTAN = { x: 6, z: -162 };
// Sunrise comes from the east, a little south. Shadows fall the opposite way.
const SUN = { x: 0.94, z: 0.34 };
const SLAB_RING = 8;

const slabAt = (bx, bz) => ({ x: CHATTAN.x + bx * SLAB_RING, z: CHATTAN.z + bz * SLAB_RING });

export const OPEN_SEA = {
  island: ISLAND,
  start: { x: 0, z: 150 },
  midShelter: { x: 10, z: 50 },          // behind a big rock: checkpoint
  landing: { x: 0, z: -108 },            // where the boat touches the beach
  beach: { x: 0, z: -116 },
  chattan: CHATTAN,
  sunStone: { x: CHATTAN.x + SUN.x * 10, z: CHATTAN.z + SUN.z * 10 },
  // Five flat stones around the rock. Index 0 is the right one: opposite the sun mark.
  slabs: [slabAt(-SUN.x, -SUN.z), slabAt(0, -1), slabAt(0, 1), slabAt(-0.64, 0.77), slabAt(0.77, -0.64)],
  correctSlab: 0,
  dust: { x: 13, z: -170 },
  windFrom: Math.PI,                     // the night wind blows from the island (north) out to sea
};

const PATH = [[0, -112], [-2, -128], [2, -142], [5, -154]];

function heightAt(x, z) {
  const r = Math.hypot(x - ISLAND.x, z - ISLAND.z);
  if (r > 60) return -3.8;
  const land = 3.2 - 7 * smoothstep(26, 52, r);
  const top = 2.5 * Math.exp(-((x - CHATTAN.x) ** 2 + (z - CHATTAN.z) ** 2) / 170);
  const bumps = 0.22 * Math.sin(x * 0.3) * Math.cos(z * 0.27) * (1 - smoothstep(18, 30, r));
  return land + top + bumps;
}

export const openSea = {
  id: 'openSea',
  env: ENV_SEA_NIGHT,
  heightAt,
  build(b) {
    const lambert = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });
    const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });

    // ---- island ground -----------------------------------------------------
    const sand = new THREE.Color(0xa8966f), wet = new THREE.Color(0x6f6650), grass = new THREE.Color(0x4f7550);
    const rock = new THREE.Color(0x7d838b), path = new THREE.Color(0x8a7658);
    b.terrain({ size: 130, segments: 64, center: [ISLAND.x, ISLAND.z], colorAt(h, x, z, c) {
      if (h < 0.3) c.copy(wet);
      else if (h < 1.2) c.copy(wet).lerp(sand, smoothstep(0.3, 0.9, h));
      else if (h < 4.2) c.copy(sand).lerp(grass, smoothstep(1.2, 1.9, h));
      else c.copy(grass).lerp(rock, smoothstep(4.2, 5.4, h));
      let d = 99;
      for (let i = 0; i < PATH.length - 1; i++) d = Math.min(d, distSegPoint(PATH[i][0], PATH[i][1], PATH[i + 1][0], PATH[i + 1][1], x, z));
      c.lerp(path, 1 - smoothstep(1, 2.6, d));
    } });

    // ---- sea rocks: [x, z, radius]. They block boats AND searchlights. --------
    const rocks = [[-30, 112, 4.5], [22, 118, 4], [-8, 72, 5], [35, 66, 4], [-45, 60, 4.5], [10, 38, 5.5], [-28, 30, 4.5], [48, 28, 4],
      [-12, 2, 5], [30, -6, 4.5], [-72, -2, 4], [5, -42, 5], [-30, -48, 4.5], [40, -52, 4], [-18, -82, 4.5], [22, -78, 4]];
    b.instanced(new THREE.IcosahedronGeometry(1, 0), 0x565b63, rocks, ([x, z, r], d) => {
      b.collider(x, z, r * 1.5, r * 1.5, r * 1.6, true);
      d.position.set(x, r * 0.35, z);
      d.scale.set(r, r * 1.25, r);
      d.rotation.set(b.rand() * 0.5, b.rand() * 6, b.rand() * 0.5);
    });

    // ---- Teen-Ungli Chattan: a rock base and three finger pillars ---------------
    const baseY = heightAt(CHATTAN.x, CHATTAN.z);
    const stone = lambert(0x8f949c);
    const chattan = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.2, 1.6, 9), stone);
    base.position.y = 0.6;
    chattan.add(base);
    // The fingers stand in a row across the sunrise direction, so their three shadows fall side by side.
    const across = { x: -SUN.z, z: SUN.x };
    const fingers = [[-1.9, 7.2], [0, 8.8], [1.9, 6.6]];
    for (const [off, h] of fingers) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, h, 7), stone);
      f.position.set(across.x * off, 1.2 + h / 2, across.z * off);
      f.rotation.z = (off * 0.02);
      chattan.add(f);
    }
    chattan.position.set(CHATTAN.x, baseY, CHATTAN.z);
    chattan.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    b.add(chattan);
    b.collider(CHATTAN.x, CHATTAN.z, 6.4, 6.4, 9, true);

    // Rani Nishaan: a carved mark on the west face of the base (ring + pearl). Dark until it is earned.
    const nishaanMat = basic(0x3a3f47, { fog: false });
    const nishaan = new THREE.Group();
    nishaan.add(new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.09, 6, 20), nishaanMat),
      new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), nishaanMat),
      new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 6, 14, Math.PI), nishaanMat));
    nishaan.children[2].rotation.z = Math.PI;
    nishaan.position.set(CHATTAN.x - SUN.x * 4.05, baseY + 1.0, CHATTAN.z - SUN.z * 4.05);
    nishaan.lookAt(CHATTAN.x - SUN.x * 20, baseY + 1.0, CHATTAN.z - SUN.z * 20);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8),
      basic(0xffd27a, { transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    glow.position.copy(nishaan.position);
    glow.visible = false;
    b.add(nishaan); b.add(glow);

    // The sun mark: an upright stone with a carved sun, on the sunrise side.
    const sunStone = new THREE.Group();
    const slabMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 0.5), lambert(0x767b83));
    slabMesh.position.y = 1.1;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), basic(0xe8a33d));
    disc.position.set(0, 1.35, 0.27);
    sunStone.add(slabMesh, disc);
    for (let i = 0; i < 8; i++) {
      const ray = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.26), basic(0xe8a33d));
      const a = (i / 8) * Math.PI * 2;
      ray.position.set(Math.sin(a) * 0.66, 1.35 + Math.cos(a) * 0.66, 0.27);
      ray.rotation.z = -a;
      sunStone.add(ray);
    }
    const ss = OPEN_SEA.sunStone;
    sunStone.position.set(ss.x, heightAt(ss.x, ss.z), ss.z);
    sunStone.lookAt(CHATTAN.x, heightAt(ss.x, ss.z), CHATTAN.z);
    b.add(sunStone);
    b.collider(ss.x, ss.z, 1.6, 1.6, 2.2, false);

    // Five flat stones where a diya can be placed.
    b.instanced(new THREE.CylinderGeometry(0.9, 1.0, 0.25, 8), 0x9a9588, OPEN_SEA.slabs, (s, d) => {
      d.position.set(s.x, heightAt(s.x, s.z) + 0.1, s.z);
    });

    // The three finger shadows + sunrise glow, shown when the diya is on the right stone.
    const shadows = new THREE.Group();
    const good = OPEN_SEA.slabs[OPEN_SEA.correctSlab];
    for (const [off] of fingers) {
      const fx = CHATTAN.x + across.x * off, fz = CHATTAN.z + across.z * off;
      const len = Math.hypot(good.x - fx, good.z - fz) + 1.5;
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.7, len).rotateX(-Math.PI / 2),
        basic(0xffc56b, { transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
          polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      const mx = (fx + good.x) / 2, mz = (fz + good.z) / 2;
      stripe.position.set(mx, heightAt(mx, mz) + 0.35, mz);
      stripe.rotation.y = Math.atan2(good.x - fx, good.z - fz);
      shadows.add(stripe);
    }
    shadows.visible = false;
    b.add(shadows);

    // The diya (clay lamp) the player carries: a bowl and a flame.
    const diya = new THREE.Group();
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.11, 0.12, 8), lambert(0x9c5a32));
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.24, 6), basic(0xffb347, { fog: false }));
    flame.position.y = 0.2;
    const flameGlow = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6),
      basic(0xffb347, { transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    flameGlow.position.y = 0.2;
    diya.add(bowl, flame, flameGlow);
    diya.visible = false;
    b.add(diya);

    // A swirl of dust hiding Dadaji's letter. Vayu blows it away.
    const dust = new THREE.Group();
    const dustMat = basic(0xb9a67c, { transparent: true, opacity: 0.5, depthWrite: false });
    const puffGeo = new THREE.SphereGeometry(1, 7, 5);
    for (let i = 0; i < 9; i++) {
      const puff = new THREE.Mesh(puffGeo, dustMat);
      puff.userData = { a: (i / 9) * Math.PI * 2, r: 1.2 + (i % 3) * 0.9, y: 0.8 + (i % 4) * 0.6, s: 1 + (i % 3) * 0.35 };
      dust.add(puff);
    }
    const dp = OPEN_SEA.dust;
    dust.position.set(dp.x, heightAt(dp.x, dp.z), dp.z);
    dust.visible = false;
    b.add(dust);
    const letter = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 8), basic(0xe8a33d, { fog: false }));
    letter.rotation.z = Math.PI / 2;
    letter.position.set(dp.x, heightAt(dp.x, dp.z) + 0.35, dp.z);
    letter.visible = false;
    b.add(letter);

    // A few palms and boulders so the island does not look bare.
    const palms = [[-16, -134], [14, -130], [-22, -152], [24, -150], [-8, -176], [20, -176], [-26, -168]];
    b.instanced(new THREE.CylinderGeometry(0.16, 0.28, 1, 6), 0x6a5238, palms, ([x, z], d) => {
      const col = b.collider(x, z, 0.6, 0.6, 5, false);
      d.position.set(x, col.y + 2.4, z); d.scale.set(1, 5.2, 1); d.rotation.z = 0.12;
    });
    b.instanced(new THREE.ConeGeometry(2.3, 1.3, 6), 0x2f6a45, palms, ([x, z], d) => {
      d.position.set(x - 0.6, heightAt(x, z) + 5.2, z); d.rotation.z = 0.3;
    });
    const boulders = [[-10, -140, 1.3], [11, -146, 1.1], [-14, -160, 1.5], [18, -166, 1.2], [-4, -122, 1]];
    b.instanced(new THREE.IcosahedronGeometry(1, 0), 0x6f747c, boulders, ([x, z, r], d) => {
      const col = b.collider(x, z, r * 1.4, r * 1.4, r * 1.5, r >= 1.4);
      d.position.set(x, col.y + r * 0.4, z); d.scale.set(r, r * 0.85, r); d.rotation.set(b.rand(), b.rand() * 6, b.rand());
    });

    // ---- handles for missions --------------------------------------------------
    let dustFade = -1, nishaanLit = false;
    return {
      diya, shadows, dust, letter,
      nishaan: {
        get lit() { return nishaanLit; },
        setLit(v) { nishaanLit = v; nishaanMat.color.setHex(v ? 0xffd27a : 0x3a3f47); glow.visible = v; },
      },
      // Put the diya on stone i. lit = false shows it gone out.
      placeDiya(i, lit = true) {
        const s = OPEN_SEA.slabs[i];
        diya.position.set(s.x, heightAt(s.x, s.z) + 0.3, s.z);
        diya.visible = true;
        flame.visible = flameGlow.visible = lit;
      },
      showDust(v) { dust.visible = v; dustFade = -1; dustMat.opacity = 0.5; dust.scale.setScalar(1); },
      blowDustAway() { if (dust.visible && dustFade < 0) dustFade = 0; },
      update(dt, time) {
        if (glow.visible) glow.scale.setScalar(1 + Math.sin(time * 3) * 0.12);
        if (diya.visible) flame.scale.y = 1 + Math.sin(time * 17) * 0.15;
        if (dust.visible) {
          for (const p of dust.children) {
            const u = p.userData, a = u.a + time * 1.6;
            p.position.set(Math.cos(a) * u.r, u.y + Math.sin(time * 2 + u.a) * 0.2, Math.sin(a) * u.r);
            p.scale.setScalar(u.s);
          }
          if (dustFade >= 0) {
            dustFade += dt;
            dustMat.opacity = Math.max(0, 0.5 * (1 - dustFade / 0.7));
            dust.scale.setScalar(1 + dustFade * 3);
            if (dustFade > 0.7) dust.visible = false;
          }
        }
      },
    };
  },
};
