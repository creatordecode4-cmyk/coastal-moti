// Small screen helpers shared by missions: fade to black, toast, objective banner, alert, cinematic bars.
export function createOverlays() {
  const $ = (id) => document.getElementById(id);
  const fadeEl = $('fade'), toastEl = $('toast'), bannerEl = $('banner'), alertEl = $('alert');
  let toastTimer = 0, bannerTimer = 0;

  return {
    // fade(true) = to black, fade(false) = back in. Resolves when the fade is done.
    fade(toBlack, ms = 400) {
      fadeEl.style.transitionDuration = `${ms}ms`;
      void fadeEl.offsetWidth;
      fadeEl.style.opacity = toBlack ? '1' : '0';
      return new Promise((resolve) => setTimeout(resolve, ms + 30));
    },
    toast(text, ms = 2200) {
      toastEl.textContent = text;
      toastEl.classList.add('on');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove('on'), ms);
    },
    // Objective card: a big line across the screen that does not stop play.
    banner(text, ms = 4200, danger = false) {
      bannerEl.textContent = text;
      bannerEl.classList.toggle('danger', danger);
      bannerEl.classList.add('on');
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => bannerEl.classList.remove('on'), ms);
    },
    // A standing hint near the player ("Press E to place the diya"). Pass null to hide it.
    prompt(text) {
      const el = $('prompt');
      if (el.textContent !== (text || '')) el.textContent = text || '';
      el.hidden = !text;
    },
    // Progress bar for hold actions. fraction = null hides it.
    holdBar(label, fraction) {
      const el = $('holdbar');
      el.hidden = fraction === null || fraction === undefined;
      if (el.hidden) return;
      $('holdbar-label').textContent = label;
      el.querySelector('i').style.transform = `scaleX(${Math.max(0, Math.min(1, fraction))})`;
    },
    // Timing bar. marker and zone are 0..1 positions; zone = [from, to]. marker = null hides it.
    cutter(label, marker, zone = [0.4, 0.6]) {
      const el = $('cutter');
      el.hidden = marker === null || marker === undefined;
      if (el.hidden) return;
      $('cutter-label').textContent = label;
      const z = el.querySelector('.ct-zone');
      z.style.left = `${zone[0] * 100}%`; z.style.width = `${(zone[1] - zone[0]) * 100}%`;
      el.querySelector('i').style.left = `${marker * 100}%`;
    },
    showAlert(title, sub = '') {
      $('alert-title').textContent = title;
      $('alert-sub').textContent = sub;
      alertEl.hidden = false;
    },
    hideAlert() { alertEl.hidden = true; },
    setCinematic(on) { document.body.classList.toggle('cine', on); },
  };
}
