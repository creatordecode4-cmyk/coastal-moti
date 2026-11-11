import { BARGE as B } from '../levels/barge.js';
import { createSwimmer } from '../engine/swim.js';
import { createAlly } from '../ai/ally.js';

// PLACEHOLDER for Mission 4. It only shows a mission card and lets the player swim around
// with Damini ("Cheel") following. Replace this file when Mission 4 is designed.
export const mission4Placeholder = {
  id: 'm4_placeholder',
  name: 'Mission 4',
  location: 'The island',
  time: 'Coming soon',
  level: 'barge',
  objectives: [{ id: 'wait', text: 'Mission 4 is not built yet. Free swim.' }],
  start(ctx) {
    const { game } = ctx;
    const level = game.world.level;
    level.oysters.forEach((o) => o.setOpen(true));
    level.setNet(false);
    level.letter.visible = false;
    game.player.reset(B.start.x, B.start.z);
    game.swim = createSwimmer(game, { ...B.start, surfaceY: B.surfaceY, airPockets: B.airPockets });
    game.rig.yaw = 0; game.rig.pitch = 0.3; game.rig.snap();
    this.cheel = createAlly(game, { name: 'Cheel', x: B.start.x + 3, y: -0.3, z: B.start.z + 1 });
    this.cheel.swimming = true;
    this.cheel.setMode('follow');
    this.cheel.drone.visible = true;
    game.onReset(() => this.cheel.dispose());
  },
  update(ctx, dt) { this.cheel.update(dt); },
  complete() {},
};
