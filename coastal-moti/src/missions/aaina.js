import * as THREE from 'three';
import { TEMPLE as T } from '../levels/temple.js';
import { createSniper } from '../ai/sniper.js';
import { createDrone } from '../ai/drone.js';
import { createNeelu } from '../ai/neelu.js';
import { angleDiff, distSegPoint } from '../engine/mathx.js';

// MISSION 2 "AAINA" (mirror) - 06:30, the broken temple-lighthouse.
// Dawn. Damini ("Cheel") and her drone are already here, working for Kaala Jaal. Veer fights past
// the gang guards, then turns three mirrors so the sunbeam reaches the temple door, while a sniper
// on the roof and the drone's scanner make him move from cover to cover. Reward: the Agni Shakti.
//
// Veer solves the puzzle himself. Neelu only flies to the mirror that needs attention.
// Radio rules: every line max 12 words. Callsigns: Disha = Veer, Aangan = Meenu, Deepak = Kavya, Cheel = Damini.

const LETTER = 'Bhairav was my best friend.';
const DUST_RADIUS = 6.5, DUST_TIME = 9;

const OUTER_GUARDS = [
  { x: -8, z: 46.5, hp: 50, patrol: [{ x: -8, z: 46.5 }, { x: 8, z: 46.5 }] },
  { x: 9, z: 41.5, hp: 50, patrol: [{ x: 9, z: 41.5 }, { x: -8, z: 41.5 }] },
];
const INNER_GUARD = { x: 20, z: -2, hp: 50, patrol: [{ x: 20, z: -2 }, { x: 22, z: 10 }] };

// Follow the sunbeam from the wall gap through the mirrors. Returns the corner points and whether it hits the door.
export function traceBeam(world, mirrors) {
  const points = [{ x: T.beamStart.x + 12, z: T.beamStart.z }];
  let p = { x: T.beamStart.x, z: T.beamStart.z }, h = T.beamStart.heading, last = null, reached = false;
  const lit = [];
  for (let n = 0; n < 6; n++) {
    const dx = Math.sin(h), dz = Math.cos(h);
    let bestT = Math.min(90, world.segmentT(p.x, p.z, p.x + dx * 90, p.z + dz * 90, (k) => k.mirror) * 90), best = null;
    for (const m of mirrors) {
      if (m === last) continue;
      const rx = m.x - p.x, rz = m.z - p.z, along = rx * dx + rz * dz;
      if (along < 0.6 || along > bestT || Math.abs(rx * dz - rz * dx) > 1.0) continue;
      best = m; bestT = along;
    }
    if (!best) {
      const end = { x: p.x + dx * bestT, z: p.z + dz * bestT };
      points.push(end);
      reached = Math.abs(end.x - T.door.x) < 1.3 && Math.abs(end.z - T.door.z) < 0.7;
      break;
    }
    points.push({ x: best.x, z: best.z });
    p = { x: best.x, z: best.z }; last = best;
    if (Math.abs(Math.sin(h - best.angle)) < 0.05) continue;   // edge-on: the light slips past
    lit.push(best);
    h = 2 * best.angle - h;                                    // mirror reflection
  }
  return { points, reached, lit };
}

