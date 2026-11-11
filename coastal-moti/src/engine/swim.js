import * as THREE from 'three';
import { clamp, damp, lerpAngle } from './mathx.js';

// Swimming: full 3D movement with the normal controls.
//   - The stick / WASD moves Veer where the CAMERA looks: look down and push forward to dive.
//   - Space (or the Dodge button) kicks straight up, C goes straight down.
//   - Slower than walking. Pushing the stick to its edge / holding Shift sprints, which costs more breath.
// Breath (0..100) drains under water and refills at the surface or inside an air pocket.
// At zero Veer starts to lose health: it is a danger, not an instant fail.
// Actions: Attack -> event 'swimAttack' (the mission decides: takedown), Tool -> event 'tool',
//          Shakti -> only the Jal shield works under water.

const SPEED = 2.6, SPRINT = 3.8, RADIUS = 0.5;
const DRAIN = 2.6, SPRINT_DRAIN = 4.4, REFILL = 32;
const DROWN_DAMAGE = 8;   // per second with no breath
const LEVEL_PITCH = 0.3;  // camera tilt that counts as swimming level

export function createSwimmer(game, { x, y, z, surfaceY = 0, bounds = 68, airPockets = [] }) {
  const pos = new THREE.Vector3(x, y, z), vel = new THREE.Vector3();
  const swim = { active: true, pos, breath: 100, underwater: false, inAir: true, surfaceY, airPockets };
  let facing = Math.PI, lean = 0, drownT = 0, attackCd = 0, toolCd = 0, t = 0;

  game.rig.underwater = true;
  game.rig.distance = 5.5;
  game.rig.autoYaw = null;

  swim.update = (dt) => {
    const { input, rig, world, player } = game;
    t += dt; attackCd -= dt; toolCd -= dt;
    for (let i = 0; i < 5; i++) if (input.take(`shakti${i + 1}`)) player.selectShakti(i);

    // Direction: along the camera's line of sight (pitch included) + sideways + straight up / down.
    const m = input.move();
    // The camera normally looks slightly down at Veer: treat that resting tilt as level swimming.
    let tilt = rig.pitch - LEVEL_PITCH;
    if (pos.y > surfaceY - 0.7 && tilt > 0 && tilt < 0.3) tilt = 0;   // at the surface a small tilt does not dive
    const cp = Math.cos(tilt), sp = Math.sin(tilt);
    const fx = -Math.sin(rig.yaw) * cp, fy = -sp, fz = -Math.cos(rig.yaw) * cp;
    const rx = Math.cos(rig.yaw), rz = -Math.sin(rig.yaw);
    const up = clamp(input.vertical() + (input.isHeld('dodge') ? 1 : 0), -1, 1);
    let dx = fx * m.y + rx * m.x, dy = fy * m.y + up, dz = fz * m.y + rz * m.x;
    const len = Math.hypot(dx, dy, dz);
    const sprint = input.run() && len > 0.1;
    if (len > 1) { dx /= len; dy /= len; dz /= len; }
    const speed = sprint ? SPRINT : SPEED;
    vel.x += (dx * speed - vel.x) * damp(3.5, dt);
    vel.y += (dy * speed - vel.y) * damp(3.5, dt);
    vel.z += (dz * speed - vel.z) * damp(3.5, dt);

    pos.addScaledVector(vel, dt);
    world.resolveSphere(pos, RADIUS);
    const floor = world.heightAt(pos.x, pos.z) + 0.7;
    if (pos.y < floor) { pos.y = floor; vel.y = Math.max(0, vel.y); }
    const top = surfaceY - 0.25;                    // head just out of the water
    if (pos.y > top) { pos.y = top; vel.y = Math.min(0, vel.y); }
    pos.x = clamp(pos.x, -bounds, bounds); pos.z = clamp(pos.z, -bounds, bounds);

    // Breath.
    swim.underwater = pos.y < surfaceY - 1.2;
    swim.inAir = !swim.underwater || airPockets.some((a) => Math.hypot(pos.x - a.x, pos.y - a.y, pos.z - a.z) < a.r);
    if (swim.inAir) swim.breath = Math.min(100, swim.breath + REFILL * dt);
    else swim.breath = Math.max(0, swim.breath - (sprint ? SPRINT_DRAIN : DRAIN) * dt);
    if (swim.breath <= 0) {
      drownT += dt;
      if (drownT >= 1) { drownT = 0; game.damagePlayer(DROWN_DAMAGE, 'drown'); }
    } else drownT = 0;

    // Actions.
    if (input.take('attack') && attackCd <= 0) { attackCd = 0.5; game.audio.play('attack'); game.events.emit('swimAttack', pos); }
    if (input.take('tool') && toolCd <= 0) { toolCd = 0.25; game.events.emit('tool'); }
    if (input.take('shakti')) {
      const unlocked = game.progress.unlockedShaktis.includes('jal');
      if (unlocked) { player.currentShakti = 2; player.useShakti(); }
      else { game.audio.play('denied'); }
    }

    // Pose: body tips forward when moving, eases upright when still.
    const moving = Math.hypot(vel.x, vel.z) > 0.4;
    if (moving) facing = lerpAngle(facing, Math.atan2(vel.x, vel.z), damp(8, dt));
    const wantLean = clamp(Math.hypot(vel.x, vel.y, vel.z) / SPEED, 0, 1) * (1.25 - clamp(vel.y / SPEED, -0.6, 0.9) * 0.9);
    lean += (wantLean - lean) * damp(5, dt);
    player.setPose(pos.x, pos.y - 0.9 + Math.sin(t * 2) * 0.05, pos.z, facing, lean);
  };

  swim.dispose = () => { game.rig.resetFollow(); };
  swim.update(0);
  return swim;
}
