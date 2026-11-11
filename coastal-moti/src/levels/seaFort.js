import * as THREE from 'three';
import { smoothstep } from '../engine/mathx.js';
import { ENV_FORT_NIGHT } from '../engine/environments.js';

// THE SEA-FORT (placeholder art), for Mission 4. New-moon night.
// South to north (north is -Z): open sea -> sea wall with a water tunnel under it -> landing pool ->
// star-dial court -> inner gate -> mural hall -> north gate -> radio tower yard.
// The land is at y = 2, the sea surface at y = 0.

const LAND = 2;

export const FORT = {
  surfaceY: 0,
  swimStart: { x: 0, y: -0.3, z: 36 },
  landing: { x: 0, z: -1.5 },                 // where Veer steps out of the pool
  dial: { x: 0, z: -9 },
  innerGate: { x: 0, z: -18 },
  // Murals along the hall, in story order: x, z and which wall they hang on (-1 west, +1 east).
  murals: [{ x: -6.9, z: -21.5, side: -1 }, { x: 6.9, z: -25, side: 1 }, { x: -6.9, z: -28.5, side: -1 }, { x: 6.9, z: -32, side: 1 }, { x: -6.9, z: -35.5, side: -1 }],
  letter: { x: -5.6, z: -37.9 },
  northGate: { x: 0, z: -40 },
  yardEntry: { x: 0, z: -44 },
  tower: { x: 0, z: -58 },
  powerBox: { x: 6, z: -52 },
  nishaan: { x: 0, z: -55.7 },                // carved on the tower's south leg
  mainGate: { x: 47, z: -12 },                // where the Coast Guard draws fire (far east side)
  waves: [
    [{ x: -14, z: -64 }, { x: 14, z: -64 }, { x: -3, z: -51 }],
    [{ x: -22, z: -46 }, { x: 22, z: -46 }, { x: 0, z: -65.5 }],
  ],
};

function heightAt(x, z) {
  const inside = smoothstep(-74, -71, z) * (1 - smoothstep(20.5, 22.5, z)) * (1 - smoothstep(43, 46, Math.abs(x)));
  let h = -8 + (LAND + 8) * inside;
  // The water channel: from the open sea, under the wall, to a pool with a ramp up to the court.
  const cx = 1 - smoothstep(4.2, 5.2, Math.abs(x));
  const cz = smoothstep(0.5, 5, z);
  h += (-7 - h) * cx * cz;
  return h;
}

