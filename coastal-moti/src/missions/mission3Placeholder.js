import { TEMPLE as T } from '../levels/temple.js';

// PLACEHOLDER for Mission 3. It only shows a mission card and lets the player walk around
// the temple courtyard with Vayu and Agni. Replace this file when Mission 3 is designed.
export const mission3Placeholder = {
  id: 'm3_placeholder',
  name: 'Mission 3',
  location: 'The island',
  time: 'Coming soon',
  level: 'temple',
  objectives: [{ id: 'wait', text: 'Mission 3 is not built yet. Free roam.' }],
  start(ctx) {
    const level = ctx.game.world.level;
    T.mirrors.forEach((m, i) => level.mirrors[i].set(m.solution));
    level.setBeam([{ x: 43, z: 16 }, ...T.mirrors, T.door], true);
    level.door.setOpen(true, true);
    level.nishaan.setLit(true);
    level.lamp.setLit(true);
    level.letter.visible = false;
    ctx.placePlayer(T.doorSpawn.x, T.doorSpawn.z, Math.PI * 0.75, 0.25);
  },
  update() {},
  complete() {},
};
