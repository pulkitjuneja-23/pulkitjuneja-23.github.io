// Photo frames that hold several photos (.slides) show one at a time and cross-fade to the next
// every 20–30 seconds. Hovering or focusing pauses; dots let visitors pick a photo.
// No automatic changes for visitors who prefer reduced motion.
(() => {
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll(".slides").forEach(box => {
    const frames = [...box.querySelectorAll(":scope > .photo")];
    if (!frames.length) return;
    frames[0].classList.add("active");
    if (frames.length < 2) return;

    let index = 0, timer = null, paused = false;
    const dots = document.createElement("div");
    dots.className = "slide-dots";
    const buttons = frames.map((_, k) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", `Photo ${k + 1} of ${frames.length}`);
      b.addEventListener("click", () => { go(k); schedule(); });
      dots.appendChild(b);
      return b;
    });
    box.appendChild(dots);

    function go(k) {
      index = (k + frames.length) % frames.length;
      frames.forEach((f, n) => f.classList.toggle("active", n === index));
      buttons.forEach((b, n) => b.setAttribute("aria-current", n === index ? "true" : "false"));
    }
    function schedule() {
      clearTimeout(timer);
      if (REDUCED) return;
      timer = setTimeout(() => { if (!paused && !document.hidden) go(index + 1); schedule(); }, 20000 + Math.random() * 10000);
    }
    box.addEventListener("mouseenter", () => { paused = true; });
    box.addEventListener("mouseleave", () => { paused = false; });
    box.addEventListener("focusin", () => { paused = true; });
    box.addEventListener("focusout", () => { paused = false; });
    go(0);
    schedule();
  });
})();
