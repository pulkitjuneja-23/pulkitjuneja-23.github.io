// Shared helpers for the canvas visuals (loaded before the other scripts).
const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches;
const C = { ink: "#dfe8e1", muted: "#8a9a8f", rule: "#243029", pink: "#ee6f82", green: "#57c27a", sky: "#72a9d8", soil: "#c79d6f", gold: "#e8e35a", stage: "#0b100d" };

// Keeps a canvas crisp at its CSS size; calls draw(ctx, w, h) on resize and on demand.
function fitCanvas(canvas, draw) {
  const ctx = canvas.getContext("2d");
  const state = { w: 0, h: 0, redraw() { if (state.w) draw(ctx, state.w, state.h); } };
  new ResizeObserver(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.w = canvas.clientWidth; state.h = canvas.clientHeight;
    canvas.width = Math.round(state.w * dpr); canvas.height = Math.round(state.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.redraw();
  }).observe(canvas);
  return state;
}

function press(buttons, active) { buttons.forEach(b => b.setAttribute("aria-pressed", String(b === active))); }

function mulberry(seed) {
  return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const RAMP = [[59, 42, 107], [43, 122, 140], [87, 194, 122], [232, 227, 90]];
function ramp(t) {
  t = Math.max(0, Math.min(1, t)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(t)), f = t - i, a = RAMP[i], b = RAMP[i + 1];
  return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(",")})`;
}

// Runs fn at most once per frame on scroll/resize.
function onScrollFrame(fn) {
  let queued = false;
  const request = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; fn(); }); } };
  addEventListener("scroll", request, { passive: true });
  addEventListener("resize", request);
  request();
}

// Continuous position (0 … steps-1) of a reading line through a list of scrollytelling steps.
function stepProgress(steps, focus = 0.7) {
  const y = innerHeight * focus;
  const centers = steps.map(el => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; });
  if (y <= centers[0]) return 0;
  for (let i = 0; i < centers.length - 1; i++) {
    if (y < centers[i + 1]) return i + (y - centers[i]) / (centers[i + 1] - centers[i]);
  }
  return centers.length - 1;
}

function markActive(steps, index) { steps.forEach((el, i) => el.classList.toggle("active", i === index)); }
