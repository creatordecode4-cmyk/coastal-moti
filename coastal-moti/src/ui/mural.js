// Mural panels: a short animated 2D picture with one caption line. The picture drifts slowly (a pan)
// while it fades in. Used for the story murals in Mission 4.
export function createMuralPanel() {
  const $ = (id) => document.getElementById(id);
  const el = $('mural'), art = $('mu-art'), caption = $('mu-caption'), count = $('mu-count'), done = $('mu-done');
  let resolve = null;

  function finish() { if (!resolve) return; const r = resolve; close(); r(); }
  function close() { el.hidden = true; el.classList.remove('on'); resolve = null; }
  done.addEventListener('click', finish);
  window.addEventListener('keydown', (e) => { if (!el.hidden && (e.code === 'Enter' || e.code === 'Space')) finish(); });

  return {
    // panel: { svg (inner SVG markup for a 400x220 picture), caption }, index / total for "2 / 5"
    show(panel, index, total) {
      art.innerHTML = `<svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice"><g class="mu-pan">${panel.svg}</g></svg>`;
      caption.textContent = panel.caption;
      count.textContent = `${index} / ${total}`;
      el.classList.toggle('twist', !!panel.twist);
      el.hidden = false;
      void el.offsetWidth;
      el.classList.add('on');
      return new Promise((r) => { resolve = r; });
    },
    close,
    get open() { return !el.hidden; },
    get caption() { return caption.textContent; },
  };
}
