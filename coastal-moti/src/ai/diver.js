import * as THREE from 'three';
import { clamp, damp } from '../engine/mathx.js';

// Kaala Jaal salvage diver. Stealth enemy for swimming levels.
//   patrol: swims a fixed loop of 3D waypoints, torch cone ahead (short range)
//   alert:  saw the player for too long -> swims at him and strikes when close, then gives up after a while
//   down:   taken out
// diver.suspicion goes 0 -> 1 while the torch is on the player.
// diver.takedown(): from behind / unseen it is instant. If he already saw the player it is a fight.

const RANGE = 9, HALF_FOV = 0.55, MAX_DY = 6;
const PATROL_SPEED = 1.6, CHASE_SPEED = 3.1, STRIKE_RANGE = 1.7, STRIKE_DAMAGE = 12, ALERT_TIME = 7;

export function createDiver(game, { route, start = 0 }) {
  const suit = new THREE.MeshLambertMaterial({ color: 0x16181d });
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.9, 4, 8), suit); body.rotation.x = Math.PI / 2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), suit); head.position.z = 0.85;
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.6, 8), new THREE.MeshLambertMaterial({ color: 0x8a6a2a })); tank.rotation.x = Math.PI / 2; tank.position.set(0, 0.32, -0.05);
  const fins = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), suit); fins.position.z = -1.0;
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xdfffb0, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false, side: THREE.DoubleSide });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(Math.tan(HALF_FOV) * RANGE, RANGE, 14, 1, true).translate(0, -RANGE / 2, 0).rotateX(-Math.PI / 2), coneMat);
  cone.position.z = 1;
  root.add(body, head, tank, fins, cone);
  game.scene.add(root);
  const calm = new THREE.Color(0xdfffb0), hot = new THREE.Color(0xff4a3d);

  const first = route[start % route.length];
  const pos = new THREE.Vector3(first.x, first.y, first.z);
  const fwd = new THREE.Vector3(0, 0, 1), want = new THREE.Vector3(), tmp = new THREE.Vector3();
  const diver = { pos, root, fwd, state: 'patrol', suspicion: 0, sees: false, hp: 60, justSpotted: false };
  let wp = (start + 1) % route.length, alertT = 0, strikeCd = 0, sink = 0;

  function swimTo(target, speed, dt) {
    want.set(target.x - pos.x, target.y - pos.y, target.z - pos.z);
    const d = want.length();
    if (d > 0.01) {
      want.multiplyScalar(1 / d);
      fwd.lerp(want, damp(3, dt)).normalize();
      pos.addScaledVector(fwd, Math.min(d, speed * dt));
    }
    return d;
  }

  diver.update = (dt) => {
    if (diver.state === 'down') {           // drifts down, limp
      sink += dt;
      const floor = game.world.heightAt(pos.x, pos.z) + 0.4;
      if (pos.y > floor) pos.y -= dt * 0.7;
      root.position.copy(pos);
      root.rotation.z = Math.min(1.4, sink * 1.2);
      return;
    }
    const p = game.swim ? game.swim.pos : game.player.pos;
    tmp.set(p.x - pos.x, p.y - pos.y, p.z - pos.z);
    const dist = tmp.length();
    const angle = dist > 0.01 ? Math.acos(clamp(tmp.dot(fwd) / dist, -1, 1)) : 0;
    diver.sees = !game.player.health.dead && dist < RANGE && Math.abs(tmp.y) < MAX_DY &&
      (angle < HALF_FOV || dist < 1.2) && game.world.lineOfSight(pos.x, pos.z, p.x, p.z);

    if (diver.state === 'patrol') {
      diver.suspicion = clamp(diver.suspicion + (diver.sees ? (dist < 3.5 ? 2.8 : 1.1) : -0.5) * dt, 0, 1);
      if (diver.suspicion >= 1) { diver.state = 'alert'; alertT = ALERT_TIME; diver.justSpotted = true; }
      else if (swimTo(route[wp], PATROL_SPEED, dt) < 0.6) wp = (wp + 1) % route.length;
    } else {                                // alert: chase and strike
      strikeCd -= dt;
      if (diver.sees) alertT = Math.max(alertT, 3); else alertT -= dt;
      swimTo(p, CHASE_SPEED, dt);
      if (dist < STRIKE_RANGE && strikeCd <= 0) { strikeCd = 1.2; game.damagePlayer(STRIKE_DAMAGE, 'diver'); }
      if (alertT <= 0) { diver.state = 'patrol'; diver.suspicion = 0; }
    }
    game.world.resolveSphere(pos, 0.5);
    root.position.copy(pos);
    root.lookAt(pos.x + fwd.x, pos.y + fwd.y, pos.z + fwd.z);
    const heat = diver.state === 'alert' ? 1 : diver.suspicion;
    coneMat.color.copy(calm).lerp(hot, heat);
    coneMat.opacity = 0.12 + heat * 0.12;
  };

  // Returns 'takedown' (silent, instant), 'hit' (he saw it coming) or 'down' (finished in a fight).
  diver.takedown = () => {
    if (diver.state === 'down') return null;
    const unseen = diver.state === 'patrol' && diver.suspicion < 0.45;
    if (!unseen) { diver.hp -= 20; if (diver.hp > 0) { if (diver.state === 'patrol') { diver.state = 'alert'; alertT = ALERT_TIME; } return 'hit'; } }
    diver.state = 'down'; diver.suspicion = 0; diver.sees = false; cone.visible = false;
    return unseen ? 'takedown' : 'down';
  };

  diver.dispose = () => { game.scene.remove(root); root.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); }); };
  root.position.copy(pos);
  return diver;
}
