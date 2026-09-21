// Hero field scene (drone's-eye view):
// - a tractor tills grass into soil in back-and-forth passes (random start lane, never the same as last time in this tab)
// - a farm track on the right where a person works at a laptop, facing the field
// - one survey drone flying lines over the field with its sensor footprint below it
// The scene pauses when scrolled out of view and starts fresh when it comes back or the page reloads.
(() => {
  const canvas = document.getElementById("till");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SPEED = 38; // tractor, CSS px per second

  let W, H, s, cssW, u, grass, soil, field, fctx;
  let lanes, laneW, left, top, bottom, roadX, roadW, segs, total, dist, heading;
  let raf = null, last = 0, pause = 0, dust = [], clock = 0;
  let survey, person;

  /* ---------- procedural textures ---------- */
  const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
  function noise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }
  const fbm = (x, y, oct) => { let v = 0, amp = 0.5, f = 1; for (let o = 0; o < oct; o++) { v += amp * noise(x * f, y * f); f *= 2.03; amp *= 0.5; } return v / (1 - Math.pow(0.5, oct)); };
  const mix = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);

  function noiseLayer(colorAt, seed) {
    const gw = Math.ceil(W / 3), gh = Math.ceil(H / 3), img = new ImageData(gw, gh), px = img.data, k = 3 / s;
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const [r, g, b] = colorAt(x * k + seed, y * k + seed, hash(x, y + seed));
      const i = (y * gw + x) * 4;
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
    }
    const small = document.createElement("canvas"); small.width = gw; small.height = gh;
    small.getContext("2d").putImageData(img, 0, 0);
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d"); g.imageSmoothingEnabled = true; g.drawImage(small, 0, 0, W, H);
    return c;
  }

  function makeGrass() {
    const seed = Math.random() * 1000;
    const c = noiseLayer((x, y, grain) => {
      const patch = fbm(x / 260, y / 260, 4), clump = fbm(x / 34, y / 34, 3), dry = Math.max(0, (fbm(x / 180 + 40, y / 180, 3) - 0.62) * 3);
      const t = patch * 0.6 + clump * 0.4, light = 0.82 + grain * 0.3;
      let r = mix(38, 96, t), g = mix(62, 122, t), b = mix(24, 46, t);
      r = mix(r, 148, dry * 0.55); g = mix(g, 138, dry * 0.45); b = mix(b, 82, dry * 0.4);
      return [r * light, g * light, b * light];
    }, seed);
    const g = c.getContext("2d");
    for (let i = 0; i < (W * H) / (240 * s); i++) {
      g.fillStyle = `rgba(20,36,14,${0.12 + Math.random() * 0.18})`;
      g.beginPath(); g.ellipse(Math.random() * W, Math.random() * H, (1 + Math.random() * 2.5) * s, (1 + Math.random() * 2) * s, Math.random() * 3, 0, 7); g.fill();
    }
    g.lineWidth = 0.8 * s;
    for (let i = 0; i < (W * H) / (26 * s); i++) {
      const x = Math.random() * W, y = Math.random() * H, l = (1.5 + Math.random() * 3) * s, a = Math.random() * 6.28;
      g.strokeStyle = `rgba(${150 + Math.random() * 60 | 0},${170 + Math.random() * 50 | 0},${90 + Math.random() * 40 | 0},${0.1 + Math.random() * 0.14})`;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    // farm track along the right edge
    const grd = g.createLinearGradient(roadX, 0, roadX + roadW, 0);
    grd.addColorStop(0, "rgba(120,98,70,0)"); grd.addColorStop(0.12, "rgba(150,126,92,.92)");
    grd.addColorStop(0.88, "rgba(150,126,92,.92)"); grd.addColorStop(1, "rgba(120,98,70,0)");
    g.fillStyle = grd; g.fillRect(roadX, 0, roadW, H);
    for (let i = 0; i < (roadW * H) / (40 * s); i++) {
      g.fillStyle = `rgba(${90 + Math.random() * 70 | 0},${72 + Math.random() * 50 | 0},${50 + Math.random() * 40 | 0},.5)`;
      g.fillRect(roadX + roadW * (0.12 + Math.random() * 0.76), Math.random() * H, rand(1, 3) * s, rand(1, 3) * s);
    }
    g.fillStyle = "rgba(96,78,54,.35)";
    g.fillRect(roadX + roadW * 0.28, 0, roadW * 0.1, H); g.fillRect(roadX + roadW * 0.62, 0, roadW * 0.1, H);
    g.fillStyle = "rgba(90,120,60,.45)"; g.fillRect(roadX + roadW * 0.45, 0, roadW * 0.1, H);
    return c;
  }

  function makeSoil() {
    const seed = Math.random() * 1000;
    const c = noiseLayer((x, y, grain) => {
      const moist = fbm(x / 200, y / 200, 4), fine = fbm(x / 12, y / 12, 2);
      const furrow = 0.5 + 0.5 * Math.sin((x / 4.2) * Math.PI + fine * 1.5);
      const t = moist * 0.55 + furrow * 0.3 + grain * 0.15;
      return [mix(58, 118, t), mix(40, 86, t), mix(26, 58, t)];
    }, seed);
    const g = c.getContext("2d");
    for (let i = 0; i < (W * H) / (90 * s); i++) {
      const x = Math.random() * W, y = Math.random() * H, r = (0.8 + Math.random() * 2.2) * s;
      g.fillStyle = "rgba(28,18,10,.45)"; g.beginPath(); g.arc(x + r * 0.4, y + r * 0.4, r, 0, 7); g.fill();
      g.fillStyle = `rgba(${130 + Math.random() * 40 | 0},${98 + Math.random() * 30 | 0},${66 + Math.random() * 20 | 0},.8)`;
      g.beginPath(); g.arc(x, y, r * 0.8, 0, 7); g.fill();
    }
    for (let i = 0; i < (W * H) / (1400 * s); i++) {
      const x = Math.random() * W, y = Math.random() * H, l = (3 + Math.random() * 6) * s, a = Math.random() * 6.28;
      g.strokeStyle = "rgba(170,150,90,.35)"; g.lineWidth = s;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    return c;
  }

  /* ---------- geometry ---------- */
  function setup() {
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (!cw || !ch) return false;
    s = Math.min(window.devicePixelRatio || 1, 1.5); cssW = cw;
    W = canvas.width = Math.round(cw * s); H = canvas.height = Math.round(ch * s);
    laneW = Math.round(Math.max(30, Math.min(48, cw / 36))) * s;
    u = laneW / 34;
    roadW = Math.round(Math.max(70, Math.min(150, cw * 0.1))) * s;
    roadX = W - roadW;
    lanes = Math.max(4, Math.floor((roadX - 12 * s) / laneW));
    left = (roadX - lanes * laneW) / 2;
    top = Math.max(laneW * 0.9, 76 * s); bottom = H - laneW * 0.9;
    grass = makeGrass(); soil = makeSoil();
    field = document.createElement("canvas"); field.width = W; field.height = H;
    fctx = field.getContext("2d");
    person = { x: roadX + roadW * 0.5, y: H * 0.6 };
    return true;
  }

  function buildPath(start) {
    const dir = start < lanes / 2 ? 1 : -1, order = [];
    for (let i = start; i >= 0 && i < lanes; i += dir) order.push(i);
    for (let i = start - dir; i >= 0 && i < lanes; i -= dir) order.push(i);
    const cx = i => left + (i + 0.5) * laneW, r = laneW / 2;
    segs = [];
    const add = (x1, y1, x2, y2, till) => { const len = Math.hypot(x2 - x1, y2 - y1); if (len > 0) segs.push({ x1, y1, x2, y2, len, till }); };
    order.forEach((lane, k) => {
      const down = k % 2 === 0, y1 = down ? top : bottom, y2 = down ? bottom : top, x = cx(lane);
      add(x, y1, x, y2, true);
      const next = order[k + 1];
      if (next === undefined) return;
      const nx = cx(next), out = down ? 1 : -1;
      if (Math.abs(next - lane) === 1) {
        const mx = (x + nx) / 2, sgn = Math.sign(nx - x);
        let px = x, py = y2;
        for (let j = 1; j <= 14; j++) {
          const a = Math.PI - (j / 14) * Math.PI, qx = mx - sgn * Math.cos(a) * r, qy = y2 + out * Math.sin(a) * r;
          add(px, py, qx, qy, false); px = qx; py = qy;
        }
      } else {
        const hy = y2 + out * r * 0.9;
        add(x, y2, x, hy, false); add(x, hy, nx, hy, false); add(nx, hy, nx, y2, false);
      }
    });
    total = segs.reduce((t, sg) => t + sg.len, 0);
  }

  function pointAt(d) {
    let acc = 0;
    for (const seg of segs) {
      if (d <= acc + seg.len) { const t = Math.max(0, (d - acc) / seg.len); return { seg, x: seg.x1 + (seg.x2 - seg.x1) * t, y: seg.y1 + (seg.y2 - seg.y1) * t }; }
      acc += seg.len;
    }
    const seg = segs[segs.length - 1];
    return { seg, x: seg.x2, y: seg.y2 };
  }

  function tillStrip(seg, ya, yb) {
    const y0 = Math.max(0, Math.min(ya, yb) - s), y1 = Math.min(H, Math.max(ya, yb) + s), x0 = seg.x1 - laneW / 2;
    if (y1 <= y0) return;
    fctx.drawImage(soil, x0, y0, laneW, y1 - y0, x0, y0, laneW, y1 - y0);
    fctx.fillStyle = "rgba(18,26,10,.28)";
    fctx.fillRect(x0 - 2.5 * s, y0, 2.5 * s, y1 - y0); fctx.fillRect(x0 + laneW, y0, 2.5 * s, y1 - y0);
  }

  function till(prev, now) {
    const off = laneW * 0.8, a = pointAt(Math.max(0, prev - off)), b = pointAt(Math.max(0, now - off));
    if (b.seg.till) tillStrip(b.seg, a.seg === b.seg ? a.y : b.seg.y1, b.y);
    if (a.seg.till && a.seg !== b.seg) tillStrip(a.seg, a.y, a.seg.y2);
    const p0 = pointAt(prev), p1 = pointAt(now);
    if (!p1.seg.till) {
      const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x), nx = -Math.sin(ang) * 9.5 * u, ny = Math.cos(ang) * 9.5 * u;
      fctx.strokeStyle = "rgba(24,34,14,.10)"; fctx.lineWidth = 4 * u; fctx.lineCap = "round";
      for (const sgn of [1, -1]) { fctx.beginPath(); fctx.moveTo(p0.x + sgn * nx, p0.y + sgn * ny); fctx.lineTo(p1.x + sgn * nx, p1.y + sgn * ny); fctx.stroke(); }
    }
    if (b.seg.till && !REDUCED && dust.length < 50 && Math.random() < 0.5) {
      dust.push({ x: b.x + (Math.random() - 0.5) * laneW, y: b.y, vx: (Math.random() - 0.5) * 10 * s, vy: (Math.random() - 0.5) * 10 * s, life: 1 });
    }
  }

  /* ---------- survey drone ---------- */
  function resetActors() {
    const x0 = Math.max(left, W * 0.36), x1 = roadX - 30 * s, rows = 4, pts = [];
    for (let r = 0; r < rows; r++) {
      const y = top + ((bottom - top) * (r + 0.5)) / rows;
      if (r % 2 === 0) pts.push([x0, y], [x1, y]); else pts.push([x1, y], [x0, y]);
    }
    survey = { pts, i: 0, x: pts[0][0], y: pts[0][1], ang: 0, dir: 1 };
  }

  function updateActors(dt) {
    const tp = survey.pts[survey.i], dx = tp[0] - survey.x, dy = tp[1] - survey.y;
    const d = Math.hypot(dx, dy), step = 55 * s * dt;
    if (d > 0.5) {
      const want = Math.atan2(dy, dx);
      survey.ang += Math.atan2(Math.sin(want - survey.ang), Math.cos(want - survey.ang)) * Math.min(1, dt * 3);
    }
    if (d <= step) {
      survey.x = tp[0]; survey.y = tp[1];
      if (survey.i + survey.dir >= survey.pts.length || survey.i + survey.dir < 0) survey.dir *= -1;
      survey.i += survey.dir;
    } else { survey.x += (dx / d) * step; survey.y += (dy / d) * step; }
  }

  function drawDrone(d) {
    const k = u * 0.95, sx = d.x + 18 * u, sy = d.y + 24 * u;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(d.ang);      // sensor footprint on the ground
    ctx.fillStyle = "rgba(238,111,130,.10)"; ctx.strokeStyle = "rgba(238,111,130,.55)"; ctx.lineWidth = s; ctx.setLineDash([4 * s, 3 * s]);
    ctx.fillRect(-12 * u, -20 * u, 24 * u, 40 * u); ctx.strokeRect(-12 * u, -20 * u, 24 * u, 40 * u);
    ctx.setLineDash([]); ctx.restore();
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(d.ang); ctx.globalAlpha = 0.22;   // shadow
    ctx.fillStyle = "#000"; ctx.filter = `blur(${4 * u}px)`;
    for (const [px, py] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) { ctx.beginPath(); ctx.arc(px * k, py * k, 5 * k, 0, 7); ctx.fill(); }
    ctx.fillRect(-4 * k, -5 * k, 8 * k, 10 * k);
    ctx.restore();
    ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.ang);
    ctx.strokeStyle = "#26292c"; ctx.lineWidth = 2.4 * k; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-10 * k, -10 * k); ctx.lineTo(10 * k, 10 * k); ctx.moveTo(-10 * k, 10 * k); ctx.lineTo(10 * k, -10 * k); ctx.stroke();
    for (const [px, py] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) {
      ctx.fillStyle = "rgba(215,222,226,.28)";
      ctx.beginPath(); ctx.arc(px * k, py * k, 5.5 * k, 0, 7); ctx.fill();
      const a = clock * 40 + px;
      ctx.strokeStyle = "rgba(240,244,246,.55)"; ctx.lineWidth = 1.1 * k;
      ctx.beginPath(); ctx.moveTo(px * k + Math.cos(a) * 5 * k, py * k + Math.sin(a) * 5 * k); ctx.lineTo(px * k - Math.cos(a) * 5 * k, py * k - Math.sin(a) * 5 * k); ctx.stroke();
      ctx.fillStyle = "#101214"; ctx.beginPath(); ctx.arc(px * k, py * k, 1.5 * k, 0, 7); ctx.fill();
    }
    ctx.fillStyle = "#1d2023"; ctx.fillRect(-5 * k, -4 * k, 10 * k, 8 * k);
    ctx.fillStyle = "#454b51"; ctx.fillRect(-3.5 * k, -2.6 * k, 7 * k, 5.2 * k);
    ctx.fillStyle = "#e8702a"; ctx.fillRect(4 * k, -2 * k, 1.4 * k, 4 * k);
    ctx.fillStyle = Math.sin(clock * 6) > 0 ? "#6cff8a" : "#1f5a2a"; ctx.beginPath(); ctx.arc(5.5 * k, -4 * k, 0.9 * k, 0, 7); ctx.fill();
    ctx.fillStyle = Math.sin(clock * 6) > 0 ? "#ff5a5a" : "#5a1f1f"; ctx.beginPath(); ctx.arc(5.5 * k, 4 * k, 0.9 * k, 0, 7); ctx.fill();
    ctx.restore();
  }

  // Person at a laptop on the track, seen from above and facing the top of the screen.
  function drawPerson() {
    const k = u * 2.15;
    ctx.save(); ctx.translate(person.x, person.y); ctx.rotate(-Math.PI / 2);
    ctx.save(); ctx.translate(4 * k, 4 * k); ctx.globalAlpha = 0.35; ctx.filter = `blur(${2 * k}px)`; ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(0, 0, 11 * k, 9 * k, 0, 0, 7); ctx.fill(); ctx.restore();
    ctx.fillStyle = "#15171a"; ctx.fillRect(-11 * k, 10 * k, 9 * k, 6 * k);           // equipment case
    ctx.fillStyle = "#3a3f44"; ctx.fillRect(-10 * k, 11 * k, 7 * k, 1 * k);
    ctx.fillStyle = "#2d3238";                                                         // legs behind the body
    ctx.beginPath(); ctx.ellipse(-7 * k, -3.4 * k, 4.5 * k, 2.6 * k, 0, 0, 7); ctx.ellipse(-7 * k, 3.4 * k, 4.5 * k, 2.6 * k, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = "#2c4a6e"; ctx.lineWidth = 3.6 * k; ctx.lineCap = "round";        // arms to the laptop
    ctx.beginPath(); ctx.moveTo(-1 * k, -7.5 * k); ctx.lineTo(7 * k, -4.5 * k); ctx.moveTo(-1 * k, 7.5 * k); ctx.lineTo(7 * k, 4.5 * k); ctx.stroke();
    ctx.fillStyle = "#2c4a6e";                                                         // torso
    ctx.beginPath(); ctx.ellipse(-2 * k, 0, 6 * k, 9.5 * k, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.45)"; ctx.lineWidth = 1 * k; ctx.stroke();
    ctx.fillStyle = "#44699a"; ctx.beginPath(); ctx.ellipse(-3.8 * k, 0, 2.8 * k, 7.6 * k, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(150,205,255,.2)"; ctx.beginPath(); ctx.ellipse(12 * k, 0, 9 * k, 8 * k, 0, 0, 7); ctx.fill(); // screen glow
    ctx.fillStyle = "#2b2f33"; ctx.fillRect(7 * k, -5.5 * k, 8 * k, 11 * k);           // laptop
    ctx.fillStyle = "#4a5056"; ctx.fillRect(8 * k, -4.5 * k, 6 * k, 9 * k);
    ctx.fillStyle = "#9fd3ff"; ctx.fillRect(15 * k, -5.5 * k, 1.8 * k, 11 * k);
    ctx.fillStyle = "#b98a66"; ctx.beginPath(); ctx.arc(7.5 * k, -4.2 * k, 1.6 * k, 0, 7); ctx.arc(7.5 * k, 4.2 * k, 1.6 * k, 0, 7); ctx.fill(); // hands
    ctx.fillStyle = "#1e1b18"; ctx.beginPath(); ctx.arc(0.6 * k, 0, 5 * k, 0, 7); ctx.fill();  // head
    ctx.fillStyle = "#e9e4d6"; ctx.beginPath(); ctx.arc(1.2 * k, 0, 4.2 * k, 0, 7); ctx.fill(); // cap crown
    ctx.fillStyle = "#3d5a3a"; ctx.beginPath(); ctx.ellipse(5 * k, 0, 2.8 * k, 4 * k, 0, -Math.PI / 2, Math.PI / 2); ctx.fill(); // brim
    ctx.restore();
  }

  function drawTractor(x, y, ang) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    const rect = (x0, y0, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x0 * u, y0 * u, w * u, h * u); };
    ctx.save(); ctx.translate(4 * u, 4 * u); ctx.globalAlpha = 0.3; ctx.filter = `blur(${2 * u}px)`;
    rect(-30, -17, 6, 34, "#000"); rect(-13, -13, 31, 26, "#000"); ctx.restore();
    rect(-30, -17, 6, 34, "#3a3d3b");
    for (let k = -14; k <= 14; k += 4.7) { ctx.fillStyle = "#a7ada8"; ctx.beginPath(); ctx.ellipse(-27 * u, k * u, 1.2 * u, 2 * u, 0, 0, 7); ctx.fill(); }
    rect(-24, -1, 11, 2, "#2a2d2b");
    rect(-13, -13, 12, 6, "#141414"); rect(-13, 7, 12, 6, "#141414");
    for (let k = -12; k < -1; k += 2.2) { rect(k, -13, 0.8, 6, "#2c2c2c"); rect(k, 7, 0.8, 6, "#2c2c2c"); }
    rect(9, -10, 7, 3.5, "#141414"); rect(9, 6.5, 7, 3.5, "#141414");
    rect(-9, -6, 27, 12, "#b8352a"); rect(-9, -6, 27, 2.2, "#d4553f"); rect(5, -1.2, 13, 2.4, "#e0765f"); rect(17, -5, 1.5, 10, "#262626");
    rect(-11, -7.5, 12, 15, "#202422"); rect(-9.8, -6.3, 9.6, 12.6, "#e9e5d8"); rect(-9.8, -6.3, 9.6, 2.4, "#ffffff");
    ctx.fillStyle = "#151515"; ctx.beginPath(); ctx.arc(8 * u, -3.8 * u, 1.1 * u, 0, 7); ctx.fill();
    ctx.restore();
  }

  function draw() {
    ctx.drawImage(field, 0, 0);
    drawPerson();
    for (const p of dust) {
      ctx.fillStyle = `rgba(150,118,82,${p.life * 0.22})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, (4 + (1 - p.life) * 12) * s, 0, 7); ctx.fill();
    }
    const p = pointAt(dist), target = Math.atan2(p.seg.y2 - p.seg.y1, p.seg.x2 - p.seg.x1);
    heading += Math.atan2(Math.sin(target - heading), Math.cos(target - heading)) * 0.2;
    drawTractor(p.x, p.y, heading);
    drawDrone(survey);
  }

  function reset() {
    fctx.drawImage(grass, 0, 0);
    let prevStart = null, start;
    try { prevStart = sessionStorage.getItem("till-start"); } catch (e) { /* storage blocked */ }
    const first = cssW > 900 ? Math.floor(lanes * 0.4) : 0;
    do { start = first + Math.floor(Math.random() * (lanes - first)); } while (lanes - first > 1 && String(start) === prevStart);
    try { sessionStorage.setItem("till-start", String(start)); } catch (e) { /* storage blocked */ }
    buildPath(start);
    resetActors();
    dist = 0; pause = 0; dust = []; heading = Math.PI / 2;
    if (REDUCED) {
      const goal = total * 0.2;
      for (let d = 0; d < goal; d += 4 * s) { till(d, d + 4 * s); dist = d + 4 * s; }
      const q = pointAt(dist); heading = Math.atan2(q.seg.y2 - q.seg.y1, q.seg.x2 - q.seg.x1);
      draw();
    }
  }

  function frame(t) {
    const dt = Math.min(0.05, last ? (t - last) / 1000 : 0);
    last = t; clock += dt;
    if (pause > 0) { pause -= dt; if (pause <= 0) reset(); }
    else {
      const prev = dist;
      dist = Math.min(total, dist + SPEED * s * dt);
      till(prev, dist);
      if (dist >= total) pause = 3;
    }
    updateActors(dt);
    dust = dust.filter(p => (p.life -= dt * 0.7) > 0);
    dust.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; });
    draw();
    raf = requestAnimationFrame(frame);
  }
  const start = () => { if (!REDUCED && raf === null) { last = 0; raf = requestAnimationFrame(frame); } };
  const stop = () => { if (raf !== null) { cancelAnimationFrame(raf); raf = null; } };

  let visible = false;
  new IntersectionObserver(([e]) => {
    if (e.intersectionRatio > 0.15) {
      if (!visible) { visible = true; if ((segs || setup()) && field) { reset(); start(); } }
    } else if (visible) { visible = false; stop(); }
  }, { threshold: [0, 0.15, 0.3] }).observe(canvas);

  let resizeTimer;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (segs && Math.abs(canvas.clientWidth - (cssW || 0)) < 40 && Math.abs(canvas.clientHeight * s - H) < 40 * s) return;
      stop();
      if (setup()) { reset(); if (visible) start(); }
    }, 250);
  }).observe(canvas);
})();
