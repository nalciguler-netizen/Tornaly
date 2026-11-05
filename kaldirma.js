/* Tornaly – Kaldırma kapasitesi: ekskavatör, beko (ön/arka), loder, sepetli platform, basit kol.
   1) Hızlı hesap: devrilme yükü, tek silindir hidrolik sınırı, kova ağırlığı değişimi etkisi.
   2) Mekanizma: genel düzlemsel mekanizma çözücüsü (noktalar + rijit gövdeler + boyu değişen silindirler),
      sanal iş ile her silindirin hidrolik sınırı, devrilme, kaldırma tablosu taraması.
   Standart oranlar: ISO 10567 (ekskavatör: min(%75 devrilme, %87 hidrolik)), ISO 14397 (loder: lastikli %50, paletli %35). */
(function () {
  'use strict';
  const g = 9.80665, PI = Math.PI;
  let H = null;
  const $ = s => document.querySelector(s);
  const f = (n, d = 0) => H().fmt(n, d);
  const esc = s => H().esc(s);
  const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : NaN; };
  const ok = v => isFinite(v) && v > 0;
  const kg = v => !isFinite(v) ? '—' : v === Infinity ? 'devrilmez' : v <= 0 ? '<b style="color:var(--err)">0 (yetersiz)</b>' : `${f(v, 0)} kg`;
  const warnP = t => `<p class="note" style="color:var(--warn)">${t}</p>`;
  const cylF = (D, d, p, n = 1) => ({ push: n * p / 10 * PI * D * D / 4, pull: n * p / 10 * PI * (D * D - d * d) / 4 }); // N (mm, bar)

  const TYPES = {
    ekskavator: { ad: 'Ekskavatör (ISO 10567)', pT: 75, pH: 87 },
    bekoArka: { ad: 'Beko – kazıcı (arka) (ISO 10567)', pT: 75, pH: 87 },
    bekoOn: { ad: 'Beko – yükleyici (ön) (ISO 14397)', pT: 50, pH: 100 },
    loderL: { ad: 'Lastikli loder (ISO 14397 %50)', pT: 50, pH: 100 },
    loderP: { ad: 'Paletli loder (ISO 14397 %35)', pT: 35, pH: 100 },
    platform: { ad: 'Sepetli platform (üretici değeri esastır)', pT: 66, pH: 100 },
    diger: { ad: 'Diğer / vinç kolu', pT: 75, pH: 87 },
  };

  /* ================= 1) Hızlı hesap ================= */
  function quick(root) {
    const s = H().store.get('kal.quick', {});
    const F = [
      { k: 'tip', l: 'Makine tipi', opts: Object.entries(TYPES).map(([k, t]) => [k, t.ad]), d: 'ekskavator', wide: 1 },
      { h: 'Devrilme' },
      { k: 'M', l: 'Makine çalışma ağırlığı', u: 'kg', d: 20000 }, { k: 'a', l: 'Devrilme kenarı → makine ağırlık merkezi', u: 'm', d: 1.6, hint: 'Yatay mesafe, makinenin kendi tarafında' },
      { k: 'b', l: 'Devrilme kenarı → yük noktası', u: 'm', d: 4.5, hint: 'Yük noktası: kova pimi (ekskavatör) ya da kova yük merkezi (loder)' },
      { k: 'Wt0', l: 'ya da katalog devrilme yükü (0 = hesapla)', u: 'kg', d: 0 },
      { h: 'Hidrolik sınır (yükü taşıyan silindir)' },
      { k: 'D', l: 'Piston çapı', u: 'mm', d: 120 }, { k: 'd', l: 'Mil çapı', u: 'mm', d: 85 }, { k: 'n', l: 'Silindir adedi', u: '', d: 2 },
      { k: 'p', l: 'Tutma / emniyet basıncı', u: 'bar', d: 343 }, { k: 'yon', l: 'Silindir yükü', opts: [['push', 'İterek taşıyor (piston tarafı)'], ['pull', 'Çekerek taşıyor (mil tarafı)']], d: 'push' },
      { k: 'rc', l: 'Silindirin pime dik kol mesafesi', u: 'm', d: 0.65, hint: 'Pim ekseninden silindir eksenine dik mesafe' },
      { k: 'rL', l: 'Pim → yük noktası yatay mesafe', u: 'm', d: 4.3 }, { k: 'mA', l: 'Kol + bom ataşman kütlesi', u: 'kg', d: 2400 }, { k: 'xA', l: 'Pim → ataşman ağırlık merkezi yatay', u: 'm', d: 2.3 },
      { k: 'Wh0', l: 'ya da katalog hidrolik kapasite (0 = hesapla)', u: 'kg', d: 0 },
      { h: 'Kova' },
      { k: 'dahil', l: 'Yukarıdaki değerler', opts: [['haric', 'Kova takılı değilken'], ['dahil', 'Katalog kovası takılıyken']], d: 'haric', wide: 1 },
      { k: 'm1', l: 'Mevcut (katalog) kova + kaplin', u: 'kg', d: 900 }, { k: 'm2', l: 'Yeni kova + kaplin', u: 'kg', d: 1250 },
      { k: 'V1', l: 'Mevcut kova hacmi (tepeleme)', u: 'm³', d: 1.0 }, { k: 'V2', l: 'Yeni kova hacmi (tepeleme)', u: 'm³', d: 1.3 },
      { k: 'rho', l: 'Malzeme yoğunluğu', opts: [['1.6', 'Toprak, kuru ~1,6 t/m³'], ['1.9', 'Toprak, ıslak / kil ~1,9'], ['1.7', 'Kum, çakıl ~1,7'], ['2.0', 'Islak kum ~2,0'], ['1.8', 'Patlatılmış kaya ~1,8'], ['1.5', 'Kömür / asfalt ~1,5'], ['0.6', 'Talaş, kar ~0,6']], d: '1.7', wide: 1 },
      { k: 'pT', l: 'Devrilme oranı', u: '%', d: '' }, { k: 'pH', l: 'Hidrolik oranı', u: '%', d: '' },
    ];
    const v0 = {}; F.forEach(x => { if (x.k) v0[x.k] = s[x.k] ?? x.d; });
    const field = x => x.h ? `<h3 style="grid-column:1/-1;margin:6px 0 0">${x.h}</h3>` : x.opts
      ? `<label class="f"${x.wide ? ' style="grid-column:1/-1"' : ''}><span>${x.l}</span><div class="in"><select data-q="${x.k}">${x.opts.map(([a, b]) => `<option value="${a}"${String(a) === String(v0[x.k]) ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select></div></label>`
      : `<label class="f"><span>${x.l}</span><div class="in"><input type="number" inputmode="decimal" data-q="${x.k}" value="${v0[x.k]}">${x.u ? `<em>${x.u}</em>` : ''}</div>${x.hint ? `<small>${x.hint}</small>` : ''}</label>`;
    root.innerHTML = `<div class="grid">${F.map(field).join('')}</div><div id="kqOut"></div>`;
    const calc = () => {
      const v = {}; root.querySelectorAll('[data-q]').forEach(i => { v[i.dataset.q] = i.tagName === 'SELECT' ? i.value : num(i.value); });
      const st = {}; root.querySelectorAll('[data-q]').forEach(i => st[i.dataset.q] = i.value); H().store.set('kal.quick', st);
      const T = TYPES[v.tip] || TYPES.diger;
      const pT = (ok(v.pT) ? v.pT : T.pT) / 100, pH = (ok(v.pH) ? v.pH : T.pH) / 100;
      root.querySelector('[data-q="pT"]').placeholder = T.pT; root.querySelector('[data-q="pH"]').placeholder = T.pH;
      let Wt = ok(v.Wt0) ? v.Wt0 : (ok(v.M) && ok(v.a) && ok(v.b) ? v.M * v.a / v.b : NaN);
      let Wh = NaN;
      if (ok(v.Wh0)) Wh = v.Wh0;
      else if ([v.D, v.p, v.rc, v.rL].every(ok)) { const c = cylF(v.D, v.d || 0, v.p, ok(v.n) ? v.n : 1); Wh = ((v.yon === 'pull' ? c.pull : c.push) * v.rc - (v.mA || 0) * g * (v.xA || 0)) / (g * v.rL); }
      const m1 = v.m1 || 0, m2 = v.m2 || 0, base = v.dahil === 'dahil' ? m1 : 0;
      const rated = m => Math.min(isFinite(Wt) ? pT * (Wt + base - m) : Infinity, isFinite(Wh) ? pH * (Wh + base - m) : Infinity);
      const rho = num(v.rho) || 1.7, L1 = (v.V1 || 0) * rho * 1000, L2 = (v.V2 || 0) * rho * 1000, r1 = rated(m1), r2 = rated(m2);
      const lim = (Wtv, Whv) => !isFinite(Whv) ? 'devrilme' : !isFinite(Wtv) ? 'hidrolik' : pT * Wtv <= pH * Whv ? 'devrilme' : 'hidrolik';
      const fit = (L, r) => !isFinite(r) ? '—' : L <= r ? `<b style="color:var(--steel)">✓ yeter</b> (%${f(L / r * 100, 0)})` : `<b style="color:var(--err)">✗ fazla</b> (%${f(L / r * 100, 0)})`;
      if (!isFinite(Wt) && !isFinite(Wh)) { $('#kqOut').innerHTML = warnP('Devrilme ya da hidrolik değerlerini girin.'); return; }
      $('#kqOut').innerHTML = `<div class="plate" style="margin-top:12px"><div class="lbl">Bu noktada izin verilen yük (yeni kova ile)</div><div class="big">${kg(r2)}</div>
        <div class="sub"><span>Sınırlayan: <b>${lim(Wt, Wh)}</b></span><span>Oranlar %${f(pT * 100)} / %${f(pH * 100)}</span></div></div>` +
        `<div class="tw"><table><tbody>
        <tr><td>Devrilme yükü (kovasız)</td><td>${kg(Wt + base)}</td></tr>
        <tr><td>Hidrolik kapasite (kovasız)</td><td>${kg(Wh + base)}</td></tr></tbody></table></div>
        <h3>Kova değişiminin etkisi</h3><div class="tw"><table><thead><tr><th></th><th>Mevcut kova</th><th>Yeni kova</th></tr></thead><tbody>
        <tr><td>Kova + kaplin</td><td>${f(m1)} kg</td><td>${f(m2)} kg</td></tr>
        <tr><td>Kalan taşıma kapasitesi</td><td>${kg(r1)}</td><td>${kg(r2)}</td></tr>
        <tr><td>Dolu kova yükü (${f(rho, 1)} t/m³)</td><td>${f(L1)} kg</td><td>${f(L2)} kg</td></tr>
        <tr><td>Uygunluk</td><td>${fit(L1, r1)}</td><td>${fit(L2, r2)}</td></tr>
        <tr><td>En büyük uygun kova hacmi</td><td>${isFinite(r1) && r1 > 0 ? f(r1 / rho / 1000, 2) + ' m³' : '—'}</td><td>${isFinite(r2) && r2 > 0 ? f(r2 / rho / 1000, 2) + ' m³' : '—'}</td></tr>
        </tbody></table></div>
        <p class="note">Kova ağırlık merkezinin yük noktasına yakın olduğu kabul edilmiştir. Hesap yalnızca girilen tek konum içindir; makine kolunu uzattıkça kapasite düşer. Tam tablo için "Mekanizma" bölümünü kullanın. Yük tablosu ve emniyet kararları için üreticinin yük tablosu esastır.</p>`;
    };
    root.querySelectorAll('[data-q]').forEach(i => { i.oninput = calc; i.onchange = calc; });
    calc();
  }

  /* ================= 2) Mekanizma ================= */
  // Şablonlar: koordinatlar metre, x ileri (yük tarafı), y yukarı, zemin y = 0. Silindir boyları şablon pozundan alınır.
  const exc = (tf, sc, M, xm, xe, cyl, ms, tip, ad) => {
    const T = ([x, y]) => [tf[0] + sc * x, sc * y];
    const P = { B0: [0.15, 2.05], C1a: [0.6, 1.0], C1b: [2.0, 3.0], C2a: [2.6, 3.75], A0: [5.6, 3.3], C2b: [5.35, 4.1], C3a: [5.75, 3.85], L1: [6.3, 0.85], H: [6.75, 1.05], K0: [6.45, 0.45], K1: [6.85, 0.6], Y: [7.35, -0.7] };
    const pts = Object.entries(P).map(([id, p]) => { const [x, y] = T(p); return { id, x: +x.toFixed(3), y: +y.toFixed(3), g: id === 'B0' || id === 'C1a' }; });
    return {
      ad, tip, pts, load: 'K0', M, xm, xe,
      bodies: [{ ad: 'Bom', p: ['B0', 'C1b', 'C2a', 'A0'], m: ms[0] }, { ad: 'Arm (kol)', p: ['A0', 'C2b', 'C3a', 'L1', 'K0'], m: ms[1] }, { ad: 'Bağlantı 1', p: ['L1', 'H'], m: ms[3] / 2 }, { ad: 'Bağlantı 2', p: ['H', 'K1'], m: ms[3] / 2 }, { ad: 'Kova', p: ['K0', 'K1', 'Y'], m: ms[2] }],
      cyls: [{ ad: 'Bom silindiri', a: 'C1a', b: 'C1b', ...cyl[0] }, { ad: 'Arm silindiri', a: 'C2a', b: 'C2b', ...cyl[1] }, { ad: 'Kova silindiri', a: 'C3a', b: 'H', ...cyl[2] }],
      extra: [],
    };
  };
  const TPL = {
    ekskavator: () => exc([0, 0], 1, 15500, -0.6, 2.0, [{ D: 120, d: 85, n: 2, p: 343, s: 1.30, e: 0.45 }, { D: 140, d: 100, n: 1, p: 343, s: 1.45, e: 0.35 }, { D: 120, d: 85, n: 1, p: 343, s: 1.05, e: 0.45 }], [1600, 750, 750, 60], 'ekskavator', 'Ekskavatör ~20 t (örnek ölçüler)'),
    bekoArka: () => exc([1.2, 0], 0.72, 6200, -1.1, 1.05, [{ D: 100, d: 60, n: 1, p: 210, s: 0.95, e: 0.45 }, { D: 90, d: 60, n: 1, p: 210, s: 1.00, e: 0.3 }, { D: 80, d: 50, n: 1, p: 210, s: 0.80, e: 0.45 }], [420, 240, 180, 25], 'bekoArka', 'Beko kazıcı tarafı ~8 t (örnek)'),
    loderL: () => ({
      ad: 'Lastikli loder Z-bar ~13 t (örnek)', tip: 'loderL', load: 'Q', M: 11500, xm: -2.0, xe: 0,
      pts: [{ id: 'A', x: -0.6, y: 2.6, g: 1 }, { id: 'C1a', x: -0.4, y: 0.8, g: 1 }, { id: 'TC', x: -0.7, y: 2.25, g: 1 }, { id: 'C1b', x: 0.6, y: 1.75 }, { id: 'LP', x: 0.9, y: 1.9 }, { id: 'B', x: 2.0, y: 0.55 },
        { id: 'LU', x: 0.5, y: 2.6 }, { id: 'LL', x: 1.25, y: 1.2 }, { id: 'K1', x: 2.05, y: 1.05 }, { id: 'Q', x: 2.45, y: 0.6 }, { id: 'Y', x: 3.0, y: 0.05 }],
      bodies: [{ ad: 'Bom', p: ['A', 'C1b', 'LP', 'B'], m: 1300 }, { ad: 'Kol (rocker)', p: ['LP', 'LU', 'LL'], m: 180 }, { ad: 'Bağlantı', p: ['LL', 'K1'], m: 70 }, { ad: 'Kova', p: ['B', 'K1', 'Q', 'Y'], m: 1100 }],
      cyls: [{ ad: 'Kaldırma silindiri', a: 'C1a', b: 'C1b', D: 140, d: 80, n: 2, p: 250, s: 0.75, e: 0.05 }, { ad: 'Devirme silindiri', a: 'TC', b: 'LU', D: 180, d: 90, n: 1, p: 250, s: 0.55, e: 0.5 }], extra: []
    }),
    bekoOn: () => ({
      ad: 'Beko yükleyici tarafı (örnek)', tip: 'bekoOn', load: 'Q', M: 6800, xm: -1.4, xe: 0,
      pts: [{ id: 'A', x: -0.3, y: 2.1, g: 1 }, { id: 'C1a', x: -0.1, y: 1.0, g: 1 }, { id: 'C1b', x: 0.9, y: 1.5 }, { id: 'TC', x: 0.4, y: 1.95 }, { id: 'B', x: 1.9, y: 0.5 },
        { id: 'K1', x: 1.95, y: 1.0 }, { id: 'Q', x: 2.3, y: 0.55 }, { id: 'Y', x: 2.75, y: 0.05 }],
      bodies: [{ ad: 'Bom', p: ['A', 'C1b', 'TC', 'B'], m: 650 }, { ad: 'Kova', p: ['B', 'K1', 'Q', 'Y'], m: 450 }],
      cyls: [{ ad: 'Kaldırma silindiri', a: 'C1a', b: 'C1b', D: 80, d: 50, n: 2, p: 230, s: 0.70, e: 0.05 }, { ad: 'Devirme silindiri', a: 'TC', b: 'K1', D: 75, d: 45, n: 2, p: 230, s: 0.55, e: 0.5 }], extra: []
    }),
    platform: () => ({
      ad: 'Kamyon üstü sepetli platform, eklemli (örnek)', tip: 'platform', load: 'T', M: 6500, xm: -0.3, xe: 2.1,
      pts: [{ id: 'P0', x: 0, y: 2.4, g: 1 }, { id: 'C1a', x: 0.6, y: 2.0, g: 1 }, { id: 'C1b', x: 1.4, y: 3.0 }, { id: 'C2a', x: 3.56, y: 3.85 }, { id: 'E', x: 4.5, y: 4.8 }, { id: 'C2b', x: 4.6, y: 5.8 }, { id: 'T', x: 8.5, y: 6.5 }],
      bodies: [{ ad: 'Alt bom', p: ['P0', 'C1b', 'C2a', 'E'], m: 600 }, { ad: 'Üst bom', p: ['E', 'C2b', 'T'], m: 450 }],
      cyls: [{ ad: 'Alt bom silindiri', a: 'C1a', b: 'C1b', D: 125, d: 70, n: 1, p: 200, s: 0.9, e: 0.4 }, { ad: 'Üst bom silindiri', a: 'C2a', b: 'C2b', D: 125, d: 70, n: 1, p: 200, s: 0.6, e: 0.8 }],
      extra: [{ ad: 'Sepet', pt: 'T', m: 150 }]
    }),
    basit: () => ({
      ad: 'Basit kol (tek silindir)', tip: 'diger', load: 'T', M: 3000, xm: -0.5, xe: 1.0,
      pts: [{ id: 'O', x: 0, y: 1.0, g: 1 }, { id: 'C1a', x: 0.3, y: 0.3, g: 1 }, { id: 'C1b', x: 0.8, y: 1.2 }, { id: 'T', x: 3.0, y: 1.5 }],
      bodies: [{ ad: 'Kol', p: ['O', 'C1b', 'T'], m: 250 }],
      cyls: [{ ad: 'Silindir', a: 'C1a', b: 'C1b', D: 80, d: 45, n: 1, p: 200, s: 0.6, e: 0.4 }], extra: []
    }),
  };
  const TPL_NAMES = [['ekskavator', 'Ekskavatör'], ['bekoArka', 'Beko – kazıcı (arka)'], ['bekoOn', 'Beko – yükleyici (ön)'], ['loderL', 'Lastikli loder (Z-bar)'], ['platform', 'Sepetli platform'], ['basit', 'Basit kol']];

  function prepare(m) {
    const idx = {}; m.pts.forEach((p, i) => { idx[p.id] = i; p.g = !!p.g; });
    m.idx = idx;
    m.free = m.pts.map((p, i) => p.g ? -1 : i).filter(i => i >= 0);
    m.cons = [];
    for (const b of m.bodies) for (let i = 0; i < b.p.length; i++) for (let j = i + 1; j < b.p.length; j++) {
      const A = m.pts[idx[b.p[i]]], B = m.pts[idx[b.p[j]]]; if (!A || !B) continue;
      m.cons.push([idx[b.p[i]], idx[b.p[j]], Math.hypot(A.x - B.x, A.y - B.y)]);
    }
    m.cyls.forEach(c => { const A = m.pts[idx[c.a]], B = m.pts[idx[c.b]]; c.L0 = Math.hypot(A.x - B.x, A.y - B.y); if (!isFinite(c.Lmin)) c.Lmin = c.L0 - (c.e ?? 0.5) * c.s; });
    return m;
  }
  // Konum çözümü: Levenberg–Marquardt, sayısal Jacobian
  function solve(m, lens, X0) {
    const nf = m.free.length, X = X0 ? X0.slice() : [].concat(...m.free.map(i => [m.pts[i].x, m.pts[i].y]));
    const pos = X => { const P = m.pts.map(p => [p.x, p.y]); m.free.forEach((i, k) => { P[i] = [X[2 * k], X[2 * k + 1]]; }); return P; };
    const res = X => { const P = pos(X), r = []; for (const [i, j, d] of m.cons) r.push(Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]) - d);
      m.cyls.forEach((c, k) => { const a = P[m.idx[c.a]], b = P[m.idx[c.b]]; r.push(Math.hypot(a[0] - b[0], a[1] - b[1]) - lens[k]); }); return r; };
    let r = res(X), e = r.reduce((s, x) => s + x * x, 0), lam = 1e-3;
    const n = 2 * nf;
    for (let it = 0; it < 60 && e > 1e-16; it++) {
      const J = []; const h = 1e-7;
      for (let c = 0; c < n; c++) { const Xh = X.slice(); Xh[c] += h; const rh = res(Xh); J.push(rh.map((v, i) => (v - r[i]) / h)); }
      const A = Array.from({ length: n }, () => new Array(n).fill(0)), bv = new Array(n).fill(0);
      for (let a = 0; a < n; a++) { for (let b = a; b < n; b++) { let s = 0; const Ja = J[a], Jb = J[b]; for (let i = 0; i < r.length; i++) s += Ja[i] * Jb[i]; A[a][b] = A[b][a] = s; } let s = 0; for (let i = 0; i < r.length; i++) s += J[a][i] * r[i]; bv[a] = -s; }
      let improved = false;
      for (let t = 0; t < 8; t++) {
        const M = A.map((row, i) => row.map((v, j) => i === j ? v * (1 + lam) + 1e-12 : v)), dx = gauss(M, bv.slice());
        if (!dx) { lam *= 10; continue; }
        const Xn = X.map((v, i) => v + dx[i]), rn = res(Xn), en = rn.reduce((s, x) => s + x * x, 0);
        if (en < e) { X.splice(0, n, ...Xn); r = rn; e = en; lam = Math.max(1e-9, lam / 5); improved = true; break; }
        lam *= 10;
      }
      if (!improved) break;
    }
    return { X, P: pos(X), err: Math.sqrt(e / Math.max(1, r.length)) };
  }
  function gauss(A, b) {
    const n = b.length;
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      if (Math.abs(A[p][c]) < 1e-14) return null;
      [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
      for (let r = c + 1; r < n; r++) { const k = A[r][c] / A[c][c]; if (!k) continue; for (let j = c; j < n; j++) A[r][j] -= k * A[c][j]; b[r] -= k * b[c]; }
    }
    const x = new Array(n);
    for (let r = n - 1; r >= 0; r--) { let s = b[r]; for (let j = r + 1; j < n; j++) s -= A[r][j] * x[j]; x[r] = s / A[r][r]; }
    return x;
  }
  const centroid = (m, P, b) => { let x = 0, y = 0; b.p.forEach(id => { const q = P[m.idx[id]]; x += q[0]; y += q[1]; }); return [x / b.p.length, y / b.p.length]; };
  const massList = (m, P) => m.bodies.filter(b => b.m > 0).map(b => [b.m, centroid(m, P, b)]).concat((m.extra || []).filter(e => e.m > 0 && m.idx[e.pt] !== undefined).map(e => [e.m, P[m.idx[e.pt]]]));

  // Bir pozda kapasite
  function solveC(m, lens, X, L0) {
    let S = solve(m, lens, X); if (S.err <= 1e-5 || !X || !L0) return S;
    for (const n of [3, 8, 20]) { // süreklilik: boyları adım adım değiştir
      let Xc = X, good = true;
      for (let i = 1; i <= n; i++) { const li = L0.map((l, k) => l + (lens[k] - l) * i / n); S = solve(m, li, Xc); if (S.err > 1e-5) { good = false; break; } Xc = S.X; }
      if (good) return S;
    }
    return S;
  }
  function evaluate(m, lens, X, pT, pH, L0) {
    const S = solveC(m, lens, X, L0); if (S.err > 1e-5) return null;
    const P = S.P, L = P[m.idx[m.load]], ms = massList(m, P);
    // devrilme
    const arm = L[0] - m.xe;
    const stab = m.M * (m.xe - m.xm) - ms.reduce((s, [mm, c]) => s + mm * (c[0] - m.xe), 0);
    const Wt = arm > 1e-6 ? stab / arm : Infinity;
    // her silindir için sanal iş
    const hyd = m.cyls.map((c, k) => {
      const h = 2e-4, lp = lens.slice(), lm = lens.slice(); lp[k] += h; lm[k] -= h;
      const Sp = solve(m, lp, S.X), Sm = solve(m, lm, S.X);
      if (Sp.err > 1e-5 || Sm.err > 1e-5) return { W: NaN };
      const dy = i => (Sp.P[i][1] - Sm.P[i][1]) / (2 * h);
      const a = dy(m.idx[m.load]);
      const msp = massList(m, Sp.P), msm = massList(m, Sm.P);
      const b = msp.reduce((s, [mm, cp], i) => s + mm * g * (cp[1] - msm[i][1][1]) / (2 * h), 0); // N, kütlelerin silindire yükü
      const F = cylF(c.D, c.d, c.p, c.n || 1);
      // gereken kuvvet (+ basma): Freq = W g a + b
      let W, need;
      if (Math.abs(a) < 1e-3) W = Infinity;
      else if (a > 0) W = (F.push - b) / (g * a);
      else W = (F.pull + b) / (g * -a);
      need = b; // yüksüz (yalnız ataşman) kuvvet
      return { W, a, need, F };
    });
    const Wh = Math.min(...hyd.map(x => isFinite(x.W) || x.W === Infinity ? x.W : Infinity));
    const lim = hyd.reduce((bi, x, i) => (x.W < (hyd[bi].W ?? Infinity) ? i : bi), 0);
    const rated = Math.min(pT * Wt, pH * Wh);
    return { S, P, L, Wt, Wh, hyd, lim, rated, stab };
  }

  let M = null, ext = [], pT = 0.75, pH = 0.87, tplId = 'ekskavator', lastX = null, lastL = null;
  const saveM = () => { H().store.set('kal.mech.' + tplId, { pts: M.pts.map(p => ({ id: p.id, x: p.x, y: p.y, g: p.g })), bodies: M.bodies.map(b => ({ ad: b.ad, p: b.p, m: b.m })), cyls: M.cyls.map(c => ({ ad: c.ad, a: c.a, b: c.b, D: c.D, d: c.d, n: c.n, p: c.p, s: c.s, e: c.e })), extra: M.extra, M: M.M, xm: M.xm, xe: M.xe, load: M.load, ext, pT, pH }); };
  function loadM(id, reset) {
    tplId = id; const base = TPL[id](), s = reset ? null : H().store.get('kal.mech.' + id, null);
    if (s) Object.assign(base, { pts: s.pts, bodies: s.bodies, cyls: s.cyls, extra: s.extra || [], M: s.M, xm: s.xm, xe: s.xe, load: s.load || base.load });
    M = prepare(base);
    ext = s && s.ext && s.ext.length === M.cyls.length ? s.ext : M.cyls.map(c => c.e ?? 0.5);
    const T = TYPES[M.tip] || TYPES.diger; pT = s && s.pT ? s.pT : T.pT / 100; pH = s && s.pH ? s.pH : T.pH / 100;
    lastX = null; lastL = null;
  }
  const lens = () => M.cyls.map((c, k) => c.Lmin + ext[k] * c.s);

  function svg(P, opts = {}) {
    const all = P.concat([[M.xe, 0], [M.xm, 0]]), xs = all.map(p => p[0]), ys = all.map(p => p[1]).concat([0]);
    const x0 = Math.min(...xs) - 0.5, x1 = Math.max(...xs) + 0.5, y0 = Math.min(...ys) - 0.4, y1 = Math.max(...ys) + 0.5;
    const W = 360, Hh = Math.max(180, Math.min(320, W * (y1 - y0) / (x1 - x0))), k = Math.min(W / (x1 - x0), Hh / (y1 - y0));
    const X = x => (x - x0) * k, Y = y => Hh - (y - y0) * k;
    let s = `<svg viewBox="0 0 ${W} ${Hh}" style="width:100%;max-height:340px;background:var(--surface);border:1px solid var(--line);border-radius:var(--r-s);touch-action:none">`;
    s += `<line x1="0" y1="${Y(0)}" x2="${W}" y2="${Y(0)}" stroke="var(--muted)" stroke-dasharray="4 3"/>`;
    s += `<path d="M${X(M.xe)} ${Y(0)} l-7 12 h14z" fill="var(--warn)"/><text x="${X(M.xe) + 9}" y="${Y(0) + 12}" font-size="10" fill="var(--muted)">devrilme kenarı</text>`;
    s += `<circle cx="${X(M.xm)}" cy="${Y(0) - 10}" r="5" fill="none" stroke="var(--ink)"/><text x="${X(M.xm) - 6}" y="${Y(0) - 18}" font-size="10" fill="var(--muted)">AM</text>`;
    const col = ['#2B6683', '#566771', '#8a6d1f', '#3c7a4a', '#7a3c6a'];
    M.bodies.forEach((b, bi) => { const q = b.p.map(id => P[M.idx[id]]); if (q.length === 2) s += `<line x1="${X(q[0][0])}" y1="${Y(q[0][1])}" x2="${X(q[1][0])}" y2="${Y(q[1][1])}" stroke="${col[bi % 5]}" stroke-width="4" stroke-linecap="round"/>`;
      else s += `<polygon points="${q.map(p => X(p[0]) + ',' + Y(p[1])).join(' ')}" fill="${col[bi % 5]}" fill-opacity=".18" stroke="${col[bi % 5]}" stroke-width="3" stroke-linejoin="round"/>`; });
    M.cyls.forEach((c, ci) => { const a = P[M.idx[c.a]], b = P[M.idx[c.b]]; s += `<line x1="${X(a[0])}" y1="${Y(a[1])}" x2="${X(b[0])}" y2="${Y(b[1])}" stroke="${opts.lim === ci ? 'var(--err)' : '#f2b705'}" stroke-width="7" stroke-linecap="round" opacity=".9"/><line x1="${X(a[0])}" y1="${Y(a[1])}" x2="${X(b[0])}" y2="${Y(b[1])}" stroke="#e6ebee" stroke-width="2"/>`; });
    M.pts.forEach((p, i) => { const q = P[i]; s += p.g ? `<rect x="${X(q[0]) - 4}" y="${Y(q[1]) - 4}" width="8" height="8" fill="var(--ink)"/>` : `<circle cx="${X(q[0])}" cy="${Y(q[1])}" r="3.2" fill="var(--paper)" stroke="var(--ink)"/>`;
      if (opts.labels) s += `<text x="${X(q[0]) + 5}" y="${Y(q[1]) - 5}" font-size="9" fill="var(--muted)">${esc(p.id)}</text>`; });
    const L = P[M.idx[M.load]]; s += `<path d="M${X(L[0])} ${Y(L[1]) + 4} v22 m-5 -6 l5 6 l5 -6" stroke="var(--err)" stroke-width="2" fill="none"/>`;
    if (opts.pts) opts.pts.forEach(([x, y, w, mx]) => { const t = Math.max(0, Math.min(1, w / mx)); s += `<circle cx="${X(x)}" cy="${Y(y)}" r="2.6" fill="hsl(${t * 120},70%,42%)"/>`; });
    return s + '</svg>';
  }

  function mech(root) {
    if (!M) loadM(H().store.get('kal.tpl', 'ekskavator'));
    root.innerHTML = `<div class="grid"><label class="f" style="grid-column:1/-1"><span>Şablon</span><div class="in"><select id="kmT">${TPL_NAMES.map(([k, n]) => `<option value="${k}"${k === tplId ? ' selected' : ''}>${n}</option>`).join('')}</select></div></label></div>
      <p class="note" id="kmAd"></p><div id="kmSvg"></div><div id="kmSl"></div><div id="kmOut"></div>
      <div class="row" style="margin-top:10px"><button class="btn tape" id="kmSweep">Kaldırma tablosu çıkar</button><button class="btn ghost" id="kmRst">Şablona dön</button></div><div id="kmTab"></div>
      <details style="margin-top:12px"><summary>Ölçüleri düzenle (kendi makineniz)</summary><div id="kmEd"></div></details>
      <p class="note">Şablon ölçüleri örnektir; gerçek makine için pim koordinatlarını (yan görünüşten, metre) ve silindir verilerini girin. Silindir kaydırıcıları stroktaki konumu (% açıklık) gösterir. Sonuçlar ön hesaptır; kaldırma işlerinde üreticinin yük tablosu ve yetkili muayene esastır.</p>`;
    $('#kmT').onchange = () => { saveM(); loadM($('#kmT').value); H().store.set('kal.tpl', tplId); mech(root); };
    $('#kmRst').onclick = async () => { if (await H().ask('Bu şablondaki ölçüler varsayılana dönsün mü?')) { loadM(tplId, true); saveM(); mech(root); } };
    $('#kmSweep').onclick = () => sweep();
    sliders(); editor(); draw();
  }
  function sliders() {
    $('#kmSl').innerHTML = M.cyls.map((c, k) => `<label class="f" style="margin-top:6px"><span>${esc(c.ad)} — <b data-sv="${k}"></b></span><input type="range" min="0" max="1000" value="${Math.round(ext[k] * 1000)}" data-sl="${k}" style="width:100%"></label>`).join('') +
      `<div class="grid" style="margin-top:6px"><label class="f"><span>Devrilme oranı</span><div class="in"><input type="number" inputmode="decimal" id="kmPT" value="${f(pT * 100)}"><em>%</em></div></label><label class="f"><span>Hidrolik oranı</span><div class="in"><input type="number" inputmode="decimal" id="kmPH" value="${f(pH * 100)}"><em>%</em></div></label></div>`;
    $('#kmSl').querySelectorAll('[data-sl]').forEach(i => i.oninput = () => { ext[+i.dataset.sl] = i.value / 1000; draw(); });
    $('#kmSl').querySelectorAll('[data-sl]').forEach(i => i.onchange = saveM);
    $('#kmPT').oninput = () => { const v = num($('#kmPT').value); if (ok(v)) { pT = v / 100; draw(); saveM(); } };
    $('#kmPH').oninput = () => { const v = num($('#kmPH').value); if (ok(v)) { pH = v / 100; draw(); saveM(); } };
  }
  function draw() {
    $('#kmAd').textContent = M.ad + ' · ' + (TYPES[M.tip] || TYPES.diger).ad;
    const ls = lens();
    M.cyls.forEach((c, k) => { const e = $(`[data-sv="${k}"]`); if (e) e.textContent = `%${f(ext[k] * 100)} açık, boy ${f(ls[k] * 1000)} mm`; });
    const R = evaluate(M, ls, lastX, pT, pH, lastL);
    if (!R) { $('#kmOut').innerHTML = warnP('Bu silindir boylarında mekanizma kapanmıyor (ulaşılamayan konum). Kaydırıcıları değiştirin ya da ölçüleri kontrol edin.'); return; }
    lastX = R.S.X; lastL = ls;
    $('#kmSvg').innerHTML = svg(R.P, { lim: R.rated === pH * R.Wh ? R.lim : -1, labels: true });
    const limBy = pT * R.Wt <= pH * R.Wh ? 'devrilme' : 'hidrolik: ' + M.cyls[R.lim].ad.toLowerCase();
    $('#kmOut').innerHTML = `<div class="plate" style="margin-top:10px"><div class="lbl">İzin verilen yük (bu konumda, ${esc(M.load)} noktasında)</div><div class="big">${kg(R.rated)}</div>
      <div class="sub"><span>Yarıçap <b>${f(R.L[0], 2)} m</b></span><span>Yükseklik <b>${f(R.L[1], 2)} m</b></span><span>Sınırlayan <b>${esc(limBy)}</b></span></div></div>
      <div class="tw"><table><tbody><tr><td>Devrilme yükü</td><td>${kg(R.Wt)} → %${f(pT * 100)}: ${kg(pT * R.Wt)}</td></tr>
      ${R.hyd.map((h, k) => `<tr><td>${esc(M.cyls[k].ad)} (Ø${M.cyls[k].D}/Ø${M.cyls[k].d}${M.cyls[k].n > 1 ? ' ×' + M.cyls[k].n : ''}, ${M.cyls[k].p} bar)</td><td>${isNaN(h.W) ? '—' : kg(h.W)}${isFinite(h.W) && h.W > 0 ? ` → %${f(pH * 100)}: ${kg(pH * h.W)}` : ''}<br><small>Yüksüzken silindir kuvveti ${f(Math.abs(h.need || 0) / 1000, 1)} kN ${h.need > 0 ? 'basma' : 'çekme'}</small></td></tr>`).join('')}
      </tbody></table></div>`;
  }
  function editor() {
    const inp = (k, v, w = 70) => `<input data-e="${k}" value="${v}" inputmode="decimal" style="width:${w}px">`;
    $('#kmEd').innerHTML = `<h3>Makine</h3><div class="grid">
      <label class="f"><span>Makine kütlesi (kol, kova hariç)</span><div class="in">${inp('M', M.M, 110)}<em>kg</em></div></label>
      <label class="f"><span>Makine ağırlık merkezi x</span><div class="in">${inp('xm', M.xm, 90)}<em>m</em></div></label>
      <label class="f"><span>Devrilme kenarı x</span><div class="in">${inp('xe', M.xe, 90)}<em>m</em></div><small>Ekskavatörde önden: ön avare tekeri; yandan: palet orta hattı (genişlik/2). Loder: ön aks. Platform: destek ayağı.</small></label>
      <label class="f"><span>Yük noktası</span><div class="in"><select data-e="load">${M.pts.map(p => `<option${p.id === M.load ? ' selected' : ''}>${esc(p.id)}</option>`).join('')}</select></div></label></div>
      <h3>Pimler (x, y metre; kare = gövdeye sabit)</h3><div class="tw"><table><thead><tr><th>Ad</th><th>x</th><th>y</th><th>Sabit</th></tr></thead><tbody>${M.pts.map((p, i) => `<tr><td>${esc(p.id)}</td><td>${inp('px' + i, p.x)}</td><td>${inp('py' + i, p.y)}</td><td><input type="checkbox" data-e="pg${i}"${p.g ? ' checked' : ''}></td></tr>`).join('')}</tbody></table></div>
      <h3>Silindirler</h3><div class="tw"><table><thead><tr><th>Ad</th><th>Piston Ø</th><th>Mil Ø</th><th>Adet</th><th>Basınç bar</th><th>Strok m</th><th>Kapalı boy m</th></tr></thead><tbody>${M.cyls.map((c, i) => `<tr><td>${esc(c.ad)}<br><small>${esc(c.a)}–${esc(c.b)}</small></td><td>${inp('cD' + i, c.D, 55)}</td><td>${inp('cd' + i, c.d, 55)}</td><td>${inp('cn' + i, c.n || 1, 40)}</td><td>${inp('cp' + i, c.p, 55)}</td><td>${inp('cs' + i, c.s, 55)}</td><td>${inp('cL' + i, +c.Lmin.toFixed(3), 60)}</td></tr>`).join('')}</tbody></table></div>
      <h3>Kütleler</h3><div class="tw"><table><thead><tr><th>Parça</th><th>kg</th></tr></thead><tbody>${M.bodies.map((b, i) => `<tr><td>${esc(b.ad)}</td><td>${inp('bm' + i, b.m, 80)}</td></tr>`).join('')}${(M.extra || []).map((e, i) => `<tr><td>${esc(e.ad)} (${esc(e.pt)})</td><td>${inp('xm' + i, e.m, 80)}</td></tr>`).join('')}</tbody></table></div>
      <p class="note">Kova değişiminin etkisi: "Kova" kütlesini değiştirin. Pim koordinatları değişince gövde ölçüleri yeni koordinatlardan alınır ve mekanizma bu pozdan yeniden kurulur.</p>
      <div class="row"><button class="btn" id="kmApply">Ölçüleri uygula</button></div>`;
    $('#kmApply').onclick = () => {
      const v = k => num($(`[data-e="${k}"]`).value);
      ['M', 'xm', 'xe'].forEach(k => { const x = v(k); if (isFinite(x)) M[k] = x; }); M.load = $('[data-e="load"]').value;
      M.pts.forEach((p, i) => { const x = v('px' + i), y = v('py' + i); if (isFinite(x)) p.x = x; if (isFinite(y)) p.y = y; p.g = $(`[data-e="pg${i}"]`).checked; });
      M.cyls.forEach((c, i) => { ['D', 'd', 'n', 'p', 's'].forEach(k => { const x = v('c' + k + i); if (ok(x)) c[k] = x; }); const L = v('cL' + i); if (ok(L)) c.Lmin = L; delete c.L0; });
      M.bodies.forEach((b, i) => { const x = v('bm' + i); if (isFinite(x)) b.m = x; }); (M.extra || []).forEach((e, i) => { const x = v('xm' + i); if (isFinite(x)) e.m = x; });
      // yeni pozdan kur; silindir açıklığını pozdaki boydan bul
      const lmin = M.cyls.map(c => c.Lmin); M = prepare(M); M.cyls.forEach((c, i) => { c.Lmin = lmin[i]; ext[i] = Math.max(0, Math.min(1, (c.L0 - c.Lmin) / c.s)); c.e = ext[i]; });
      lastX = null; lastL = null; saveM(); sliders(); draw(); H().toast('Ölçüler uygulandı');
      if (M.cyls.some(c => c.L0 < c.Lmin - 1e-3 || c.L0 > c.Lmin + c.s + 1e-3)) H().toast('Uyarı: pozdaki silindir boyu strok dışında');
    };
  }
  function sweep() {
    const out = $('#kmTab'); out.innerHTML = '<p class="note">Hesaplanıyor…</p>';
    setTimeout(() => {
      const nC = Math.min(2, M.cyls.length), N = nC === 1 ? 40 : 16, pts = [];
      const base = ext.slice(); let Xr = lastX, Lr = lastL;
      for (let i = 0; i <= N; i++) {
        let Xc = Xr, Lc = Lr;
        for (let j = 0; j <= (nC === 2 ? N : 0); j++) {
          const e = base.slice(); e[0] = i / N; if (nC === 2) e[1] = (i % 2 ? N - j : j) / N;
          const ls = M.cyls.map((c, k) => c.Lmin + e[k] * c.s), R = evaluate(M, ls, Xc, pT, pH, Lc);
          if (!R) continue; Xc = R.S.X; Lc = ls; if (j === 0) { Xr = R.S.X; Lr = ls; }
          pts.push([R.L[0], R.L[1], Math.max(0, R.rated), R.rated === pT * R.Wt ? 'D' : 'H']);
        }
      }
      if (!pts.length) { out.innerHTML = warnP('Tarama yapılamadı.'); return; }
      const mx = Math.max(...pts.map(p => isFinite(p[2]) ? p[2] : 0));
      const R0 = evaluate(M, lens(), lastX, pT, pH, lastL);
      // ızgara: yükseklik × yarıçap
      const st = M.tip === 'ekskavator' || M.tip === 'platform' ? 1.5 : 1.0;
      const rs = [], hs = [], xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      for (let r = Math.ceil(Math.max(M.xe + 0.01, Math.min(...xs)) / st) * st; r <= Math.max(...xs) + 1e-9; r += st) rs.push(+r.toFixed(2));
      for (let h = Math.floor(Math.max(...ys) / st) * st; h >= Math.min(...ys) - 1e-9; h -= st) hs.push(+h.toFixed(2));
      const tol = st * 0.3;
      const cell = (r, h) => { let best = -1, lim = ''; for (const p of pts) if (Math.abs(p[0] - r) <= tol && Math.abs(p[1] - h) <= tol && p[2] > best) { best = p[2]; lim = p[3]; } return best < 0 ? '' : `${f(best, 0)}${lim === 'H' ? '*' : ''}`; };
      const rows = hs.map(h => [`<b>${f(h, 1)} m</b>`].concat(rs.map(r => cell(r, h)))).filter(r => r.slice(1).some(Boolean));
      const maxR = pts.reduce((b, p) => p[0] > b[0] ? p : b, pts[0]);
      out.innerHTML = (R0 ? svg(R0.P, { pts: pts.map(p => [p[0], p[1], p[2], mx]) }) : '') +
        `<p class="note">Renk: kırmızı = düşük, yeşil = yüksek kapasite. Taranan: ${esc(M.cyls[0].ad)}${nC === 2 ? ' ve ' + esc(M.cyls[1].ad) : ''} tüm strok; diğer silindirler mevcut konumda.</p>` +
        `<h3>Kaldırma tablosu (kg, ${esc(M.load)} noktasında)</h3><div class="tw"><table><thead><tr><th>Yükseklik \\ Yarıçap</th>${rs.map(r => `<th>${f(r, 1)} m</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <p class="note">* hidrolik sınırlı, diğerleri devrilme sınırlı. En uzak erişim: ${f(maxR[0], 2)} m yarıçapta ${f(maxR[1], 2)} m yükseklik, ${f(maxR[2], 0)} kg. Değerler devrilme %${f(pT * 100)} ve hidrolik %${f(pH * 100)} oranlarıyla hesaplanmıştır.</p>`;
    }, 30);
  }

  /* ================= Giriş ================= */
  function render(root, host) {
    H = host;
    const mode = H().store.get('kal.mode', 'quick');
    root.innerHTML = `<div class="seg" id="kalSeg" style="grid-template-columns:1fr 1fr;margin-bottom:12px"><button data-m="quick" aria-pressed="${mode === 'quick'}">Hızlı hesap</button><button data-m="mech" aria-pressed="${mode === 'mech'}">Mekanizma</button></div><div id="kalBody"></div>`;
    root.querySelectorAll('#kalSeg button').forEach(b => b.onclick = () => { H().store.set('kal.mode', b.dataset.m); render(root, host); });
    (mode === 'mech' ? mech : quick)($('#kalBody'));
  }
  window.TornalyKaldirma = { render, _t: { TPL, prepare, solve, evaluate, cylF } };
})();
