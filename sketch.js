/* Tornaly Çizim – kısıtlı (parametrik) 2B çizim modülü.
   Çizgi, dikdörtgen, daire, yay; yatay/dikey/paralel/dik/eşit/teğet/eş merkez/nokta-üstünde kısıtları;
   uzunluk, çap, yarıçap, mesafe ölçüleri. Levenberg–Marquardt çözücü. Tamamen telefonda çalışır.
   Dışa: window.TornalySketch.create(kök, { onChange, toast }) */
(function () {
  'use strict';
  const TAU = Math.PI * 2, REF = 100, EPS = 1e-9;
  const hyp = Math.hypot;

  /* ================= Model ================= */
  function newModel() { return { pts: { o: { x: 0, y: 0, fixed: true } }, ents: {}, cons: [], n: 1, pockets: {} }; }
  const uid = M => 'i' + (M.n++);
  const rad = (M, e) => e.t === 'circle' ? e.r : hyp(M.pts[e.a].x - M.pts[e.c].x, M.pts[e.a].y - M.pts[e.c].y);
  const isCirc = e => e && (e.t === 'circle' || e.t === 'arc');
  const lenOf = (M, e) => hyp(M.pts[e.b].x - M.pts[e.a].x, M.pts[e.b].y - M.pts[e.a].y);
  function arcAngles(M, e) {
    const c = M.pts[e.c], a = M.pts[e.a], b = M.pts[e.b];
    const t0 = Math.atan2(a.y - c.y, a.x - c.x), t1 = Math.atan2(b.y - c.y, b.x - c.x);
    let sw = ((t1 - t0) % TAU + TAU) % TAU; if (sw < 1e-9) sw = TAU;
    return { t0, sw, r: hyp(a.x - c.x, a.y - c.y) };
  }

  /* ================= Çözücü ================= */
  function residuals(M, drag) {
    const P = M.pts, E = M.ents, out = [];
    for (const id in E) { const e = E[id]; if (e.t === 'arc') { const c = P[e.c], a = P[e.a], b = P[e.b]; out.push(hyp(a.x - c.x, a.y - c.y) - hyp(b.x - c.x, b.y - c.y)); } }
    for (const k of M.cons) {
      const e1 = E[k.e1 || k.e], e2 = E[k.e2];
      switch (k.t) {
        case 'h': out.push(P[e1.a].y - P[e1.b].y); break;
        case 'v': out.push(P[e1.a].x - P[e1.b].x); break;
        case 'hp': out.push(P[k.p].y - P[k.q].y); break;
        case 'vp': out.push(P[k.p].x - P[k.q].x); break;
        case 'par': case 'perp': {
          const ux = P[e1.b].x - P[e1.a].x, uy = P[e1.b].y - P[e1.a].y, vx = P[e2.b].x - P[e2.a].x, vy = P[e2.b].y - P[e2.a].y;
          const d = (hyp(ux, uy) * hyp(vx, vy)) + EPS;
          out.push((k.t === 'par' ? (ux * vy - uy * vx) : (ux * vx + uy * vy)) / d * REF); break;
        }
        case 'eq': out.push(e1.t === 'line' ? lenOf(M, e1) - lenOf(M, e2) : rad(M, e1) - rad(M, e2)); break;
        case 'len': out.push(lenOf(M, e1) - k.v); break;
        case 'rad': out.push(rad(M, e1) - k.v); break;
        case 'dist': out.push(hyp(P[k.q].x - P[k.p].x, P[k.q].y - P[k.p].y) - k.v); break;
        case 'hd': out.push(Math.abs(P[k.q].x - P[k.p].x) - k.v); break;
        case 'vd': out.push(Math.abs(P[k.q].y - P[k.p].y) - k.v); break;
        case 'conc': { const c1 = P[e1.c], c2 = P[e2.c]; out.push(c1.x - c2.x, c1.y - c2.y); break; }
        case 'tan': {
          if (e1.t === 'line') {
            const a = P[e1.a], b = P[e1.b], c = P[e2.c], L = hyp(b.x - a.x, b.y - a.y) + EPS;
            out.push(Math.abs((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / L - rad(M, e2));
          } else {
            const c1 = P[e1.c], c2 = P[e2.c], d = hyp(c2.x - c1.x, c2.y - c1.y), r1 = rad(M, e1), r2 = rad(M, e2);
            out.push(k.mode === 'in' ? d - Math.abs(r1 - r2) : d - (r1 + r2));
          }
          break;
        }
        case 'onl': { const a = P[e1.a], b = P[e1.b], p = P[k.p], L = hyp(b.x - a.x, b.y - a.y) + EPS; out.push(((p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x)) / L); break; }
        case 'onc': { const c = P[e1.c], p = P[k.p]; out.push(hyp(p.x - c.x, p.y - c.y) - rad(M, e1)); break; }
        case 'fix': out.push(P[k.p].x - k.x, P[k.p].y - k.y); break;
      }
    }
    if (drag) { const p = P[drag.p]; out.push(drag.w * (p.x - drag.x), drag.w * (p.y - drag.y)); }
    return out;
  }
  function variables(M) {
    const v = [];
    for (const id in M.pts) { const p = M.pts[id]; if (!p.fixed) v.push([p, 'x'], [p, 'y']); }
    for (const id in M.ents) { const e = M.ents[id]; if (e.t === 'circle') v.push([e, 'r']); }
    return v;
  }
  function jacobian(M, V, F, drag) {
    const h = 1e-6, J = [];
    for (let j = 0; j < V.length; j++) {
      const [o, k] = V[j], s = o[k];
      o[k] = s + h; const Fj = residuals(M, drag); o[k] = s;
      J.push(Fj.map((f, i) => (f - F[i]) / h));
    }
    return J; // sütun dizisi: J[j][i]
  }
  function linSolve(A, b) {
    const n = b.length;
    for (let c = 0; c < n; c++) {
      let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
      if (Math.abs(A[piv][c]) < 1e-30) return null;
      [A[c], A[piv]] = [A[piv], A[c]]; [b[c], b[piv]] = [b[piv], b[c]];
      for (let r = c + 1; r < n; r++) { const f = A[r][c] / A[c][c]; if (!f) continue; for (let k = c; k < n; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; }
    }
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) { let s = b[r]; for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k]; x[r] = s / A[r][r]; }
    return x;
  }
  function rankOf(J, m) {
    const n = J.length; if (!n || !m) return 0;
    const A = []; for (let i = 0; i < m; i++) { const row = new Array(n); for (let j = 0; j < n; j++) row[j] = J[j][i]; A.push(row); }
    let mx = 0; A.forEach(r => r.forEach(v => { if (Math.abs(v) > mx) mx = Math.abs(v); }));
    const tol = Math.max(1e-9, mx * 1e-7); let rank = 0;
    for (let c = 0; c < n && rank < m; c++) {
      let piv = rank; for (let r = rank + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
      if (Math.abs(A[piv][c]) <= tol) continue;
      [A[rank], A[piv]] = [A[piv], A[rank]];
      for (let r = rank + 1; r < m; r++) { const f = A[r][c] / A[rank][c]; if (f) for (let k = c; k < n; k++) A[r][k] -= f * A[rank][k]; }
      rank++;
    }
    return rank;
  }
  function solve(M, drag, iters = 150) {
    const V = variables(M), n = V.length;
    if (!n) { const F = residuals(M); const mr = F.reduce((s, f) => Math.max(s, Math.abs(f)), 0); return { ok: mr < 1e-6, dof: 0, maxres: mr }; }
    const get = () => V.map(([o, k]) => o[k]), set = x => V.forEach(([o, k], i) => { o[k] = x[i]; });
    let x = get(), F = residuals(M, drag), cost = F.reduce((s, f) => s + f * f, 0), mu = 1e-3;
    for (let it = 0; it < iters; it++) {
      if (F.reduce((s, f) => Math.max(s, Math.abs(f)), 0) < 1e-10) break;
      const J = jacobian(M, V, F, drag), m = F.length;
      const A = [], g = new Array(n).fill(0);
      for (let i = 0; i < n; i++) { const row = new Array(n).fill(0); A.push(row); }
      for (let i = 0; i < n; i++) {
        const Ji = J[i];
        for (let k = 0; k < m; k++) g[i] += Ji[k] * F[k];
        for (let j = i; j < n; j++) { const Jj = J[j]; let s = 0; for (let k = 0; k < m; k++) s += Ji[k] * Jj[k]; A[i][j] = A[j][i] = s; }
      }
      let improved = false;
      while (mu < 1e12) {
        const Ad = A.map((r, i) => r.map((v, j) => i === j ? v + mu : v));
        const d = linSolve(Ad, g.map(v => -v));
        if (!d) { mu *= 10; continue; }
        const xn = x.map((v, i) => v + d[i]); set(xn);
        const Fn = residuals(M, drag), cn = Fn.reduce((s, f) => s + f * f, 0);
        if (cn < cost) { x = xn; F = Fn; const small = d.reduce((s, v) => Math.max(s, Math.abs(v)), 0) < 1e-12; cost = cn; mu = Math.max(mu / 3, 1e-12); improved = !small; break; }
        set(x); mu *= 4;
      }
      if (!improved) break;
    }
    set(x);
    const F0 = residuals(M), mr = F0.reduce((s, f) => Math.max(s, Math.abs(f)), 0);
    const r = rankOf(jacobian(M, V, F0), F0.length);
    return { ok: mr < 1e-5, dof: Math.max(0, n - r), maxres: mr };
  }

  /* ================= Profil (kapalı konturlar) ================= */
  function sArea(p) { let a = 0; for (let i = 0, n = p.length; i < n; i++) { const q = p[(i + 1) % n]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; }
  function inside(pt, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if (((a[1] > pt[1]) !== (b[1] > pt[1])) && (pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0])) c = !c;
    }
    return c;
  }
  function sampleArc(M, e, fromA) {
    const { t0, sw, r } = arcAngles(M, e), c = M.pts[e.c], n = Math.max(4, Math.ceil(sw / (3 * Math.PI / 180))), out = [];
    for (let i = 0; i <= n; i++) { const t = t0 + sw * i / n; out.push([c.x + r * Math.cos(t), c.y + r * Math.sin(t)]); }
    return fromA ? out : out.reverse();
  }
  function profile(M) {
    const E = M.ents, adj = {}, segs = [], loops = [];
    let open = 0, branch = 0;
    for (const id in E) {
      const e = E[id]; if (e.aux) continue;
      if (e.t === 'circle') {
        const c = M.pts[e.c], pts = []; for (let i = 0; i < 180; i++) { const t = TAU * i / 180; pts.push([c.x + e.r * Math.cos(t), c.y + e.r * Math.sin(t)]); }
        loops.push({ key: id, pts, ents: [id], label: 'Ø' + nf(2 * e.r) + ' daire' }); continue;
      }
      segs.push(id); (adj[e.a] = adj[e.a] || []).push(id); (adj[e.b] = adj[e.b] || []).push(id);
    }
    const used = new Set(), badPts = [];
    for (const p in adj) { if (adj[p].length === 1) { open++; badPts.push(p); } else if (adj[p].length > 2) { branch++; badPts.push(p); } }
    for (const s0 of segs) {
      if (used.has(s0)) continue;
      // bileşeni topla
      const comp = [], stack = [s0], seen = new Set([s0]);
      while (stack.length) { const s = stack.pop(); comp.push(s); for (const p of [E[s].a, E[s].b]) for (const t of adj[p]) if (!seen.has(t)) { seen.add(t); stack.push(t); } }
      comp.forEach(s => used.add(s));
      if (comp.some(s => adj[E[s].a].length !== 2 || adj[E[s].b].length !== 2)) continue;
      // döngüyü sırayla gez
      const pts = []; let cur = s0, at = E[s0].a; const ents = [];
      for (let guard = 0; guard < comp.length + 1; guard++) {
        const e = E[cur], fwd = e.a === at; ents.push(cur);
        const seg = e.t === 'line' ? [[M.pts[at].x, M.pts[at].y]] : sampleArc(M, e, fwd).slice(0, -1);
        pts.push(...seg);
        at = fwd ? e.b : e.a;
        const nx = adj[at].find(t => t !== cur);
        if (nx === s0 || nx === undefined) break;
        cur = nx;
      }
      if (pts.length > 2) loops.push({ key: ents.slice().sort().join('+'), pts, ents });
    }
    loops.forEach(l => { l.area = Math.abs(sArea(l.pts)); if (!l.label) { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; l.pts.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }); l.label = nf(x1 - x0) + '×' + nf(y1 - y0); } });
    const valid = loops.filter(l => l.area > 1e-6).sort((a, b) => b.area - a.area);
    if (!valid.length) return { outer: null, inner: [], open, branch, outside: 0, badPts };
    const outer = valid[0], inner = []; let outside = 0;
    for (const l of valid.slice(1)) {
      if (!inside(l.pts[0], outer.pts)) { outside++; continue; }
      if (inner.some(h => inside(l.pts[0], h.pts))) continue;
      const pk = M.pockets[l.key];
      inner.push({ key: l.key, pts: l.pts, ents: l.ents, label: l.label, area: l.area, kind: pk ? 'pocket' : 'hole', depth: pk ? pk.depth : 0 });
    }
    return { outer: outer.pts, outerEnts: outer.ents, inner, open, branch, outside, badPts };
  }

  /* ================= Dışa aktarım ================= */
  function toDXF(M) {
    const pr = profile(M), layerOf = {};
    pr.inner.forEach(i => i.ents.forEach(id => { if (i.kind === 'pocket') layerOf[id] = 'CEP_' + nf(i.depth).replace(',', '.') + 'mm'; }));
    let s = '0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n';
    const P = M.pts, f = v => (+v.toFixed(6)).toString();
    for (const id in M.ents) {
      const e = M.ents[id], ly = e.aux ? 'YARDIMCI' : (layerOf[id] || 'KONTUR');
      if (e.t === 'line') s += `0\nLINE\n8\n${ly}\n10\n${f(P[e.a].x)}\n20\n${f(P[e.a].y)}\n11\n${f(P[e.b].x)}\n21\n${f(P[e.b].y)}\n`;
      else if (e.t === 'circle') s += `0\nCIRCLE\n8\n${ly}\n10\n${f(P[e.c].x)}\n20\n${f(P[e.c].y)}\n40\n${f(e.r)}\n`;
      else { const { t0, sw, r } = arcAngles(M, e); s += `0\nARC\n8\n${ly}\n10\n${f(P[e.c].x)}\n20\n${f(P[e.c].y)}\n40\n${f(r)}\n50\n${f(t0 * 180 / Math.PI)}\n51\n${f((t0 + sw) * 180 / Math.PI)}\n`; }
    }
    return s + '0\nENDSEC\n0\nEOF\n';
  }
  function toSVG(M) {
    const P = M.pts; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const grow = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
    for (const id in M.ents) { const e = M.ents[id]; if (e.t === 'line') { grow(P[e.a].x, P[e.a].y); grow(P[e.b].x, P[e.b].y); } else { const r = rad(M, e), c = P[e.c]; grow(c.x - r, c.y - r); grow(c.x + r, c.y + r); } }
    if (!isFinite(x0)) { x0 = y0 = 0; x1 = y1 = 10; }
    const m = 5, W = x1 - x0 + 2 * m, H = y1 - y0 + 2 * m, f = v => (+v.toFixed(4));
    const X = x => f(x - x0 + m), Y = y => f(y1 - y + m);
    let body = '';
    for (const id in M.ents) {
      const e = M.ents[id], st = e.aux ? ' stroke-dasharray="2 1.5" stroke="#888"' : ' stroke="#000"';
      if (e.t === 'line') body += `<line x1="${X(P[e.a].x)}" y1="${Y(P[e.a].y)}" x2="${X(P[e.b].x)}" y2="${Y(P[e.b].y)}"${st}/>`;
      else if (e.t === 'circle') body += `<circle cx="${X(P[e.c].x)}" cy="${Y(P[e.c].y)}" r="${f(e.r)}"${st}/>`;
      else { const { sw, r } = arcAngles(M, e); body += `<path d="M${X(P[e.a].x)} ${Y(P[e.a].y)} A${f(r)} ${f(r)} 0 ${sw > Math.PI ? 1 : 0} 0 ${X(P[e.b].x)} ${Y(P[e.b].y)}"${st}/>`; }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(W)}mm" height="${f(H)}mm" viewBox="0 0 ${f(W)} ${f(H)}"><g fill="none" stroke-width="0.35">${body}</g></svg>`;
  }

  /* ================= Yardımcılar ================= */
  function nf(v, d = 2) { const s = (Math.round(v * 10 ** d) / 10 ** d).toLocaleString('tr-TR', { maximumFractionDigits: d }); return s === '-0' ? '0' : s; }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const parseNum = s => { const v = parseFloat(String(s).replace(',', '.')); return isFinite(v) ? v : NaN; };
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    const t = L2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2)) : 0;
    return hyp(px - ax - t * dx, py - ay - t * dy);
  }

  const CSS = `
.sk{position:relative}
.sk-bar{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}
.sk-bar button{border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:var(--r-s,6px);padding:7px 10px;font:inherit;font-size:.92rem;cursor:pointer;min-height:38px}
.sk-bar button[aria-pressed="true"]{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.sk-bar button:disabled{opacity:.4}
.sk-cv{display:block;width:100%;height:min(62vh,520px);background:var(--surface);border:1px solid var(--line);border-radius:var(--r-s,6px);touch-action:none;user-select:none;-webkit-user-select:none}
.sk-st{font-size:.85rem;color:var(--muted);margin:6px 0 0;min-height:1.3em}
.sk-st b.ok{color:var(--steel)} .sk-st b.bad{color:var(--err,#A3262A)} .sk-st b.mid{color:var(--warn)}
.sk-cons{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 0}
.sk-cons:empty{display:none}
.sk-cons button{border:1px solid var(--steel);background:var(--paper);color:var(--ink);border-radius:999px;padding:6px 11px;font:inherit;font-size:.9rem;cursor:pointer}
.sk-cons button.del{border-color:var(--err,#A3262A);color:var(--err,#A3262A)}
.sk-inner{margin-top:10px}
.sk-inner:empty{display:none}
.sk-inner .row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:6px;align-items:center;padding:6px 0;border-top:1px solid var(--line)}
.sk-inner select,.sk-inner input{font:inherit;font-size:.9rem;border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:4px;padding:5px 6px}
.sk-inner input{width:76px;text-align:right}
.sk-sheet{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:flex-end;justify-content:center;z-index:60}
.sk-sheet>div{background:var(--paper);color:var(--ink);width:min(520px,100%);border-radius:12px 12px 0 0;padding:16px 16px 22px;box-shadow:0 -4px 20px rgba(0,0,0,.25)}
.sk-sheet h4{margin:0 0 10px;font-size:1.05rem}
.sk-sheet input{width:100%;box-sizing:border-box;font:inherit;font-size:1.3rem;padding:10px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--ink)}
.sk-sheet .acts{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.sk-sheet .acts button{flex:1;min-width:110px;padding:11px;border-radius:6px;border:1px solid var(--ink);background:var(--surface);color:var(--ink);font:inherit;font-weight:600}
.sk-sheet .acts button.main{background:var(--ink);color:var(--paper)}
`;

  /* ================= Arayüz ================= */
  function create(root, opts = {}) {
    if (!document.getElementById('sk-css')) { const st = document.createElement('style'); st.id = 'sk-css'; st.textContent = CSS; document.head.appendChild(st); }
    const KEY = 'tornaly.sketch';
    let M = newModel();
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.pts && s.ents) { M = Object.assign(newModel(), s); M.pts.o = { x: 0, y: 0, fixed: true }; } } catch {}
    const undo = [], redo = [];
    let tool = 'sel', sel = { pts: new Set(), ents: new Set(), cons: new Set() };
    let pend = [], preview = null, lastStat = { ok: true, dof: 0 }, chain0 = null;
    const view = { cx: 50, cy: 20, k: 3 };
    let W = 300, H = 300;

    root.classList.add('sk');
    root.innerHTML = `
      <div class="sk-bar" data-r="tools">
        <button data-t="sel">Seç</button><button data-t="line">Çizgi</button><button data-t="rect">Dikdörtgen</button>
        <button data-t="circle">Daire</button><button data-t="arc">Yay</button><button data-t="dim">Ölçü</button>
      </div>
      <svg class="sk-cv" aria-label="Çizim alanı"></svg>
      <p class="sk-st"></p>
      <div class="sk-cons"></div>
      <div class="sk-bar" style="margin-top:8px">
        <button data-a="undo">Geri al</button><button data-a="redo">Yinele</button><button data-a="fit">Sığdır</button>
        <button data-a="dxf">DXF indir</button><button data-a="svg">SVG indir</button><button data-a="clear">Temizle</button>
      </div>
      <div class="sk-inner"></div>`;
    const svg = root.querySelector('svg'), stEl = root.querySelector('.sk-st'), consEl = root.querySelector('.sk-cons'), innerEl = root.querySelector('.sk-inner');

    /* ---- yardımcı ---- */
    const toS = (x, y) => [W / 2 + (x - view.cx) * view.k, H / 2 - (y - view.cy) * view.k];
    const toW = (sx, sy) => [view.cx + (sx - W / 2) / view.k, view.cy - (sy - H / 2) / view.k];
    const gridStep = () => { const st = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000]; return st.find(s => s * view.k >= 22) || 2000; };
    const snapStep = () => { const g = gridStep(); return g >= 5 ? g / 5 : g / 2; };
    const toast = m => (opts.toast || (t => console.log(t)))(m);
    function snapshot() { undo.push(JSON.stringify(M)); if (undo.length > 60) undo.shift(); redo.length = 0; }
    function restore(s) { M = JSON.parse(s); sel = { pts: new Set(), ents: new Set(), cons: new Set() }; }
    let saveT = null, changeT = null;
    function changed(full = true) {
      clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(M)); } catch {} }, 300);
      if (full) { clearTimeout(changeT); changeT = setTimeout(() => opts.onChange && opts.onChange(), 250); }
      render();
    }
    function runSolve() { lastStat = solve(M); return lastStat; }
    function commit(fn, { check = true } = {}) {
      const before = JSON.stringify(M);
      snapshot();
      fn();
      if (check) {
        const r = runSolve();
        if (!r.ok) { M = JSON.parse(before); undo.pop(); runSolve(); toast('Bu kısıt diğerleriyle çelişiyor; eklenmedi.'); render(); return false; }
      }
      changed(); return true;
    }

    /* ---- nokta / öğe oluşturma ---- */
    function pointAt(w, snapPid) {
      if (snapPid) return snapPid;
      const id = uid(M); M.pts[id] = { x: w[0], y: w[1] }; return id;
    }
    function hitPoint(sx, sy, R = 18, exclude) {
      let best = null, bd = R;
      for (const id in M.pts) { if (id === exclude) continue; const p = M.pts[id], [x, y] = toS(p.x, p.y), d = hyp(x - sx, y - sy); if (d < bd) { bd = d; best = id; } }
      return best;
    }
    function hitEnt(sx, sy, R = 14) {
      let best = null, bd = R; const P = M.pts;
      for (const id in M.ents) {
        const e = M.ents[id]; let d;
        if (e.t === 'line') { const [ax, ay] = toS(P[e.a].x, P[e.a].y), [bx, by] = toS(P[e.b].x, P[e.b].y); d = segDist(sx, sy, ax, ay, bx, by); }
        else {
          const [cx, cy] = toS(P[e.c].x, P[e.c].y), r = rad(M, e) * view.k; d = Math.abs(hyp(sx - cx, sy - cy) - r);
          if (e.t === 'arc') { const { t0, sw } = arcAngles(M, e), t = Math.atan2(-(sy - cy), sx - cx), rel = ((t - t0) % TAU + TAU) % TAU; if (rel > sw) d = Infinity; }
        }
        if (d < bd) { bd = d; best = id; }
      }
      return best;
    }
    let labelBoxes = [];
    function hitLabel(sx, sy, dimsOnly) { for (const b of labelBoxes) if ((!dimsOnly || b.dim) && Math.abs(sx - b.x) < b.w / 2 + 4 && Math.abs(sy - b.y) < 12) return b.ci; return -1; }
    function snapWorld(sx, sy, from) {
      const pid = hitPoint(sx, sy);
      if (pid) return { pid, w: [M.pts[pid].x, M.pts[pid].y] };
      let [x, y] = toW(sx, sy); const s = snapStep();
      x = Math.round(x / s) * s; y = Math.round(y / s) * s;
      if (from) { // yataya/dikeye yapıştır
        const dx = x - from[0], dy = y - from[1];
        if (Math.abs(dy) < Math.abs(dx) * 0.07) y = from[1]; else if (Math.abs(dx) < Math.abs(dy) * 0.07) x = from[0];
      }
      return { pid: null, w: [x, y] };
    }
    function addLine(s, e) {
      const a = pointAt(s.w, s.pid), b = pointAt(e.w, e.pid);
      if (a === b) return null;
      const P = M.pts, id = uid(M); M.ents[id] = { t: 'line', a, b };
      const dx = P[b].x - P[a].x, dy = P[b].y - P[a].y;
      if (Math.abs(dy) < Math.abs(dx) * 0.07 && !(P[a].fixed && P[b].fixed)) M.cons.push({ t: 'h', e: id });
      else if (Math.abs(dx) < Math.abs(dy) * 0.07 && !(P[a].fixed && P[b].fixed)) M.cons.push({ t: 'v', e: id });
      return { id, b };
    }

    /* ---- sayı girme / seçenek penceresi ---- */
    function sheet(title, { value, choices } = {}) {
      return new Promise(res => {
        const d = document.createElement('div'); d.className = 'sk-sheet';
        d.innerHTML = `<div><h4>${esc(title)}</h4>${value !== undefined ? `<input inputmode="decimal" value="${esc(value)}">` : ''}
          <div class="acts">${choices ? choices.map((c, i) => `<button data-i="${i}">${esc(c)}</button>`).join('') : '<button data-x="no">Vazgeç</button><button class="main" data-x="ok">Tamam</button>'}</div></div>`;
        document.body.appendChild(d);
        const inp = d.querySelector('input'); if (inp) { setTimeout(() => { inp.focus(); inp.select(); }, 30); inp.onkeydown = ev => { if (ev.key === 'Enter') done(parseNum(inp.value)); }; }
        const t0 = Date.now(), done = v => { d.remove(); res(v); };
        d.onclick = ev => { if (ev.target === d && Date.now() - t0 > 450) done(null); };
        d.querySelectorAll('button').forEach(b => b.onclick = () => {
          if (Date.now() - t0 < 350) return; // açan dokunuşun arkasından gelen sahte tıklamayı yut
          if (b.dataset.i !== undefined) return done(+b.dataset.i);
          if (b.dataset.x === 'no') return done(null);
          const v = parseNum(inp.value); if (!(v > 0)) { inp.style.borderColor = 'var(--err)'; return; } done(v);
        });
      });
    }
    async function dimEntity(id) {
      const e = M.ents[id];
      if (e.t === 'line') { const v = await sheet('Çizgi uzunluğu (mm)', { value: nf(lenOf(M, e), 3) }); if (v > 0) setDim({ t: 'len', e: id }, v); }
      else if (e.t === 'circle') { const v = await sheet('Daire çapı (mm)', { value: nf(2 * e.r, 3) }); if (v > 0) setDim({ t: 'rad', e: id, dia: true }, v / 2); }
      else { const v = await sheet('Yay yarıçapı (mm)', { value: nf(rad(M, e), 3) }); if (v > 0) setDim({ t: 'rad', e: id }, v); }
    }
    async function dimPoints(p, q) {
      const P = M.pts, dx = Math.abs(P[q].x - P[p].x), dy = Math.abs(P[q].y - P[p].y);
      const c = await sheet('Hangi ölçü?', { choices: ['Yatay mesafe', 'Dikey mesafe', 'Doğrusal mesafe'] });
      if (c === null || c === undefined) return;
      const t = ['hd', 'vd', 'dist'][c], cur = [dx, dy, hyp(dx, dy)][c];
      const v = await sheet(['Yatay mesafe', 'Dikey mesafe', 'Mesafe'][c] + ' (mm)', { value: nf(cur, 3) });
      if (v > 0) setDim({ t, p, q }, v);
    }
    function setDim(base, v) {
      const same = k => k.t === base.t && (base.e ? k.e === base.e : ((k.p === base.p && k.q === base.q) || (k.p === base.q && k.q === base.p)));
      const ex = M.cons.findIndex(same);
      if (commit(() => { if (ex >= 0) M.cons[ex].v = v; else M.cons.push({ ...base, v }); })) clearSel();
    }
    async function editCons(ci) {
      const k = M.cons[ci]; if (!k || k.v === undefined) return;
      const shown = k.dia ? k.v * 2 : k.v;
      const v = await sheet((k.dia ? 'Çap' : k.t === 'rad' ? 'Yarıçap' : k.t === 'len' ? 'Uzunluk' : 'Mesafe') + ' (mm)', { value: nf(shown, 3) });
      if (v > 0) commit(() => { M.cons[ci].v = k.dia ? v / 2 : v; });
    }


    /* ---- sesli komut (metin önceden küçük harfe ve rakama çevrilmiş gelir) ---- */
    const W_ = w => new RegExp('(^|\\s)' + w + '(?=\\s|$)');
    function setTool(t) { tool = t; pend = []; preview = null; chain0 = null; if (t !== 'sel') sel = { pts: new Set(), ents: new Set(), cons: new Set() }; render(); }
    function voiceDim(kind, v) {
      const ents = [...sel.ents].map(id => [id, M.ents[id]]), pts = [...sel.pts];
      if (kind === 'uzunluk') {
        if (ents.length === 1 && ents[0][1].t === 'line' && !pts.length) { setDim({ t: 'len', e: ents[0][0] }, v); return 'Uzunluk ' + nf(v) + ' mm verildi'; }
        return '⚠ Önce bir çizgi seçin (Seç aracı).';
      }
      if (kind === 'çap' || kind === 'yarıçap') {
        if (ents.length === 1 && isCirc(ents[0][1]) && !pts.length) {
          const r = kind === 'çap' ? v / 2 : v;
          setDim({ t: 'rad', e: ents[0][0], dia: kind === 'çap' && ents[0][1].t === 'circle' }, r);
          return (kind === 'çap' ? 'Çap Ø' : 'Yarıçap R') + nf(v) + ' verildi';
        }
        return '⚠ Önce bir daire ya da yay seçin (Seç aracı).';
      }
      const t = kind === 'yatay mesafe' ? 'hd' : kind === 'dikey mesafe' ? 'vd' : 'dist';
      let p, q;
      if (pts.length === 2 && !ents.length) [p, q] = pts; else if (pts.length === 1 && !ents.length) [p, q] = ['o', pts[0]];
      else return '⚠ Önce iki nokta (ya da orijine göre bir nokta) seçin.';
      setDim({ t, p, q }, v); return kind[0].toUpperCase() + kind.slice(1) + ' ' + nf(v) + ' mm verildi';
    }
    function voice(t) {
      if (W_('geri al').test(t)) { root.querySelector('[data-a="undo"]').click(); return 'Geri alındı'; }
      if (W_('yinele').test(t)) { root.querySelector('[data-a="redo"]').click(); return 'Yinelendi'; }
      if (W_('sığdır').test(t)) { fit(); render(); return 'Çizim ekrana sığdırıldı'; }
      const dm = /(yatay mesafe|dikey mesafe|mesafe|uzunluk|yarıçap|çap)[ıiuü]?\s*(\d+(?:\.\d+)?)/.exec(t);
      if (dm) return voiceDim(dm[1], parseFloat(dm[2]));
      const tools = [['dikdörtgen', 'rect', 'Dikdörtgen'], ['çizgi', 'line', 'Çizgi'], ['daire', 'circle', 'Daire'], ['yay', 'arc', 'Yay'], ['seç', 'sel', 'Seç'], ['ölçü', 'dim', 'Ölçü']];
      for (const [w, tl, name] of tools) if (W_(w).test(t)) { setTool(tl); return name + ' aracı seçildi'; }
      const cons = [['eş merkez', ['Eş merkez']], ['teğet', ['Teğet']], ['paralel', ['Paralel']], ['eşit', ['Eşit', 'Hepsi eşit']], ['dikey', ['Dikey', 'Dikey hizala']], ['yatay', ['Yatay', 'Yatay hizala']],
        ['dik', ['Dik']], ['birleştir', ['Birleştir']], ['sabitle', ['Sabitle']], ['yardımcı', ['Yardımcı çizgi yap', 'Parça çizgisi yap']], ['sil', ['Sil']]];
      for (const [w, labels] of cons) if (W_(w).test(t)) {
        if (tool !== 'sel') return '⚠ Önce Seç aracıyla öğeleri seçin.';
        const B = consButtons(), b = B.find(x => labels.includes(x[0]));
        if (!b) return '⚠ "' + w + '" için uygun öğeleri seçin.';
        b[1](); return b[0] + ' uygulandı';
      }
      return null;
    }

    /* ---- silme / birleştirme ---- */
    function cleanup() {
      const used = new Set(['o']);
      for (const id in M.ents) { const e = M.ents[id]; ['a', 'b', 'c'].forEach(k => e[k] && used.add(e[k])); }
      M.cons.forEach(k => { if (k.t === 'fix' || k.t === 'onl' || k.t === 'onc') used.add(k.p); });
      for (const id in M.pts) if (!used.has(id)) delete M.pts[id];
      M.cons = M.cons.filter(k => {
        for (const f of ['e', 'e1', 'e2']) if (k[f] && !M.ents[k[f]]) return false;
        for (const f of ['p', 'q']) if (k[f] && !M.pts[k[f]]) return false;
        if (k.p && k.q && k.p === k.q) return false;
        return true;
      });
    }
    function delSelected() {
      commit(() => {
        const ci = [...sel.cons].sort((a, b) => b - a); ci.forEach(i => M.cons.splice(i, 1));
        sel.ents.forEach(id => delete M.ents[id]);
        sel.pts.forEach(id => {
          if (id === 'o') return;
          M.cons = M.cons.filter(k => k.p !== id && k.q !== id);
          for (const eid in M.ents) { const e = M.ents[eid]; if (e.a === id || e.b === id || e.c === id) delete M.ents[eid]; }
          delete M.pts[id];
        });
        cleanup();
        sel = { pts: new Set(), ents: new Set(), cons: new Set() };
      }, { check: false });
      runSolve(); render();
    }
    function merge(keep, drop) {
      if (drop === 'o') [keep, drop] = [drop, keep];
      for (const id in M.ents) { const e = M.ents[id]; ['a', 'b', 'c'].forEach(k => { if (e[k] === drop) e[k] = keep; }); if (e.t === 'line' && e.a === e.b) delete M.ents[id]; if (e.t === 'arc' && (e.a === e.b || e.a === e.c)) delete M.ents[id]; }
      M.cons.forEach(k => { if (k.p === drop) k.p = keep; if (k.q === drop) k.q = keep; });
      delete M.pts[drop]; cleanup();
    }

    /* ---- kısıt çubuğu ---- */
    function consButtons() {
      const ents = [...sel.ents].map(id => [id, M.ents[id]]), pts = [...sel.pts];
      const lines = ents.filter(([, e]) => e.t === 'line').map(([i]) => i), circs = ents.filter(([, e]) => isCirc(e)).map(([i]) => i);
      const B = []; const add = (txt, fn, cls) => B.push([txt, fn, cls]);
      const con = k => () => { if (commit(() => M.cons.push(k))) clearSel(); };
      if (!pts.length && lines.length === 1 && !circs.length) {
        add('Yatay', con({ t: 'h', e: lines[0] })); add('Dikey', con({ t: 'v', e: lines[0] })); add('Uzunluk', () => dimEntity(lines[0]));
      }
      if (!pts.length && lines.length === 2 && !circs.length) {
        add('Paralel', con({ t: 'par', e1: lines[0], e2: lines[1] })); add('Dik', con({ t: 'perp', e1: lines[0], e2: lines[1] })); add('Eşit', con({ t: 'eq', e1: lines[0], e2: lines[1] }));
      }
      if (!pts.length && lines.length > 2 && !circs.length) add('Hepsi eşit', () => { if (commit(() => { for (let i = 1; i < lines.length; i++) M.cons.push({ t: 'eq', e1: lines[0], e2: lines[i] }); })) clearSel(); });
      if (!pts.length && !lines.length && circs.length === 1) {
        const e = M.ents[circs[0]];
        add(e.t === 'circle' ? 'Çap' : 'Yarıçap', () => dimEntity(circs[0]));
        if (e.t === 'arc') add('Yönü çevir', () => { if (commit(() => { const x = e.a; e.a = e.b; e.b = x; }, { check: false })) render(); });
      }
      if (!pts.length && !lines.length && circs.length >= 2) {
        add('Eşit', () => { if (commit(() => { for (let i = 1; i < circs.length; i++) M.cons.push({ t: 'eq', e1: circs[0], e2: circs[i] }); })) clearSel(); });
        if (circs.length === 2) {
          add('Eş merkez', con({ t: 'conc', e1: circs[0], e2: circs[1] }));
          add('Teğet', () => { const a = M.ents[circs[0]], b = M.ents[circs[1]], P = M.pts, d = hyp(P[a.c].x - P[b.c].x, P[a.c].y - P[b.c].y); con({ t: 'tan', e1: circs[0], e2: circs[1], mode: d < Math.max(rad(M, a), rad(M, b)) ? 'in' : 'out' })(); });
        }
      }
      if (!pts.length && lines.length === 1 && circs.length === 1) add('Teğet', con({ t: 'tan', e1: lines[0], e2: circs[0] }));
      if (pts.length === 2 && !ents.length) {
        const [p, q] = pts;
        add('Birleştir', () => { if (commit(() => merge(p, q))) clearSel(); });
        add('Yatay hizala', con({ t: 'hp', p, q })); add('Dikey hizala', con({ t: 'vp', p, q }));
        add('Mesafe', () => dimPoints(p, q));
      }
      if (pts.length === 1 && lines.length === 1 && !circs.length) add('Çizgi üstünde', con({ t: 'onl', p: pts[0], e: lines[0] }));
      if (pts.length === 1 && !lines.length && circs.length === 1) add('Yay/daire üstünde', con({ t: 'onc', p: pts[0], e: circs[0] }));
      if (pts.length === 1 && !ents.length && pts[0] !== 'o') {
        const p = pts[0], fx = M.cons.findIndex(k => k.t === 'fix' && k.p === p);
        if (fx >= 0) add('Serbest bırak', () => { commit(() => M.cons.splice(fx, 1), { check: false }); clearSel(); });
        else add('Sabitle', con({ t: 'fix', p, x: M.pts[p].x, y: M.pts[p].y }));
        add('Mesafe (orijine)', () => dimPoints('o', p));
      }
      if (ents.length && !pts.length) {
        const allAux = ents.every(([, e]) => e.aux);
        add(allAux ? 'Parça çizgisi yap' : 'Yardımcı çizgi yap', () => { commit(() => ents.forEach(([, e]) => { if (allAux) delete e.aux; else e.aux = true; }), { check: false }); clearSel(); });
      }
      if (sel.cons.size === 1 && M.cons[[...sel.cons][0]].v !== undefined) add('Değeri değiştir', () => editCons([...sel.cons][0]));
      if (sel.pts.size || sel.ents.size || sel.cons.size) add('Sil', delSelected, 'del');
      return B;
    }
    function clearSel() { sel = { pts: new Set(), ents: new Set(), cons: new Set() }; render(); }

    /* ---- çizim ---- */
    const HELP = {
      sel: 'Öğeye dokunarak seçin, noktayı sürükleyerek şekli değiştirin. Boş alanda kaydırın, iki parmakla yakınlaştırın.',
      line: 'Başlangıca dokunun, sonra sıradaki noktalara dokunun (ya da sürükleyin). Başlangıç noktasına dönünce şekil kapanır; zinciri yarıda bitirmek için son noktaya tekrar dokunun.',
      rect: 'İlk köşeye dokunun, karşı köşeye dokunun (ya da sürükleyin).',
      circle: 'Merkeze dokunun, sonra çevreye dokunun (ya da sürükleyin).',
      arc: 'Yay merkezine, sonra başlangıç noktasına, sonra bitiş noktasına dokunun (saat yönünün tersine).',
      dim: 'Ölçülecek çizgiye/daireye dokunun ya da iki noktaya sırayla dokunun.',
    };
    function render() {
      const r = svg.getBoundingClientRect(); W = r.width || 300; H = r.height || 300;
      const P = M.pts, g = gridStep(), out = [];
      const [wx0, wy1] = toW(0, 0), [wx1, wy0] = toW(W, H);
      for (let x = Math.ceil(wx0 / g) * g, i = 0; x <= wx1 && i < 300; x += g, i++) { const [sx] = toS(x, 0); out.push(`<line x1="${sx}" y1="0" x2="${sx}" y2="${H}" stroke="var(--line)" stroke-width="${Math.round(x / g) % 5 ? .5 : 1}"/>`); }
      for (let y = Math.ceil(wy0 / g) * g, i = 0; y <= wy1 && i < 300; y += g, i++) { const [, sy] = toS(0, y); out.push(`<line x1="0" y1="${sy}" x2="${W}" y2="${sy}" stroke="var(--line)" stroke-width="${Math.round(y / g) % 5 ? .5 : 1}"/>`); }
      const [ox, oy] = toS(0, 0);
      out.push(`<line x1="0" y1="${oy}" x2="${W}" y2="${oy}" stroke="var(--steel)" stroke-width="1" stroke-dasharray="10 4 2 4" opacity=".7"/>`);
      out.push(`<line x1="${ox}" y1="0" x2="${ox}" y2="${H}" stroke="var(--steel)" stroke-width="1" stroke-dasharray="10 4 2 4" opacity=".4"/>`);
      // profil dolgusu
      const pr = profile(M);
      const poly = pts => pts.map(([x, y]) => toS(x, y).map(v => v.toFixed(1)).join(',')).join(' ');
      if (pr.outer) {
        let d = 'M' + poly(pr.outer).replace(/ /g, ' L') + 'Z';
        pr.inner.filter(i => i.kind === 'hole').forEach(i => { d += ' M' + poly(i.pts).replace(/ /g, ' L') + 'Z'; });
        out.push(`<path d="${d}" fill="var(--steel)" fill-opacity=".1" fill-rule="evenodd"/>`);
        pr.inner.filter(i => i.kind === 'pocket').forEach(i => out.push(`<polygon points="${poly(i.pts)}" fill="var(--warn)" fill-opacity=".18"/>`));
      }
      // öğeler
      for (const id in M.ents) {
        const e = M.ents[id], on = sel.ents.has(id), col = on ? 'var(--steel)' : 'var(--ink)', w = on ? 3 : 1.8, dash = e.aux ? ' stroke-dasharray="6 4" opacity=".6"' : '';
        if (e.t === 'line') { const [ax, ay] = toS(P[e.a].x, P[e.a].y), [bx, by] = toS(P[e.b].x, P[e.b].y); out.push(`<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${col}" stroke-width="${w}"${dash} stroke-linecap="round"/>`); }
        else if (e.t === 'circle') { const [cx, cy] = toS(P[e.c].x, P[e.c].y); out.push(`<circle cx="${cx}" cy="${cy}" r="${e.r * view.k}" fill="none" stroke="${col}" stroke-width="${w}"${dash}/>`); }
        else { const { sw, r } = arcAngles(M, e), [ax, ay] = toS(P[e.a].x, P[e.a].y), [bx, by] = toS(P[e.b].x, P[e.b].y); out.push(`<path d="M${ax} ${ay} A${r * view.k} ${r * view.k} 0 ${sw > Math.PI ? 1 : 0} 0 ${bx} ${by}" fill="none" stroke="${col}" stroke-width="${w}"${dash}/>`); }
      }
      // kısıt simgeleri ve ölçüler
      labelBoxes = [];
      const label = (x, y, txt, ci, dim) => {
        const w = Math.max(16, txt.length * (dim ? 7.6 : 7) + 8), on = sel.cons.has(ci);
        labelBoxes.push({ x, y, w, ci, dim });
        out.push(`<g><rect x="${x - w / 2}" y="${y - 10}" width="${w}" height="20" rx="4" fill="${on ? 'var(--steel)' : dim ? 'var(--paper)' : 'var(--surface)'}" stroke="${dim ? 'var(--steel)' : 'var(--line)'}"/><text x="${x}" y="${y + 4.5}" text-anchor="middle" font-size="${dim ? 12.5 : 11}" font-weight="${dim ? 600 : 400}" fill="${on ? 'var(--paper)' : 'var(--ink)'}">${esc(txt)}</text></g>`);
      };
      const mid = id => { const e = M.ents[id]; if (e.t === 'line') return toS((P[e.a].x + P[e.b].x) / 2, (P[e.a].y + P[e.b].y) / 2); const r = rad(M, e), c = P[e.c]; if (e.t === 'arc') { const { t0, sw } = arcAngles(M, e), t = t0 + sw / 2; return toS(c.x + r * Math.cos(t), c.y + r * Math.sin(t)); } return toS(c.x + r * 0.71, c.y + r * 0.71); };
      const offs = {}; const off = id => { offs[id] = (offs[id] || 0) + 1; return offs[id]; };
      M.cons.forEach((k, ci) => {
        const G = { h: 'Y', v: 'D', par: '∥', perp: '⊥', eq: '=', tan: 'T', conc: '◎', onl: '•', onc: '•', fix: '⚓', hp: 'Y', vp: 'D' }[k.t];
        if (k.t === 'len') { const e = M.ents[k.e], [ax, ay] = toS(P[e.a].x, P[e.a].y), [bx, by] = toS(P[e.b].x, P[e.b].y), L = hyp(bx - ax, by - ay) || 1, nx = -(by - ay) / L, ny = (bx - ax) / L; label((ax + bx) / 2 + nx * 16, (ay + by) / 2 + ny * 16, nf(k.v), ci, true); return; }
        if (k.t === 'rad') { const [x, y] = mid(k.e); label(x + 16, y - 14, (k.dia ? 'Ø' + nf(2 * k.v) : 'R' + nf(k.v)), ci, true); return; }
        if (k.t === 'dist' || k.t === 'hd' || k.t === 'vd') {
          const [ax, ay] = toS(P[k.p].x, P[k.p].y), [bx, by] = toS(P[k.q].x, P[k.q].y);
          let x2 = bx, y2 = by; if (k.t === 'hd') y2 = ay; if (k.t === 'vd') x2 = ax;
          out.push(`<line x1="${ax}" y1="${ay}" x2="${x2}" y2="${y2}" stroke="var(--steel)" stroke-width="1" stroke-dasharray="3 3"/>`);
          if (k.t !== 'dist') out.push(`<line x1="${x2}" y1="${y2}" x2="${bx}" y2="${by}" stroke="var(--steel)" stroke-width=".7" stroke-dasharray="2 3"/>`);
          label((ax + x2) / 2, (ay + y2) / 2 - (k.t === 'vd' ? 0 : 12), (k.t === 'hd' ? '↔' : k.t === 'vd' ? '↕' : '') + nf(k.v), ci, true); return;
        }
        let x, y;
        if (k.e || k.e1) { const id = k.e || k.e1; [x, y] = mid(id); const n = off(id); x += 12 * n; y += 14; }
        else { [x, y] = toS(P[k.p].x, P[k.p].y); const n = off(k.p); x += 14 * n; y -= 14; }
        label(x, y, G, ci, false);
        if (k.e2) { const [x2, y2] = mid(k.e2); const n = off(k.e2); label(x2 + 12 * n, y2 + 14, G, ci, false); }
      });
      // noktalar
      const bad = new Set(pr.badPts);
      for (const id in P) {
        const p = P[id], [x, y] = toS(p.x, p.y), on = sel.pts.has(id), fixed = p.fixed || M.cons.some(k => k.t === 'fix' && k.p === id);
        out.push(`<circle cx="${x}" cy="${y}" r="${on ? 6 : 3.6}" fill="${on ? 'var(--steel)' : bad.has(id) ? 'var(--err)' : fixed ? 'var(--ink)' : 'var(--paper)'}" stroke="${bad.has(id) ? 'var(--err)' : 'var(--ink)'}" stroke-width="1.3"/>`);
      }
      // önizleme
      if (preview) {
        const pv = preview;
        if (pv.t === 'line' || pv.t === 'rect') {
          const [ax, ay] = toS(...pv.a), [bx, by] = toS(...pv.b);
          if (pv.t === 'line') out.push(`<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="var(--steel)" stroke-width="2" stroke-dasharray="6 4"/>`);
          else out.push(`<rect x="${Math.min(ax, bx)}" y="${Math.min(ay, by)}" width="${Math.abs(bx - ax)}" height="${Math.abs(by - ay)}" fill="none" stroke="var(--steel)" stroke-width="2" stroke-dasharray="6 4"/>`);
          const L = pv.t === 'line' ? hyp(pv.b[0] - pv.a[0], pv.b[1] - pv.a[1]) : null;
          out.push(`<text x="${(ax + bx) / 2}" y="${Math.min(ay, by) - 10}" text-anchor="middle" font-size="12" fill="var(--steel)">${pv.t === 'line' ? nf(L, 1) : nf(Math.abs(pv.b[0] - pv.a[0]), 1) + ' × ' + nf(Math.abs(pv.b[1] - pv.a[1]), 1)}</text>`);
        } else if (pv.t === 'circle') {
          const [cx, cy] = toS(...pv.c), r = hyp(pv.b[0] - pv.c[0], pv.b[1] - pv.c[1]);
          out.push(`<circle cx="${cx}" cy="${cy}" r="${r * view.k}" fill="none" stroke="var(--steel)" stroke-width="2" stroke-dasharray="6 4"/><text x="${cx}" y="${cy - r * view.k - 8}" text-anchor="middle" font-size="12" fill="var(--steel)">Ø${nf(2 * r, 1)}</text>`);
        } else if (pv.t === 'mark') { pv.pts.forEach(q => { const [x, y] = toS(...q); out.push(`<circle cx="${x}" cy="${y}" r="5" fill="var(--steel)"/>`); }); }
      }
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = out.join('');
      // durum
      const pr2 = pr, parts = [];
      if (!lastStat.ok) parts.push('<b class="bad">Kısıtlar çelişiyor</b>');
      else if (Object.keys(M.ents).length) parts.push(lastStat.dof === 0 ? '<b class="ok">Tam tanımlı ✓</b>' : `<b class="mid">${lastStat.dof} serbestlik</b> (eksik ölçü/kısıt var)`);
      if (pr2.open) parts.push(`<b class="bad">${pr2.open} açık uç</b> (kırmızı noktalar)`);
      if (pr2.branch) parts.push('<b class="bad">çatallanan nokta</b>');
      stEl.innerHTML = (parts.length ? parts.join(' · ') + '<br>' : '') + esc(HELP[tool]);
      // kısıt düğmeleri
      const B = tool === 'sel' ? consButtons() : [];
      consEl.innerHTML = B.map(([t, , c], i) => `<button data-i="${i}"${c ? ` class="${c}"` : ''}>${esc(t)}</button>`).join('');
      consEl.querySelectorAll('button').forEach(b => b.onclick = () => B[+b.dataset.i][1]());
      root.querySelectorAll('[data-t]').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === tool));
      root.querySelector('[data-a="undo"]').disabled = !undo.length; root.querySelector('[data-a="redo"]').disabled = !redo.length;
      renderInner(pr);
    }
    let innerSig = '';
    function renderInner(pr) {
      const sig = pr.inner.map(i => i.key + i.kind + i.depth + i.label).join('|');
      if (sig === innerSig) return; innerSig = sig;
      if (!pr.inner.length) { innerEl.innerHTML = ''; return; }
      innerEl.innerHTML = '<small style="color:var(--muted)">İç konturlar: boydan boya delik mi, belirli derinlikte cep mi? (Cep freze ve dökümde hesaba katılır.)</small>' +
        pr.inner.map((i, n) => `<div class="row"><span>${n + 1}. ${esc(i.label)}</span>
          <select data-k="${esc(i.key)}"><option value="hole"${i.kind === 'hole' ? ' selected' : ''}>Delik</option><option value="pocket"${i.kind === 'pocket' ? ' selected' : ''}>Cep</option></select>
          <span>${i.kind === 'pocket' ? `<input data-d="${esc(i.key)}" inputmode="decimal" value="${nf(i.depth)}" aria-label="Cep derinliği mm"> mm` : ''}</span></div>`).join('');
      innerEl.querySelectorAll('select').forEach(s => s.onchange = () => { snapshot(); if (s.value === 'pocket') M.pockets[s.dataset.k] = { depth: (M.pockets[s.dataset.k] || {}).depth || 5 }; else delete M.pockets[s.dataset.k]; changed(); });
      innerEl.querySelectorAll('input').forEach(inp => inp.onchange = () => { const v = parseNum(inp.value); if (v > 0) { snapshot(); M.pockets[inp.dataset.d] = { depth: v }; changed(); } });
    }

    /* ---- dokunma ---- */
    const ptrs = new Map(); let gest = null;
    svg.addEventListener('pointerdown', ev => {
      svg.setPointerCapture(ev.pointerId);
      const r = svg.getBoundingClientRect(), sx = ev.clientX - r.left, sy = ev.clientY - r.top;
      ptrs.set(ev.pointerId, [sx, sy]);
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; gest = { t: 'pinch', d0: hyp(a[0] - b[0], a[1] - b[1]), k0: view.k, m0: toW((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) }; preview = null; return; }
      if (ptrs.size > 2) return;
      gest = { t: 'one', sx0: sx, sy0: sy, moved: false, vx: view.cx, vy: view.cy };
      if (tool === 'sel') {
        const pid = hitPoint(sx, sy);
        if (pid && pid !== 'o' && !M.pts[pid].fixed) gest.drag = pid;
      }
      if (tool === 'line' || tool === 'rect' || tool === 'circle') {
        gest.start = (tool === 'line' && pend.length) ? null : snapWorld(sx, sy);
      }
    });
    svg.addEventListener('pointermove', ev => {
      if (!ptrs.has(ev.pointerId)) {
        if (ev.pointerType === 'mouse' && (tool === 'line' || tool === 'circle' || tool === 'rect') && pend.length) { const r = svg.getBoundingClientRect(); hover(ev.clientX - r.left, ev.clientY - r.top); }
        return;
      }
      const r = svg.getBoundingClientRect(), sx = ev.clientX - r.left, sy = ev.clientY - r.top;
      ptrs.set(ev.pointerId, [sx, sy]);
      if (!gest) return;
      if (gest.t === 'pinch' && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()], d = hyp(a[0] - b[0], a[1] - b[1]);
        view.k = Math.max(0.02, Math.min(400, gest.k0 * d / (gest.d0 || 1)));
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        view.cx = gest.m0[0] - (mx - W / 2) / view.k; view.cy = gest.m0[1] + (my - H / 2) / view.k;
        render(); return;
      }
      if (gest.t !== 'one') return;
      if (!gest.moved && hyp(sx - gest.sx0, sy - gest.sy0) > 8) {
        gest.moved = true;
        if (gest.drag) snapshot();
      }
      if (!gest.moved) return;
      if (tool === 'sel') {
        if (gest.drag) {
          const [x, y] = toW(sx, sy);
          solve(M, { p: gest.drag, x, y, w: 0.2 }, 30); lastStat = solve(M, null, 30);
          render();
        } else { view.cx = gest.vx - (sx - gest.sx0) / view.k; view.cy = gest.vy + (sy - gest.sy0) / view.k; render(); }
        return;
      }
      if (tool === 'dim' || tool === 'arc') { view.cx = gest.vx - (sx - gest.sx0) / view.k; view.cy = gest.vy + (sy - gest.sy0) / view.k; render(); return; }
      hover(sx, sy, true);
    });
    function hover(sx, sy, dragging) {
      if (tool === 'line') {
        const a = dragging && gest && gest.start ? gest.start.w : pend[0] ? pend[0].w : null; if (!a) return;
        preview = { t: 'line', a, b: snapWorld(sx, sy, a).w };
      } else if (tool === 'rect') { const a = dragging && gest.start ? gest.start.w : pend[0] && pend[0].w; if (!a) return; preview = { t: 'rect', a, b: snapWorld(sx, sy).w }; }
      else if (tool === 'circle') { const c = dragging && gest.start ? gest.start.w : pend[0] && pend[0].w; if (!c) return; preview = { t: 'circle', c, b: snapWorld(sx, sy).w }; }
      render();
    }
    function finishTouch(ev) {
      if (!ptrs.has(ev.pointerId)) return;
      const r = svg.getBoundingClientRect(), sx = ev.clientX - r.left, sy = ev.clientY - r.top;
      ptrs.delete(ev.pointerId);
      if (!gest) return;
      if (gest.t === 'pinch') { if (!ptrs.size) gest = null; return; }
      const g = gest; gest = null;
      if (ev.type === 'pointercancel') { preview = null; render(); return; }
      if (tool === 'sel') {
        if (g.drag && g.moved) { runSolve(); changed(); return; }
        if (g.moved) return;
        const pid0 = hitPoint(sx, sy, 12), near = pid0 ? null : hitEnt(sx, sy, 7), ci = pid0 || near ? -1 : hitLabel(sx, sy), pid = ci < 0 ? (pid0 || hitPoint(sx, sy, 16)) : null, eid = ci < 0 && !pid ? (near || hitEnt(sx, sy)) : null;
        if (ci >= 0) { const k = M.cons[ci]; if (sel.cons.has(ci) && k.v !== undefined) { editCons(ci); return; } toggle(sel.cons, ci); }
        else if (pid) toggle(sel.pts, pid); else if (eid) toggle(sel.ents, eid); else sel = { pts: new Set(), ents: new Set(), cons: new Set() };
        render(); return;
      }
      if (tool === 'dim') {
        if (g.moved) return;
        const ci = hitLabel(sx, sy, true); if (ci >= 0) { editCons(ci); return; }
        const pid = hitPoint(sx, sy, 16);
        if (pid) { if (pend.length && pend[0].pid !== pid) { const p = pend[0].pid; pend = []; preview = null; dimPoints(p, pid); } else { pend = [{ pid }]; preview = { t: 'mark', pts: [[M.pts[pid].x, M.pts[pid].y]] }; } render(); return; }
        const eid = hitEnt(sx, sy); pend = []; preview = null; render(); if (eid) dimEntity(eid);
        return;
      }
      const end = snapWorld(sx, sy, tool === 'line' ? (g.start ? g.start.w : pend[0] && pend[0].w) : null);
      if (tool === 'line') {
        let start = g.moved && g.start ? g.start : pend[0];
        if (g.moved && g.start) chain0 = g.start.pid || null;
        if (!start) { pend = [end]; chain0 = end.pid || null; preview = null; render(); return; }
        if (!g.moved && start.pid && end.pid === start.pid) { pend = []; chain0 = null; preview = null; render(); return; } // zinciri bitir
        let res;
        commit(() => { res = addLine(start, end); });
        if (!res) { render(); return; }
        if (!chain0) chain0 = M.ents[res.id].a;
        const closed = res.b === chain0; // zincir başına dönüldü: kapandı
        pend = closed ? [] : [{ pid: res.b, w: [M.pts[res.b].x, M.pts[res.b].y] }];
        if (closed) chain0 = null;
        preview = null; render(); return;
      }
      if (tool === 'rect') {
        const a = g.moved && g.start ? g.start : pend[0];
        if (!a) { pend = [end]; render(); return; }
        pend = []; preview = null;
        const [x0, y0] = a.w, [x1, y1] = end.w;
        if (Math.abs(x1 - x0) < 1e-6 || Math.abs(y1 - y0) < 1e-6) { render(); return; }
        commit(() => {
          const p0 = pointAt(a.w, a.pid), p2 = pointAt(end.w, end.pid), p1 = pointAt([x1, y0]), p3 = pointAt([x0, y1]);
          const l = [[p0, p1], [p1, p2], [p2, p3], [p3, p0]].map(([s, e]) => { const id = uid(M); M.ents[id] = { t: 'line', a: s, b: e }; return id; });
          M.cons.push({ t: 'h', e: l[0] }, { t: 'v', e: l[1] }, { t: 'h', e: l[2] }, { t: 'v', e: l[3] });
        });
        render(); return;
      }
      if (tool === 'circle') {
        const c = g.moved && g.start ? g.start : pend[0];
        if (!c) { pend = [end]; render(); return; }
        pend = []; preview = null;
        const r0 = hyp(end.w[0] - c.w[0], end.w[1] - c.w[1]);
        if (r0 < 1e-6) { render(); return; }
        commit(() => { const cid = pointAt(c.w, c.pid), id = uid(M); M.ents[id] = { t: 'circle', c: cid, r: r0 }; });
        render(); return;
      }
      if (tool === 'arc') {
        if (g.moved) return;
        const s = snapWorld(sx, sy);
        pend.push(s);
        if (pend.length < 3) { preview = { t: 'mark', pts: pend.map(q => q.w) }; render(); return; }
        const [c, a, b] = pend; pend = []; preview = null;
        const r0 = hyp(a.w[0] - c.w[0], a.w[1] - c.w[1]); if (r0 < 1e-6) { render(); return; }
        const tb = Math.atan2(b.w[1] - c.w[1], b.w[0] - c.w[0]), bw = b.pid ? b.w : [c.w[0] + r0 * Math.cos(tb), c.w[1] + r0 * Math.sin(tb)];
        commit(() => { const ci = pointAt(c.w, c.pid), ai = pointAt(a.w, a.pid), bi = pointAt(bw, b.pid), id = uid(M); if (ai !== bi) M.ents[id] = { t: 'arc', c: ci, a: ai, b: bi }; });
        render();
      }
    }
    const toggle = (set, v) => { set.has(v) ? set.delete(v) : set.add(v); };
    svg.addEventListener('pointerup', finishTouch);
    svg.addEventListener('touchend', ev => { if (ev.cancelable) ev.preventDefault(); }, { passive: false });
    svg.addEventListener('pointercancel', finishTouch);
    svg.addEventListener('wheel', ev => { ev.preventDefault(); const r = svg.getBoundingClientRect(), sx = ev.clientX - r.left, sy = ev.clientY - r.top, w0 = toW(sx, sy); view.k = Math.max(0.02, Math.min(400, view.k * (ev.deltaY < 0 ? 1.15 : 1 / 1.15))); const w1 = toW(sx, sy); view.cx += w0[0] - w1[0]; view.cy += w0[1] - w1[1]; render(); }, { passive: false });

    root.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tool = b.dataset.t; pend = []; preview = null; chain0 = null; if (tool !== 'sel') sel = { pts: new Set(), ents: new Set(), cons: new Set() }; render(); });
    root.querySelector('[data-a="undo"]').onclick = () => { if (!undo.length) return; redo.push(JSON.stringify(M)); restore(undo.pop()); runSolve(); changed(); };
    root.querySelector('[data-a="redo"]').onclick = () => { if (!redo.length) return; undo.push(JSON.stringify(M)); restore(redo.pop()); runSolve(); changed(); };
    root.querySelector('[data-a="fit"]').onclick = () => { fit(); render(); };
    root.querySelector('[data-a="clear"]').onclick = async () => {
      const c = await sheet('Çizimin tamamı silinsin mi?', { choices: ['Vazgeç', 'Sil'] });
      if (c === 1) { snapshot(); M = newModel(); pend = []; preview = null; sel = { pts: new Set(), ents: new Set(), cons: new Set() }; lastStat = { ok: true, dof: 0 }; fit(); changed(); }
    };
    root.querySelector('[data-a="dxf"]').onclick = () => download('cizim.dxf', toDXF(M), 'application/dxf');
    root.querySelector('[data-a="svg"]').onclick = () => download('cizim.svg', toSVG(M), 'image/svg+xml');
    async function download(name, text, type) {
      if (!Object.keys(M.ents).length) { toast('Çizim boş.'); return; }
      const blob = new Blob([text], { type }), file = new File([blob], name, { type });
      try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
    function fit() {
      const r = svg.getBoundingClientRect(); W = r.width || 300; H = r.height || 300;
      let x0 = 0, y0 = 0, x1 = 0, y1 = 0; const P = M.pts;
      const grow = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
      for (const id in P) grow(P[id].x, P[id].y);
      for (const id in M.ents) { const e = M.ents[id]; if (isCirc(e)) { const r = rad(M, e), c = P[e.c]; grow(c.x - r, c.y - r); grow(c.x + r, c.y + r); } }
      if (x1 - x0 < 1 && y1 - y0 < 1) { x0 = -20; y0 = -20; x1 = 100; y1 = 60; }
      view.k = Math.min(W / ((x1 - x0) * 1.25), H / ((y1 - y0) * 1.35)); view.cx = (x0 + x1) / 2; view.cy = (y0 + y1) / 2;
    }
    new ResizeObserver(() => render()).observe(svg);
    runSolve(); fit();
    setTimeout(() => { fit(); render(); }, 0);

    return {
      profile: () => profile(M),
      voice,
      isEmpty: () => !Object.keys(M.ents).length,
      resize() { fit(); render(); },
      model: () => M,
      setModel(m) { M = Object.assign(newModel(), JSON.parse(JSON.stringify(m))); M.pts.o = { x: 0, y: 0, fixed: true }; runSolve(); fit(); changed(); },
      toDXF: () => toDXF(M), toSVG: () => toSVG(M), status: () => lastStat,
    };
  }

  window.TornalySketch = { create, core: { newModel, solve, residuals, profile, toDXF, toSVG, rad, lenOf } };
})();
