# Coastal Moti: The Lost Pearl

An original 3D third-person action-adventure for the browser, set on the Konkan coast.
Story campaign + a battle mode against bots. Runs on phones (touch) and PC (keyboard + mouse).

Last updated: 11 November 2026 (Mission 2 added)

**Status: Missions 0, 1 and 2 are playable** with placeholder art ("Andhera", "Hawa ka Rukh", "Aaina",
roughly 4-6 minutes each). Mission 3 is only a placeholder card.

## Controls

| Action | PC | Phone / tablet |
|---|---|---|
| Move | WASD (or arrows) | Left thumb: virtual joystick (appears where you touch) |
| Run | hold Shift | push the joystick to its edge |
| Look | mouse (click once to capture it) | drag on the right half of the screen |
| Attack | left click or J | Attack button |
| Shakti (current power) | right click or Q | Shakti button |
| Select Shakti | 1-5 | tap a Shakti icon |
| Burst (charges by dealing damage) | F | Burst button |
| Tool | E | Tool button |
| Dodge-roll | Space | Dodge button |
| Pause | Esc or P | pause button |

The scheme is picked automatically (touch devices get the joystick and buttons).

**Sailing (Mission 1):** forward (W / stick up) raises the sail, left and right steer, back (S / stick down)
rows backward, letting go drops the sail. The HUD dial shows where the wind comes from; the red wedge is
the direction the boat cannot sail. To go upwind, zig-zag (tack) on either side of the wedge.

## Run it

It is a plain static site: no install, no build step. You only need any static file server
(opening `index.html` directly with `file://` will not work, because browsers block ES modules there).

```bash
cd coastal-moti
python3 -m http.server 8080      # or: npx serve -l 8080
```

Open <http://localhost:8080>. To test on a phone on the same Wi-Fi, open `http://<your-PC-IP>:8080`
(note: install-to-home-screen and offline mode need **https** or `localhost`, so test those after deploying).

All paths are relative, so the game works from a sub-folder URL (tested over https at `/coastal-moti/`:
the manifest, the service worker and offline mode all work there).

## Put it online for free (GitHub Pages, separate repository)

The game gets its **own** repository, so the portfolio and its hosting are never touched.

1. On github.com create a new **public** repository, for example `coastal-moti` (free GitHub Pages needs a public repository).
2. Put two things in it: this `coastal-moti/` folder, and the file `coastal-moti/deploy/github-pages.yml`
   copied to `.github/workflows/deploy.yml`.
3. In the new repository open **Settings -> Pages -> Build and deployment -> Source** and choose **GitHub Actions**.
4. Push to `main` (or run the workflow by hand from the **Actions** tab). After about a minute the game is at
   `https://<your-username>.github.io/<repository-name>/`.
5. On the phone: open that link in Chrome, then menu -> **Add to Home screen** to install it.

Every later push that changes `coastal-moti/` republishes automatically.
When you release a new version, bump `CACHE_VERSION` in `sw.js`.

Other free hosts work too (Netlify, Cloudflare Pages): publish the `coastal-moti` folder with no build command.

## Folder structure

