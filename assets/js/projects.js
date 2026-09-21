// Projects: one row per project, grouped into Current and Past.
// Clicking a row opens its details right underneath; clicking again (or ×) closes it.
// Links to #case-… anywhere on the page open that project.
(() => {
  const list = document.getElementById("proj-grid");
  if (!list) return;
  const cards = [...list.querySelectorAll(".proj-card")];
  const panels = cards.map(c => document.getElementById(c.getAttribute("aria-controls")));
  let openIndex = -1;

  function open(i, scroll) {
    const same = i === openIndex;
    cards.forEach((c, k) => {
      const on = k === i && !same;
      c.setAttribute("aria-expanded", String(on));
      panels[k].hidden = !on;
    });
    openIndex = same ? -1 : i;
    if (openIndex < 0) return;
    cards[i].closest("li").appendChild(panels[i]); // details sit under the row that opened them
    if (scroll) cards[i].scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  cards.forEach((c, i) => c.addEventListener("click", () => open(i, true)));
  panels.forEach((p, i) => p.querySelector(".case-close")?.addEventListener("click", () => { open(i); cards[i].focus(); }));

  document.addEventListener("click", e => {
    const a = e.target.closest('a[href^="#case-"]');
    if (!a) return;
    const i = panels.findIndex(p => "#" + p.id === a.getAttribute("href"));
    if (i < 0) return;
    e.preventDefault();
    if (openIndex !== i) open(i, false);
    cards[i].scrollIntoView({ block: "center", behavior: "smooth" });
  });

  if (location.hash.startsWith("#case-")) {
    const i = panels.findIndex(p => "#" + p.id === location.hash);
    if (i >= 0) open(i, true);
  }
})();
