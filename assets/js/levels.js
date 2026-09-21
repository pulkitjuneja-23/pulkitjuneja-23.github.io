// Projects showcase: a large photo with a vertical "altitude" gauge (air → soil).
// Scrolling over the photo moves through the levels (the page scrolls on once the first/last level is reached),
// clicking a level or using arrow keys jumps to it, and swiping sideways works on touch screens.
// It also steps through on its own every 8 s while on screen, until the visitor interacts.
(() => {
  const root = document.getElementById("levels");
  if (!root) return;
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const frames = [...root.querySelectorAll(".levels-frames .photo")];
  const caps = [...root.querySelectorAll(".lv-cap")];
  const tabs = [...root.querySelectorAll(".levels-gauge button")];
  const gauge = root.querySelector(".levels-gauge");
  let index = 0, auto = !REDUCED, visibleRatio = 0, timer = null;

  function set(i, focus = false) {
    index = Math.max(0, Math.min(tabs.length - 1, i));
    frames.forEach((f, k) => f.classList.toggle("active", k === index));
    caps.forEach((c, k) => { c.hidden = k !== index; });
    tabs.forEach((t, k) => { t.setAttribute("aria-selected", String(k === index)); t.tabIndex = k === index ? 0 : -1; });
    root.style.setProperty("--level", index / (tabs.length - 1));
    // on a phone the gauge is a sideways strip, so keep the current label on screen
    if (gauge.scrollWidth > gauge.clientWidth + 4) {
      const t = tabs[index];
      gauge.scrollTo({ left: t.offsetLeft - (gauge.clientWidth - t.clientWidth) / 2, behavior: REDUCED ? "auto" : "smooth" });
    }
    if (focus) tabs[index].focus();
  }
  const stopAuto = () => { auto = false; clearInterval(timer); };
  function run() { clearInterval(timer); timer = setInterval(() => { if (!document.hidden) set((index + 1) % tabs.length); }, 8000); }

  tabs.forEach((t, k) => t.addEventListener("click", () => { stopAuto(); set(k); }));
  gauge.addEventListener("keydown", e => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault(); stopAuto(); set(index + step, true);
  });

  // Mouse wheel / trackpad: one level per gesture, only while the showcase is almost fully in view.
  let lockUntil = 0, acc = 0;
  root.addEventListener("wheel", e => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || visibleRatio < 0.85) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    if ((dir > 0 && index === tabs.length - 1) || (dir < 0 && index === 0)) return; // let the page carry on
    e.preventDefault();
    const now = performance.now();
    acc += e.deltaY;
    if (now < lockUntil || Math.abs(acc) < 30) return;
    acc = 0; lockUntil = now + 650;
    stopAuto(); set(index + dir);
  }, { passive: false });

  // Touch: swipe left/right on the photo.
  let touchX = null;
  root.addEventListener("touchstart", e => {
    touchX = e.target.closest(".levels-gauge") ? null : e.touches[0].clientX;
  }, { passive: true });
  root.addEventListener("touchend", e => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 45) { stopAuto(); set(index + (dx < 0 ? 1 : -1)); }
  }, { passive: true });

  root.addEventListener("pointerenter", () => clearInterval(timer));
  root.addEventListener("pointerleave", () => { if (auto && visibleRatio > 0.4) run(); });
  new IntersectionObserver(([e]) => {
    visibleRatio = e.intersectionRatio;
    if (visibleRatio > 0.4 && auto) run(); else clearInterval(timer);
  }, { threshold: [0, 0.4, 0.85, 1] }).observe(root);

  set(0);
})();
