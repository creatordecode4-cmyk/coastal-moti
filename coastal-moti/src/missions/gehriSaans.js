import * as THREE from 'three';
import { BARGE as B } from '../levels/barge.js';
import { createSwimmer } from '../engine/swim.js';
import { createDiver } from '../ai/diver.js';
import { createAlly } from '../ai/ally.js';
import { ENV_BARGE_DAY, ENV_UNDERWATER } from '../engine/environments.js';

// MISSION 3 "GEHRI SAANS" (deep breath) - 14:00, under the Kaala Jaal salvage barge.
// Veer dives for three oysters that carry Rani Chandravati's mark, past the gang's divers.
// Damini gets tangled in a net; Baaz leaves her. Veer cuts her free and gives her his breath.
// On the surface she changes sides and joins the squad as "Cheel". Reward: the Jal Shakti.
//
// Lullaby line 3: "Saat saans neeche, jahan seep gaati hai."
//   (Seven breaths down, where the oyster sings.)
// Radio rules: every line under 12 words. Callsigns: Disha = Veer, Aangan = Meenu, Deepak = Kavya, Cheel = Damini.

const LETTER = 'I could hold my breath for three minutes once.';
const OPEN_TIME = 1.5, SHARE_TIME = 2, CUTS = 3, ZONE = [0.36, 0.64], MARKER_SPEED = 1.9;