export const seaFort = {
  id: 'seaFort',
  env: ENV_FORT_NIGHT,
  heightAt,
  build(b) {
    const lambert = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });
    const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });
    const wallMat = lambert(0x8f8a80);

    // ---- ground: paved stone ----
    const stoneA = new THREE.Color(0x9a968c), stoneB = new THREE.Color(0x7d7a72), wet = new THREE.Color(0x4f5660);
    b.terrain({ size: 200, segments: 100, center: [0, -25], colorAt(h, x, z, c) {
      if (h < 0.5) { c.copy(wet); return; }
      c.copy(stoneB).lerp(stoneA, 0.5 + 0.5 * Math.sin(x * 0.9) * Math.sin(z * 0.9));
    } });

    // ---- walls: [x, z, sizeX, sizeZ, height] ----
    b.boxes(0x8f8a80, [
      [-23.5, 21, 37, 1.2, 5], [23.5, 21, 37, 1.2, 5],             // sea wall (the channel passes between)
      [-20, -8, 1, 21, 4], [20, -8, 1, 21, 4],                     // star-dial court, west / east
      [-11.5, -18, 17, 1, 4], [11.5, -18, 17, 1, 4],               // court north wall (inner gate between)
      [-7.5, -29, 1, 22, 4], [7.5, -29, 1, 22, 4],                 // mural hall
      [-5, -40, 5, 1, 4], [5, -40, 5, 1, 4],                       // hall north end (north gate between)
      [-17, -40, 19, 1, 4], [17, -40, 19, 1, 4],                   // tower yard south wall
      [-26, -54, 1, 28, 4], [26, -54, 1, 28, 4], [0, -68, 53, 1, 4],
      [-8, -52, 5, 0.8, 2], [9, -56, 0.8, 5, 2],                   // low walls in the yard: cover
    ]);
    b.boxes(0x7a5a3a, [[-12, -48, 1.3, 1.3, 2.2], [12, -48, 1.3, 1.3, 2.2], [-16, -58, 1.3, 1.3, 2.2], [16, -58, 1.3, 1.3, 2.2],
      [-6, -63, 1.3, 1.3, 2.2], [6, -63, 1.3, 1.3, 2.2], [-14, -4, 1.3, 1.3, 2.2], [14, -12, 1.3, 1.3, 2.2]]);

    // The wall over the channel and the tunnel roof: they float, so a swimmer must go under them.
    const over = new THREE.Mesh(new THREE.BoxGeometry(10.2, 7, 1.2), wallMat); over.position.set(0, 1.1, 21);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(10.2, 1.2, 11), wallMat); roof.position.set(0, -0.7, 14.5);
    over.castShadow = roof.castShadow = true;
    b.add(over); b.add(roof);
    b.collider(0, 21, 10.2, 1.2, 7, false, -2.4).floating = true;
    b.collider(0, 14.5, 10.2, 11, 3.5, false, -1.3).floating = true;

    // ---- gates: stone slabs that sink when opened ----
    function gate(x, z, w) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 4.2, 0.9), lambert(0x5a554c));
      mesh.position.set(x, LAND + 2.1, z); mesh.castShadow = true;
      b.add(mesh);
      let col = b.collider(x, z, w, 1, 4, true), open = false, k = 0;
      return { mesh, get open() { return open; },
        setOpen(v, instant = false) {
          if (v && col) { b.world.removeCollider(col); col = null; }
          open = v; if (instant) k = v ? 1 : 0;
        },
        tick(dt) { k += ((open ? 1 : 0) - k) * Math.min(1, dt * 1.6); mesh.position.y = LAND + 2.1 - k * 4.4; } };
    }
    const innerGate = gate(FORT.innerGate.x, FORT.innerGate.z, 6.2);
    const northGate = gate(FORT.northGate.x, FORT.northGate.z, 5.2);

    // ---- the star dial: a stone table with three rings ----
    const dial = new THREE.Group();
    const table = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 0.9, 12), lambert(0x6f6a60)); table.position.y = 0.45;
    dial.add(table);
    const ringMat = lambert(0x8a6a2a), gemMat = basic(0xbfe9ff, { fog: false });
    const rings = [1.45, 1.05, 0.65].map((r) => {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.09, 6, 24), ringMat); ring.rotation.x = Math.PI / 2;
      const gem = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), gemMat); gem.position.set(0, 0.05, -r);
      g.add(ring, gem); g.position.y = 0.98;
      dial.add(g);
      return g;
    });
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), basic(0xffd27a, { fog: false })); star.position.set(0, 1.25, -1.85);
    dial.add(star);
    dial.position.set(FORT.dial.x, LAND, FORT.dial.z);
    b.add(dial);
    b.collider(FORT.dial.x, FORT.dial.z, 3.2, 3.2, 1, false);

    // ---- murals: painted panels on the hall walls (the animated versions play as 2D overlays) ----
    const muralColors = [0x2f6f8f, 0x7a2f25, 0x8a6a2a, 0x3a3f5a, 0xe8a33d];
    const murals = FORT.murals.map((m, i) => {
      const g = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 3.4), lambert(0x4a3824));
      const paintMat = basic(muralColors[i]);
      const paint = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.2), paintMat);
      paint.rotation.y = -m.side * Math.PI / 2; paint.position.x = -m.side * 0.08;
      const lampMat = basic(0x3a3428, { fog: false });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), lampMat); lamp.position.set(-m.side * 0.3, 1.6, 0);
      g.add(frame, paint, lamp);
      g.position.set(m.x, LAND + 1.9, m.z);
      b.add(g);
      paintMat.color.multiplyScalar(0.35);
      const base = new THREE.Color(muralColors[i]);
      return { x: m.x - m.side * 1.6, z: m.z, seen: false,
        // state: 'dark' (not yet), 'ready' (next to read: lamp glows), 'seen'
        setState(state) { lampMat.color.setHex(state === 'ready' ? 0xffd27a : state === 'seen' ? 0x8a7a4a : 0x3a3428); paintMat.color.copy(base).multiplyScalar(state === 'dark' ? 0.35 : 1); } };
    });
    const letter = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 8), basic(0xe8a33d, { fog: false }));
    letter.rotation.z = Math.PI / 2; letter.position.set(FORT.letter.x, LAND + 0.35, FORT.letter.z); letter.visible = false;
    b.add(letter);

    // ---- radio tower: four legs, a platform, an aerial, a red lamp, and the power box ----
    const steel = lambert(0x3a3f47);
    const tower = new THREE.Group();
    for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 15, 0.3), steel); leg.position.set(x, 7.5, z); tower.add(leg);
    }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.3, 4.4), steel); deck.position.y = 15;
    const aerial = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 7, 6), steel); aerial.position.y = 18.6;
    const beaconMat = basic(0xff3b30, { fog: false });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), beaconMat); beacon.position.y = 22.2;
    const walkway = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.25, 4.4), steel); walkway.position.y = 6;   // Baaz stands here
    tower.add(deck, walkway, aerial, beacon);
    tower.position.set(FORT.tower.x, LAND, FORT.tower.z);
    tower.traverse((o) => { if (o.isMesh && o !== beacon) o.castShadow = true; });
    b.add(tower);
    b.collider(FORT.tower.x, FORT.tower.z, 4, 4, 15, true);
    const boxLampMat = basic(0x6dff8a, { fog: false });
    const box = new THREE.Group();
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.5, 0.7), lambert(0x565b63)); cabinet.position.y = 0.75;
    const boxLamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), boxLampMat); boxLamp.position.set(0, 1.25, 0.38);
    box.add(cabinet, boxLamp);
    box.position.set(FORT.powerBox.x, LAND, FORT.powerBox.z);
    b.add(box);
    b.collider(FORT.powerBox.x, FORT.powerBox.z, 1.2, 0.9, 1.5, false);
    // Baaz: only ever a far-off dark shape on the tower's walkway.
    const baaz = new THREE.Group();
    const shade = basic(0x020304, { fog: false });
    const bb = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.9, 4, 8), shade); bb.position.y = 1.05;
    const bh = new THREE.Mesh(new THREE.SphereGeometry(0.23, 8, 6), shade); bh.position.y = 1.9;
    // A dull red glow behind him (the tower's warning lamp) so the black shape reads against the night sky.
    const back = new THREE.Mesh(new THREE.CircleGeometry(1.9, 20), basic(0xff3b30, { transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    back.position.set(0, 1.3, -0.5);
    baaz.add(back, bb, bh);
    baaz.position.set(FORT.tower.x, LAND + 6.12, FORT.tower.z + 1.7);
    baaz.visible = false;
    b.add(baaz);
    // Rani Nishaan on the tower's south side.
    const nishaanMat = basic(0x4a4640, { fog: false });
    const nishaan = new THREE.Group();
    nishaan.add(new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.08, 6, 20), nishaanMat), new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), nishaanMat));
    nishaan.position.set(FORT.nishaan.x, LAND + 1.7, FORT.nishaan.z);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8), basic(0xffd27a, { transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    glow.position.copy(nishaan.position); glow.visible = false;
    b.add(nishaan); b.add(glow);

    // ---- torches: a flame and a pool of warm light (no real lights: cheap) ----
    const torches = [[-18, 0], [18, 0], [-18, -16], [18, -16], [-6.5, -19.5], [6.5, -30], [-6.5, -38.5], [-24, -42], [24, -42], [-24, -66], [24, -66], [-6, 6], [6, 6]];
    b.instanced(new THREE.CylinderGeometry(0.07, 0.09, 2.4, 6), 0x2c2c2c, torches, ([x, z], d) => { d.position.set(x, heightAt(x, z) + 1.2, z); });
    const flames = b.instanced(new THREE.ConeGeometry(0.2, 0.6, 6), basic(0xffa040, { fog: false }), torches, ([x, z], d) => { d.position.set(x, heightAt(x, z) + 2.7, z); }, false);
    for (const [x, z] of torches) b.groundGlow(x, z, 7, 0xffa040, 0.3, false);

    // ---- the sky: stars, and the far-off gunfire at the main gate ----
    const N = 520, sp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = b.rand() * Math.PI * 2, e = 0.08 + b.rand() * 1.45, r = 820;
      sp.set([Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r], i * 3);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.7, sizeAttenuation: false, fog: false, depthWrite: false }));
    stars.frustumCulled = false;
    b.add(stars);
    const flash = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), basic(0xffd27a, { transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    flash.position.set(FORT.mainGate.x, LAND + 3, FORT.mainGate.z);
    b.add(flash);

    let powered = true, nishaanLit = false, battle = false, flashT = 0;
    return {
      innerGate, northGate, murals, letter, baaz,
      // Ring angles in the world copy the puzzle: `state` is [outer, middle, inner], `steps` positions per turn.
      setDial(state, steps) { rings.forEach((g, i) => { g.rotation.y = -state[i] * Math.PI * 2 / steps; }); },
      nishaan: { get lit() { return nishaanLit; }, setLit(v) { nishaanLit = v; nishaanMat.color.setHex(v ? 0xffd27a : 0x4a4640); glow.visible = v; } },
      tower: { get powered() { return powered; }, setPower(v) { powered = v; beaconMat.color.setHex(v ? 0xff3b30 : 0x1a1a1a); boxLampMat.color.setHex(v ? 0x6dff8a : 0x1a1a1a); } },
      setBattle(v) { battle = v; },
      get battleFlash() { return flash.material.opacity; },
      update(dt, time) {
        innerGate.tick(dt); northGate.tick(dt);
        stars.position.copy(b.camera?.position ?? stars.position);
        if (glow.visible) glow.scale.setScalar(1 + Math.sin(time * 3) * 0.12);
        if (powered) beacon.visible = Math.sin(time * 4) > -0.3;
        flames.rotation.y = 0;
        // Gunfire at the main gate: irregular flashes.
        flashT -= dt;
        if (battle && flashT <= 0) { flashT = 0.12 + Math.random() * 0.9; flash.material.opacity = 0.9; }
        flash.material.opacity = Math.max(0, flash.material.opacity - dt * 6);
      },
    };
  },
};
