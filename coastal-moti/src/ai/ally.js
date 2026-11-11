import * as THREE from 'three';
import { damp, lerpAngle } from '../engine/mathx.js';

// A squad ally driven by mission scripts. First user: Damini ("Cheel") and her drone.
//   ally.setMode('follow' | 'stay' | 'trapped')   follow = keep close behind Veer
//   ally.swimming = true / false                   3D follow under water, or walking on the ground
//   ally.goTo({ x, y?, z })                        walk / swim to a spot and stay there
//   ally.enemies = () => [things with .pos]        who the drone may mark (set by the mission)
//   ally.mark(target, seconds)                     put a visible marker over a target
//   ally.autoMark = true                           the drone marks the nearest unmarked enemy every few
//                                                  seconds and the ally calls its position on the radio
// Radio call-outs are generated from compass direction and distance: always under 12 words.

const FOLLOW_DIST = 2.6, WALK_SPEED = 5.2, SWIM_SPEED = 3.4;
const DIRS = ['North', 'North-east', 'East', 'South-east', 'South', 'South-west', 'West', 'North-west'];

export function compassWord(dx, dz) {              // north is -Z, east is +X
  const a = Math.atan2(dx, -dz);
  return DIRS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}

export function createAlly(game, { name = 'Cheel', x, y = null, z, color = 0xd9552b, markColor = 0xff4fd8 }) {
  const lambert = (c) => new THREE.MeshLambertMaterial({ color: c });
  const root = new THREE.Group(), model = new THREE.Group();
  root.rotation.order = 'YXZ';
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.72, 4, 8), lambert(color)); body.position.y = 0.92;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), lambert(0xb9805a)); head.position.y = 1.62;
  const hair = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.5, 6), lambert(0x1c1410)); hair.position.set(0, 1.55, -0.26); hair.rotation.x = -2.2;
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.16), lambert(0x2b2e36)); pack.position.set(0, 1.05, -0.3);
  model.add(body, head, hair, pack);
  model.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  root.add(model);
  game.scene.add(root);

  // Her drone: hovers above her and looks at whatever it marks.
  const drone = new THREE.Group();
  drone.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.6), lambert(0x2b2e36)));
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: markColor, fog: false })); eye.position.y = -0.14;
  drone.add(eye);
  drone.visible = false;
  game.scene.add(drone);

  const pos = new THREE.Vector3(x, y ?? game.world.heightAt(x, z), z);
  const ally = { name, pos, root, drone, mode: 'stay', swimming: false, autoMark: false, enemies: () => [], marks: [], calls: 0 };
  let facing = 0, dest = null, markCd = 2, t = 0;

  ally.setMode = (mode) => { ally.mode = mode; dest = null; };
  ally.goTo = (p) => { dest = { x: p.x, y: p.y ?? null, z: p.z }; ally.mode = 'goto'; };
  ally.say = (text) => game.radio.say(name, text);

  // A marker: a spinning diamond with a ring, drawn over everything so it reads through fog and walls.
  ally.mark = (target, seconds = 8) => {
    let m = ally.marks.find((q) => q.target === target);
    if (!m) {
      const mat = new THREE.MeshBasicMaterial({ color: markColor, fog: false, depthTest: false, transparent: true });
      const icon = new THREE.Group();
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), mat);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 6, 20), mat);
      gem.renderOrder = ring.renderOrder = 10;
      icon.add(gem, ring);
      game.scene.add(icon);
      m = { target, icon, mat, t: 0 };
      ally.marks.push(m);
    }
    m.t = seconds;
    return m;
  };
  ally.isMarked = (target) => ally.marks.some((m) => m.target === target);

  function callOut(target) {
    const p = game.player.pos, q = target.pos;
    const metres = Math.max(5, Math.round(Math.hypot(q.x - p.x, q.z - p.z) / 5) * 5);
    ally.calls++;
    ally.say(`${target.label || 'Enemy'}. ${compassWord(q.x - p.x, q.z - p.z)}. ${metres} metres.`);
  }

  ally.update = (dt) => {
    t += dt;
    const p = game.swim ? game.swim.pos : game.player.pos;
    let goal = null;
    if (ally.mode === 'follow') {
      const d = Math.hypot(p.x - pos.x, p.z - pos.z, ally.swimming ? p.y - pos.y : 0);
      if (d > FOLLOW_DIST) goal = { x: p.x, y: ally.swimming ? p.y : null, z: p.z, stop: FOLLOW_DIST };
    } else if (ally.mode === 'goto' && dest) goal = { ...dest, stop: 0.4 };

    if (goal) {
      const dx = goal.x - pos.x, dz = goal.z - pos.z, dy = ally.swimming && goal.y !== null ? goal.y - pos.y : 0;
      const d = Math.hypot(dx, dy, dz);
      if (d > goal.stop) {
        const step = Math.min(d - goal.stop, (ally.swimming ? SWIM_SPEED : WALK_SPEED) * dt);
        if (ally.swimming) { pos.x += dx / d * step; pos.y += dy / d * step; pos.z += dz / d * step; game.world.resolveSphere(pos, 0.45); }
        else game.world.move(pos, dx / d * step, dz / d * step, 0.4);
        facing = lerpAngle(facing, Math.atan2(dx, dz), damp(8, dt));
      } else if (ally.mode === 'goto') ally.mode = 'stay';
    }
    if (!ally.swimming) pos.y += (game.world.heightAt(pos.x, pos.z) - pos.y) * damp(20, dt);
    root.position.set(pos.x, pos.y - (ally.swimming ? 0.9 : 0) + (ally.swimming ? Math.sin(t * 2.2) * 0.05 : 0), pos.z);
    root.rotation.y = facing;
    root.rotation.x = ally.swimming && goal ? 1.0 : ally.mode === 'trapped' ? 0.5 : 0;

    // Drone + markers.
    if (drone.visible) {
      drone.position.set(pos.x + Math.sin(t * 0.9) * 1.2, pos.y + (ally.swimming ? 3.2 : 3.6) + Math.sin(t * 2) * 0.15, pos.z + Math.cos(t * 0.9) * 1.2);
      drone.rotation.y += dt * 1.5;
      if (ally.autoMark && (markCd -= dt) <= 0) {
        markCd = 4;
        let best = null, bd = 40;
        for (const e of ally.enemies()) {
          if (ally.isMarked(e)) continue;
          const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z);
          if (d < bd) { bd = d; best = e; }
        }
        if (best) { ally.mark(best, 10); callOut(best); game.audio.play('ui'); }
      }
    }
    for (let i = ally.marks.length - 1; i >= 0; i--) {
      const m = ally.marks[i];
      m.t -= dt;
      const q = m.target.pos;
      m.icon.position.set(q.x, q.y + (m.target.markHeight ?? 2.6), q.z);
      m.icon.rotation.y += dt * 2.5;
      m.mat.opacity = Math.min(1, m.t);
      if (m.t <= 0 || m.target.gone) { game.scene.remove(m.icon); m.mat.dispose(); m.icon.children.forEach((c) => c.geometry.dispose()); ally.marks.splice(i, 1); }
    }
  };

  ally.dispose = () => {
    game.scene.remove(root, drone);
    for (const o of [root, drone]) o.traverse((q) => { q.geometry?.dispose(); q.material?.dispose(); });
    for (const m of ally.marks) { game.scene.remove(m.icon); m.mat.dispose(); }
    ally.marks = [];
  };
  ally.update(0);
  return ally;
}