export const aaina = {
  id: 'm2_aaina',
  aliases: ['m2_placeholder'],
  name: 'Aaina',
  location: 'Broken temple-lighthouse',
  time: '06:30',
  level: 'temple',
  objectives: [
    { id: 'reach', text: 'Reach the temple', target: T.gate },
    { id: 'mirrors', text: 'Align the mirrors: sunbeam to the door' },
    { id: 'lamp', text: 'Light the temple lamp with Agni', target: T.lamp },
    { id: 'letter', text: "Read Dadaji's letter", target: T.letter },
  ],
  endDelay: 7500,
  endLine: 'Two Nishaan lit. Three remain.',

  // checkpoint: null (fresh start) | 'gate' | 'door'
  start(ctx, checkpoint) {
    const { game } = ctx;
    const level = game.world.level;
    const solved = checkpoint === 'door';
    this.busy = false; this.clock = 0; this.puzzleClock = 0; this.said = {};
    this.hintStage = 0; this.dust = []; this.lastHurt = -99; this.scanCool = 0;
    this.toolPressed = false; this.shakti = null;

    // Aaina needs Vayu (earned in Mission 1). If the player jumped straight here, grant it.
    if (!game.progress.unlockedShaktis.includes('vayu')) { game.progress.unlockedShaktis.push('vayu'); game.persist(); }
    game.player.currentShakti = 0;

    // Level state.
    T.mirrors.forEach((m, i) => level.mirrors[i].set(solved ? m.solution : m.initial));
    level.door.setOpen(solved, true);
    level.nishaan.setLit(solved);
    level.lamp.setLit(false);
    level.letter.visible = false;

    const offTool = game.events.on('tool', () => { this.toolPressed = true; });
    const offShakti = game.events.on('shakti', (s) => { this.shakti = s.id; });
    game.player.health.onDamage = () => { this.lastHurt = this.clock; };
    game.onReset(() => { offTool(); offShakti(); game.player.health.onDamage = null; for (const d of this.dust) this.removeDust(game, d); this.dust = []; });

    this.neelu = createNeelu(game, { x: 2, z: 64 });
    game.onReset(() => this.neelu.dispose());
    this.sniper = null; this.drone = null;
    if (!solved) {
      this.sniper = createSniper(game, T.sniper);
      this.drone = createDrone(game, { route: T.droneRoute });
      game.onReset(() => { this.sniper.dispose(); this.drone.dispose(); });
    }

    if (!checkpoint) {
      ctx.placePlayer(T.start.x, T.start.z, 0, 0.22);
      OUTER_GUARDS.forEach((g) => ctx.spawnBot(g));
      ctx.spawnBot(INNER_GUARD);
      game.banner('Reach the temple.');                    // objective card
      ctx.radio('Deepak', 'Disha, ruins ahead. Kaala Jaal guards on the path.');
      ctx.radio('Aangan', 'Neelu followed you. Blue bird. Trust him.');
      ctx.radio('Deepak', 'Attack, dodge, Vayu. Use everything.');
    } else if (checkpoint === 'gate') {
      ctx.skipTo('mirrors');
      ctx.placePlayer(T.gateSpawn.x, T.gateSpawn.z, 0, 0.3);
      ctx.spawnBot(INNER_GUARD);
      this.said.cheel = this.said.gate = true;
      game.banner('Align the mirrors.');
    } else {
      ctx.skipTo('lamp');
      ctx.placePlayer(T.doorSpawn.x, T.doorSpawn.z, Math.PI * 0.75, 0.25);
      game.player.currentShakti = 1;
      game.banner('Light the lamp.');
    }
    this.refreshBeam(ctx);
  },

  // ---- helpers ----
  refreshBeam(ctx) {
    const { game } = ctx;
    const level = game.world.level;
    const beam = traceBeam(game.world, level.mirrors);
    this.beam = beam;
    for (const m of level.mirrors) m.glint.visible = beam.lit.includes(m);
    level.setBeam(beam.points, beam.reached || this.dust.length > 0);
    return beam;
  },

  inDust(x, z) { return this.dust.some((d) => Math.hypot(x - d.x, z - d.z) < DUST_RADIUS); },
  // Dust between the sniper and a point hides that point from him.
  hiddenFromSniper(x, z) {
    return this.dust.some((d) => Math.hypot(x - d.x, z - d.z) < DUST_RADIUS ||
      distSegPoint(T.sniper.x, T.sniper.z, x, z, d.x, d.z) < DUST_RADIUS * 0.75);
  },

  addDust(ctx, x, z) {
    const { game } = ctx;
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xcdb98a, transparent: true, opacity: 0.42, depthWrite: false });
    const geo = new THREE.SphereGeometry(1, 7, 5);
    for (let i = 0; i < 8; i++) {
      const puff = new THREE.Mesh(geo, mat);
      const a = (i / 8) * Math.PI * 2, r = i % 2 ? 2.2 : 4.2;
      puff.position.set(Math.cos(a) * r, 1.2 + (i % 3) * 0.7, Math.sin(a) * r);
      puff.scale.setScalar(1.8 + (i % 3) * 0.5);
      group.add(puff);
    }
    group.position.set(x, game.world.heightAt(x, z), z);
    game.scene.add(group);
    this.dust.push({ x, z, t: DUST_TIME, group, mat, geo });
  },
  removeDust(game, d) { game.scene.remove(d.group); d.mat.dispose(); d.geo.dispose(); },

  update(ctx, dt) {
    if (this.busy) return;
    const { game } = ctx;
    const level = game.world.level;
    const player = game.player, p = player.pos;
    const id = ctx.current?.id;
    this.clock += dt;
    const tool = this.toolPressed, shakti = this.shakti;
    this.toolPressed = false; this.shakti = null;

    // Out of danger for a few seconds: Veer catches his breath.
    if (this.clock - this.lastHurt > 6 && !player.health.dead) player.health.heal(5 * dt);

    // Vayu kicks up a dust cloud: it hides Veer and makes the sunbeam glow.
    if (shakti === 'vayu') {
      this.addDust(ctx, p.x + Math.sin(player.facing) * 3.2, p.z + Math.cos(player.facing) * 3.2);
      this.refreshBeam(ctx);
      if (!this.said.dust && this.sniper?.active) { this.said.dust = true; ctx.radio('Deepak', 'Good. Dust hides you. And shows the light.'); }
    }
    for (let i = this.dust.length - 1; i >= 0; i--) {
      const d = this.dust[i];
      d.t -= dt;
      d.mat.opacity = 0.42 * Math.min(1, d.t / 2);
      d.group.rotation.y += dt * 0.5;
      if (d.t <= 0) { this.removeDust(game, d); this.dust.splice(i, 1); this.refreshBeam(ctx); }
    }

    // The sniper and the drone work until the door opens.
    if (this.sniper?.active) {
      this.sniper.update(dt, (x, z) => this.hiddenFromSniper(x, z));
      this.drone.update(dt);
      this.scanCool -= dt;
      if (this.drone.touches(p) && !this.inDust(p.x, p.z)) {
        this.sniper.alert(8);
        if (this.scanCool <= 0) {
          this.scanCool = 7;
          game.banner('Drone scan! Sniper alerted.', 2400, true);
          game.audio.play('alert');
          if (!this.said.scan) { this.said.scan = true; ctx.radio('Cheel', 'My drone sees you. So does the sniper.'); }
        }
      }
      game.stealth = { level: this.sniper.charge, lit: this.sniper.sees,
        label: this.sniper.alertT > 0 ? 'SNIPER ALERT' : this.sniper.sees ? 'IN SIGHT' : undefined };
      if (this.sniper.sees && !this.said.sniper) {
        this.said.sniper = true;
        ctx.radio('Deepak', 'Sniper on the roof. Move cover to cover.');
        ctx.radio('Deepak', 'Vayu kicks up dust. Dust blinds him.');
      }
    } else { this.drone?.update(dt); game.stealth = null; }

    // Damini speaks as Veer comes up to the ruins.
    if (!this.said.cheel && p.z < 38) {
      this.said.cheel = true;
      ctx.radio('Cheel', 'I want the pearl. Go home, there is a storm.');
      ctx.radio('Disha', 'That drone is yours? Who are you?');
      ctx.radio('Cheel', 'Cheel. I read ruins. Kaala Jaal pays well.');
    }

    if (id === 'reach') {
      this.neelu.goTo({ x: T.gate.x, z: T.gate.z + 3 }, 3.2);
      if (p.z < 21.2 && Math.abs(p.x) < 30) {              // through the gate
        ctx.checkpoint('gate');
        ctx.completeObjective('reach');
        game.banner('Align the mirrors.');                 // objective card
        ctx.radio('Aangan', 'Three mirrors, bhaiya. Follow Neelu. He knows where.');
      }
    } else if (id === 'mirrors') {
      this.puzzleClock += dt;
      const wrong = level.mirrors.findIndex((m, i) => m.state !== T.mirrors[i].solution);
      const focus = level.mirrors[Math.max(0, wrong)];
      this.neelu.goTo(focus, 4.4);                         // Neelu perches on the mirror that needs work

      let near = null;
      for (const m of level.mirrors) if (Math.hypot(p.x - m.x, p.z - m.z) < 2.7) near = m;
      game.prompt(near ? (game.mobile ? 'Tap Tool to turn the mirror' : 'Press E to turn the mirror') : null);
      if (near && tool) {
        near.set(near.state + 1);
        game.audio.play('ui');
        game.noise(p, 6);
        if (this.refreshBeam(ctx).reached) { this.solve(ctx); return; }
      }

      // Hints: a small one after 60 s, a stronger one after 120 s (then every 60 s for the current mirror).
      if (this.hintStage === 0 && this.puzzleClock > 60) {
        this.hintStage = 1;
        game.toast('Hint: follow the beam. Fix the mirror where it goes wrong.', 6000);
        ctx.radio('Deepak', 'Follow the light. Fix the mirror where it stops.');
      } else if (this.hintStage >= 1 && this.puzzleClock > 60 + this.hintStage * 60) {
        this.hintStage++;
        const lines = ['First mirror. Turn it until the light goes north.', 'Second mirror. Send the light east.', 'Last mirror. Send the light to the door.'];
        game.toast(`Hint: ${lines[Math.max(0, wrong)]}`, 7000);
        ctx.radio('Deepak', lines[Math.max(0, wrong)]);
      }
      // Damini is racing for the same door.
      if (!this.said.race1 && this.puzzleClock > 40) { this.said.race1 = true; ctx.radio('Cheel', 'First mirror mapped. You are slow, fisher boy.'); }
      if (!this.said.race2 && this.puzzleClock > 100) { this.said.race2 = true; ctx.radio('Cheel', 'My drone has the angles. Almost there.'); }
    } else if (id === 'lamp') {
      this.neelu.goTo(T.lamp, 3.4);
      game.prompt(game.mobile ? 'Face the lamp and tap the Agni button' : 'Face the lamp and press Q to use Agni');
      if (shakti === 'agni') {
        const d = Math.hypot(T.lamp.x - p.x, T.lamp.z - p.z);
        const aim = Math.abs(angleDiff(player.facing, Math.atan2(T.lamp.x - p.x, T.lamp.z - p.z)));
        if (d < 15 && aim < 0.9) {
          game.prompt(null);
          level.lamp.setLit(true);
          level.letter.visible = true;
          game.audio.play('unlock');
          ctx.setFlag('agniTutorialDone');
          ctx.completeObjective('lamp');
          ctx.radio('Aangan', 'Fire now? Amma will hide the matches.');
        } else game.toast(d >= 15 ? 'Too far. Go closer to the lamp.' : 'Turn to face the lamp first.');
      }
    } else if (id === 'letter') {
      this.neelu.goTo(T.letter, 2.4);
      if (ctx.playerNear(T.letter, 1.9)) this.readLetter(ctx);
    }
    this.neelu.update(dt);
  },

  // The beam is on the door: it opens, the gang pulls back, the second Nishaan lights, Agni is earned.
  solve(ctx) {
    const { game } = ctx;
    const level = game.world.level;
    game.prompt(null);
    game.audio.play('objective');
    level.setBeam(this.beam.points, true);
    this.sniper.retire();
    game.stealth = null;
    ctx.script(async (s) => {
      level.door.setOpen(true);
      await s.wait(1.2);
      this.drone.leave();
      level.nishaan.setLit(true);
      ctx.setFlag('raniNishaan2');
      ctx.unlockShakti('agni');                  // saved; the HUD icon unlocks by itself
      game.player.currentShakti = 1;
      ctx.checkpoint('door');
      ctx.completeObjective('mirrors');
      game.banner('Rani Nishaan 2 of 5. Agni Shakti unlocked.', 4200);
      ctx.radio('Deepak', 'Sniper is blind in that light. He is gone.');
      ctx.radio('Cheel', "Beginner's luck. The pearl is still mine.");
      ctx.radio('Disha', 'My father is out there. Keep your pearl.');
      await s.wait(4.6);
      game.banner('Light the lamp.');            // objective card
    });
  },

  readLetter(ctx) {
    const { game } = ctx;
    this.busy = true;
    game.frozen = true;
    game.audio.play('pickup');
    ctx.script(async (s) => {
      await s.after(game.letter.show(LETTER, { title: "Dadaji's letter", item: 'Tucked behind the temple lamp.', map: false }));
      game.world.level.letter.visible = false;
      ctx.setFlag('hasDadajiLetter3');
      game.frozen = false;
      this.busy = false;
      ctx.completeObjective('letter');
    });
  },

  complete(ctx) {
    ctx.game.prompt(null);
    ctx.radio('Disha', 'Bhairav. Dadaji never said that name.');
    ctx.radio('Deepak', 'Second mark lit. Three remain. Well done, Disha.');
  },
};