```
index.html            page shell, importmap (three -> ./vendor), HUD and overlay markup
manifest.json         PWA manifest
sw.js                 service worker: precache + network-first with offline fallback
vendor/               three.js 0.160.0 (pinned, vendored) + its MIT licence
src/
  main.js             entry point: device check, settings, starts the game
  game.js             wires all systems together and runs the frame loop
  engine/
    engine.js         renderer, scene, lights, loop, quality + environment switching
    environments.js   look presets: ENV_DAY, ENV_STORM_NIGHT, ENV_SEA_NIGHT, ENV_DAWN (sky, sun, sea, fog, rain)
    boat.js           Dadaji's sailing boat: wind, points of sail, tacking, wave bobbing
    weather.js        rain (one draw call, animated in the shader) and lightning
    world.js          level loader + builder helpers + collision / line-of-sight API
    player.js         third-person controller: walk, run, dodge-roll, attack, Shakti, Burst, Tool
    cameraRig.js      follow camera with wall avoidance + cutscene camera
    input.js combat.js health.js shaktis.js sky.js sea.js quality.js device.js events.js mathx.js
  levels/
    seepgaon.js       the village, the hill and the Diya-Ghar lighthouse (storm night)
    openSea.js        open water with sea rocks, and the island with the Teen-Ungli Chattan
    temple.js         the broken temple-lighthouse: courtyard, three mirrors, sunbeam, door, lamp
    testArena.js      daytime combat test island
  ai/
    guard.js          stealth guard: fixed waypoint route, torch vision cone, hearing
    patrolBoat.js     smuggler speedboat: fixed route, sweeping searchlight, short chase
    sniper.js         rooftop sniper: aims while he has line of sight, cover and dust break it
    drone.js          Damini's drone: fixed loop with a scanner circle on the ground
    neelu.js          Neelu the kingfisher: flies to where the player should look next
    bot.js            combat bot: patrol, investigate, chase, shoot, cover
  missions/
    missionManager.js mission flow, objectives, checkpoints, scripts, saving
    andhera.js        Mission 0 "Andhera"
    hawaKaRukh.js     Mission 1 "Hawa ka Rukh"
    aaina.js          Mission 2 "Aaina"
    mission3Placeholder.js
    systemsCheck.js   combat test mission (developer only)
  ui/                 hud.js, touchControls.js, pauseMenu.js, missionCard.js, radio.js, overlays.js,
                      compassTutorial.js, letter.js, *.css
  audio/audio.js      sound hooks (synthesized placeholder sounds, storm ambience, thunder)
  save/               save.js (progress, checkpoint, flags), settings.js (quality, sound)
assets/               icons/ (original) · models/ textures/ audio/ are still empty
deploy/github-pages.yml   GitHub Pages workflow template (see "Put it online for free")
licenses/ASSETS.md    one line per third-party asset: name, author, URL, license
```

## Mission 0 "Andhera" (23:40 · Seepgaon Diya-Ghar)

1. The lighthouse flickers three times and goes dark. Baba's radio call cuts off.
2. **Compass tutorial:** take Dadaji's brass compass from the porch and turn it. The needle always swings
   back to the same direction: the island. Saves the flag `compassPointsToIsland` (needed in the finale).
3. Climb the lane to the Diya-Ghar. Cutscene: men in black cut the lamp wires.
4. **Stealth escape:** four guards walk fixed routes. The lit cone on the ground is exactly what a torch
   can see; walls and houses cut it. Standing under a street lamp makes Veer visible from far away
   (the HUD shows HIDDEN / IN LIGHT / SEEN). Running close to a guard makes it stop and look.
   If the meter fills: "Spotted", then back to the last checkpoint.
5. Take Dadaji's tin box at the boat shed (half a map + a letter), then get home.
6. Objective card, one-line card, then the Mission 1 placeholder card.

Checkpoints (saved to localStorage, a refresh resumes there): `compass`, `escape`, `mid`, `box`.
Flags saved in `progress.flags`: `hasCompass`, `compassPointsToIsland`, `hasHalfMap`, `hasDadajiLetter1`.

## Mission 1 "Hawa ka Rukh" (02:15 · Open sea)

Starts by itself when Mission 0 ends.

1. **Sailing:** Veer sails Dadaji's boat to the island. The night wind blows from the island, so he must
   tack against it. Lullaby line 1 plays on the radio; Kavya ("Deepak") speaks for the first time.
2. **Searchlights:** three Kaala Jaal speedboats follow fixed routes and sweep a pool of light over the sea.
   One second in the light = alert, and that boat chases for about six seconds. Sea rocks block the light.
   Turning side-on to the wind outruns the chase; sitting still or sailing close to the wind does not.
   If the boat reaches Veer: "Caught", back to the last checkpoint.
3. **The island:** find the Teen-Ungli Chattan (three finger pillars). Five flat stones surround it and a
   carved sun mark shows where the sun rises. The diya goes on the stone opposite the sun mark, where
   the three shadows would fall. A wrong stone puts the diya out.
