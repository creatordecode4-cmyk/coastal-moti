import { OPEN_SEA as S } from '../levels/openSea.js';
import { createBoat, sailZone } from '../engine/boat.js';
import { createPatrolBoat } from '../ai/patrolBoat.js';

// MISSION 1 "HAWA KA RUKH" (the way of the wind) - 02:15, open sea.
// Veer sails Dadaji's boat to the island, upwind, past Kaala Jaal searchlights. On the island he
// finds the Teen-Ungli Chattan, places a diya where the sunrise shadow would fall, lights the
// first Rani Nishaan and earns the Vayu Shakti.
//
// Lullaby line 1: "Teen ungli jab suraj ko roke, hawa se poochh kinara kahan."
//   (When three fingers block the sun, ask the wind where the shore is.)
// Radio rules: every line max 12 words. Callsigns: Disha = Veer, Aangan = Meenu, Deepak = Kavya.

const LETTER = 'I was scared here the first time too.';

// Fixed patrol loops for the three speedboats (waypoints on the water).
const PATROLS = [
  { start: 0, phase: 0.0, route: [{ x: -70, z: 92 }, { x: 70, z: 92 }] },
  { start: 1, phase: 1.6, route: [{ x: -55, z: 18 }, { x: 55, z: 10 }, { x: 55, z: -22 }, { x: -55, z: -14 }] },
  { start: 0, phase: 3.1, route: [{ x: -60, z: -62 }, { x: 0, z: -72 }, { x: 60, z: -62 }, { x: 0, z: -66 }] },
];

