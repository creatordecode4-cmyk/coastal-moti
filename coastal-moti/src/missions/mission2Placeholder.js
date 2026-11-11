import { OPEN_SEA as S } from '../levels/openSea.js';

// PLACEHOLDER for Mission 2. It only shows a mission card and lets the player walk around
// the island with Vayu. Replace this file when Mission 2 is designed.
export const mission2Placeholder = {
  id: 'm2_placeholder',
  name: 'Mission 2',
  location: 'The island',
  time: 'Coming soon',
  level: 'openSea',
  objectives: [{ id: 'wait', text: 'Mission 2 is not built yet. Free roam.' }],
  start(ctx) {
    const level = ctx.game.world.level;
    level.nishaan.setLit(true);
    level.shadows.visible = true;
    level.placeDiya(S.correctSlab, true);
    level.showDust(false);
    level.letter.visible = false;
    const slab = S.slabs[S.correctSlab];
    ctx.placePlayer(slab.x - 1.5, slab.z + 1, -Math.PI / 2, 0.2);
    ctx.game.player.currentShakti = 0;
  },
  update() {},
  complete() {},
};