4. **Reward:** the first Rani Nishaan lights up and the **Vayu Shakti** is unlocked and saved: a wind dash
   that pushes nearby enemies and blows dust away. A short tutorial makes the player use it once on a
   dust swirl, which uncovers Dadaji's second letter.
5. One-line card, then the Mission 2 placeholder card.

Checkpoints: `mid` (half-way, behind a rock), `island` (landed), `nishaan` (Vayu unlocked).
Flags: `raniNishaan1`, `vayuTutorialDone`, `hasDadajiLetter2`.

## Mission 2 "Aaina" (06:30 · Broken temple-lighthouse)

Starts by itself when Mission 1 ends. Dawn.

1. **Reach the temple:** two Kaala Jaal guards patrol the path (first real combat: Attack, Dodge, Vayu).
   Damini ("Cheel") speaks for the first time; her drone circles the courtyard.
2. **Align the mirrors:** a sunbeam enters through a gap in the east wall. Three mirrors turn 22.5 degrees
   per press of Tool; the beam is traced live as a glowing line and must reach the temple door.
   - A **sniper** on the roof aims while he has line of sight (the HUD shows IN SIGHT and a meter);
     crates, walls and the mirror stands break it. A dodge-roll slips a shot.
   - The **drone** paints a scanner circle; touching it alerts the sniper, who then aims almost twice as fast.
   - **Vayu** raises a dust cloud for 9 seconds: it hides Veer from both and makes the beam glow brightly.
   - **Neelu** perches on the mirror that needs work. He never shows the angle.
   - **Hints:** a small one after 60 seconds, a stronger one after 120 seconds (names the mirror and the
     direction, not the number of turns), then one more every 60 seconds.
3. **Light the lamp:** the door opens, the second Rani Nishaan lights and the **Agni Shakti** is unlocked and
   saved. The tutorial makes the player face the temple lamp and use Agni once.
4. Dadaji's third letter, a one-line card, then the Mission 3 placeholder card.

Checkpoints: `gate` (inside the courtyard), `door` (puzzle solved, Agni unlocked).
Flags: `raniNishaan2`, `agniTutorialDone`, `hasDadajiLetter3`.
Veer slowly recovers health after six seconds without being hit (this mission only).

## Replaying and jumping to a mission

- Pause menu -> "Reset all progress" starts again from Mission 0.
- Add `?mission=<id>` to the address to start at a mission: `?mission=m0_andhera`, `?mission=m1_hawa_ka_rukh`, `?mission=m2_aaina`.
- Developer only: `?mission=t0_systems_check` opens the daytime combat test arena.

## How to add a mission

A mission is a plain object registered in `src/game.js` with `game.missions.register(mission)`.
`src/missions/andhera.js` is the full example. The minimum is:

```js
export const mission = {
  id: 'm1_example', name: 'Mission name', location: 'Seepgaon Diya-Ghar', time: '23:40',
  level: 'seepgaon',
  objectives: [{ id: 'reach', text: 'Reach the gate', target: { x: 0, z: 0 } }],
  endLine: 'Optional one-line card at the end.',
  start(ctx, checkpoint) { ctx.placePlayer(0, 38); ctx.radio('Aangan', 'Move.'); },
  update(ctx, dt)        { if (ctx.playerNear({ x: 0, z: 0 }, 2.5)) ctx.completeObjective('reach'); },
  complete(ctx)          { ctx.unlockShakti('vayu'); },
};
```

`ctx` also offers `checkpoint(id)`, `fail(title)`, `setFlag(name)`, `skipTo(objectiveId)`,
`script(async (s) => { await s.wait(2); ... })` for timed sequences, `spawnBot(...)`, `setTarget(pos)` and
`setObjectiveText(id, text)`. Radio lines over 12 words are cut and reported in the console.

## Sound hooks

Every event calls `game.audio.play('<name>')` (attack, hit, hurt, dodge, radio, objective, thunder, static,
flicker, pickup ...). Today each name is a short synthesized sound, and the storm ambience is filtered noise.
To swap in a real file: `game.audio.load('attack', 'assets/audio/attack.ogg')`, then add the file to
`licenses/ASSETS.md`.