export const hawaKaRukh = {
  id: 'm1_hawa_ka_rukh',
  aliases: ['m1_placeholder'],   // saves made before this mission existed
  name: 'Hawa ka Rukh',
  location: 'Open sea',
  time: '02:15',
  level: 'openSea',
  objectives: [
    { id: 'sail', text: 'Reach the island unseen', target: S.landing },
    { id: 'chattan', text: 'Find the Teen-Ungli Chattan', target: S.chattan },
    { id: 'diya', text: 'Place the diya where the sunrise shadow falls' },
    { id: 'vayu', text: 'Use Vayu to blow the dust away', target: S.dust },
    { id: 'letter', text: "Read Dadaji's letter", target: S.dust },
  ],
  endDelay: 7500,
  endLine: 'One Nishaan lit. Four remain.',

  // checkpoint: null (fresh start) | 'mid' | 'island' | 'nishaan'
  start(ctx, checkpoint) {
    const { game } = ctx;
    const level = game.world.level;
    this.patrols = [];
    this.busy = false;
    this.clock = 0;
    this.said = {};
    this.wrong = 0;
    this.toolPressed = false;
    this.midDone = checkpoint === 'mid';

    // Reset the island props.
    const solved = checkpoint === 'nishaan';
    level.nishaan.setLit(solved);
    level.shadows.visible = solved;
    level.diya.visible = false;
    if (solved) level.placeDiya(S.correctSlab, true);
    level.showDust(solved);
    level.letter.visible = false;

    // The Tool button places the diya; the Shakti button is watched for the Vayu tutorial.
    const offTool = game.events.on('tool', () => { this.toolPressed = true; });
    const offShakti = game.events.on('shakti', (s) => { if (s.id === 'vayu') this.vayuUsed = true; });
    game.onReset(() => { offTool(); offShakti(); });
    this.vayuUsed = false;

    if (!checkpoint) {
      this.launch(ctx, S.start.x, S.start.z);
      game.banner('Reach the island unseen.');           // objective card
      ctx.radio('Aangan', 'Teen ungli jab suraj ko roke, hawa se poochh kinara kahan.');
      ctx.radio('Disha', 'The lullaby. Ask the wind where the shore is.');
      ctx.radio('Disha', 'Night wind blows from land. I sail into it.');
      game.toast(game.mobile ? 'Stick up: sail. Left / right: steer. Zig-zag into the wind.'
        : 'W: sail. A / D: steer. You cannot sail straight into the wind: zig-zag.', 9000);
    } else if (checkpoint === 'mid') {
      this.launch(ctx, S.midShelter.x, S.midShelter.z);
      this.said.deepak = true;
    } else {
      // On the island, on foot. The boat is pulled up on the beach.
      this.beachBoat(ctx);
      if (checkpoint === 'island') {
        ctx.skipTo('chattan');
        ctx.placePlayer(S.beach.x, S.beach.z, 0, 0.2);
        game.banner('Find the Teen-Ungli Chattan.');
      } else {
        ctx.skipTo('vayu');
        const slab = S.slabs[S.correctSlab];
        ctx.placePlayer(slab.x - 1.5, slab.z + 1, -Math.PI / 2, 0.2);
        game.player.currentShakti = 0;
      }
    }
  },

  // Put Veer in the boat at (x, z), bow to the north, and send out the patrols.
  launch(ctx, x, z) {
    const { game } = ctx;
    const boat = createBoat(game, { x, z, heading: Math.PI, windFrom: S.windFrom });
    game.boat = boat;
    game.onReset(() => boat.dispose());
    game.player.health.reset();
    game.rig.yaw = 0; game.rig.pitch = 0.36; game.rig.distance = 12;
    game.rig.snap();
    this.patrols = PATROLS.map((p) => createPatrolBoat(game, p));
    game.onReset(() => { for (const p of this.patrols) p.dispose(); this.patrols = []; });
    game.stealth = { level: 0, lit: false };
  },

  beachBoat(ctx) {
    const { game } = ctx;
    const boat = createBoat(game, { x: S.landing.x + 3, z: S.landing.z + 0.5, heading: Math.PI * 0.9 });
    boat.park();
    game.boat = boat;
    game.onReset(() => boat.dispose());
    game.rig.resetFollow();
  },

  update(ctx, dt) {
    if (this.busy) return;
    this.clock += dt;
    if (ctx.game.boat?.active) this.sailing(ctx, dt); else this.onFoot(ctx, dt);
  },

  // ---------------------------------------------------------------- at sea
  sailing(ctx, dt) {
    const { game } = ctx;
    const boat = game.boat;

    // The wind swings a little, so the best course keeps changing.
    boat.windFrom = S.windFrom + 0.25 * Math.sin(this.clock * 0.08);
    const f = boat.forward(), wx = Math.sin(boat.windFrom), wz = Math.cos(boat.windFrom);
    game.sail = { rel: Math.atan2(wx * -f.z + wz * f.x, wx * f.x + wz * f.z), zone: sailZone(boat.off), speed: boat.speed };

    // Searchlights.
    let worst = 0, lit = false, chased = false;
    for (const p of this.patrols) {
      p.update(dt, boat.pos);
      worst = Math.max(worst, p.exposure);
      lit = lit || p.lit;
      if (p.state === 'chase') chased = true;
      if (p.justAlerted) {
        p.justAlerted = false;
        game.banner('Searchlight! They are coming.', 2600, true);   // short alert
        game.audio.play('alert');
        if (!this.said.alert) { this.said.alert = true; ctx.radio('Deepak', 'They saw you. Get behind a rock. Now.'); }
      }
      if (p.caught) { ctx.fail('Caught'); return; }
    }
    game.stealth = { level: chased ? 1 : worst, lit, label: chased ? 'CHASED' : undefined };

    // Kavya comes on the radio for the first time.
    if (!this.said.deepak && boat.pos.z < 118) {
      this.said.deepak = true;
      ctx.radio('Deepak', 'Disha, Deepak here. You are not alone.');
      ctx.radio('Deepak', "Coast Guard. I heard your father's call.");
      ctx.radio('Deepak', 'Kaala Jaal boats ahead. Stay out of their lights.');
    }

    if (!this.midDone && boat.pos.z < 46 && !chased) {
      this.midDone = true;
      ctx.checkpoint('mid');
      ctx.radio('Aangan', 'Halfway, bhaiya. Even the fish are hiding.');
    }

    // Any part of the island's shore will do: land where the water gets shallow.
    if (!chased && game.world.heightAt(boat.pos.x, boat.pos.z) > -2.4) this.land(ctx);
  },

  land(ctx) {
    const { game } = ctx;
    this.busy = true;
    game.frozen = true;
    ctx.script(async (s) => {
      await s.after(game.fade(true, 450));
      for (const p of this.patrols) p.dispose();
      this.patrols = [];
      // Pull the boat up where it touched the shore and step out toward the middle of the island.
      const b = game.boat.pos, dx = b.x - S.island.x, dz = b.z - S.island.z, d = Math.hypot(dx, dz) || 1;
      game.boat.pos.set(S.island.x + dx / d * 40.5, 0, S.island.z + dz / d * 40.5);
      game.boat.heading = Math.atan2(-dx, -dz) + 0.3;
      game.boat.park();
      game.sail = null; game.stealth = null;
      game.rig.resetFollow();
      ctx.placePlayer(S.island.x + dx / d * 35, S.island.z + dz / d * 35, Math.atan2(dx, dz), 0.2);
      ctx.checkpoint('island');
      ctx.completeObjective('sail');
      await s.after(game.fade(false, 500));
      game.frozen = false;
      this.busy = false;
      game.banner('Find the Teen-Ungli Chattan.');        // objective card
      ctx.radio('Deepak', 'Good sailing. Find the three-finger rock.');
    });
  },

  // ---------------------------------------------------------------- on the island
  onFoot(ctx) {
    const { game } = ctx;
    const level = game.world.level;
    const p = game.player.pos;
    const id = ctx.current?.id;
    const tool = this.toolPressed, vayu = this.vayuUsed;
    this.toolPressed = this.vayuUsed = false;

    if (id === 'chattan') {
      if (ctx.playerNear(S.chattan, 10)) {
        ctx.completeObjective('chattan');
        ctx.radio('Disha', 'Teen-Ungli Chattan. Three fingers against the sun.');
        ctx.radio('Deepak', 'Sun rises behind the sun mark. Shadow falls opposite.');
      }
    } else if (id === 'diya') {
      let near = -1;
      S.slabs.forEach((slab, i) => { if (Math.hypot(p.x - slab.x, p.z - slab.z) < 1.8) near = i; });
      game.prompt(near < 0 || this.diyaBusy ? null : game.mobile ? 'Tap Tool to place the diya' : 'Press E to place the diya');
      if (near >= 0 && tool && !this.diyaBusy) {
        game.audio.play('pickup');
        level.placeDiya(near, true);
        if (near === S.correctSlab) this.lightNishaan(ctx);
        else this.wrongStone(ctx, near);
      }
    } else if (id === 'vayu') {
      game.prompt(game.mobile ? 'Tap the Vayu button near the dust' : 'Press Q to use Vayu near the dust');
      if (vayu) {
        if (ctx.playerNear(S.dust, 13)) {
          game.prompt(null);
          level.blowDustAway();
          level.letter.visible = true;
          ctx.setFlag('vayuTutorialDone');
          ctx.completeObjective('vayu');
        } else game.toast('Too far. Use Vayu closer to the dust.');
      }
    } else if (id === 'letter') {
      if (ctx.playerNear(S.dust, 1.8)) this.readLetter(ctx);
    }
  },

  // A wrong stone: the flame dies after a moment and the diya comes back to Veer.
  wrongStone(ctx, i) {
    const { game } = ctx;
    this.diyaBusy = true;
    this.wrong++;
    ctx.script(async (s) => {
      await s.wait(1.1);
      game.world.level.placeDiya(i, false);
      game.audio.play('denied');
      ctx.radio('Aangan', 'Wrong stone, bhaiya. The diya went out.');
      if (this.wrong === 2) ctx.radio('Deepak', 'Find the sun mark. Go to the stone opposite.');
      await s.wait(1.2);
      game.world.level.diya.visible = false;
      this.diyaBusy = false;
    });
  },

  // The right stone: three shadows, the first Rani Nishaan lights up, Vayu is unlocked.
  lightNishaan(ctx) {
    const { game } = ctx;
    const level = game.world.level;
    this.diyaBusy = true;
    game.prompt(null);
    ctx.script(async (s) => {
      await s.wait(0.6);
      level.shadows.visible = true;
      game.engine.weather.strike();
      await s.wait(0.9);
      level.nishaan.setLit(true);
      ctx.setFlag('raniNishaan1');
      ctx.unlockShakti('vayu');                 // saved
      game.player.currentShakti = 0;
      level.showDust(true);
      game.banner('Rani Nishaan 1 of 5. Vayu Shakti unlocked.', 4500);
      ctx.checkpoint('nishaan');
      ctx.completeObjective('diya');
      ctx.radio('Disha', 'The Nishaan is lit. Wind in my hands.');
      ctx.radio('Deepak', 'Vayu. Use it. Clear that dust.');
      this.diyaBusy = false;
    });
  },

  readLetter(ctx) {
    const { game } = ctx;
    this.busy = true;
    game.frozen = true;
    game.audio.play('pickup');
    ctx.script(async (s) => {
      await s.after(game.letter.show(LETTER, { title: "Dadaji's letter", item: 'Hidden under the Teen-Ungli Chattan.', map: false }));
      game.world.level.letter.visible = false;
      ctx.setFlag('hasDadajiLetter2');
      game.frozen = false;
      this.busy = false;
      ctx.completeObjective('letter');
    });
  },

  complete(ctx) {
    ctx.game.prompt(null);
    ctx.radio('Disha', 'Dadaji stood here. Scared. Like me.');
    ctx.radio('Deepak', 'One mark found. Four remain. Rest, Disha. Out.');
    ctx.radio('Aangan', 'Come back before Amma wakes. Please.');
  },
};