const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export const gehriSaans = {
  id: 'm3_gehri_saans',
  aliases: ['m3_placeholder'],
  name: 'Gehri Saans',
  location: 'Underwater beneath the Kaala Jaal salvage barge',
  time: '14:00',
  level: 'barge',
  objectives: [
    { id: 'dive', text: 'Dive beneath the barge', target: B.underBarge },
    { id: 'oysters', text: 'Find three oysters (0/3)' },
    { id: 'damini', text: 'Free Damini', target: B.net },
    { id: 'surface', text: 'Take Damini up to the surface' },
    { id: 'jal', text: 'Use Jal to block the gunfire' },
    { id: 'letter', text: "Read Dadaji's letter", target: B.boat },
  ],
  endDelay: 7500,
  endLine: 'Three Nishaan lit. Two remain.',

  // checkpoint: null (fresh start) | 'oysters' | 'net' | 'surface'
  start(ctx, checkpoint) {
    const { game } = ctx;
    const level = game.world.level;
    this.busy = false; this.clock = 0; this.said = {}; this.hold = 0; this.cuts = 0; this.phase = 'cut';
    this.toolPressed = false; this.attackAt = null; this.shakti = null; this.lowT = 0; this.under = null;
    this.bullets = []; this.gunman = null; this.fireT = 0; this.jalUsedAt = -1; this.blocks = 0;

    // Which oysters are already open (kept in a saved flag so a refresh remembers them).
    if (!checkpoint) ctx.setFlag('m3Oysters', 0);
    this.mask = checkpoint === 'net' || checkpoint === 'surface' ? 7 : (ctx.getFlag('m3Oysters') || 0);
    level.oysters.forEach((o, i) => o.setOpen(!!(this.mask & (1 << i))));
    level.setNet(checkpoint === 'net', 0);
    level.letter.visible = false;

    const offTool = game.events.on('tool', () => { this.toolPressed = true; });
    const offAttack = game.events.on('swimAttack', (pos) => { this.attackAt = pos; });
    const offShakti = game.events.on('shakti', (s) => { this.shakti = s.id; });
    const offBlock = game.events.on('shieldBlock', () => { this.blocks++; });
    game.onReset(() => { offTool(); offAttack(); offShakti(); offBlock(); this.clearBullets(game); this.removeGunman(game); game.engine.setEnvironment(ENV_BARGE_DAY); });

    // Where Veer starts.
    const spawn = !checkpoint ? B.start : checkpoint === 'oysters' ? B.airPockets[0] : checkpoint === 'net' ? B.airPockets[1] : { x: 14, y: -0.3, z: 28 };
    game.player.reset(spawn.x, spawn.z);
    game.swim = createSwimmer(game, { x: spawn.x, y: spawn.y, z: spawn.z, surfaceY: B.surfaceY, airPockets: B.airPockets });
    game.rig.yaw = 0; game.rig.pitch = 0.3; game.rig.snap();

    this.divers = checkpoint === 'surface' ? [] : B.divers.map((d) => createDiver(game, d));
    game.onReset(() => { for (const d of this.divers) d.dispose(); this.divers = []; });

    // Damini. Hidden until the net scene; after the rescue she follows Veer.
    this.cheel = createAlly(game, { name: 'Cheel', x: B.net.x, y: B.net.y, z: B.net.z });
    this.cheel.swimming = true;
    game.onReset(() => this.cheel.dispose());
    this.cheel.root.visible = checkpoint === 'net' || checkpoint === 'surface';
    if (checkpoint === 'net') this.cheel.setMode('trapped');

    if (!checkpoint) {
      game.banner('Dive beneath the barge.');                 // objective card
      ctx.radio('Aangan', 'Saat saans neeche, jahan seep gaati hai.');
      ctx.radio('Disha', 'Seven breaths down. Where the oyster sings.');
      ctx.radio('Deepak', 'Kaala Jaal salvage barge. Divers below. Stay unseen.');
      ctx.radio('Deepak', 'Air pockets under the wrecks. Breathe there.');
      game.toast(game.mobile ? 'Drag to look down, then push the stick to dive. Dodge button: swim up.'
        : 'Look down and press W to dive. Space: up. C: down.', 9000);
    } else if (checkpoint === 'oysters') {
      ctx.skipTo('oysters');
      this.setCount(ctx);
      game.banner('Find three oysters.');
    } else if (checkpoint === 'net') {
      ctx.skipTo('damini');
      game.banner('Free Damini.');
    } else {
      ctx.skipTo('jal');
      this.cheel.pos.set(16, -0.3, 29);
      this.cheel.setMode('follow');
      game.player.currentShakti = 2;
      this.startGunfire(ctx);
    }
  },

  // ---- small helpers ----
  count() { return [0, 1, 2].filter((i) => this.mask & (1 << i)).length; },
  setCount(ctx) { ctx.setObjectiveText('oysters', `Find three oysters (${this.count()}/3)`); },
  clearBullets(game) { for (const b of this.bullets) { game.scene.remove(b.mesh); } this.bullets = []; },
  removeGunman(game) {
    if (!this.gunman) return;
    game.scene.remove(this.gunman.mesh);
    this.gunman.mesh.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    this.gunman.gone = true; this.gunman = null;
  },

  // A gang gunman steps out on the barge deck. Cheel's drone marks him; Jal blocks his bullets.
  startGunfire(ctx) {
    const { game } = ctx;
    const mat = new THREE.MeshLambertMaterial({ color: 0x15171c });
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.75, 4, 8), mat); body.position.y = 0.95;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 6), mat); head.position.y = 1.66;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.9), mat); gun.position.set(0.25, 1.2, 0.45);
    mesh.add(body, head, gun);
    mesh.position.set(B.gunman.x, B.gunman.y - 1.1, B.gunman.z);
    game.scene.add(mesh);
    this.gunman = { pos: new THREE.Vector3(B.gunman.x, B.gunman.y, B.gunman.z), mesh, label: 'Gunman', markHeight: 1.6, gone: false };
    this.fireT = 2.2;
    this.cheel.drone.visible = true;
    this.cheel.enemies = () => (this.gunman && !this.gunman.gone ? [this.gunman] : []);
    this.cheel.autoMark = true;
    ctx.radio('Deepak', 'Gunman on the barge! Disha, shield up!');
  },

  update(ctx, dt) {
    if (this.busy) return;
    const { game } = ctx;
    const level = game.world.level;
    const swim = game.swim, p = swim.pos;
    const id = ctx.current?.id;
    this.clock += dt;
    const tool = this.toolPressed, attackAt = this.attackAt, shakti = this.shakti;
    this.toolPressed = false; this.attackAt = null; this.shakti = null;

    // Above and below the surface look different: swap the whole environment when the camera crosses it.
    const under = game.engine.camera.position.y < -0.15;
    if (under !== this.under) { this.under = under; game.engine.setEnvironment(under ? ENV_UNDERWATER : ENV_BARGE_DAY); }

    // Low breath: a clear warning, then health loss (handled by the swimmer).
    if (swim.breath < 25 && !swim.inAir) {
      if (!this.lowWarned) {
        this.lowWarned = true;
        game.banner('Low breath! Surface or find an air pocket.', 2600, true);
        if (!this.said.low) { this.said.low = true; ctx.radio('Deepak', 'Breath low. Find air. Now.'); }
      }
      if ((this.lowT -= dt) <= 0) { this.lowT = 1; game.audio.play('denied'); }
    } else if (swim.breath > 55) this.lowWarned = false;

    // Divers.
    let worst = 0, alert = false;
    for (const d of this.divers) {
      d.update(dt);
      worst = Math.max(worst, d.suspicion);
      if (d.state === 'alert') alert = true;
      if (d.justSpotted) {
        d.justSpotted = false;
        game.banner('Spotted! A diver is coming.', 2400, true);
        game.audio.play('alert');
        if (!this.said.spotted) { this.said.spotted = true; ctx.radio('Deepak', 'He saw you. Break away or fight.'); }
      }
    }
    game.stealth = this.divers.length && swim.underwater ? { level: alert ? 1 : worst, lit: false, label: alert ? 'SPOTTED' : undefined } : null;

    // Attack: a silent takedown when the diver has not seen Veer, a struggle if he has.
    if (attackAt) {
      let near = null, nd = 2.2;
      for (const d of this.divers) { if (d.state === 'down') continue; const dd = dist3(d.pos, p); if (dd < nd) { nd = dd; near = d; } }
      const result = near?.takedown();
      if (result) {
        game.audio.play(result === 'hit' ? 'hit' : 'down');
        game.combat.ring({ x: near.pos.x, y: near.pos.y - 0.15, z: near.pos.z }, 0xffffff, 1.2, 0.25);
        if (result === 'takedown') {
          game.addXp(30);
          if (!this.said.takedown) { this.said.takedown = true; ctx.radio('Deepak', 'Clean. He never saw you.'); }
        }
      }
    }

    this.cheel.update(dt);

    if (id === 'dive') {
      if (Math.hypot(p.x - B.underBarge.x, p.z - B.underBarge.z) < 10 && p.y < -4) {
        ctx.completeObjective('dive');
        ctx.checkpoint('oysters');
        game.banner('Find three oysters.');                   // objective card
        if (!this.said.cheelEarly) { this.said.cheelEarly = true; ctx.radio('Cheel', 'Fisher boy again. The oysters are mine.'); }
      }
    } else if (id === 'oysters') {
      // The marker points at the nearest oyster that is still closed.
      let best = -1, bd = 1e9;
      level.oysters.forEach((o, i) => { if (o.open) return; const d = dist3(o, p); if (d < bd) { bd = d; best = i; } });
      game.setObjectiveTarget(best >= 0 ? level.oysters[best] : null);
      if (best >= 0 && bd < 2.4) {
        game.prompt(game.mobile ? 'Hold Tool to open the oyster' : 'Hold E to open the oyster');
        this.hold = game.input.isHeld('tool') ? this.hold + dt : Math.max(0, this.hold - dt * 2);
        game.holdBar('Opening the oyster', this.hold > 0 ? this.hold / OPEN_TIME : null);
        if (this.hold >= OPEN_TIME) this.openOyster(ctx, best);
      } else { this.hold = 0; game.prompt(null); game.holdBar('', null); }
    } else if (id === 'damini') {
      const near = dist3(B.net, p) < 3.2;
      if (!near) { game.prompt(null); game.cutter('', null); game.holdBar('', null); this.hold = 0; }
      else if (this.phase === 'cut') {
        // Timed cut: the marker swings across the bar; press when it is in the green zone.
        const marker = 0.5 + 0.5 * Math.sin(this.clock * MARKER_SPEED);
        game.prompt(game.mobile ? 'Tap Tool when the marker is on green' : 'Press E when the marker is on green');
        game.cutter(`Cut the net (${this.cuts}/${CUTS})`, marker, ZONE);
        if (tool) {
          if (marker >= ZONE[0] && marker <= ZONE[1]) {
            this.cuts++;
            level.setNet(true, this.cuts);
            game.audio.play('hit');
            if (this.cuts >= CUTS) { this.phase = 'share'; level.setNet(false); game.cutter('', null); this.hold = 0; this.cheel.setMode('stay'); ctx.radio('Disha', 'Take my air. All of it.'); }
          } else game.audio.play('denied');
        }
      } else {
        // Hold to give Damini the breath Veer has left.
        game.prompt(game.mobile ? 'Hold Tool to share your breath' : 'Hold E to share your breath');
        this.hold = game.input.isHeld('tool') ? this.hold + dt : Math.max(0, this.hold - dt * 2);
        game.holdBar('Sharing breath', this.hold > 0 ? this.hold / SHARE_TIME : null);
        if (this.hold >= SHARE_TIME) {
          swim.breath = Math.min(swim.breath, 24);            // his last breath goes to her
          game.prompt(null); game.holdBar('', null);
          game.audio.play('unlock');
          this.cheel.setMode('follow');
          ctx.setFlag('sharedBreath');
          ctx.completeObjective('damini');
          game.banner('Up! Take her to the surface.', 3000);
        }
      }
    } else if (id === 'surface') {
      if (!swim.underwater && dist3(this.cheel.pos, p) < 8) this.surfaced(ctx);
    } else if (id === 'jal') {
      game.prompt(game.mobile ? 'Tap the Jal button to raise the shield' : 'Press Q to raise the Jal shield');
      if (shakti === 'jal' && this.jalUsedAt < 0) { this.jalUsedAt = this.clock; ctx.radio('Cheel', 'Marked him. My drone has his position.'); }
      if (this.jalUsedAt >= 0 && this.clock - this.jalUsedAt > 3.2) {   // shield tried: the barge pulls out
        game.prompt(null);
        this.removeGunman(game);
        this.clearBullets(game);
        level.letter.visible = true;
        ctx.setFlag('jalTutorialDone');
        ctx.completeObjective('jal');
        ctx.radio('Deepak', 'Coast Guard inbound. The barge is running.');
      }
    } else if (id === 'letter') {
      game.prompt(null);
      if (Math.hypot(p.x - (B.boat.x + 1.3), p.z - (B.boat.z - 0.6)) < 2.6 && !swim.underwater) this.readLetter(ctx);
    }

    this.gunfire(ctx, dt);
  },

  openOyster(ctx, i) {
    const { game } = ctx;
    const level = game.world.level;
    this.hold = 0;
    game.prompt(null); game.holdBar('', null);
    level.oysters[i].setOpen(true);
    this.mask |= 1 << i;
    ctx.setFlag('m3Oysters', this.mask);
    game.audio.play('unlock');
    this.setCount(ctx);
    const n = this.count();
    if (n < 3) {
      ctx.checkpoint('oysters');
      ctx.radio('Aangan', n === 1 ? 'One singing oyster! Two more, bhaiya.' : 'Two! One more. Do not forget to breathe.');
      return;
    }
    // The third mark: the Nishaan is complete. Then the net.
    ctx.setFlag('raniNishaan3');
    game.setObjectiveTarget(null);
    level.setNet(true, 0);
    this.cheel.root.visible = true;
    this.cheel.setMode('trapped');
    ctx.checkpoint('net');
    ctx.completeObjective('oysters');
    ctx.radio('Disha', "Three shells. The queen's mark on each.");
    ctx.radio('Cheel', 'Net. I am caught. Baaz, send a diver.');
    ctx.radio('Baaz', 'The job is done. Leave her. Raise anchor.');
    ctx.script(async (s) => { await s.wait(1.5); game.banner('Free Damini.'); });   // objective card
  },

  // Back in the air: Damini changes sides, Jal is earned, and the gunman opens fire.
  surfaced(ctx) {
    const { game } = ctx;
    this.busy = true;
    for (const d of this.divers) d.dispose();
    this.divers = [];
    game.stealth = null;
    ctx.script(async (s) => {
      ctx.radio('Cheel', 'They sink ships. I did not know.');
      await s.wait(4);
      ctx.setFlag('daminiJoined');
      game.banner('Cheel joined the squad.', 3600);
      ctx.radio('Deepak', 'Cheel, you fly with us now.');
      await s.wait(4);
      ctx.unlockShakti('jal');                    // saved; the HUD icon unlocks by itself
      game.player.currentShakti = 2;
      game.banner('Rani Nishaan 3 of 5. Jal Shakti unlocked.', 4200);
      ctx.checkpoint('surface');
      ctx.completeObjective('surface');
      this.busy = false;
      this.startGunfire(ctx);
    });
  },

  // The gunman's bullets (simple straight tracers; the Jal shield stops them in game.damagePlayer).
  gunfire(ctx, dt) {
    const { game } = ctx;
    const p = game.swim.pos;
    if (this.gunman && !this.gunman.gone && !game.swim.underwater) {
      this.gunman.mesh.rotation.y = Math.atan2(p.x - this.gunman.pos.x, p.z - this.gunman.pos.z);
      if ((this.fireT -= dt) <= 0) {
        this.fireT = 1.25;
        const from = this.gunman.pos.clone().add(new THREE.Vector3(0, 0.1, 0));
        const dir = new THREE.Vector3(p.x - from.x, p.y + 0.3 - from.y, p.z - from.z).normalize();
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false }));
        mesh.position.copy(from);
        game.scene.add(mesh);
        this.bullets.push({ mesh, dir, life: 3 });
        game.audio.play('shoot');
      }
    }
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.mesh.position.addScaledVector(b.dir, 26 * dt);
      b.life -= dt;
      const hit = Math.hypot(b.mesh.position.x - p.x, b.mesh.position.y - (p.y + 0.2), b.mesh.position.z - p.z) < 0.9;
      if (hit) game.damagePlayer(6, 'bullet');
      if (hit || b.life <= 0) { game.scene.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.material.dispose(); this.bullets.splice(i, 1); }
    }
  },

  readLetter(ctx) {
    const { game } = ctx;
    this.busy = true;
    game.frozen = true;
    game.audio.play('pickup');
    ctx.script(async (s) => {
      await s.after(game.letter.show(LETTER, { title: "Dadaji's letter", item: "In a tin tube, tied to Dadaji's boat.", map: false }));
      game.world.level.letter.visible = false;
      ctx.setFlag('hasDadajiLetter4');
      game.frozen = false;
      this.busy = false;
      ctx.completeObjective('letter');
    });
  },

  complete(ctx) {
    ctx.game.prompt(null);
    ctx.radio('Aangan', 'Three minutes? Dadaji was showing off.');
    ctx.radio('Cheel', 'Cheel. On your wing, Disha.');
    ctx.radio('Deepak', 'Third mark lit. Two remain. Out.');
  },
};
