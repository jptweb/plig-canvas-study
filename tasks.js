// Task definitions: two variants, each a list of stages with a checkpoint.
// A checkpoint gets the analyzed run (call log grouped into rects + path
// segments, plus the canvas pixels) and returns { pass, why, notes }.
// `why` is for the log and ?debug=1, never shown to participants by default.
// `solution` is the complete reference code after that stage (starter lines
// excluded). The page draws it into the stage's goal thumbnail and, at load,
// checks that it passes its own stage. Not shown to participants as text.

// ---------- shared helpers ----------

export function analyze(result) {
  const fillRects = [], strokeRects = [], segments = [];
  let cur = [];
  for (const c of result.calls) {
    switch (c.name) {
      case 'fillRect':
        fillRects.push({ x: c.args[0], y: c.args[1], w: c.args[2], h: c.args[3], fillStyle: c.fillStyle });
        break;
      case 'strokeRect':
        strokeRects.push({ x: c.args[0], y: c.args[1], w: c.args[2], h: c.args[3], strokeStyle: c.strokeStyle, lineWidth: c.lineWidth });
        break;
      case 'beginPath':
        cur = [];
        break;
      case 'moveTo': case 'lineTo': case 'arc': case 'arcTo': case 'rect': case 'closePath': case 'ellipse':
        cur.push(c);
        break;
      case 'fill':
        segments.push({ kind: 'fill', ops: cur.slice(), fillStyle: c.fillStyle });
        break;
      case 'stroke':
        segments.push({ kind: 'stroke', ops: cur.slice(), strokeStyle: c.strokeStyle, lineWidth: c.lineWidth });
        break;
    }
  }
  return { fillRects, strokeRects, segments, pixels: result.pixels, width: 400, height: 300 };
}

const px = (a, x, y) => {
  const i = (Math.round(y) * a.width + Math.round(x)) * 4;
  const d = a.pixels;
  return [d[i], d[i + 1], d[i + 2], d[i + 3]];
};
const painted = p => p[3] > 0;
const isWhite = p => p[0] >= 245 && p[1] >= 245 && p[2] >= 245;
const greenish = p => painted(p) && p[1] > p[0] + 20 && p[1] > p[2] + 20;
const near = (p, q, tol = 8) => Math.abs(p[0] - q[0]) <= tol && Math.abs(p[1] - q[1]) <= tol && Math.abs(p[2] - q[2]) <= tol && Math.abs(p[3] - q[3]) <= tol;
const distinct = (p, q) => !near(p, q, 30);
const pts = ops => ops.filter(o => o.name === 'moveTo' || o.name === 'lineTo').map(o => ({ x: o.args[0], y: o.args[1] }));
const arcs = ops => ops.filter(o => o.name === 'arc').map(o => ({
  cx: o.args[0], cy: o.args[1], r: o.args[2], start: o.args[3], end: o.args[4], ccw: !!o.args[5],
  sweep: Math.abs((o.args[4] ?? 0) - (o.args[3] ?? 0))
}));
const fullCircle = a => a.sweep >= Math.PI * 2 - 0.01;
const inside = (r, box) => r.x >= box.x - 1 && r.y >= box.y - 1 && r.x + r.w <= box.x + box.w + 1 && r.y + r.h <= box.y + box.h + 1;

// straight lines drawn with moveTo/lineTo, in order, per stroke segment
function lines(seg) {
  const out = []; let start = null;
  for (const o of seg.ops) {
    if (o.name === 'moveTo') start = { x: o.args[0], y: o.args[1] };
    else if (o.name === 'lineTo') {
      const end = { x: o.args[0], y: o.args[1] };
      if (start) out.push({ a: start, b: end, lineWidth: seg.lineWidth });
      start = end;
    }
  }
  return out;
}

const ok = (why = '', notes = []) => ({ pass: true, why, notes });
const no = (why, notes = []) => ({ pass: false, why, notes });

// ---------- Variant A: Scene ----------

const findGround = a => a.fillRects.find(r => r.x <= 2 && r.x + r.w >= 398 && Math.abs(r.y + r.h - 300) <= 2 && r.h >= 80 && r.h <= 120);
const findBody = a => a.fillRects.find(r => Math.abs(r.y + r.h - 200) <= 2 && r.w >= 100 && r.h >= 80 && r.w < 398);

