import * as THREE from 'three';
import { smoothstep, distSegPoint } from '../engine/mathx.js';
import { ENV_DAWN } from '../engine/environments.js';

// THE BROKEN TEMPLE-LIGHTHOUSE (placeholder art), for Mission 2.
// The "big brother" of the Diya-Ghar: a ruined stone temple with a broken tower, in a walled courtyard
// in the middle of the island. Three big mirrors stand in the courtyard. At dawn a sunbeam comes in
// through a gap in the east wall. North is -Z. Headings: (sin a, cos a) on the XZ plane.

const GROUND = 2.2;
const STEP = Math.PI / 8;          // a mirror turns 22.5 degrees per press

export const TEMPLE = {
  start: { x: 0, z: 72 },
  gate: { x: 0, z: 22 },
  gateSpawn: { x: 7, z: 26 },           // checkpoint: behind the south wall, out of the sniper's sight
  door: { x: 0, z: -24 },
  doorSpawn: { x: -4, z: -15 },
  lamp: { x: 3.6, z: -20.6 },
  letter: { x: 5.6, z: -22.6 },
  sniper: { x: 0, z: -23.5, y: GROUND + 7.2 },   // on the roof edge above the door
  beamStart: { x: 31, z: 16, heading: -Math.PI / 2 },   // the sunbeam enters going west
  // The three mirrors. `solution` and `initial` are the number of 22.5-degree steps of the mirror face.
  mirrors: [
    { x: -18, z: 16, initial: 5, solution: 2 },
    { x: -18, z: -6, initial: 1, solution: 6 },
    { x: 0, z: -6, initial: 3, solution: 6 },
  ],
  step: STEP,
  // The drone's scan loop over the courtyard.
  droneRoute: [{ x: -20, z: 10 }, { x: -20, z: -12 }, { x: 0, z: -14 }, { x: 20, z: -10 }, { x: 20, z: 12 }, { x: 0, z: 4 }],
};

const PATH = [[0, 74], [-3, 56], [3, 40], [0, 24], [0, 10]];

function heightAt(x, z) {
  const r = Math.hypot(x, z);
  const land = GROUND - 6.2 * smoothstep(80, 106, r);
  const flat = smoothstep(40, 58, Math.hypot(x, z + 5));   // the courtyard is level
  const bumps = 0.3 * Math.sin(x * 0.12) * Math.cos(z * 0.11) * flat * (1 - smoothstep(70, 86, r));
  return land + bumps;
}

