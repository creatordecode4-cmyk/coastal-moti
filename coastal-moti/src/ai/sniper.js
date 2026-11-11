import * as THREE from 'three';
import { clamp } from '../engine/mathx.js';

// Rooftop sniper. He does not move. While he has a clear line to the player a red aiming line
// tightens; when it is full he fires. Breaking the line (crates, walls, dust) makes him lose the aim.
//   sniper.charge   0..1, how close the shot is
//   sniper.alert(s) aims almost twice as fast for s seconds (the drone found the player)
// Line of sight is the simple 2D check used everywhere: tall colliders block it.

const AIM_TIME = 2.3, ALERT_AIM_TIME = 1.25, COOLDOWN = 1.6, DAMAGE = 22, RANGE = 75;

export function createSniper(game, { x, y, z }) {
  const dark = new THREE.MeshLambertMaterial({ color: 0x15171c });
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.6, 4, 8), dark); body.position.y = 0.7;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 6), dark); head.position.y = 1.35;
  const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.5), dark); rifle.position.set(0.2, 1.05, 0.7);
  root.add(body, head, rifle);
  root.position.set(x, y, z);
  game.scene.add(root);
  const laserMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.2, depthWrite: false, fog: false });
  const laser = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), laserMat);
  laser.frustumCulled = false; laser.visible = false;
  game.scene.add(laser);

  const muzzle = new THREE.Vector3(x, y + 1.05, z + 0.3);
  const sniper = { x, z, charge: 0, sees: false, active: true, alertT: 0, shots: 0, hits: 0 };
  let cooldown = 0;

  sniper.alert = (seconds) => { sniper.alertT = Math.max(sniper.alertT, seconds); };

  // hidden(px, pz) -> true when something that is not a collider hides the player (dust).
  sniper.update = (dt, hidden) => {
    const p = game.player;
    sniper.alertT = Math.max(0, sniper.alertT - dt);
    cooldown -= dt;
    const dist = Math.hypot(p.pos.x - x, p.pos.z - z);
    sniper.sees = sniper.active && !p.health.dead && dist < RANGE &&
      game.world.lineOfSight(x, z, p.pos.x, p.pos.z) && !(hidden && hidden(p.pos.x, p.pos.z));

    if (sniper.sees && cooldown <= 0) sniper.charge += dt / (sniper.alertT > 0 ? ALERT_AIM_TIME : AIM_TIME);
    else sniper.charge -= dt * 1.4;
    sniper.charge = clamp(sniper.charge, 0, 1);

    if (sniper.charge >= 1) {             // fire
      sniper.charge = 0; cooldown = COOLDOWN; sniper.shots++;
      const chest = new THREE.Vector3(p.pos.x, p.pos.y + 1.1, p.pos.z);
      game.combat.beam(muzzle, chest, 0xfff1c9, 0.12);
      game.audio.play('shoot');
      if (!p.health.invulnerable) { sniper.hits++; game.damagePlayer(DAMAGE); }   // a dodge-roll slips the shot
    }

    root.rotation.y = Math.atan2(p.pos.x - x, p.pos.z - z);
    laser.visible = sniper.sees && sniper.charge > 0.02;
    if (laser.visible) {
      const tx = p.pos.x, ty = p.pos.y + 1.1, tz = p.pos.z;
      const len = Math.hypot(tx - muzzle.x, ty - muzzle.y, tz - muzzle.z);
      laser.position.set((tx + muzzle.x) / 2, (ty + muzzle.y) / 2, (tz + muzzle.z) / 2);
      laser.lookAt(tx, ty, tz);
      const w = 0.03 + sniper.charge * 0.05;
      laser.scale.set(w, w, len);
      laserMat.opacity = 0.2 + sniper.charge * 0.7;
    }
  };

  // The sniper gives up (blinded by the beam): he stops aiming and leaves the roof.
  sniper.retire = () => { sniper.active = false; sniper.charge = 0; laser.visible = false; root.visible = false; };
  sniper.dispose = () => {
    game.scene.remove(root, laser);
    dark.dispose(); laserMat.dispose(); laser.geometry.dispose();
    for (const m of [body, head, rifle]) m.geometry.dispose();
  };
  return sniper;
}
