import { FORT as F } from '../levels/seaFort.js';
import { createSwimmer } from '../engine/swim.js';
import { createAlly } from '../ai/ally.js';
import { angleDiff } from '../engine/mathx.js';
import { MURALS } from './amavasyaMurals.js';

// MISSION 4 "AMAVASYA" (new-moon night) - 00:00, the sea-fort.
// The Coast Guard draws fire at the main gate while Veer and Damini slip in through the water tunnel.
// A star dial opens the inner gate. Five murals tell the true story and its twist: the Chandramoti
// pearl was never treasure, it was the light of the Diya-Ghar. Then Baaz takes the radio tower and
// cuts the Coast Guard's radio. Veer wins the tower back and earns the Bijli Shakti.
//
// Baaz is only a voice on the radio and a far-off shape on the tower.
// Radio rules: every line under 12 words. Callsigns: Disha = Veer, Aangan = Meenu, Deepak = Kavya, Cheel = Damini.

const LETTER = 'The Rani never wanted gold. Only light.';
const ORDER = ['court', 'hall', 'tower', 'power'];

export const amavasya = {
  id: 'm4_amavasya',
  aliases: ['m4_placeholder'],
  name: 'Amavasya',
  location: 'The sea-fort',
  time: '00:00',
  level: 'seaFort',
  reloadLevel: true,          // gates lose their colliders when they open: rebuild the fort on every (re)start
  grants: 'bijli',
  objectives: [
    { id: 'tunnel', text: 'Swim in through the water tunnel', target: F.landing },
    { id: 'dial', text: 'Align the star dial', target: F.dial },
    { id: 'murals', text: 'Read the murals (0/5)' },
    { id: 'letter', text: "Read Dadaji's letter", target: F.letter },
    { id: 'tower', text: 'Capture the radio tower (wave 1 of 2)', target: F.tower },
    { id: 'nishaan', text: 'Touch the mark on the tower', target: F.nishaan },
    { id: 'power', text: 'Cut the tower power with Bijli', target: F.powerBox },
  ],
  endDelay: 8000,
  endLine: 'Four Nishaan lit. One remains.',

  // checkpoint: null (fresh start) | 'court' | 'hall' | 'tower' | 'power'
  start(ctx, checkpoint) {
    const { game } = ctx;
    const level = game.world.level;
    const at = ORDER.indexOf(checkpoint);                // -1 = fresh start
    this.busy = false; this.clock = 0; this.said = {}; this.lastHurt = -99;
    this.toolPressed = false; this.shakti = null;
    this.seen = at >= 2 ? MURALS.length : 0;
    this.wave = at >= 3 ? 3 : 0; this.waveT = 0;

    // The fort as it should be at this point of the story.
    game.starDial.reset(at >= 1);
    level.setDial(game.starDial.state, game.starDial.steps);
    level.innerGate.setOpen(at >= 1, true);
    level.northGate.setOpen(at >= 2, true);
    this.showMurals(level);
    level.letter.visible = false;
    level.baaz.visible = at >= 2;
    level.nishaan.setLit(at >= 3);
    level.tower.setPower(true);
    level.setBattle(true);                               // the Coast Guard at the main gate

    const offTool = game.events.on('tool', () => { this.toolPressed = true; });
    const offShakti = game.events.on('shakti', (s) => { this.shakti = s.id; });
    game.player.health.onDamage = () => { this.lastHurt = this.clock; };
    game.onReset(() => { offTool(); offShakti(); game.player.health.onDamage = null; });

    // Damini is an ally now.
    this.cheel = createAlly(game, { name: 'Cheel', x: F.swimStart.x + 3, y: -0.3, z: F.swimStart.z + 2 });
    this.cheel.enemies = () => game.bots.filter((b) => !b.health.dead);
    game.onReset(() => this.cheel.dispose());
    this.cheel.setMode('follow');

    if (at < 0) {
      game.player.reset(F.swimStart.x, F.swimStart.z);
      game.swim = createSwimmer(game, { ...F.swimStart, surfaceY: F.surfaceY });
      game.rig.yaw = 0; game.rig.pitch = 0.3; game.rig.snap();
      this.cheel.swimming = true;
      game.banner('Enter through the water tunnel.');
      ctx.radio('Deepak', 'Disha, we hit the main gate. You take the water.');
      ctx.radio('Cheel', 'Tunnel is under the sea wall. Dive with me.');
      ctx.radio('Aangan', 'New moon, bhaiya. Amavasya. Come back before dawn.');
    } else {
      const spawn = [F.landing, { x: 0, z: -20.8 }, { x: 0, z: -37.5 }, { x: 0, z: -47 }][at];
      ctx.skipTo(['dial', 'murals', 'tower', 'power'][at]);
      ctx.placePlayer(spawn.x, spawn.z, 0, 0.28);
      this.landCheel(game, spawn);
      if (at === 0) game.banner('Align the star dial.');
      if (at === 1) { this.setMuralText(ctx); game.banner('Read the murals.'); }
      if (at === 2) { game.banner('Capture the radio tower.'); this.said.baaz = true; }
      if (at === 3) { game.player.currentShakti = 3; game.banner('Cut the tower power.'); }
    }
  },

  // ---- helpers ----
  landCheel(game, near) {
    this.cheel.swimming = false;
    this.cheel.pos.set(near.x + 2, game.world.heightAt(near.x + 2, near.z + 2), near.z + 2);
    this.cheel.drone.visible = true;
  },
  showMurals(level) { level.murals.forEach((m, i) => m.setState(i < this.seen ? 'seen' : i === this.seen ? 'ready' : 'dark')); },
  setMuralText(ctx) { ctx.setObjectiveText('murals', `Read the murals (${this.seen}/${MURALS.length})`); },
  alive(game) { return game.bots.filter((b) => !b.health.dead).length; },

  spawnWave(ctx, n) {
    const { game } = ctx;
    this.wave = n;
    for (const p of F.waves[n - 1]) {
      const bot = ctx.spawnBot({ x: p.x, z: p.z, hp: 45, patrol: [] });
      bot.label = 'Guard';
      bot.alert(game.player.pos);                        // they know he is here
    }
    ctx.setObjectiveText('tower', `Capture the radio tower (wave ${n} of 2)`);
    this.cheel.autoMark = true;
    game.audio.play('alert');
    ctx.radio('Cheel', n === 1 ? 'Guards at the tower. Marking them.' : 'Second group. Coming over the wall.');
  },

  update(ctx, dt) {
    if (this.busy) return;
    const { game } = ctx;
    const level = game.world.level;
    const player = game.player, p = game.swim ? game.swim.pos : player.pos;
    const id = ctx.current?.id;
    this.clock += dt;
    const tool = this.toolPressed, shakti = this.shakti;
    this.toolPressed = false; this.shakti = null;

    if (this.clock - this.lastHurt > 6 && !player.health.dead) player.health.heal(5 * dt);   // catch his breath
    this.cheel.update(dt);

    if (id === 'tunnel') {
      if (!this.said.fire && p.z < 26) { this.said.fire = true; ctx.radio('Deepak', 'Taking fire at the gate. Keep moving.'); }
      if (p.z < 5.6 && !game.swim.underwater) this.land(ctx);
    } else if (id === 'dial') {
      const near = Math.hypot(p.x - F.dial.x, p.z - F.dial.z) < 3.4;
      game.prompt(near ? (game.mobile ? 'Tap Tool to use the star dial' : 'Press E to use the star dial') : null);
      if (near && tool) this.useDial(ctx);
    } else if (id === 'murals') {
      const m = level.murals[this.seen];
      game.setObjectiveTarget(m);
      const near = Math.hypot(p.x - m.x, p.z - m.z) < 2.6;
      game.prompt(near ? (game.mobile ? 'Tap Tool to look at the mural' : 'Press E to look at the mural') : null);
      if (near && tool) this.readMural(ctx);
    } else if (id === 'letter') {
      game.prompt(null);
      if (ctx.playerNear(F.letter, 1.9)) this.readLetter(ctx);
    } else if (id === 'tower') {
      if (this.wave === 0 && p.z < F.yardEntry.z + 1.5) this.spawnWave(ctx, 1);
      else if (this.wave >= 1 && this.alive(game) === 0) {
        if ((this.waveT += dt) > 2) {
          this.waveT = 0;
          if (this.wave === 1) this.spawnWave(ctx, 2);
          else {
            this.wave = 3;
            this.cheel.autoMark = false;
            ctx.completeObjective('tower');
            ctx.radio('Disha', 'Tower yard is clear.');
            ctx.radio('Cheel', 'There. A mark on the tower leg.');
          }
        }
      }
    } else if (id === 'nishaan') {
      if (ctx.playerNear(F.nishaan, 2.8)) {
        level.nishaan.setLit(true);
        ctx.setFlag('raniNishaan4');
        ctx.unlockShakti('bijli');                 // saved; the HUD icon unlocks by itself
        player.currentShakti = 3;
        game.banner('Rani Nishaan 4 of 5. Bijli Shakti unlocked.', 4200);
        ctx.checkpoint('power');
        ctx.completeObjective('nishaan');
        ctx.radio('Cheel', 'Power box, by the tower. Fry it, Disha.');
      }
    } else if (id === 'power') {
      game.prompt(game.mobile ? 'Face the power box and tap the Bijli button' : 'Face the power box and press Q to use Bijli');
      if (shakti === 'bijli') {
        const d = Math.hypot(F.powerBox.x - p.x, F.powerBox.z - p.z);
        const aim = Math.abs(angleDiff(player.facing, Math.atan2(F.powerBox.x - p.x, F.powerBox.z - p.z)));
        if (d < 12 && aim < 0.9) this.cutPower(ctx);
        else game.toast(d >= 12 ? 'Too far. Go closer to the power box.' : 'Turn to face the power box first.');
      }
    }
  },

  // Out of the pool, onto the stone of the star-dial court.
  land(ctx) {
    const { game } = ctx;
    this.busy = true;
    game.frozen = true;
    ctx.script(async (s) => {
      await s.after(game.fade(true, 400));
      game.swim.dispose(); game.swim = null;
      ctx.placePlayer(F.landing.x, F.landing.z, 0, 0.28);
      this.landCheel(game, F.landing);
      ctx.checkpoint('court');
      ctx.completeObjective('tunnel');
      await s.after(game.fade(false, 500));
      game.frozen = false;
      this.busy = false;
      game.banner('Align the star dial.');
      ctx.radio('Cheel', 'A star dial. Three rings. My drone cannot read it.');
      ctx.radio('Disha', 'The gate opens when the stars line up.');
    });
  },

  // The star-dial puzzle (a 2D overlay). Hints come from Cheel after 60 and 120 seconds at the dial.
  useDial(ctx) {
    const { game } = ctx;
    const level = game.world.level;
    this.busy = true;
    game.frozen = true;
    game.prompt(null);
    ctx.script(async (s) => {
      const solved = await s.after(game.starDial.run({
        onChange: (state) => level.setDial(state, game.starDial.steps),
        onHint: (n) => ctx.radio('Cheel', n === 1 ? 'One ring drags the next. Start outside.' : 'Outer, middle, inner. Marks up to the star.'),
      }));
      game.frozen = false;
      this.busy = false;
      if (!solved) return;
      level.innerGate.setOpen(true);
      game.audio.play('objective');
      ctx.checkpoint('hall');
      ctx.completeObjective('dial');
      this.showMurals(level);
      game.banner('Read the murals.');
      ctx.radio('Disha', 'Stars aligned. The gate is open.');
    });
  },

  // One mural: a short animated panel. The fifth is the twist.
  readMural(ctx) {
    const { game } = ctx;
    const level = game.world.level;
    this.busy = true;
    game.frozen = true;
    game.prompt(null);
    game.audio.play('pickup');
    ctx.script(async (s) => {
      await s.after(game.muralPanel.show(MURALS[this.seen], this.seen + 1, MURALS.length));
      this.seen++;
      this.showMurals(level);
      this.setMuralText(ctx);
      game.frozen = false;
      this.busy = false;
      if (this.seen < MURALS.length) return;
      ctx.setFlag('pearlIsTheLight');            // the twist is known
      level.letter.visible = true;
      game.setObjectiveTarget(null);
      ctx.completeObjective('murals');
      ctx.radio('Disha', 'The pearl was the light. Never treasure.');
      ctx.radio('Cheel', 'I chased a lamp. For thieves.');
    });
  },

  readLetter(ctx) {
    const { game } = ctx;
    const level = game.world.level;
    this.busy = true;
    game.frozen = true;
    game.audio.play('pickup');
    ctx.script(async (s) => {
      await s.after(game.letter.show(LETTER, { title: "Dadaji's letter", item: 'Tucked under the last mural.', map: false }));
      level.letter.visible = false;
      ctx.setFlag('hasDadajiLetter5');
      game.frozen = false;
      this.busy = false;
      // Baaz takes the radio tower and the Coast Guard goes silent.
      level.baaz.visible = true;
      level.northGate.setOpen(true);
      ctx.setFlag('commsCut');
      ctx.checkpoint('tower');
      ctx.completeObjective('letter');
      ctx.radio('Baaz', 'A fine story. The tower is mine now.');
      ctx.radio('Baaz', 'Your Coast Guard cannot hear you. Nobody can.');
      ctx.radio('Deepak', 'Disha, you are break—');
      ctx.radio('Radio', 'Coast Guard signal lost.', { sound: 'static' });
      game.banner('Capture the radio tower.');
    });
  },

  // Bijli on the power box: the jammer dies, the Coast Guard is back, Baaz walks away.
  cutPower(ctx) {
    const { game } = ctx;
    const level = game.world.level;
    game.prompt(null);
    level.tower.setPower(false);
    game.engine.weather.strike();
    game.audio.play('unlock');
    ctx.setFlag('bijliTutorialDone');
    ctx.setFlag('commsCut', false);
    ctx.radio('Deepak', 'Disha, Deepak. We hear you again.');
    ctx.radio('Baaz', 'Keep the tower. I only need the pearl.');
    ctx.script(async (s) => { await s.wait(5); level.baaz.visible = false; });
    ctx.completeObjective('power');
  },

  complete(ctx) {
    ctx.radio('Aangan', 'A lamp, bhaiya? All this for a lamp?');
    ctx.radio('Deepak', 'Fourth mark lit. One remains. Dawn is close.');
  },
};
