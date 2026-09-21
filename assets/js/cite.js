// Publications: "Cite" opens a box with APA and BibTeX citations, each with a Copy button.
(() => {
  document.querySelectorAll("[data-cite]").forEach(btn => {
    const box = document.getElementById(btn.getAttribute("aria-controls"));
    if (!box) return;
    btn.addEventListener("click", () => {
      const show = box.hidden;
      box.hidden = !show;
      btn.setAttribute("aria-expanded", String(show));
    });
  });

  document.querySelectorAll(".cite-copy").forEach(btn => {
    btn.addEventListener("click", async () => {
      const text = btn.closest(".cite-row").querySelector(".cite-text").textContent.trim();
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; }
      catch (e) { // clipboard API unavailable (e.g. opened from a file): fall back to a selection copy
        const t = document.createElement("textarea");
        t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
        document.body.appendChild(t); t.select();
        try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
        t.remove();
      }
      const label = btn.textContent;
      btn.textContent = ok ? "Copied" : "Press Ctrl+C";
      setTimeout(() => { btn.textContent = label; }, 1600);
    });
  });
})();