## Known limits

- All art is placeholder shapes; characters have no skeletal animation.
- "Climbing the lighthouse" is a cutscene: there are no interiors, stairs, jumping or climbing yet.
- Sailing is simplified: the sail trims itself, there is no capsizing, and the wind only swings a little.
- Patrol boats do not avoid each other and only check line of sight against sea rocks.
- The sniper's line of sight is the same simple 2D check: anything tall hides Veer, even though the sniper stands on a roof.
- Damini's "race" for the door is told through radio lines only; she cannot win it yet.
- Guards never leave their routes (by design for this mission) and do not search for the player.
- Line of sight is checked in 2D against walls, houses and tall stacks; low props do not hide Veer.
- Combat bots (test arena) still have no path-finding.
- Shakti effects and all damage numbers are placeholder tuning.
- Not yet profiled on a real phone. The 30 FPS target must be checked on a mid-range Android device.
- Stealth, sailing and sniper difficulty were tuned with automated checks, not with human players.

## Tech rules

- Pure static web project, no backend, no paid services, no paid assets.
- Three.js pinned at **0.160.0**, plain ES modules, no build step.
- Performance target: **30 FPS on a mid-range Android phone.** Low-poly models, simple lights,
  ONE shadow-casting directional light, instancing for repeated objects.
- Quality toggle Low / Medium / High (`src/engine/quality.js`). Mobile defaults to Low, PC to Medium.
  The choice is remembered.
- Controls: mobile = left virtual joystick + right buttons (Attack, Shakti, Burst, Tool, Dodge);
  PC = WASD + mouse + keys 1-5 for Shaktis. The right scheme is picked automatically.
- When you add or rename a file, add it to `PRECACHE` in `sw.js` and bump `CACHE_VERSION`.
- `window.__moti` exposes the game object in the browser console for debugging.

## Originality and legal rules

- Everything is original: no names, characters, missions, dialogue, logos, fonts, HUD layouts,
  sounds or music from any existing game or film.
- Third-party assets must be CC0 or clearly commercial-use-allowed, and be listed in
  `licenses/ASSETS.md` before they are committed.
- No real-money mechanics, no loot boxes, no trading, no cash-out items.

## Story bible (use consistently everywhere)

| Who / what | Details |
|---|---|
| **Veer** (17) | Hero. Fisherman's son from Seepgaon, Konkan coast. Callsign **"Disha"**. |
| **Inspector Kavya Naik** | Coast Guard. Callsign **"Deepak"**. Calm, short sentences. |
| **Meenu** (9) | Veer's sister, on radio from home. Callsign **"Aangan"**. Light humor. |
| **Damini** (22) | Freelance treasure hunter with a drone. Callsign **"Cheel"**. Starts with the enemy, switches sides in Mission 3. |
| **Neelu** | A kingfisher that shows the way, like an objective marker. |
| **Baaz** | Leader of the smuggler gang **Kaala Jaal**. Calm, professional, never shouts. Puts out the Diya-Ghar lighthouse on purpose so ships crash in storms and his gang can loot them. |
| **Dadaji** | Veer's late grandfather. Appears only in short letters found at each clue. |
| **Rani Chandravati** | Fictional coastal queen from the 1700s. Seen only in murals and the lullaby. |
| **Chandramoti pearl** | The heart of the Diya-Ghar lighthouse. |
| **Dadaji's brass compass** | The key that fits the lamp socket. |

- **The lullaby is the treasure map.** Each line is one clue; each clue unlocks one Shakti:
  **Vayu** (wind), **Agni** (fire), **Jal** (water), **Bijli** (lightning), **Dharti** (earth).
- **The one big twist (Mission 4):** the "pirate queen" was a protector. The pearl was never
  treasure; it was the lighthouse's light.
- **Dialogue rules:** every line max 12 words. Military-radio tone ("Copy." "Move." "Sniper on the roof.").
  No crying, no long speeches.
