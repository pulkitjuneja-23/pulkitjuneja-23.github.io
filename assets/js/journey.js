// Journey: dot-matrix world map beside the chapter cards.
// Home bases (data-type="home") are joined by a route; conference trips (data-type="trip") are drawn
// as side trips out of Temple. Scrolling the cards moves the map. Photos stay tucked away until a card
// (or its place on the map) is clicked. On narrow screens the cards become a horizontal swipe row.
(() => {
  const canvas = document.getElementById("map"), list = document.getElementById("chapters");
  if (!canvas || !list || !window.WORLD_DOTS) return;
  const cards = [...list.querySelectorAll(".chapter")];
  const narrow = matchMedia("(max-width: 900px)");
  const GOLD = "rgba(232,200,90,1)";

  const D = window.WORLD_DOTS, bin = atob(D.bits), bits = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bits[i] = bin.charCodeAt(i);
  const isLand = (r, c) => { const i = r * D.cols + c; return (bits[i >> 3] >> (i & 7)) & 1; };

  const chapters = cards.map(el => ({ lon: +el.dataset.lon, lat: +el.dataset.lat, zoom: +el.dataset.zoom, place: el.dataset.place, key: el.dataset.key, type: el.dataset.type || "home" }));
  const places = chapters.map((ch, i) => ({ ...ch, i })).filter(ch => ch.key);
  const hub = places.find(p => p.key === "temple") || places[0];
  const cam = { lon: chapters[0].lon, lat: chapters[0].lat, zoom: chapters[0].zoom };
  let active = -1, onScreen = false, pulse = 0, hit = [];

  const view = fitCanvas(canvas, (c, w, h) => {
    c.fillStyle = C.stage; c.fillRect(0, 0, w, h);
    const k = (w / 360) * cam.zoom;
    const X = lon => w / 2 + (lon - cam.lon) * k, Y = lat => h / 2 - (lat - cam.lat) * k;

    c.strokeStyle = "rgba(223,232,225,.05)"; c.lineWidth = 1;
    for (let lon = -180; lon <= 180; lon += 15) { const x = X(lon); if (x > 0 && x < w) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } }
    for (let lat = -60; lat <= 90; lat += 15) { const y = Y(lat); if (y > 0 && y < h) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } }

    const stride = Math.max(1, Math.ceil(3.2 / (k * D.step)));
    const size = Math.max(1, Math.min(2.8, k * D.step * stride * 0.5));
    const lonMin = cam.lon - w / 2 / k, lonMax = cam.lon + w / 2 / k, latMax = cam.lat + h / 2 / k, latMin = cam.lat - h / 2 / k;
    const r0 = Math.max(0, Math.floor((D.lat0 - latMax) / D.step)), r1 = Math.min(D.rows - 1, Math.ceil((D.lat0 - latMin) / D.step));
    const c0 = Math.max(0, Math.floor((lonMin + 180) / D.step)), c1 = Math.min(D.cols - 1, Math.ceil((lonMax + 180) / D.step));
    c.fillStyle = "rgba(223,232,225,.26)";
    for (let r = r0 - (r0 % stride); r <= r1; r += stride) {
      const y = Y(D.lat0 - (r + 0.5) * D.step);
      for (let col = c0 - (c0 % stride); col <= c1; col += stride) {
        if (isLand(r, col)) c.fillRect(X(-180 + (col + 0.5) * D.step) - size / 2, y - size / 2, size, size);
      }
    }

    const arc = (a, b, color, width, dash) => {
      const ax = X(a.lon), ay = Y(a.lat), bx = X(b.lon), by = Y(b.lat);
      c.strokeStyle = color; c.lineWidth = width; c.setLineDash(dash);
      c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 - Math.hypot(bx - ax, by - ay) * 0.22, bx, by); c.stroke();
      c.setLineDash([]);
    };
    const homes = places.filter(p => p.type === "home" && p.i <= active);
    for (let j = 1; j < homes.length; j++) arc(homes[j - 1], homes[j], C.pink, 1.8, [6, 5]);
    places.filter(p => p.type === "trip" && p.i <= active).forEach(p => arc(hub, p, "rgba(232,200,90,.55)", 1.2, [3, 4]));

    hit = [];
    for (const p of places) {
      const x = X(p.lon), y = Y(p.lat), isActive = p.i === active, seen = p.i <= active, home = p.type === "home";
      if (x < -20 || x > w + 20 || y < -20 || y > h + 20) continue;
      hit.push({ x, y, i: p.i });
      const color = home ? C.pink : GOLD;
      if (isActive && !REDUCED_MOTION) {
        c.strokeStyle = home ? `rgba(238,111,130,${1 - pulse})` : `rgba(232,200,90,${1 - pulse})`; c.lineWidth = 2;
        c.beginPath(); c.arc(x, y, (home ? 7 : 5) + pulse * 18, 0, 7); c.stroke();
      }
      c.fillStyle = seen ? color : C.stage; c.strokeStyle = seen ? color : C.muted; c.lineWidth = 1.5;
      c.beginPath(); c.arc(x, y, home ? (isActive ? 7 : 5.5) : (isActive ? 5 : 3.5), 0, 7); c.fill(); c.stroke();
      if (home) { c.fillStyle = C.stage; c.beginPath(); c.arc(x, y, 2, 0, 7); c.fill(); }
    }
    c.font = "12px 'IBM Plex Sans', sans-serif";
    for (const hp of hit) {
      if (hp.i !== active) continue;
      const label = chapters[active].place, tw = c.measureText(label).width, lx = Math.min(hp.x + 12, w - tw - 12);
      c.fillStyle = "rgba(11,16,13,.85)"; c.fillRect(lx - 6, hp.y - 26, tw + 12, 22);
      c.fillStyle = C.ink; c.fillText(label, lx, hp.y - 11);
    }
  });

  function setActive(i) { if (i !== active) { active = i; markActive(cards, i); } }

  // Only one card shows its photos at a time.
  function setOpen(i, force) {
    cards.forEach((card, k) => {
      const toggle = card.querySelector(".chapter-toggle");
      if (!toggle) return;
      const on = k === i ? (force ?? !card.classList.contains("open")) : false;
      card.classList.toggle("open", on);
      toggle.setAttribute("aria-expanded", String(on));
    });
  }

  function goTo(i) {
    setActive(i); setOpen(i, true);
    const card = cards[i], behavior = REDUCED_MOTION ? "auto" : "smooth";
    if (narrow.matches) list.scrollTo({ left: card.offsetLeft - (list.clientWidth - card.clientWidth) / 2, behavior });
    else requestAnimationFrame(() => card.scrollIntoView({ block: "center", behavior }));
  }

  cards.forEach((card, i) => {
    if (!card.querySelector(".slides")) return;
    card.classList.add("has-photos");
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "chapter-toggle";
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", `Photos: ${chapters[i].place}`);
    card.prepend(btn);
    card.addEventListener("click", e => {
      if (e.target.closest(".slide-dots")) return;
      setActive(i); setOpen(i);
    });
  });

  // map → text
  const nearest = e => {
    const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    let best = null, bd = 22;
    for (const hp of hit) { const d = Math.hypot(hp.x - mx, hp.y - my); if (d < bd) { bd = d; best = hp; } }
    return best;
  };
  canvas.addEventListener("click", e => { const p = nearest(e); if (p) goTo(p.i); });
  canvas.addEventListener("mousemove", e => { canvas.style.cursor = nearest(e) ? "pointer" : "default"; });

  // text → map
  onScrollFrame(() => {
    if (narrow.matches) return;
    setActive(Math.max(0, Math.min(cards.length - 1, Math.round(stepProgress(cards, 0.5)))));
  });
  let queued = false;
  list.addEventListener("scroll", () => {
    if (!narrow.matches || queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const mid = list.scrollLeft + list.clientWidth / 2;
      let best = 0, bd = Infinity;
      cards.forEach((card, i) => { const d = Math.abs(card.offsetLeft + card.clientWidth / 2 - mid); if (d < bd) { bd = d; best = i; } });
      setActive(best);
    });
  }, { passive: true });
  if (narrow.matches) setActive(0);

  function frame() {
    if (onScreen) {
      const target = chapters[Math.max(0, active)];
      if (REDUCED_MOTION) Object.assign(cam, { lon: target.lon, lat: target.lat, zoom: target.zoom });
      else {
        const far = Math.hypot(target.lon - cam.lon, target.lat - cam.lat);
        const goalZoom = target.zoom / (1 + far / 12);
        cam.lon += (target.lon - cam.lon) * 0.06;
        cam.lat += (target.lat - cam.lat) * 0.06;
        cam.zoom = Math.exp(Math.log(cam.zoom) + (Math.log(goalZoom) - Math.log(cam.zoom)) * 0.06);
        pulse = (pulse + 0.012) % 1;
      }
      view.redraw();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(canvas);
})();
