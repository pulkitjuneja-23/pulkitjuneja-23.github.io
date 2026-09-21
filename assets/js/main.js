// Page behavior: top bar state, scroll-progress rail, active section, photo slots, contact links, footer year.
(() => {
  const root = document.documentElement;
  // Empty photo slots show their expected file name only when previewing locally (never on the live site).
  if (location.protocol === "file:") root.classList.add("local");

  document.querySelectorAll(".photo img").forEach(img => {
    const fig = img.closest(".photo");
    const check = () => fig.classList.toggle("empty", !img.naturalWidth);
    img.addEventListener("load", check);
    img.addEventListener("error", () => fig.classList.add("empty"));
    if (img.complete) check();
  });

  // Contact: "Let's connect" reveals the same row of links that sits at the top of the page.
  const connect = document.getElementById("connect");
  if (connect) {
    const links = document.getElementById("contact-row");
    connect.addEventListener("click", () => {
      const show = links.hidden;
      links.hidden = !show;
      connect.setAttribute("aria-expanded", String(show));
      if (show) links.querySelector("a")?.focus();
    });
  }

  const bar = document.getElementById("topbar"), hero = document.querySelector(".hero");
  const navLinks = [...document.querySelectorAll(".topnav a")];
  const sections = [...document.querySelectorAll("[data-nav]")];
  const marksHost = document.getElementById("rail-marks"), pct = document.getElementById("rail-pct");

  const marks = sections.map(sec => {
    const a = document.createElement("a");
    a.href = "#" + sec.id; a.className = "rail-mark";
    a.innerHTML = `<span>${sec.dataset.label}</span>`;
    a.setAttribute("aria-label", sec.dataset.label);
    marksHost.appendChild(a);
    return a;
  });

  // Place each marker at the scroll position where its section starts.
  function placeMarks() {
    const max = Math.max(1, root.scrollHeight - innerHeight);
    sections.forEach((sec, i) => {
      const y = sec.getBoundingClientRect().top + scrollY - innerHeight * 0.3;
      marks[i].style.setProperty("--at", Math.min(1, Math.max(0, y / max)).toFixed(4));
    });
  }
  new ResizeObserver(placeMarks).observe(document.body);

  onScrollFrame(() => {
    const max = Math.max(1, root.scrollHeight - innerHeight), p = Math.min(1, scrollY / max);
    root.style.setProperty("--progress", p.toFixed(4));
    pct.textContent = Math.round(p * 100) + "%";
    bar.classList.toggle("solid", hero.getBoundingClientRect().bottom < 72);

    let current = null;
    for (const sec of sections) if (sec.getBoundingClientRect().top <= innerHeight * 0.35) current = sec;
    if (p > 0.995) current = sections[sections.length - 1];
    const id = current ? current.id : "";
    navLinks.forEach(a => a.classList.toggle("active", a.getAttribute("href") === "#" + id));
    marks.forEach((m, i) => {
      m.classList.toggle("active", sections[i].id === id);
      m.classList.toggle("passed", current && sections.indexOf(current) >= i);
    });
  });

  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