export const temple = {
  id: 'temple',
  env: ENV_DAWN,
  heightAt,
  build(b) {
    const lambert = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });
    const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });

    // ---- ground ----
    const sand = new THREE.Color(0xcdb98a), wet = new THREE.Color(0x8f8263), grass = new THREE.Color(0x6f9a5c);
    const stoneC = new THREE.Color(0x9d9a90), path = new THREE.Color(0xa8946e);
    b.terrain({ size: 240, segments: 96, colorAt(h, x, z, c) {
      if (h < 0.3) c.copy(wet);
      else if (h < 1.3) c.copy(wet).lerp(sand, smoothstep(0.3, 0.9, h));
      else c.copy(sand).lerp(grass, smoothstep(1.3, 1.9, h));
      c.lerp(stoneC, 1 - smoothstep(30, 36, Math.max(Math.abs(x), Math.abs(z + 5) - 3)));   // paved courtyard
      let d = 99;
      for (let i = 0; i < PATH.length - 1; i++) d = Math.min(d, distSegPoint(PATH[i][0], PATH[i][1], PATH[i + 1][0], PATH[i + 1][1], x, z));
      c.lerp(path, (1 - smoothstep(1.2, 3, d)) * 0.8);
    } });

    // ---- courtyard walls: [x, z, sizeX, sizeZ, height]. Gate in the south wall, sun gap in the east wall. ----
    b.boxes(0xa9a498, [
      [-30, -5, 1, 54, 3], [30, -9, 1, 46, 3], [30, 20, 1, 4, 3],
      [-16.5, 22, 27, 1, 3], [16.5, 22, 27, 1, 3],
      [-19, -32, 22, 1, 3], [19, -32, 22, 1, 3],
      // broken wall stubs inside: cover from the sniper
      [-6, 4, 5, 0.8, 2], [12, -12, 0.8, 5, 2], [-26, -14, 0.8, 5, 2], [16, 4, 0.8, 4, 2],
    ]);
    // Crate stacks (gang supplies): tall enough to block shots.
    b.boxes(0x7a5a3a, [[-10, 12, 1.3, 1.3, 2.2], [-24, 8, 1.3, 1.3, 2.2], [-24, -2, 1.3, 1.3, 2.2], [-12, -10, 1.3, 1.3, 2.2],
      [-9, -1, 1.3, 1.3, 2.2], [8, -2, 1.3, 1.3, 2.2], [10, 10, 1.3, 1.3, 2.2], [22, -8, 1.3, 1.3, 2.2], [6, 7, 1.3, 1.3, 2.2], [-4, 26, 1.3, 1.3, 2.2]]);

    // ---- the temple-lighthouse: stepped base, broken tower ----
    const stone = lambert(0xb5b0a2), darkStone = lambert(0x8d897e);
    const t = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(16, 7, 12), stone); base.position.set(0, 3.5, -30);
    const tier = new THREE.Mesh(new THREE.BoxGeometry(11, 2.5, 8), darkStone); tier.position.set(0, 8.25, -31);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.2, 9, 10), stone); tower.position.set(0, 14, -31.5);
    const broken = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.4, 3, 7), darkStone); broken.position.set(0.5, 19.6, -31.5); broken.rotation.z = 0.25;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4.2, 0.4), darkStone); frame.position.set(0, 2.1, -23.9);
    t.add(base, tier, tower, broken, frame);
    for (const x of [-6.5, 6.5]) { // pillars beside the door
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.75, 6.5, 8), darkStone); p.position.set(x, 3.25, -23.4); t.add(p);
    }
    t.position.y = GROUND;
    t.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    b.add(t);
    b.collider(0, -30, 16, 12, 7, true);

    // The door: a dark slab that sinks into the ground when the beam reaches it.
    const doorMat = basic(0x2a241c);
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.6, 0.3), doorMat);
    door.position.set(0, GROUND + 1.8, -23.6);
    b.add(door);
    // Rani Nishaan above the door (same mark as on the Teen-Ungli Chattan).
    const nishaanMat = basic(0x4a4640, { fog: false });
    const nishaan = new THREE.Group();
    nishaan.add(new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.1, 6, 20), nishaanMat),
      new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), nishaanMat));
    nishaan.position.set(0, GROUND + 5.3, -23.8);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(1.7, 10, 8),
      basic(0xffd27a, { transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    glow.position.copy(nishaan.position); glow.visible = false;
    b.add(nishaan); b.add(glow);

    // The temple lamp (a stone bowl) beside the door, and Dadaji's letter behind it.
    const lamp = new THREE.Group();
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 1.1, 8), darkStone); stand.position.y = 0.55;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.45, 0.45, 10), darkStone); bowl.position.y = 1.3;
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.3, 7), basic(0xff8a2f, { fog: false })); flame.position.y = 2.1;
    const flameGlow = new THREE.Mesh(new THREE.SphereGeometry(2.4, 10, 8),
      basic(0xff9a3f, { transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); flameGlow.position.y = 2;
    flame.visible = flameGlow.visible = false;
    lamp.add(stand, bowl, flame, flameGlow);
    lamp.position.set(TEMPLE.lamp.x, GROUND, TEMPLE.lamp.z);
    b.add(lamp);
    b.collider(TEMPLE.lamp.x, TEMPLE.lamp.z, 1.4, 1.4, 1.4, false);
    const letter = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 8), basic(0xe8a33d, { fog: false }));
    letter.rotation.z = Math.PI / 2;
    letter.position.set(TEMPLE.letter.x, GROUND + 0.35, TEMPLE.letter.z);
    letter.visible = false;
    b.add(letter);

    // ---- the three mirrors: a stone stand and a tall turning face ----
    const mirrorMat = basic(0xcfe6f2);
    const mirrors = TEMPLE.mirrors.map((m) => {
      const standMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.6), darkStone);
      standMesh.position.set(m.x, GROUND + 0.5, m.z); standMesh.castShadow = true;
      b.add(standMesh);
      const col = b.collider(m.x, m.z, 1.6, 1.6, 2.6, true);
      col.mirror = true;                       // the light beam ignores the stands
      const face = new THREE.Group();
      const glass = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 0.12), mirrorMat);
      const rim = new THREE.Mesh(new THREE.BoxGeometry(2.9, 2.9, 0.08), lambert(0x8a6a2a));
      glass.position.y = rim.position.y = 1.5;
      face.add(rim, glass);
      face.position.set(m.x, GROUND + 0.9, m.z);
      b.add(face);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6),
        basic(0xfff1c9, { transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      glint.position.set(m.x, GROUND + 2.4, m.z); glint.visible = false;
      b.add(glint);
      const mirror = { x: m.x, z: m.z, state: m.initial, target: m.initial * STEP, glint,
        // The face lies along heading `state * 22.5 degrees`.
        set(k) { mirror.state = ((k % 8) + 8) % 8; mirror.target = mirror.state * STEP; },
        get angle() { return mirror.state * STEP; } };
      mirror.face = face;
      face.rotation.y = mirror.target - Math.PI / 2;
      return mirror;
    });

    // The sunbeam: up to 6 glowing segments.
    const beamMat = basic(0xffe9a8, { transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const beamGeo = new THREE.BoxGeometry(1, 1, 1);
    const segs = [];
    for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(beamGeo, beamMat); s.visible = false; s.frustumCulled = false; b.add(s); segs.push(s); }
    // Where the sun comes in: a bright patch in the wall gap.
    const sunGap = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.6), basic(0xfff1c9, { transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    sunGap.rotation.y = Math.PI / 2; sunGap.position.set(30, GROUND + 1.8, 16);
    b.add(sunGap);

    // ---- outside: palms, boulders, broken pillars on the way up ----
    const palms = [[-18, 60], [16, 58], [-26, 40], [24, 36], [-40, 10], [42, 6], [-44, -30], [44, -34], [-20, -52], [22, -50], [36, 56], [-38, 54]];
    b.instanced(new THREE.CylinderGeometry(0.16, 0.28, 1, 6), 0x7a6040, palms, ([x, z], d) => {
      const col = b.collider(x, z, 0.6, 0.6, 5, false);
      d.position.set(x, col.y + 2.4, z); d.scale.set(1, 5.2, 1);
    });
    b.instanced(new THREE.ConeGeometry(2.3, 1.3, 6), 0x3f8f4f, palms, ([x, z], d) => { d.position.set(x, heightAt(x, z) + 5.2, z); });
    const boulders = [[-6, 58, 2], [7, 50, 1.8], [-12, 40, 2.1], [10, 34, 1.9], [-16, 28, 1.7], [18, 44, 1.6], [1, 54, 1.2]];
    b.instanced(new THREE.IcosahedronGeometry(1, 0), 0x8d8a82, boulders, ([x, z, r], d) => {
      const col = b.collider(x, z, r * 1.4, r * 1.4, r * 1.5, r >= 1.5);
      d.position.set(x, col.y + r * 0.45, z); d.scale.set(r, r * 0.9, r); d.rotation.set(b.rand(), b.rand() * 6, b.rand());
    });
    const pillars = [[-5, 30, 3.2], [5, 30, 2.2], [-5, 38, 1.4], [5, 38, 3.6]];
    b.instanced(new THREE.CylinderGeometry(0.5, 0.6, 1, 8), 0xb5b0a2, pillars, ([x, z, h], d) => {
      b.collider(x, z, 1.1, 1.1, h, h >= 1.8);
      d.position.set(x, heightAt(x, z) + h / 2, z); d.scale.set(1, h, 1);
    });

    // ---- handles for missions ----
    let doorOpen = false, doorY = 0, nishaanLit = false, lampLit = false;
    return {
      mirrors, ground: GROUND,
      // Draw the beam through `points` ([{x, z}, ...]). bright = thick and strong.
      setBeam(points, bright) {
        beamMat.opacity = bright ? 0.85 : 0.3;
        const w = bright ? 0.32 : 0.12;
        segs.forEach((s, i) => {
          const a = points[i], c = points[i + 1];
          s.visible = !!(a && c);
          if (!s.visible) return;
          const len = Math.hypot(c.x - a.x, c.z - a.z);
          s.position.set((a.x + c.x) / 2, GROUND + 2.4, (a.z + c.z) / 2);
          s.rotation.y = Math.atan2(c.x - a.x, c.z - a.z);
          s.scale.set(w, w, len);
        });
      },
      door: { get open() { return doorOpen; }, setOpen(v, instant = false) { doorOpen = v; if (instant) doorY = v ? 1 : 0; doorMat.color.setHex(v ? 0xffe9a8 : 0x2a241c); } },
      nishaan: { get lit() { return nishaanLit; }, setLit(v) { nishaanLit = v; nishaanMat.color.setHex(v ? 0xffd27a : 0x4a4640); glow.visible = v; } },
      lamp: { get lit() { return lampLit; }, setLit(v) { lampLit = v; flame.visible = flameGlow.visible = v; } },
      letter,
      update(dt, time) {
        for (const m of mirrors) {   // mirrors turn smoothly to their new angle
          const want = m.target - Math.PI / 2;
          let d = (want - m.face.rotation.y) % Math.PI; if (d > Math.PI / 2) d -= Math.PI; if (d < -Math.PI / 2) d += Math.PI;
          m.face.rotation.y += d * Math.min(1, dt * 8);
          if (m.glint.visible) m.glint.scale.setScalar(1 + Math.sin(time * 9) * 0.15);
        }
        doorY += ((doorOpen ? 1 : 0) - doorY) * Math.min(1, dt * 1.5);
        door.position.y = GROUND + 1.8 - doorY * 3.7;
        if (glow.visible) glow.scale.setScalar(1 + Math.sin(time * 3) * 0.12);
        if (lampLit) { flame.scale.y = 1 + Math.sin(time * 15) * 0.14; flameGlow.scale.setScalar(1 + Math.sin(time * 6) * 0.06); }
      },
    };
  },
};
