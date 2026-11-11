import * as THREE from 'three';
import { smoothstep } from '../engine/mathx.js';
import { ENV_BARGE_DAY } from '../engine/environments.js';

// UNDER THE KAALA JAAL SALVAGE BARGE (placeholder art), for Mission 3.
// The sea surface is y = 0. The barge floats in the middle; the sea bed is about 16 m down with an old
// wreck, rocks, kelp and two air pockets. Three oysters carry Rani Chandravati's mark. North is -Z.

const DEPTH = -16;

function heightAt(x, z) {
  const mound = 2.6 * Math.exp(-((x + 22) ** 2 + (z + 15) ** 2) / 260) + 2 * Math.exp(-((x - 20) ** 2 + (z - 16) ** 2) / 200);
  return DEPTH + 1.1 * Math.sin(x * 0.07) * Math.cos(z * 0.06) + mound;
}
const bedY = (x, z, lift = 0) => heightAt(x, z) + lift;

export const BARGE = {
  surfaceY: 0,
  start: { x: 5, y: -0.3, z: 46 },                 // in the water beside Dadaji's boat
  boat: { x: 2, z: 49 },
  underBarge: { x: 0, y: -7, z: 0 },
  // Oysters with the queen's mark: x, z (they sit on the sea bed).
  oysters: [{ x: -24, z: -8 }, { x: 21, z: 13 }, { x: 5, z: -34 }],
  net: { x: 10, z: -30 },                          // where Damini gets tangled
  // Air pockets: breath refills inside the radius.
  airPockets: [
    { x: -4, z: 30, y: bedY(-4, 30, 2.1), r: 2.6, name: 'upturned boat' },
    { x: -12, z: -36, y: bedY(-12, -36, 2.4), r: 2.8, name: 'rock arch' },
  ],
  gunman: { x: 0, y: 3.1, z: 15.5 },               // on the barge deck, south end
  // Fixed 3D patrol loops for the three divers.
  divers: [
    { start: 0, route: [{ x: -31, y: -9.5, z: -1 }, { x: -15, y: -9.5, z: -1 }, { x: -15, y: -9.5, z: -24 }, { x: -31, y: -9.5, z: -24 }] },
    { start: 0, route: [{ x: 0, y: -6, z: -14 }, { x: 0, y: -6, z: 14 }] },
    { start: 2, route: [{ x: 13, y: -10.5, z: 21 }, { x: 29, y: -10.5, z: 21 }, { x: 29, y: -10.5, z: 6 }, { x: 13, y: -10.5, z: 6 }] },
  ],
};
for (const o of BARGE.oysters) o.y = bedY(o.x, o.z, 0.45);
BARGE.net.y = bedY(BARGE.net.x, BARGE.net.z, 1.6);

