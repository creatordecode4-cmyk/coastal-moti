import { FORT as F } from '../levels/seaFort.js';
import { createAlly } from '../ai/ally.js';

// PLACEHOLDER for Mission 5. It only shows a mission card and lets the player walk around
// the captured sea-fort with Damini ("Cheel"). Replace this file when Mission 5 is designed.
export const mission5Placeholder = {
  id: 'm5_placeholder',
  name: 'Mission 5',
  location: 'Seepgaon Diya-Ghar',
  time: 'Coming soon',
  level: 'seaFort',
  reloadLevel: true,
  objectives: [{ id: 'wait', text: 'Mission 5 is not built yet. Free roam.' }],
  start(ctx) {
    const { game } = ctx;
    const level = game.world.level;
    level.innerGate.setOpen(true, true);
    level.northGate.setOpen(true, true);
    level.murals.forEach((m) => m.setState('seen'));
    level.nishaan.setLit(true);
    level.tower.setPower(false);
    level.setBattle(false);
    ctx.placePlayer(0, -47, 0, 0.28);
    this.cheel = createAlly(game, { name: 'Cheel', x: 2, z: -45 });
    this.cheel.setMode('follow');
    this.cheel.drone.visible = true;
    game.onReset(() => this.cheel.dispose());
  },
  update(ctx, dt) { this.cheel.update(dt); },
  complete() {},
};