const scene = {
  id: 'scene',
  name: 'Scene',
  intro: 'Build the scene one stage at a time. The list below checks your work every time you press Run. The small pictures show roughly what each stage should look like.',
  starter: `const canvas = document.getElementById("stage");   // 400 wide, 300 tall
const ctx = canvas.getContext("2d");

// Build the scene one stage at a time.
// The stage list next to the canvas checks your work every time you press Run.
`,
  stages: [
    {
      id: 'ground', title: 'Ground', section: 'sec-coords',
      text: 'Draw the ground: a green rectangle as wide as the canvas and 100 pixels tall, sitting on the bottom edge.',
      solution: `ctx.fillStyle = "seagreen";
ctx.fillRect(0, 200, 400, 100);
`,
      check(a) {
        const g = findGround(a);
        if (!g) {
          const top = a.fillRects.find(r => r.x <= 2 && r.x + r.w >= 398 && r.y <= 2 && r.h >= 80 && r.h <= 120);
          return no(top ? 'rectangle is at the top: y grows downward, so y + height must equal 300' : 'no full-width rectangle with its bottom edge at 300');
        }
        if (!greenish(px(a, 200, 290))) return no('rectangle found but it is not green at (200, 290)');
        return ok();
      }
    },
    {
      id: 'body', title: 'House body', section: 'sec-coords',
      text: 'Draw the house body: a rectangle at least 100 wide and 80 tall, in any color that is not green, standing on the ground. Standing on the ground means its bottom edge is at y = 200.',
      solution: `ctx.fillStyle = "seagreen";
ctx.fillRect(0, 200, 400, 100);
ctx.fillStyle = "peru";
ctx.fillRect(80, 100, 140, 100);
`,
      check(a) {
        const b = findBody(a);
        if (!b) {
          const floating = a.fillRects.find(r => r.w >= 100 && r.h >= 80 && r.w < 398 && Math.abs(r.y + r.h - 200) > 2);
          return no(floating ? `body found but its bottom edge is at ${floating.y + floating.h}, not 200` : 'no rectangle at least 100 x 80 with its bottom edge at 200');
        }
        // several probes, so a door or window drawn later inside the body does not fool the check
        const probes = [[b.x + b.w / 2, b.y + b.h / 2], [b.x + 5, b.y + 5], [b.x + b.w - 6, b.y + 5], [b.x + 5, b.y + b.h - 6], [b.x + b.w - 6, b.y + b.h - 6]].map(([x, y]) => px(a, x, y));
        if (probes.some(p => !painted(p))) return no('body area is not fully painted');
        if (probes.filter(greenish).length >= 3) return no('body is green: fillStyle carried over from the ground');
        return ok();
      }
    },
    {
      id: 'roof', title: 'Roof', section: 'sec-paths',
      text: "Add a triangle roof on top of the house body. Its two bottom corners sit on the body's top edge and its peak is above.",
      solution: `ctx.fillStyle = "seagreen";
ctx.fillRect(0, 200, 400, 100);
ctx.fillStyle = "peru";
ctx.fillRect(80, 100, 140, 100);
ctx.fillStyle = "firebrick";
ctx.beginPath();
ctx.moveTo(70, 100);
ctx.lineTo(230, 100);
ctx.lineTo(150, 40);
ctx.closePath();
ctx.fill();
`,
      check(a) {
        const b = findBody(a);
        if (!b) return no('needs the house body first');
        const top = b.y;
        const fills = a.segments.filter(s => s.kind === 'fill' && !s.ops.some(o => o.name === 'arc'));
        if (!fills.length) {
          const pathStarted = a.segments.length === 0 && a.fillRects.length >= 2;
          return no(pathStarted ? 'no triangle path yet (beginPath, moveTo, lineTo, lineTo, fill)' : 'triangle points found but no fill() after them');
        }
        for (const s of fills) {
          const p = pts(s.ops);
          if (p.length < 3) continue;
          const onTop = p.filter(q => Math.abs(q.y - top) <= 6).length;
          const above = p.some(q => q.y < top - 10);
          if (onTop >= 2 && above) return ok();
        }
        return no(`triangle found but its base is not on the body's top edge (y = ${top})`);
      }
    },
    {
      id: 'sun', title: 'Sun', section: 'sec-circles',
      text: 'Draw a sun: a full circle in the top right part of the canvas, radius at least 20, in a yellow or orange color.',
      solution: `ctx.fillStyle = "seagreen";
ctx.fillRect(0, 200, 400, 100);
ctx.fillStyle = "peru";
ctx.fillRect(80, 100, 140, 100);
ctx.fillStyle = "firebrick";
ctx.beginPath();
ctx.moveTo(70, 100);
ctx.lineTo(230, 100);
ctx.lineTo(150, 40);
ctx.closePath();
ctx.fill();
ctx.fillStyle = "gold";
ctx.beginPath();
ctx.arc(340, 60, 30, 0, Math.PI * 2);
ctx.fill();
`,
      check(a) {
        const fills = a.segments.filter(s => s.kind === 'fill');
        let found = null, glued = false;
        for (const s of fills) {
          const arc = arcs(s.ops).find(c => c.cx > 250 && c.cy < 120 && c.r >= 20 && fullCircle(c));
          if (!arc) continue;
          if (s.ops.some(o => o.name === 'lineTo')) { glued = true; continue; }
          found = arc; break;
        }
        if (glued && !found) return no('the sun is in the same path as the roof: no beginPath() before the arc');
        if (!found) {
          const partial = fills.flatMap(s => arcs(s.ops)).find(c => c.cx > 250 && c.cy < 120 && c.r >= 20);
          if (partial) return no(`arc found but it only sweeps ${partial.sweep.toFixed(2)} radians, not a full circle`);
          const strokedOnly = a.segments.some(s => s.kind === 'stroke' && arcs(s.ops).length);
          return no(strokedOnly ? 'arc is stroked but not filled' : 'no filled full circle in the top right (center x > 250, y < 120)');
        }
        if (!painted(px(a, found.cx, found.cy))) return no('sun area is not painted');
        const notes = found.sweep > 7 ? ['sun-angle-360'] : [];
        return ok('', notes);
      }
    },
    {
      id: 'stretch', title: 'Stretch: door and window', section: 'sec-rects', stretch: true,
      text: 'Add a door (a filled rectangle inside the body that reaches down to the ground) and a window (an outlined square inside the body with lineWidth 3 or more).',
      solution: `ctx.fillStyle = "seagreen";
ctx.fillRect(0, 200, 400, 100);
ctx.fillStyle = "peru";
ctx.fillRect(80, 100, 140, 100);
ctx.fillStyle = "firebrick";
ctx.beginPath();
ctx.moveTo(70, 100);
ctx.lineTo(230, 100);
ctx.lineTo(150, 40);
ctx.closePath();
ctx.fill();
ctx.fillStyle = "gold";
ctx.beginPath();
ctx.arc(340, 60, 30, 0, Math.PI * 2);
ctx.fill();
ctx.fillStyle = "saddlebrown";
ctx.fillRect(130, 140, 40, 60);
ctx.strokeStyle = "black";
ctx.lineWidth = 3;
ctx.strokeRect(90, 115, 30, 30);
`,
      check(a) {
        const b = findBody(a);
        if (!b) return no('needs the house body first');
        const door = a.fillRects.find(r => r !== b && inside(r, b) && r.w < b.w && Math.abs(r.y + r.h - 200) <= 2);
        const win = a.strokeRects.find(r => inside(r, b) && r.lineWidth >= 3);
        if (!door && !win) return no('no door or window yet');
        if (!door) return no('window found; door needs its bottom edge at 200');
        if (!win) return no('door found; window needs strokeRect inside the body with lineWidth 3 or more');
        return ok();
      }
    }
  ]
};