export const barge = {
  id: 'barge',
  env: ENV_BARGE_DAY,
  heightAt,
  build(b) {
    const lambert = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });
    const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });

    // ---- sea bed ----
    const sandA = new THREE.Color(0xd9c9a0), sandB = new THREE.Color(0xa9a488), weed = new THREE.Color(0x6f9a7a);
    b.terrain({ size: 170, segments: 64, colorAt(h, x, z, c) {
      c.copy(sandB).lerp(sandA, smoothstep(DEPTH - 1, DEPTH + 1.5, h));
      c.lerp(weed, 0.35 * (0.5 + 0.5 * Math.sin(x * 0.21 + z * 0.17)));
    } });

    // ---- the barge: a floating steel box with a crane ----
    const hullMat = lambert(0x3a3f47), rust = lambert(0x7a3f2a);
    const bargeGroup = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(14, 3.6, 34), hullMat); hull.position.y = 0.2;
    const band = new THREE.Mesh(new THREE.BoxGeometry(14.1, 0.5, 34.1), rust); band.position.y = 1.3;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 6), lambert(0x565b63)); cabin.position.set(0, 3.5, -11);
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.6, 9, 0.6), rust); mast.position.set(3, 6.5, 2);
    const jib = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 11), rust); jib.position.set(3, 10.6, 6); jib.rotation.x = 0.2;
    bargeGroup.add(hull, band, cabin, mast, jib);
    bargeGroup.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    b.add(bargeGroup);
    b.collider(0, 0, 14, 34, 3.6, false, -1.6).floating = true;
    // Salvage cables from the barge down to the wreck.
    const cables = [[-5, -10, -20, -15], [5, -10, -24, -12], [-5, 12, -6, 26]];
    b.instanced(new THREE.CylinderGeometry(0.07, 0.07, 1, 5), 0x2a2d33, cables, ([x0, z0, x1, z1], d) => {
      const a = new THREE.Vector3(x0, -1.5, z0), c = new THREE.Vector3(x1, bedY(x1, z1, 1), z1);
      d.position.copy(a).add(c).multiplyScalar(0.5);
      d.scale.set(1, a.distanceTo(c), 1);
      d.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.clone().sub(a).normalize());
    }, false);

    // ---- the old wreck (blocks sight) and sea rocks ----
    b.boxes(0x5a4a3a, [[-22, -15, 10, 5, 4.2], [-22, -15, 3, 9, 2.6]]);
    const rocks = [[22, 17, 2.6], [-36, 8, 3.2], [34, -16, 3], [-8, -22, 2.4], [16, -22, 2.8], [-18, 20, 2.6], [38, 30, 3], [-40, -34, 3.2], [12, 38, 2.2], [-30, 40, 2.8]];
    b.instanced(new THREE.IcosahedronGeometry(1, 0), 0x6d7379, rocks, ([x, z, r], d) => {
      const col = b.collider(x, z, r * 1.5, r * 1.5, r * 1.7, true);
      d.position.set(x, col.y + r * 0.55, z); d.scale.set(r, r * 1.2, r); d.rotation.set(b.rand() * 0.6, b.rand() * 6, b.rand() * 0.6);
    });
    // Kelp: tall thin blades (decoration, one draw call).
    const kelp = [];
    for (let i = 0; i < 70; i++) { const x = (b.rand() - 0.5) * 130, z = (b.rand() - 0.5) * 130; if (Math.abs(x) < 9 && Math.abs(z) < 20) continue; kelp.push([x, z, 2.5 + b.rand() * 4, b.rand() * 3]); }
    b.instanced(new THREE.BoxGeometry(0.16, 1, 0.5), 0x3f8f5f, kelp, ([x, z, h, rot], d) => {
      d.position.set(x, bedY(x, z, h / 2), z); d.scale.set(1, h, 1); d.rotation.set(0.12, rot, 0.1);
    }, false);

    // ---- air pockets: an upturned boat and a rock arch, each with a bright bubble of air ----
    const airMat = basic(0xdff8ff, { transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const bubbles = BARGE.airPockets.map((a) => {
      const bubble = new THREE.Mesh(new THREE.SphereGeometry(a.r * 0.7, 12, 8), airMat);
      bubble.position.set(a.x, a.y, a.z);
      b.add(bubble);
      return bubble;
    });
    const boatShell = new THREE.Mesh(new THREE.SphereGeometry(2.6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), lambert(0x6b4a2f));
    boatShell.scale.set(1, 0.8, 1.7);
    boatShell.position.set(BARGE.airPockets[0].x, BARGE.airPockets[0].y + 0.4, BARGE.airPockets[0].z);
    b.add(boatShell);
    const arch = BARGE.airPockets[1];
    b.instanced(new THREE.IcosahedronGeometry(1, 0), 0x6d7379, [[arch.x - 3.2, arch.z, 0], [arch.x + 3.2, arch.z, 0], [arch.x, arch.z, 1]], ([x, z, top], d) => {
      if (top) { d.position.set(x, arch.y + 2.6, z); d.scale.set(4.6, 1.3, 2.6); }
      else { d.position.set(x, bedY(x, z, 1.6), z); d.scale.set(1.5, 3, 2); }
    });

    // ---- the three oysters with Rani Chandravati's mark ----
    const shellMat = lambert(0x8a7f96), darkShell = lambert(0x6b6275);
    const oysters = BARGE.oysters.map((o) => {
      const g = new THREE.Group();
      const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), darkShell); bottom.scale.y = 0.5;
      const lid = new THREE.Group();
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), shellMat); top.scale.y = 0.55;
      lid.add(top); lid.position.z = -0.65; top.position.z = 0.65;
      const markMat = basic(0xb89a5a, { fog: false });
      const mark = new THREE.Group();   // the queen's mark: a ring and a pearl
      mark.add(new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.04, 6, 16), markMat), new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), markMat));
      mark.rotation.x = -Math.PI / 2; mark.position.set(0, 0.42, 0.65);
      lid.add(mark);
      const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), basic(0xfff6e0, { fog: false })); pearl.position.y = 0.12; pearl.visible = false;
      const glow = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8), basic(0xffd27a, { transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      glow.visible = false;
      g.add(bottom, lid, pearl, glow);
      g.position.set(o.x, o.y - 0.35, o.z);
      b.add(g);
      const oyster = { x: o.x, y: o.y, z: o.z, open: false, lid, glow,
        setOpen(v) { oyster.open = v; pearl.visible = glow.visible = v; markMat.color.setHex(v ? 0xffd27a : 0xb89a5a); } };
      return oyster;
    });

    // ---- the net that traps Damini: a loose ball of strands ----
    const net = new THREE.Group();
    const netMat = basic(0x9fb39a, { transparent: true, opacity: 0.85 });
    const strands = [];
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.03, 4, 18), netMat);
      s.rotation.set(i * 0.7, i * 1.1, i * 0.4);
      net.add(s); strands.push(s);
    }
    net.position.set(BARGE.net.x, BARGE.net.y, BARGE.net.z);
    net.visible = false;
    b.add(net);

    // ---- Dadaji's boat on the surface, with a letter tube tied to it ----
    const boat = new THREE.Group();
    const bh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 3.4), lambert(0x6b4a2f)); bh.position.y = 0.2;
    const br = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.1, 3.5), lambert(0x2f6f8f)); br.position.y = 0.5;
    boat.add(bh, br);
    boat.position.set(BARGE.boat.x, 0, BARGE.boat.z); boat.rotation.y = 0.5;
    b.add(boat);
    const letter = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.55, 8), basic(0xe8a33d, { fog: false }));
    letter.rotation.z = Math.PI / 2; letter.position.set(BARGE.boat.x + 1.3, 0.1, BARGE.boat.z - 0.6); letter.visible = false;
    b.add(letter);

    // ---- cheap underwater life: god-rays, fish, bubbles (one draw call each) ----
    const rays = [];
    for (let i = 0; i < 26; i++) rays.push([(b.rand() - 0.5) * 110, (b.rand() - 0.5) * 110, b.rand() * 3, 1.2 + b.rand() * 2]);
    const rayMesh = b.instanced(new THREE.PlaneGeometry(1, 22), basic(0xcff4ff, { transparent: true, opacity: 0.055, blending: THREE.AdditiveBlending,
      depthWrite: false, fog: false, side: THREE.DoubleSide }), rays, ([x, z, rot, w], d) => {
      d.position.set(x, -10.5, z); d.rotation.set(0.12, rot, 0.16); d.scale.set(w, 1, 1);
    }, false);

    const FISH = 44;
    const fish = new THREE.InstancedMesh(new THREE.ConeGeometry(0.11, 0.5, 5).rotateX(Math.PI / 2), lambert(0xe9b96a), FISH);
    fish.frustumCulled = false;
    b.add(fish);
    const schools = [[-10, -9, 8, 7], [18, -11, -8, 6], [-26, -8, -26, 5], [8, -5, 30, 8]];   // x, y, z, radius
    const fd = new THREE.Object3D();

    const N = 170;
    const bp = new Float32Array(N * 3);
    for (let i = 0; i < N * 3; i++) bp[i] = Math.random();
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
    const bubbleUniforms = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uScale: { value: 300 } };
    const bubbleCloud = new THREE.Points(bg, new THREE.ShaderMaterial({
      uniforms: bubbleUniforms, transparent: true, depthWrite: false, fog: false,
      vertexShader: /* glsl */`
        uniform float uTime, uScale; uniform vec3 uCam;
        const vec3 BOX = vec3(44.0, 18.0, 44.0);
        void main() {
          vec3 p = position * BOX;
          p.y = mod(p.y + uTime * (1.2 + fract(position.x * 31.7) * 1.4), BOX.y);
          p.xz = mod(p.xz - uCam.xz, BOX.xz) - BOX.xz * 0.5;
          p.x += sin(uTime * 2.0 + position.z * 40.0) * 0.15;
          vec3 world = vec3(uCam.x + p.x, -17.5 + p.y, uCam.z + p.z);
          vec4 mv = viewMatrix * vec4(world, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(uScale * 0.06 / -mv.z, 1.0, 9.0);
        }`,
      fragmentShader: /* glsl */`
        precision mediump float;
        void main() { vec2 c = gl_PointCoord - 0.5; float d = dot(c, c); if (d > 0.25) discard; gl_FragColor = vec4(0.85, 0.97, 1.0, 0.35 + d); }`,
    }));
    bubbleCloud.frustumCulled = false;
    b.add(bubbleCloud);

    return {
      oysters, net, strands, letter, bubbles, rayMesh,
      // Show n of the net's strands (9 = whole, 0 = gone).
      setNet(visible, cut = 0) { net.visible = visible; strands.forEach((s, i) => { s.visible = i >= cut * 3; }); },
      update(dt, time) {
        for (let i = 0; i < FISH; i++) {
          const s = schools[i % schools.length], a = time * (0.25 + (i % 5) * 0.03) + i * 1.7, r = s[3] * (0.5 + ((i * 7) % 10) / 20);
          fd.position.set(s[0] + Math.cos(a) * r, s[1] + Math.sin(a * 1.7 + i) * 1.2, s[2] + Math.sin(a) * r);
          fd.rotation.set(0, -a, 0);
          fd.updateMatrix();
          fish.setMatrixAt(i, fd.matrix);
        }
        fish.instanceMatrix.needsUpdate = true;
        bubbleUniforms.uTime.value = time;
        bubbleUniforms.uCam.value.copy(b.camera?.position ?? bubbleUniforms.uCam.value);
        for (const o of oysters) {
          o.lid.rotation.x += ((o.open ? -1.1 : 0) - o.lid.rotation.x) * Math.min(1, dt * 4);
          if (o.open) o.glow.scale.setScalar(1 + Math.sin(time * 3) * 0.12);
        }
        bubbles.forEach((m, i) => m.scale.setScalar(1 + Math.sin(time * 2 + i) * 0.06));
        net.rotation.y += dt * 0.15;
      },
    };
  },
};
