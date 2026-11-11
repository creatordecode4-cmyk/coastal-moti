// The star dial (Mission 4): three stone rings, each with a piece of a constellation.
// Turn the rings until all three pieces sit under the fixed star. The catch: the rings are linked.
// Turning the outer ring drags the middle one; turning the middle ring drags the inner one.
// (So the order that works is outer, then middle, then inner.)
// Hints appear after 60 and 120 seconds of looking at the dial.

const STEPS = 6;                 // positions per ring (60 degrees each)
const START = [4, 1, 5];         // outer, middle, inner
const NAMES = ['Outer', 'Middle', 'Inner'];
const HINTS = ['Turning one ring drags the next ring inward. Start with the outer ring.',
  'Outer first, then middle, then inner. Bring each mark up to the star.'];

export function createStarDial(game) {
  const $ = (id) => document.getElementById(id);
  const el = $('star-dial'), svg = $('sd-svg'), hint = $('sd-hint'), buttons = $('sd-buttons');
  const state = [...START];
  const shown = START.map((v) => v * 360 / STEPS);   // angles currently drawn (for the turn animation)
  let resolve = null, timer = 0, elapsed = 0, hintsShown = 0, onHint = null, onChange = null, solved = false;

  // Draw the dial once.
  const glyphs = ['M-7 -97 L5 -89 L-2 -80', 'M-2 -73 L7 -63 L0 -54', 'M0 -47 L-6 -37 L2 -29'];
  const radii = [[102, 78], [75, 51], [48, 24]];
  let html = '<circle r="112" fill="#1b2430"/>';
  radii.forEach(([ro, ri], i) => {
    let ticks = '';
    for (let k = 0; k < STEPS; k++) ticks += `<line x1="0" y1="${-ro}" x2="0" y2="${-ro + 6}" stroke="#3a2c12" stroke-width="2" transform="rotate(${k * 360 / STEPS})"/>`;
    const dots = glyphs[i].replace(/[ML]/g, '').trim().split(/\s+/).reduce((acc, v, j, arr) => (j % 2 ? acc : acc + `<circle cx="${v}" cy="${arr[j + 1]}" r="3.4" fill="#eaf6ff"/>`), '');
    html += `<g class="sd-ring" data-ring="${i}"><path d="M0 ${-ro} A${ro} ${ro} 0 1 1 -0.01 ${-ro} Z M0 ${-ri} A${ri} ${ri} 0 1 0 0.01 ${-ri} Z" fill="${['#8a6a2a', '#a8843a', '#c29f52'][i]}" fill-rule="evenodd" stroke="#3a2c12" stroke-width="1.5"/>${ticks}<path d="${glyphs[i]}" fill="none" stroke="#eaf6ff" stroke-width="2"/>${dots}</g>`;
  });
  html += '<circle r="20" fill="#3a2c12"/><path d="M0 -119 L3.5 -111 L12 -110 L5.5 -104.5 L7.5 -96 L0 -100.5 L-7.5 -96 L-5.5 -104.5 L-12 -110 L-3.5 -111 Z" fill="#ffd27a"/>';
  svg.innerHTML = html;
  const ringEls = [...svg.querySelectorAll('.sd-ring')];
  NAMES.forEach((name, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = `${name} ring`; b.dataset.ring = i;
    b.addEventListener('click', () => turn(i));
    buttons.appendChild(b);
  });
  ringEls.forEach((r, i) => r.addEventListener('pointerdown', () => turn(i)));
  $('sd-back').addEventListener('click', () => finish(false));
  window.addEventListener('keydown', (e) => {
    if (el.hidden) return;
    const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
    if (i >= 0) turn(i);
    if (e.code === 'KeyX') finish(false);
  });

  function render() {
    // Rotation is set as an SVG attribute: it always turns about the centre of the dial (0, 0).
    ringEls.forEach((r, i) => {
      const to = state[i] * 360 / STEPS;
      let from = shown[i];
      if (to < from) from -= 360;                     // always turn forward
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / 260);
        shown[i] = from + (to - from) * k;
        r.setAttribute('transform', `rotate(${shown[i]})`);
        if (k < 1 && state[i] * 360 / STEPS === to) requestAnimationFrame(step); else { shown[i] = state[i] * 360 / STEPS; r.setAttribute('transform', `rotate(${shown[i]})`); }
      };
      if (Math.abs(to - shown[i]) < 0.01) r.setAttribute('transform', `rotate(${to})`); else requestAnimationFrame(step);
    });
    el.classList.toggle('solved', solved);
    onChange?.(state);
  }

  function turn(i) {
    if (solved || el.hidden) return;
    state[i] = (state[i] + 1) % STEPS;
    if (i < 2) state[i + 1] = (state[i + 1] + 1) % STEPS;   // the link
    game.audio.play('ui');
    solved = state.every((v) => v === 0);
    render();
    if (solved) { game.audio.play('unlock'); setTimeout(() => finish(true), 1100); }
  }

  function finish(result) {
    if (!resolve) return;
    clearInterval(timer);
    el.hidden = true;
    const r = resolve; resolve = null;
    r(result);
  }

  return {
    steps: STEPS,
    get state() { return state; },
    get solved() { return solved; },
    get elapsed() { return elapsed; },
    get open() { return !el.hidden; },
    reset(solvedState = false) { state.splice(0, 3, ...(solvedState ? [0, 0, 0] : START)); state.forEach((v, i) => { shown[i] = v * 360 / STEPS; }); solved = solvedState; elapsed = 0; hintsShown = 0; hint.textContent = ''; },
    // For tests and scripts: jump the hint clock.
    setElapsed(v) { elapsed = v; },
    turn,
    close() { finish(false); },
    // Opens the dial. Resolves true when solved, false when the player steps back.
    run(callbacks = {}) {
      onHint = callbacks.onHint; onChange = callbacks.onChange;
      $('sd-help').textContent = game.mobile ? 'Tap a ring (or its button) to turn it.' : 'Click a ring, or press 1 / 2 / 3. X steps back.';
      el.hidden = false;
      render();
      timer = setInterval(() => {
        if (game.paused || solved) return;
        elapsed += 0.25;
        const due = elapsed >= 120 ? 2 : elapsed >= 60 ? 1 : 0;
        if (due > hintsShown) { hintsShown = due; hint.textContent = `Hint: ${HINTS[due - 1]}`; onHint?.(due); }
      }, 250);
      return new Promise((r) => { resolve = r; });
    },
  };
}