// ---------- Variant B: Target ----------

const findBackground = a => a.fillRects.find(r => r.x <= 0 && r.y <= 0 && r.x + r.w >= 400 && r.y + r.h >= 300);
const bgPixel = a => px(a, 10, 10);
const C = { x: 200, y: 150 };
// probe at radius r on the 45-degree diagonal (up and to the right), so the
// crosshair lines through the center never sit on a probe point
const probe = (a, r) => px(a, C.x + r * 0.7071, C.y - r * 0.7071);

const ring = {
  id: 'ring',
  name: 'Target',
  intro: 'Build the target one stage at a time. The list below checks your work every time you press Run. The small pictures show roughly what each stage should look like.',
  starter: `const canvas = document.getElementById("stage");   // 400 wide, 300 tall
const ctx = canvas.getContext("2d");

// Build the target one stage at a time.
// The stage list next to the canvas checks your work every time you press Run.
`,
  stages: [
    {
      id: 'background', title: 'Background', section: 'sec-coords',
      text: 'Fill the entire canvas with a light color, for example "lightblue".',
      solution: `ctx.fillStyle = "lightblue";
ctx.fillRect(0, 0, 400, 300);
`,
      check(a) {
        if (!findBackground(a)) return no('no fillRect covering the whole canvas (0, 0, 400, 300)');
        const p = bgPixel(a);
        if (!painted(p)) return no('background is not painted');
        if (isWhite(p)) return no('background is white; pick a light color that is not white');
        return ok();
      }
    },
    {
      id: 'disc', title: 'Disc', section: 'sec-circles',
      text: 'Draw a filled circle centered at (200, 150) with radius 100, in a strong color.',
      solution: `ctx.fillStyle = "lightblue";
ctx.fillRect(0, 0, 400, 300);
ctx.fillStyle = "crimson";
ctx.beginPath();
ctx.arc(200, 150, 100, 0, Math.PI * 2);
ctx.fill();
`,
      check(a) {
        const fills = a.segments.filter(s => s.kind === 'fill');
        const hit = fills.flatMap(s => arcs(s.ops)).find(c => Math.abs(c.cx - C.x) <= 3 && Math.abs(c.cy - C.y) <= 3 && c.r >= 95 && c.r <= 105 && fullCircle(c));
        if (!hit) {
          const anyArc = a.segments.flatMap(s => arcs(s.ops))[0];
          if (!anyArc) return no('no arc drawn yet');
          if (!fullCircle(anyArc)) return no(`arc sweeps ${anyArc.sweep.toFixed(2)} radians, not a full circle`);
          return no(`arc found at (${anyArc.cx}, ${anyArc.cy}) r=${anyArc.r}; needs center (200, 150) and radius 100, then fill()`);
        }
        const band = probe(a, 85);
        if (!painted(band) || near(band, bgPixel(a))) return no('disc is not painted, or it matches the background color');
        return ok();
      }
    },
    {
      id: 'ring', title: 'Ring', section: 'sec-rings',
      text: 'Turn the disc into a ring: the middle should show the background again, leaving a band 30 pixels wide (outer radius 100, inner radius 70).',
      solution: `ctx.fillStyle = "lightblue";
ctx.fillRect(0, 0, 400, 300);
ctx.fillStyle = "crimson";
ctx.beginPath();
ctx.arc(200, 150, 100, 0, Math.PI * 2, false);
ctx.arc(200, 150, 70, 0, Math.PI * 2, true);
ctx.fill();
`,
      check(a) {
        const bg = bgPixel(a);
        const gap = probe(a, 65);   // inside the hole, and still background after the bullseye stage
        const band = probe(a, 85);
        if (!painted(band) || near(band, bg)) return no('needs the disc first');
        if (!near(gap, bg)) {
          const fills = a.segments.filter(s => s.kind === 'fill');
          const twoArcs = fills.find(s => arcs(s.ops).length >= 2);
          if (twoArcs && !arcs(twoArcs.ops).some(c => c.ccw)) return no('two arcs in one path but both run the same direction: the inner arc needs true as its last argument');
          const innerAlone = fills.find(s => arcs(s.ops).length === 1 && arcs(s.ops)[0].r < 95 && arcs(s.ops)[0].ccw);
          if (innerAlone) return no('inner arc is in its own path; put it in the same path as the outer circle');
          return no('the middle is still solid');
        }
        const notes = [];
        const fills = a.segments.filter(s => s.kind === 'fill');
        const winding = fills.some(s => { const c = arcs(s.ops); return c.length >= 2 && c.some(x => x.ccw) && c.some(x => !x.ccw); });
        const bgFill = findBackground(a);
        const cover = fills.some(s => { const c = arcs(s.ops); return c.length === 1 && c[0].r < 95 && bgFill && s.fillStyle === bgFill.fillStyle; });
        notes.push(winding ? 'ring-technique:winding' : cover ? 'ring-technique:cover' : 'ring-technique:other');
        return ok('', notes);
      }
    },
    {
      id: 'bullseye', title: 'Bullseye', section: 'sec-state',
      text: 'Add a second ring inside the first, from radius 40 to 60, in a different color. Then a solid dot of radius 20 in a third color. The background should show between the rings.',
      solution: `ctx.fillStyle = "lightblue";
ctx.fillRect(0, 0, 400, 300);
ctx.fillStyle = "crimson";
ctx.beginPath();
ctx.arc(200, 150, 100, 0, Math.PI * 2, false);
ctx.arc(200, 150, 70, 0, Math.PI * 2, true);
ctx.fill();
ctx.fillStyle = "navy";
ctx.beginPath();
ctx.arc(200, 150, 60, 0, Math.PI * 2, false);
ctx.arc(200, 150, 40, 0, Math.PI * 2, true);
ctx.fill();
ctx.fillStyle = "gold";
ctx.beginPath();
ctx.arc(200, 150, 20, 0, Math.PI * 2);
ctx.fill();
`,
      check(a) {
        const bg = bgPixel(a);
        const p85 = probe(a, 85), p65 = probe(a, 65), p50 = probe(a, 50), p30 = probe(a, 30), p0 = probe(a, 8);
        if (!painted(p85) || near(p85, bg)) return no('needs the outer ring first');
        if (!near(p65, bg)) return no('the gap between the outer ring and the second ring (radius 60 to 70) is not showing the background');
        if (!painted(p50) || near(p50, bg)) return no('no second ring painted at radius 50');
        if (!near(p30, bg)) return no('the gap between the second ring and the dot (radius 20 to 40) is not showing the background');
        if (!painted(p0) || near(p0, bg)) return no('no dot painted in the middle');
        if (!distinct(p85, p50)) return no('outer ring and second ring are the same color: fillStyle carried over, or the second ring repainted the first (missing beginPath)');
        if (!distinct(p50, p0) || !distinct(p85, p0)) return no('the dot needs a third color');
        return ok();
      }
    },
    {
      id: 'stretch', title: 'Stretch: crosshair', section: 'sec-paths', stretch: true,
      text: 'Draw a crosshair: two straight lines through the center, edge to edge, in a dark color, lineWidth 3.',
      solution: `ctx.fillStyle = "lightblue";
ctx.fillRect(0, 0, 400, 300);
ctx.fillStyle = "crimson";
ctx.beginPath();
ctx.arc(200, 150, 100, 0, Math.PI * 2, false);
ctx.arc(200, 150, 70, 0, Math.PI * 2, true);
ctx.fill();
ctx.fillStyle = "navy";
ctx.beginPath();
ctx.arc(200, 150, 60, 0, Math.PI * 2, false);
ctx.arc(200, 150, 40, 0, Math.PI * 2, true);
ctx.fill();
ctx.fillStyle = "gold";
ctx.beginPath();
ctx.arc(200, 150, 20, 0, Math.PI * 2);
ctx.fill();
ctx.strokeStyle = "black";
ctx.lineWidth = 3;
ctx.beginPath();
ctx.moveTo(0, 150);
ctx.lineTo(400, 150);
ctx.moveTo(200, 0);
ctx.lineTo(200, 300);
ctx.stroke();
`,
      check(a) {
        const strokes = a.segments.filter(s => s.kind === 'stroke');
        const all = strokes.flatMap(lines);
        if (!all.length) return no('no stroked line yet (moveTo, lineTo, stroke)');
        const horiz = all.find(l => Math.abs(l.a.y - C.y) <= 3 && Math.abs(l.b.y - C.y) <= 3 && Math.min(l.a.x, l.b.x) <= 5 && Math.max(l.a.x, l.b.x) >= 395);
        const vert = all.find(l => Math.abs(l.a.x - C.x) <= 3 && Math.abs(l.b.x - C.x) <= 3 && Math.min(l.a.y, l.b.y) <= 5 && Math.max(l.a.y, l.b.y) >= 295);
        if (!horiz || !vert) return no(`${horiz ? 'horizontal' : 'vertical'} line found; the other one needs to run edge to edge through (200, 150)`);
        if (horiz.lineWidth < 2 || vert.lineWidth < 2) return no('lines found but lineWidth is under 2');
        return ok();
      }
    }
  ]
};

export const TASKS = { scene, ring };
