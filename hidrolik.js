/* Tornaly – Hidrolik sekmesi: silindir, hortum, pompa/motor, pim-burç, tank/akümülatör, rehberler,
   servis teklifleri (revizyon, hortum imalat, kova), test raporu + QR etiket, bakım/garanti, yağ temizliği, valf, birim çevirici.
   Hesaplar telefonda yapılır; hiçbir veri dışarı gönderilmez. Sonuçlar ön hesaptır. */
(function () {
  'use strict';
  const H = () => window.TornalyHost;
  const $ = s => document.querySelector(s);
  const PI = Math.PI;
  const f = (n, d = 1) => H().fmt(n, d);
  const tl = n => H().tl(n);
  const esc = s => H().esc(s);
  const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : NaN; };
  const ok = v => isFinite(v) && v > 0;

  /* ================= Standart veriler ================= */
  const BORES = [25, 32, 40, 50, 63, 80, 100, 125, 140, 160, 180, 200, 220, 250, 280, 320, 360, 400];
  const RODS = [12, 14, 16, 18, 20, 22, 25, 28, 32, 36, 40, 45, 50, 56, 63, 70, 80, 90, 100, 110, 125, 140, 160, 180, 200, 220, 250, 280, 320, 360];
  // Hortum tabloları (tipik üretici katalog değerleri; EN 853 / EN 856 / SAE J517). [DN, iç Ø mm, çalışma basıncı bar, min. bükülme yarıçapı mm]
  const HOSES = {
    '1SN': { std: 'EN 853 1SN', rows: [[6, 6.4, 225, 100], [8, 7.9, 215, 115], [10, 9.5, 180, 130], [12, 12.7, 160, 180], [16, 15.9, 130, 200], [19, 19.0, 105, 240], [25, 25.4, 88, 300], [31, 31.8, 63, 420], [38, 38.1, 50, 500], [51, 50.8, 40, 630]] },
    '2SN': { std: 'EN 853 2SN', rows: [[6, 6.4, 400, 100], [8, 7.9, 350, 115], [10, 9.5, 330, 130], [12, 12.7, 275, 180], [16, 15.9, 250, 200], [19, 19.0, 215, 240], [25, 25.4, 165, 300], [31, 31.8, 125, 420], [38, 38.1, 90, 500], [51, 50.8, 80, 630]] },
    '4SP': { std: 'EN 856 4SP', rows: [[6, 6.4, 450, 150], [10, 9.5, 445, 180], [12, 12.7, 415, 230], [16, 15.9, 350, 250], [19, 19.0, 350, 300], [25, 25.4, 280, 340], [31, 31.8, 210, 420]] },
    '4SH': { std: 'EN 856 4SH', rows: [[19, 19.0, 420, 280], [25, 25.4, 380, 340], [31, 31.8, 325, 460], [38, 38.1, 290, 560], [51, 50.8, 250, 700]] },
    'R13': { std: 'SAE 100R13', rows: [[19, 19.0, 345, 240], [25, 25.4, 345, 300], [31, 31.8, 345, 420], [38, 38.1, 345, 500], [51, 50.8, 345, 640]] },
    'R15': { std: 'SAE 100R15', rows: [[10, 9.5, 414, 150], [12, 12.7, 414, 200], [19, 19.0, 414, 265], [25, 25.4, 414, 330], [31, 31.8, 414, 445], [38, 38.1, 414, 530]] },
  };
  const HOSE_ORDER = ['1SN', '2SN', '4SP', '4SH', 'R13', 'R15'];
  const MOTORS = [0.37, 0.55, 0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75, 90, 110, 132, 160, 200, 250, 315];
  const ACCU = [0.16, 0.32, 0.7, 1, 1.4, 2.5, 4, 5, 6, 10, 13, 20, 24, 32, 50];
  const VALVES = [['NG6 / CETOP 3', 80], ['NG10 / CETOP 5', 160], ['NG16 / CETOP 7', 300], ['NG25 / CETOP 8', 650], ['NG32 / CETOP 10', 1100]];

  /* ================= Fiyatlar (Ayarlar'dan bağımsız, hidroliğe özel) ================= */
  const DEF_PRICES = {
    honBoru: [2.4, 'EUR', 'Honlanmış boru (ST52)', '/kg'], kromMil: [2.7, 'EUR', 'Krom kaplı mil (CK45)', '/kg'], celik: [42, 'TL', 'Kafa, piston, göz çeliği (C45)', '/kg'],
    hardox: [3.6, 'EUR', 'Aşınma sacı (Hardox 450 vb.)', '/kg'], st52: [38, 'TL', 'Yapı sacı (S355)', '/kg'],
    keceA: [8, 'EUR', 'Keçe seti sabit kısım', '/set'], keceB: [0.35, 'EUR', 'Keçe seti, piston çapı başına', '/mm'],
    honlama: [6, 'TL', 'Honlama (çap × boy)', '/(mm·m)'], krom: [180, 'TL', 'Mil krom kaplama', '/dm²'],
    kaynak: [1100, 'TL', 'Kaynak saat ücreti', '/saat'], montaj: [900, 'TL', 'Montaj / söküm saat ücreti', '/saat'],
    test: [450, 'TL', 'Basınç testi', '/adet'], boya: [150, 'TL', 'Boya', '/m²'],
    hortumK: [0.26, 'EUR', '2SN hortum fiyat katsayısı (DN başına)', '/m·DN'], rakorA: [1.2, 'EUR', 'Pres rakor sabit kısım', '/adet'], rakorB: [0.12, 'EUR', 'Pres rakor, DN başına', '/adet·DN'],
    presleme: [40, 'TL', 'Presleme işçiliği', '/uç'], spiral: [35, 'TL', 'Spiral koruma', '/m'],
    dis: [9, 'EUR', 'Kova dişi', '/adet'], adaptor: [14, 'EUR', 'Diş adaptörü', '/adet'],
  };
  const HOSE_MULT = { '1SN': 0.7, '2SN': 1, '4SP': 1.75, '4SH': 2.1, 'R13': 2.3, 'R15': 2.6 };
  function prices() {
    const s = H().store.get('hyd.prices', {}), o = {};
    for (const k in DEF_PRICES) o[k] = s[k] ? { v: s[k][0], cur: s[k][1] } : { v: DEF_PRICES[k][0], cur: DEF_PRICES[k][1] };
    return o;
  }
  const P = k => { const p = prices()[k]; return H().toTL(p.v, p.cur); };
  const rate = k => H().prof().rates[k] || 0;
  const kFactor = () => { const pr = H().prof(); return (1 + pr.overhead / 100) * (1 + pr.profit / 100); };

  /* ================= Form yardımcıları ================= */
  const saved = id => H().store.get('hyd.in.' + id, {});
  function form(id, fields, cb) {
    const s = saved(id), vals = {};
    const html = fields.map(fd => {
      if (fd.h) return `<h3 style="grid-column:1/-1;margin:6px 0 0">${esc(fd.h)}</h3>`;
      if (fd.note) return `<p class="note" style="grid-column:1/-1;margin:0">${fd.note}</p>`;
      const v = s[fd.k] ?? fd.d; vals[fd.k] = fd.opts ? v : num(v);
      if (fd.opts) return `<label class="f"${fd.wide ? ' style="grid-column:1/-1"' : ''}><span>${esc(fd.l)}</span><div class="in"><select data-hk="${fd.k}">${fd.opts.map(([ov, ol]) => `<option value="${esc(ov)}"${String(ov) === String(v) ? ' selected' : ''}>${esc(ol)}</option>`).join('')}</select></div>${fd.hint ? `<small>${fd.hint}</small>` : ''}</label>`;
      if (fd.text) return `<label class="f"${fd.wide ? ' style="grid-column:1/-1"' : ''}><span>${esc(fd.l)}</span><div class="in"><input data-hk="${fd.k}" data-txt="1" value="${esc(v ?? '')}"></div></label>`;
      return `<label class="f"><span>${esc(fd.l)}</span><div class="in"><input type="number" inputmode="decimal" data-hk="${fd.k}" value="${v ?? ''}">${fd.u ? `<em>${esc(fd.u)}</em>` : ''}</div>${fd.hint ? `<small>${fd.hint}</small>` : ''}</label>`;
    }).join('');
    return {
      html: `<div class="grid">${html}</div>`,
      bind(root) {
        const all = {}; fields.forEach(fd => { if (fd.k) all[fd.k] = fd; });
        const read = () => { const o = {}; root.querySelectorAll('[data-hk]').forEach(i => { const fd = all[i.dataset.hk]; o[i.dataset.hk] = fd && (fd.opts || fd.text) ? i.value : num(i.value); }); return o; };
        const go = () => { const o = read(); const st = {}; root.querySelectorAll('[data-hk]').forEach(i => { st[i.dataset.hk] = i.value; }); H().store.set('hyd.in.' + id, st); cb(o); };
        root.querySelectorAll('[data-hk]').forEach(i => { i.oninput = go; i.onchange = go; });
        go();
      }
    };
  }
  const table = (head, rows, cls = '') => `<div class="tw"><table class="${cls}">${head ? `<thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead>` : ''}<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const kv = rows => table(null, rows.map(([a, b]) => [esc(a), b]));
  const badge = (good, t) => `<b style="color:${good ? 'var(--steel)' : 'var(--err)'}">${good ? '✓' : '✗'} ${t}</b>`;
  const warnP = t => `<p class="note" style="color:var(--warn)">${t}</p>`;
  // Araçlar arası bağlantı: son silindir (ctx) ve "Sonraki adım" düğmeleri
  const ctx = () => H().store.get('hyd.ctx', null);
  const nextBar = items => `<h3>Sonraki adım</h3><div class="row hynext">${items.map(([l], i) => `<button class="btn" data-nx="${i}">${l}</button>`).join('')}</div>`;
  const bindNext = (root, items) => root.querySelectorAll('[data-nx]').forEach(b => b.onclick = () => items[+b.dataset.nx][1]());
  const S_ = o => { const r = {}; for (const k in o) if (o[k] !== undefined && o[k] !== null && !(typeof o[k] === 'number' && !isFinite(o[k]))) r[k] = String(typeof o[k] === 'number' ? +o[k].toFixed(3) : o[k]); return r; };
  const LINKS = {
    hortum: c => ({ Q: c.Q, p: c.p, hat: 'basinc' }), hiz: c => ({ D: c.D, d: c.d, s: c.s, Q: c.Q }),
    pompa: c => ({ p: c.p, V: c.Q ? Math.ceil(c.Q * 1000 / (1450 * 0.92)) : undefined, n: 1450 }),
    pim: c => ({ F: Math.ceil(c.F / 1000) }), valf: c => ({ Q: c.Q ? Math.ceil(c.Q * c.phi) : undefined }), tank: c => ({ Q: c.Q }),
    revizyon: c => ({ D: c.D, d: c.d, s: c.s }), test: c => ({ tanim: c.ad, pw: c.p, tip: '1.5' }),
  };

  /* ================= Teklif üretme ================= */
  function serviceQuote({ title, part, meta, lines, qty = 1, mat = '-', shot = '' }) {
    const k = kFactor(), piece = lines.reduce((s, l) => s + l[1], 0), vatPct = H().prof().vat;
    const unit = piece * k, now = new Date(), pad = n => String(n).padStart(2, '0');
    return {
      no: `T-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`,
      date: now.toLocaleDateString('tr-TR'), proc: title, mat, partKg: null, dims: '', meta, part,
      rows: [{ q: qty, unit, total: unit * qty, vat: unit * qty * vatPct / 100 }],
      lines, batch: [], vatPct, shot, forceBreak: true, kind: 'hyd'
    };
  }

  /* ================= 3B (silindir) ================= */
  let r3 = null;
  function cyl3D(host, g) {
    if (typeof THREE === 'undefined') { host.innerHTML = '<p class="note">3B görüntü bu cihazda açılamadı.</p>'; return; }
    if (!r3) {
      const cv = document.createElement('canvas'); cv.style.cssText = 'width:100%;height:240px;display:block;touch-action:none';
      const R = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
      R.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 1, 1e6);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x56656e, 1.0));
      const dl = new THREE.DirectionalLight(0xffffff, 0.7); dl.position.set(1, 1.5, 1); scene.add(dl);
      r3 = { cv, R, scene, cam, grp: null, th: 0.6, ph: 1.2, r: 1000 };
      let last = null;
      cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); last = [e.clientX, e.clientY]; });
      cv.addEventListener('pointermove', e => { if (!last) return; r3.th -= (e.clientX - last[0]) * 0.01; r3.ph = Math.max(0.2, Math.min(2.9, r3.ph - (e.clientY - last[1]) * 0.01)); last = [e.clientX, e.clientY]; place(); });
      cv.addEventListener('pointerup', () => { last = null; });
    }
    host.innerHTML = ''; host.appendChild(r3.cv);
    const { scene } = r3;
    if (r3.grp) { scene.remove(r3.grp); r3.grp.traverse(o => o.geometry && o.geometry.dispose()); }
    const grp = new THREE.Group(), mS = new THREE.MeshStandardMaterial({ color: 0x8a99a3, metalness: 0.35, roughness: 0.5 }),
      mC = new THREE.MeshStandardMaterial({ color: 0xe6ebee, metalness: 0.9, roughness: 0.15 }), mP = new THREE.MeshStandardMaterial({ color: 0xf2b705, metalness: 0.2, roughness: 0.6 });
    const lathe = (pts, mat) => { const m = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 64), mat); return m; };
    const { D, OD, d, Lt, ext, eye } = g;
    // gövde (boru, dış yüzey), dip kapak ve kafa
    grp.add(lathe([[D / 2, 0], [OD / 2, 0], [OD / 2, Lt], [D / 2, Lt]], mP));
    grp.add(lathe([[0, -0.25 * D], [OD / 2, -0.25 * D], [OD / 2, 0], [0, 0]], mS));
    grp.add(lathe([[d / 2, Lt], [OD / 2 * 0.97, Lt], [OD / 2 * 0.97, Lt + 0.35 * D], [d / 2, Lt + 0.35 * D]], mS));
    grp.add(lathe([[0, Lt - 0.05 * D], [d / 2, Lt - 0.05 * D], [d / 2, Lt + 0.35 * D + ext], [0, Lt + 0.35 * D + ext]], mC));
    // gözler
    const eyeG = (y, w) => { const m = new THREE.Mesh(new THREE.TorusGeometry(eye * 0.75, eye * 0.45, 16, 40), mS); m.position.set(0, y, 0); m.scale.set(1, 1, w / (eye * 0.9)); return m; };
    grp.add(eyeG(-0.25 * D - eye * 0.8, OD * 0.6));
    grp.add(eyeG(Lt + 0.35 * D + ext + eye * 0.8, d * 0.9));
    grp.rotation.z = -PI / 2; grp.position.x = -(Lt + ext) / 2;
    scene.add(grp); r3.grp = grp;
    const len = Lt + ext + 0.6 * D + 3 * eye; r3.r = len * 1.25;
    place();
  }
  function place() {
    if (!r3) return;
    const w = r3.cv.clientWidth || 320, h = r3.cv.clientHeight || 240;
    r3.R.setSize(w, h, false); r3.cam.aspect = w / h; r3.cam.near = r3.r / 100; r3.cam.far = r3.r * 10; r3.cam.updateProjectionMatrix();
    r3.cam.position.set(r3.r * Math.sin(r3.ph) * Math.sin(r3.th), r3.r * Math.cos(r3.ph), r3.r * Math.sin(r3.ph) * Math.cos(r3.th));
    r3.cam.lookAt(0, 0, 0); r3.R.render(r3.scene, r3.cam);
  }
  const snap3 = () => { if (!r3 || !r3.grp) return ''; r3.R.setClearColor(0xffffff, 1); r3.R.render(r3.scene, r3.cam); const u = r3.cv.toDataURL('image/jpeg', 0.8); r3.R.setClearColor(0x000000, 0); r3.R.render(r3.scene, r3.cam); return u; };

  /* ================= Hesaplar ================= */
  const nextIn = (arr, v) => arr.find(x => x >= v - 1e-9) || null;
  const nearest = (arr, v) => arr.reduce((b, x) => Math.abs(x - v) < Math.abs(b - v) ? x : b, arr[0]);
  function buckling(d, Lk, Fpush, S) {
    const E = 210000, A = PI * d * d / 4, I = PI * d ** 4 / 64, lam = 4 * Lk / d;
    let Fk, how;
    if (lam >= 89) { Fk = PI * PI * E * I / (Lk * Lk); how = 'Euler'; } else { Fk = (335 - 0.62 * lam) * A; how = 'Tetmajer'; }
    return { Fk, Fallow: Fk / S, lam, how, ok: Fpush <= Fk / S };
  }

  const TOOLS = [];
  const tool = (id, grp, title, desc, render) => TOOLS.push({ id, grp, title, desc, render });

  /* ---------- 1. Silindir hesabı ---------- */
  tool('silindir', 'Hesap', 'Hidrolik silindir', 'Yük ve basınçtan çap, mil, burkulma, boru et kalınlığı, 3B ve maliyet', root => {
    const F = form('silindir', [
      { k: 'mode', l: 'Hesap şekli', opts: [['yuk', 'Yük ve basınç verildi → çap bul'], ['cap', 'Çap verildi → kuvvet bul']], d: 'yuk', wide: true },
      { k: 'yuk', l: 'Kaldırılacak / itilecek yük', u: 'ton', d: 10 }, { k: 'strok', l: 'Strok', u: 'mm', d: 500 },
      { k: 'yer', l: 'Kullanım yeri (basınç önerisi)', opts: [['250', 'İş makinesi, kepçe, vinç → 250 bar'], ['210', 'Kaldırma platformu, forklift → 210 bar'], ['200', 'Tarım makinesi, römork → 200 bar'], ['180', 'Damper → 180 bar'], ['160', 'Sanayi makinesi → 160 bar'], ['250p', 'Hidrolik pres → 250 bar']], d: '250', wide: true },
      { k: 'p', l: 'Çalışma basıncı (0 = öneri)', u: 'bar', d: 0 }, { k: 'tSure', l: 'İstenen çıkış süresi (0 = debiden)', u: 's', d: 0 },
      { k: 'D0', l: 'Piston çapı (çap verildiyse)', u: 'mm', d: 100 }, { k: 'phi', l: 'Alan oranı (piston/halka)', opts: [['1.25', '1,25'], ['1.4', '1,4'], ['1.6', '1,6'], ['2', '2,0']], d: '1.6' },
      { k: 'd0', l: 'Mil çapı (0 = otomatik)', u: 'mm', d: 0 },
      { k: 'kapali', l: 'Kapalı boy, göz-göz (0 = tahmini)', u: 'mm', d: 0 }, { k: 'eta', l: 'Mekanik verim', u: '%', d: 90 },
      { k: 'euler', l: 'Bağlantı (burkulma durumu)', opts: [['1', 'Göz – göz (iki uç mafsallı)'], ['0.7', 'Flanş – göz (bir uç ankastre)'], ['2', 'Bir uç ankastre, diğeri serbest'], ['0.5', 'İki uç ankastre']], d: '1', wide: true },
      { k: 'Sk', l: 'Burkulma emniyet katsayısı', u: '', d: 3.5 }, { k: 'Re', l: 'Boru akma dayanımı', u: 'MPa', d: 355 },
      { k: 'St', l: 'Boru emniyet katsayısı', u: '', d: 2 }, { k: 'Q', l: 'Pompa debisi (süre 0 ise)', u: 'l/dk', d: 60 },
      { h: 'Maliyet' }, { k: 'adet', l: 'Adet', u: '', d: 1 }, { k: 'hIs', l: 'Talaşlı işleme (0 = tahmini)', u: 'saat', d: 0 },
      { k: 'hKa', l: 'Kaynak (0 = tahmini)', u: 'saat', d: 0 }, { k: 'hMo', l: 'Montaj + test (0 = tahmini)', u: 'saat', d: 0 },
    ], v => calc(v));
    root.innerHTML = '<div id="hy3d" style="margin-bottom:6px"></div><div id="hyHead"></div>' + F.html + '<div id="hyOut"></div><div id="hyNext"></div>';
    let last = null;
    function calc(v) {
      const p = ok(v.p) ? v.p : parseFloat(v.yer) || 250, pM = p / 10, eta = (ok(v.eta) ? v.eta : 90) / 100, phi = num(v.phi) || 1.6, out = $('#hyOut');
      if (!ok(p)) { out.innerHTML = warnP('Basıncı girin.'); return; }
      let D, Freq = ok(v.yuk) ? v.yuk * 9806.65 : 0, Dreq = 0;
      if (v.mode === 'yuk') { if (!ok(Freq)) { out.innerHTML = warnP('Yükü girin.'); return; } Dreq = Math.sqrt(4 * Freq / (PI * pM * eta)); D = nextIn(BORES, Dreq); if (!D) { out.innerHTML = warnP('Gereken çap Ø400 mm\'yi aşıyor; basıncı artırın ya da birden fazla silindir kullanın.'); return; } }
      else { D = v.D0; if (!ok(D)) { out.innerHTML = warnP('Piston çapını girin.'); return; } }
      const d = ok(v.d0) ? v.d0 : nearest(RODS.filter(x => x < D * 0.8), D * Math.sqrt(1 - 1 / phi));
      const A = PI * D * D / 4, Aa = PI * (D * D - d * d) / 4, Fp = pM * A * eta, Fc = pM * Aa * eta;
      const s = Math.max(0, D / 2 * (Math.sqrt(((v.Re / v.St) + pM) / ((v.Re / v.St) - pM)) - 1));
      const sOk = (v.Re / v.St) > pM;
      const OD = Math.ceil(D + 2 * Math.max(s, 0.06 * D, 5));
      const stroke = ok(v.strok) ? v.strok : 0, closed = ok(v.kapali) ? v.kapali : Math.round(stroke + 0.9 * D + 120);
      const Lext = closed + stroke, K = num(v.euler) || 1, Lk = K * Lext;
      const Fload = v.mode === 'yuk' ? Freq : Fp;
      const bk = buckling(d, Lk, Fload, ok(v.Sk) ? v.Sk : 3.5);
      const dMinB = (() => { for (const r of RODS) { if (r >= D) break; if (buckling(r, Lk, Fload, ok(v.Sk) ? v.Sk : 3.5).ok) return r; } return null; })();
      const Qt = ok(v.tSure) && stroke ? A * stroke / 1e6 / v.tSure * 60 : 0, Q = Qt || v.Q, vo = ok(Q) ? Q * 1e6 / 60 / A / 1000 : 0, vi = ok(Q) ? Q * 1e6 / 60 / Aa / 1000 : 0;
      const Pkw = ok(Q) ? p * Q / 600 / 0.85 : 0, mot = MOTORS.find(x => x >= Pkw) || null;
      const opts = v.mode === 'yuk' ? [100, 160, 200, 210, 250, 315].map(pp => { const Dx = nextIn(BORES, Math.sqrt(4 * Freq / (PI * pp / 10 * eta))); if (!Dx) return null; const dx = nearest(RODS.filter(x => x < Dx * 0.8), Dx * Math.sqrt(1 - 1 / phi)); return [pp, Dx, dx]; }).filter(Boolean) : [];
      // maliyet
      const Lt = stroke + 0.6 * D + 50, Lr = stroke + 1.3 * D + 60, rho = 7.85e-6;
      const mT = rho * PI / 4 * (OD * OD - D * D) * Lt, mR = rho * PI / 4 * d * d * Lr, mP = rho * PI / 4 * OD * OD * (0.9 * D + 50);
      const hIs = ok(v.hIs) ? v.hIs : 1 + D / 60, hKa = ok(v.hKa) ? v.hKa : 0.4 + D / 150, hMo = ok(v.hMo) ? v.hMo : 0.8 + D / 200;
      const kece = P('keceA') + P('keceB') * D, boyaA = PI * OD * Lt * 1e-6 + 2 * PI * OD * OD / 4 * 1e-6;
      const lines = [
        [`Honlanmış boru Ø${D}/Ø${OD} × ${f(Lt, 0)} mm (${f(mT, 1)} kg)`, mT * P('honBoru')],
        [`Krom mil Ø${d} × ${f(Lr, 0)} mm (${f(mR, 1)} kg)`, mR * P('kromMil')],
        [`Kafa, dip kapak, piston, gözler (${f(mP, 1)} kg çelik)`, mP * P('celik')],
        [`Talaşlı işleme (${f(hIs, 1)} saat)`, hIs * rate('torna')],
        [`Kaynak (${f(hKa, 1)} saat)`, hKa * P('kaynak')],
        [`Keçe seti`, kece],
        [`Montaj ve basınç testi (${f(hMo, 1)} saat)`, hMo * P('montaj') + P('test')],
        [`Boya (${f(boyaA, 2)} m²)`, boyaA * P('boya')],
      ];
      const cost = lines.reduce((a, l) => a + l[1], 0), qty = ok(v.adet) ? Math.round(v.adet) : 1;
      last = { D, d, OD, stroke, closed, p, Fp, Fc, lines, qty, mass: mT + mR + mP };
      out.innerHTML = `<div class="plate" style="margin-top:12px"><div class="lbl">Seçilen silindir</div><div class="big">Ø${D} / Ø${d} × ${f(stroke, 0)}</div>
        <div class="sub"><span>İtme <b>${f(Fp / 9806.65, 2)} ton</b></span><span>Çekme <b>${f(Fc / 9806.65, 2)} ton</b></span><span>Ağırlık <b>~${f(mT + mR + mP, 0)} kg</b></span></div></div>` +
        kv([
          v.mode === 'yuk' ? ['Gereken piston çapı (hesap)', `Ø${f(Dreq, 1)} mm → standart Ø${D} mm (ISO 3320)`] : ['Piston çapı', `Ø${D} mm`],
          ['Mil çapı', `Ø${d} mm (alan oranı ${f(A / Aa, 2)})`],
          ['İtme / çekme kuvveti', `${f(Fp / 1000, 1)} kN / ${f(Fc / 1000, 1)} kN (verim %${f(eta * 100, 0)})`],
          ['Test basıncı (1,5 ×)', `${f(p * 1.5, 0)} bar`],
          ['Boru et kalınlığı (Lamé)', sOk ? `en az ${f(s, 1)} mm → Ø${D}/Ø${OD} önerilir` : badge(false, 'Basınç malzeme için çok yüksek')],
          ['Açık boy (göz-göz)', `${f(Lext, 0)} mm (kapalı ${f(closed, 0)}${ok(v.kapali) ? '' : ', tahmini'})`],
          ['Burkulma boyu Lk', `${f(Lk, 0)} mm, narinlik λ = ${f(bk.lam, 0)} (${bk.how})`],
          ['Burkulma yükü / izin verilen', `${f(bk.Fk / 1000, 1)} kN / ${f(bk.Fallow / 1000, 1)} kN`],
          ['Burkulma kontrolü', bk.ok ? badge(true, 'Uygun') : badge(false, `Yetersiz — ${dMinB ? 'en az Ø' + dMinB + ' mil gerekli' : 'mil yetmez, strok/bağlantıyı değiştirin'}`)],
          ['Hız (çıkış / dönüş)', ok(Q) ? `${f(vo, 3)} / ${f(vi, 3)} m/s` : '-'],
          ['Süre (çıkış / dönüş)', ok(Q) && stroke ? `${f(stroke / 1000 / vo, 1)} / ${f(stroke / 1000 / vi, 1)} s` : '-'],
          ['Yağ hacmi (çıkış)', `${f(A * stroke / 1e6, 2)} litre`],
          ['Gereken pompa debisi', ok(Q) ? `${f(Q, 1)} l/dk${Qt ? ` (${f(v.tSure, 1)} s çıkış için)` : ''}` : '-'],
          ['Pompa gücü / elektrik motoru', ok(Q) ? `${f(Pkw, 2)} kW → ${mot ? mot + ' kW motor' : 'çok büyük'}` : '-'],
        ]) + (opts.length ? `<h3>Basınca göre seçenekler (${f(v.yuk, 1)} ton)</h3>` + table(['Basınç', 'Piston / mil', ''], opts.map(([pp, Dx, dx]) => [`${pp} bar`, `Ø${Dx} / Ø${dx}`, pp === p ? '<b>seçili</b>' : `<button class="btn" data-pp="${pp}" style="padding:4px 10px">Seç</button>`])) : '') +
        `<h3>Kaba maliyet (1 adet, gider ve kâr hariç)</h3>` + table(null, lines.map(([n, x]) => [esc(n), tl(x)]).concat([['<b>Toplam maliyet</b>', `<b>${tl(cost)}</b>`], [`Genel gider + kâr ile birim fiyat`, `<b>${tl(cost * kFactor())}</b>`]])) +
        `<p class="note">Ön hesaptır. Kafa/piston ölçüleri, kaynak ve keçe tipi tasarıma göre değişir; nihai tasarım ve basınç testi zorunludur. Fiyatlar Hidrolik → Fiyatlar'dan değiştirilir.</p>`;
      cyl3D($('#hy3d'), { D, OD, d, Lt, ext: stroke * 0.6, eye: Math.max(12, d * 0.45) });
      $('#hyHead').innerHTML = '';
      out.querySelectorAll('[data-pp]').forEach(b => b.onclick = () => { const i = root.querySelector('[data-hk="p"]'); i.value = b.dataset.pp; i.dispatchEvent(new Event('input')); });
      const ad = `Hidrolik silindir Ø${D}/Ø${d} × ${f(stroke, 0)}`;
      H().store.set('hyd.ctx', { D, d, s: stroke, p, Q: ok(Q) ? +Q.toFixed(1) : 0, F: Math.max(Fp, Fc), phi: A / Aa, ad, closed, OD });
      last.Q = Q;
    }
    F.bind(root);
    const goQ = () => { if (!last) return; const L = last;
      H().openQuote(serviceQuote({ title: 'Hidrolik silindir imalatı', part: `Silindir Ø${L.D}/Ø${L.d} × ${f(L.stroke, 0)}`, qty: L.qty, mat: 'ST52 boru, CK45 krom mil',
        meta: [['Piston / mil', `Ø${L.D} / Ø${L.d} mm`], ['Strok', `${f(L.stroke, 0)} mm`], ['Çalışma basıncı', `${f(L.p, 0)} bar`], ['İtme / çekme', `${f(L.Fp / 1000, 0)} / ${f(L.Fc / 1000, 0)} kN`], ['Kapalı boy', `${f(L.closed, 0)} mm`], ['Ağırlık', `~${f(L.mass, 0)} kg`]],
        lines: L.lines, shot: snap3() })); };
    const link = id => () => { const c = ctx(); openTool(id, { vals: S_(LINKS[id](c)) }); };
    const items = [['Teklif hazırla', goQ], ['Hortum seç', link('hortum')], ['Pompa ve motor', link('pompa')], ['Hız ve süre', link('hiz')], ['Pim kontrolü', link('pim')], ['Valf seç', link('valf')], ['Tank ve soğutma', link('tank')],
      ['Piston torna hesabı', () => { if (!last) return; H().openTorna(`Piston Ø${last.D}`, [{ d: last.D, di: Math.round(last.d * 0.6), l: Math.round(0.6 * last.D) }]); }],
      ['Mil torna hesabı', () => { if (!last) return; H().openTorna(`Krom mil Ø${last.d}`, [{ d: last.d, di: 0, l: Math.round(last.stroke + 1.3 * last.D + 60) }]); }],
      ['Test raporu', link('test')]];
    $('#hyNext').innerHTML = nextBar(items); bindNext(root, items);
  });

  /* ---------- 2. Hortum seçimi ---------- */
  function vTarget(line, p) {
    if (line === 'emis') return 1.0;
    if (line === 'donus') return 3.0;
    const pts = [[0, 3.5], [50, 4], [100, 4.5], [200, 5], [315, 6]]; // tipik üretici önerileri
    for (let i = 1; i < pts.length; i++) if (p <= pts[i][0]) { const [a, va] = pts[i - 1], [b, vb] = pts[i]; return va + (vb - va) * (p - a) / (b - a); }
    return 6;
  }
  function dpLoss(Q, d, L, nu, rho) { // bar
    const v = Q / 60000 / (PI * (d / 1000) ** 2 / 4), Re = v * d / 1000 / (nu * 1e-6);
    const lam = Re < 2300 ? 64 / Re : 0.316 / Math.pow(Re, 0.25);
    return { v, Re, dp: lam * L / (d / 1000) * rho * v * v / 2 / 1e5 };
  }
  tool('hortum', 'Hesap', 'Hortum seçimi', 'Debi ve basınca göre hortum çapı, tipi, bükülme yarıçapı ve basınç kaybı', root => {
    const F = form('hortum', [
      { k: 'Q', l: 'Debi', u: 'l/dk', d: 60 }, { k: 'p', l: 'Çalışma basıncı (tepe dahil)', u: 'bar', d: 250 },
      { k: 'hat', l: 'Hat tipi', opts: [['basinc', 'Basınç hattı'], ['donus', 'Dönüş hattı'], ['emis', 'Emiş hattı']], d: 'basinc' },
      { k: 'L', l: 'Hortum boyu', u: 'm', d: 2 }, { k: 'nu', l: 'Yağ viskozitesi (çalışma sıcaklığında)', u: 'cSt', d: 32 }, { k: 'rho', l: 'Yağ yoğunluğu', u: 'kg/m³', d: 870 },
    ], v => {
      const out = $('#hyOut'); if (!ok(v.Q) || !ok(v.p)) { out.innerHTML = warnP('Debi ve basıncı girin.'); return; }
      const vt = vTarget(v.hat, v.p), dmin = Math.sqrt(4 * v.Q / 60000 / vt / PI) * 1000;
      const rows = [];
      for (const t of HOSE_ORDER) {
        const r = HOSES[t].rows.find(x => x[1] >= dmin * 0.97 && x[2] >= v.p);
        if (!r) continue;
        const L = dpLoss(v.Q, r[1], ok(v.L) ? v.L : 1, ok(v.nu) ? v.nu : 32, ok(v.rho) ? v.rho : 870);
        rows.push([`<b>${t}</b><br><small>${HOSES[t].std}</small>`, `DN${r[0]} (Ø${f(r[1], 1)})`, `${r[2]} bar`, `${r[3]} mm`, `${f(L.v, 2)} m/s`, `${f(L.dp, 2)} bar`]);
      }
      out.innerHTML = kv([['Önerilen akış hızı', `${f(vt, 1)} m/s (${{ basinc: 'basınç', donus: 'dönüş', emis: 'emiş' }[v.hat]} hattı)`], ['Gereken en küçük iç çap', `Ø${f(dmin, 1)} mm`]]) +
        (rows.length ? `<h3>Uygun hortumlar (ucuzdan pahalıya)</h3>` + table(['Tip', 'Ölçü', 'Çalışma bas.', 'Min. bükülme R', 'Hız', 'Basınç kaybı'], rows) + `<p class="note">İlk satır genelde en ekonomik seçimdir. Patlama basıncı çalışma basıncının 4 katıdır (EN 853/856). Basınç darbeleri olan hatlarda bir üst sınıf seçin. Değerler tipik katalog değerleridir; kullandığınız markanın kataloğuyla doğrulayın. Rakor ve dirsek kayıpları dahil değildir.</p>`
          : warnP('Bu basınç ve debi için tablodaki hortumlardan uygun olan yok; iki paralel hat ya da boru düşünün.'));
    });
    let best = null;
    root.innerHTML = F.html + '<div id="hyOut"></div>';
    F.bind(root);
    const items = [['Hortum imalat teklifi', () => { const v = saved('hortum'); if (best) H().store.set('hyd.in.hortumImalat.rows', [{ t: best.t, dn: best.dn, L: num(v.L) || 1, n: 2, sp: 0 }]); openTool('hortumImalat'); }],
      ['Test raporu (2× test)', () => { const v = saved('hortum'); openTool('test', { vals: S_({ tanim: best ? `Hortum ${best.t} DN${best.dn} × ${v.L} m` : 'Hortum takımı', pw: best ? best.pw : num(v.p), tip: '2' }) }); }],
      ['Valf seç', () => { const v = saved('hortum'); openTool('valf', { vals: S_({ Q: num(v.Q) }) }); }]];
    root.insertAdjacentHTML('beforeend', nextBar(items)); bindNext(root, items);
    function pick() { const v = saved('hortum'), Q = num(v.Q), p = num(v.p); if (!ok(Q) || !ok(p)) { best = null; return; } const dmin = Math.sqrt(4 * Q / 60000 / vTarget(v.hat, p) / PI) * 1000; for (const t of HOSE_ORDER) { const r = HOSES[t].rows.find(x => x[1] >= dmin * 0.97 && x[2] >= p); if (r) { best = { t, dn: r[0], pw: r[2] }; return; } } best = null; }
    pick(); root.addEventListener('input', pick); root.addEventListener('change', pick);
  });

  /* ---------- 3. Silindir hız ve süre ---------- */
  tool('hiz', 'Hesap', 'Silindir hız ve süre', 'Pompa debisine göre açılma/kapanma hızı ve süresi, diferansiyel bağlantı', root => {
    const F = form('hiz', [{ k: 'D', l: 'Piston çapı', u: 'mm', d: 80 }, { k: 'd', l: 'Mil çapı', u: 'mm', d: 45 }, { k: 's', l: 'Strok', u: 'mm', d: 400 }, { k: 'Q', l: 'Debi', u: 'l/dk', d: 40 }], v => {
      const out = $('#hyOut'); if (![v.D, v.d, v.s, v.Q].every(ok) || v.d >= v.D) { out.innerHTML = warnP('Değerleri kontrol edin (mil, pistondan küçük olmalı).'); return; }
      const A = PI * v.D ** 2 / 4, Aa = PI * (v.D ** 2 - v.d ** 2) / 4, Ar = PI * v.d ** 2 / 4, q = v.Q * 1e6 / 60;
      const vo = q / A / 1000, vi = q / Aa / 1000, vr = q / Ar / 1000;
      out.innerHTML = kv([['Çıkış hızı / süresi', `${f(vo, 3)} m/s · ${f(v.s / 1000 / vo, 1)} s`], ['Dönüş hızı / süresi', `${f(vi, 3)} m/s · ${f(v.s / 1000 / vi, 1)} s`],
        ['Diferansiyel (rejeneratif) çıkış', `${f(vr, 3)} m/s · ${f(v.s / 1000 / vr, 1)} s (kuvvet mil alanına düşer)`], ['Dönüşte tanka giden debi', `${f(v.Q * A / Aa, 1)} l/dk (dönüş filtresi buna göre seçilir)`], ['Alan oranı', f(A / Aa, 2)]]);
    });
    root.innerHTML = F.html + '<div id="hyOut"></div>'; F.bind(root);
    const items = [['Pompa ve motor', () => { const v = saved('hiz'); openTool('pompa', { vals: S_({ V: Math.ceil(num(v.Q) * 1000 / (1450 * 0.92)), n: 1450 }) }); }], ['Hortum seç', () => { const v = saved('hiz'); openTool('hortum', { vals: S_({ Q: num(v.Q) }) }); }], ['Valf seç (dönüş debisi)', () => { const v = saved('hiz'); const D = num(v.D), d = num(v.d); openTool('valf', { vals: S_({ Q: Math.ceil(num(v.Q) * D * D / (D * D - d * d)) }) }); }]];
    root.insertAdjacentHTML('beforeend', nextBar(items)); bindNext(root, items);
  });

  /* ---------- 4. Pompa ve motor ---------- */
  tool('pompa', 'Hesap', 'Pompa ve hidrolik motor', 'Debi, güç, elektrik motoru; hidrolik motor tork ve devri', root => {
    const F = form('pompa', [
      { h: 'Pompa' }, { k: 'V', l: 'Pompa hacmi', u: 'cc/dev', d: 25 }, { k: 'n', l: 'Devir', u: 'd/dk', d: 1450 }, { k: 'p', l: 'Basınç', u: 'bar', d: 200 },
      { k: 'ev', l: 'Hacimsel verim', u: '%', d: 92 }, { k: 'et', l: 'Toplam verim', u: '%', d: 85 },
      { h: 'Hidrolik motor' }, { k: 'Vm', l: 'Motor hacmi', u: 'cc/dev', d: 100 }, { k: 'Qm', l: 'Gelen debi', u: 'l/dk', d: 60 }, { k: 'dpm', l: 'Basınç farkı', u: 'bar', d: 180 },
      { k: 'evm', l: 'Hacimsel verim', u: '%', d: 92 }, { k: 'ehm', l: 'Mekanik verim', u: '%', d: 90 },
    ], v => {
      const out = $('#hyOut'), r = [];
      if ([v.V, v.n, v.p].every(ok)) {
        const Q = v.V * v.n * (v.ev || 92) / 100 / 1000, Pk = v.p * Q / 600 / ((v.et || 85) / 100), m = nextIn(MOTORS, Pk);
        r.push(['Pompa debisi', `${f(Q, 1)} l/dk`], ['Gereken güç', `${f(Pk, 2)} kW`], ['Elektrik motoru', m ? `${m} kW (standart)` : 'çok büyük'], ['Pompa mili torku', `${f(v.V * v.p / (20 * PI) / ((v.et || 85) / (v.ev || 92)), 0)} Nm`]);
      }
      if ([v.Vm, v.Qm, v.dpm].every(ok)) {
        const n = v.Qm * 1000 * (v.evm || 92) / 100 / v.Vm, T = v.Vm * v.dpm / (20 * PI) * (v.ehm || 90) / 100;
        r.push(['Motor devri', `${f(n, 0)} d/dk`], ['Motor torku', `${f(T, 0)} Nm`], ['Çıkış gücü', `${f(T * n * 2 * PI / 60 / 1000, 2)} kW`]);
      }
      out.innerHTML = r.length ? kv(r) : warnP('Değerleri girin.');
    });
    root.innerHTML = F.html + '<div id="hyOut"></div>'; F.bind(root);
    const pq = () => { const v = saved('pompa'); return { Q: +(num(v.V) * num(v.n) * (num(v.ev) || 92) / 100 / 1000).toFixed(1), p: num(v.p) }; };
    const items = [['Hortum seç', () => openTool('hortum', { vals: S_(pq()) })], ['Valf seç', () => openTool('valf', { vals: S_({ Q: pq().Q }) })], ['Tank ve soğutma', () => { const v = saved('pompa'), x = pq(); openTool('tank', { vals: S_({ Q: x.Q, Pin: x.p * x.Q / 600 / ((num(v.et) || 85) / 100) }) }); }]];
    root.insertAdjacentHTML('beforeend', nextBar(items)); bindNext(root, items);
  });

  /* ---------- 5. Pim ve burç ---------- */
  tool('pim', 'Hesap', 'Pim ve burç kontrolü', 'Kova/bom pimlerinde yüzey basıncı, kesme ve eğilme', root => {
    const F = form('pim', [
      { k: 'F', l: 'Pime gelen kuvvet', u: 'kN', d: 150 }, { k: 'd', l: 'Pim çapı', u: 'mm', d: 60 }, { k: 'b', l: 'Burç boyu (orta göz)', u: 'mm', d: 80 },
      { k: 'a', l: 'Yan kulak kalınlığı', u: 'mm', d: 25 }, { k: 'kes', l: 'Kesme', opts: [['2', 'Çift kesme (çatal)'], ['1', 'Tek kesme']], d: '2' },
      { k: 'Re', l: 'Pim akma dayanımı (42CrMo4 ıslah ~650)', u: 'MPa', d: 650 }, { k: 'pz', l: 'Burç izin verilen yüzey basıncı', u: 'MPa', d: 40, hint: 'Gresli çelik burç tipik 30–60; bronz 15–30' },
      { k: 'S', l: 'Emniyet katsayısı', u: '', d: 2 },
    ], v => {
      const out = $('#hyOut'); if (![v.F, v.d, v.b].every(ok)) { out.innerHTML = warnP('Değerleri girin.'); return; }
      const Fn = v.F * 1000, n = num(v.kes) || 2, S = v.S || 2, Re = v.Re || 650, a = ok(v.a) ? v.a : v.b * 0.3;
      const p = Fn / (v.d * v.b), tau = Fn / (n * PI * v.d ** 2 / 4), M = n === 2 ? Fn * (v.b + 2 * a) / 8 : Fn * (v.b / 2 + a / 2), sb = M / (PI * v.d ** 3 / 32);
      const tA = 0.577 * Re / S, sA = Re / S;
      const dP = Fn / (v.pz * v.b), dT = Math.sqrt(Fn / (n * PI / 4 * tA)), dB = Math.cbrt(32 * M / (PI * sA));
      out.innerHTML = kv([
        ['Yüzey basıncı (burç)', `${f(p, 1)} MPa — ${p <= v.pz ? badge(true, 'uygun') : badge(false, 'yüksek')}`],
        ['Kesme gerilmesi', `${f(tau, 1)} MPa (izin ${f(tA, 0)}) — ${tau <= tA ? badge(true, 'uygun') : badge(false, 'yüksek')}`],
        ['Eğilme gerilmesi', `${f(sb, 1)} MPa (izin ${f(sA, 0)}) — ${sb <= sA ? badge(true, 'uygun') : badge(false, 'yüksek')}`],
        ['Gereken en küçük pim çapı', `<b>Ø${f(Math.max(dP, dT, dB), 1)} mm</b> (basınç ${f(dP, 0)} · kesme ${f(dT, 0)} · eğilme ${f(dB, 0)})`],
      ]) + '<p class="note">Darbe ve titreşimli çalışmada (kırıcı, kazı) emniyet katsayısını 2,5–3 alın. Burç boyu artırmak yüzey basıncını düşürür ve aşınmayı yavaşlatır.</p>';
    });
    root.innerHTML = F.html + '<div id="hyOut"></div>'; F.bind(root);
  });

  /* ---------- 6. Tank, akümülatör, soğutma ---------- */
  tool('tank', 'Hesap', 'Tank, akümülatör, soğutma', 'Tank hacmi, ısı yükü ve soğutucu ihtiyacı, akümülatör hacmi', root => {
    const F = form('tank', [
      { h: 'Tank ve ısı' }, { k: 'Q', l: 'Pompa debisi', u: 'l/dk', d: 60 }, { k: 'tip', l: 'Uygulama', opts: [['3', 'Sabit (endüstriyel) ×3'], ['1.5', 'Mobil (iş makinesi) ×1,5']], d: '1.5' },
      { k: 'Pin', l: 'Pompa giriş gücü', u: 'kW', d: 25 }, { k: 'kay', l: 'Isıya dönen kayıp', u: '%', d: 25, hint: 'Tipik %20–30' }, { k: 'dT', l: 'Yağ – ortam sıcaklık farkı', u: '°C', d: 30 },
      { h: 'Akümülatör' }, { k: 'p1', l: 'En düşük çalışma basıncı', u: 'bar', d: 120 }, { k: 'p2', l: 'En yüksek basınç', u: 'bar', d: 180 }, { k: 'dV', l: 'Gereken yağ', u: 'litre', d: 2 },
      { k: 'n', l: 'Süreç', opts: [['1', 'Yavaş (izotermal)'], ['1.4', 'Hızlı (adyabatik)']], d: '1.4' },
    ], v => {
      const out = $('#hyOut'), r = [];
      if (ok(v.Q)) {
        const V = v.Q * (num(v.tip) || 1.5), A = 0.065 * Math.pow(V, 2 / 3), Pt = 12 * A * (v.dT || 30) / 1000, Pl = ok(v.Pin) ? v.Pin * (v.kay || 25) / 100 : 0;
        r.push(['Önerilen tank hacmi', `${f(V, 0)} litre`], ['Tank yüzeyi (yaklaşık)', `${f(A, 2)} m²`], ['Isıya dönen kayıp', `${f(Pl, 2)} kW`], ['Tankın attığı ısı', `${f(Pt, 2)} kW`],
          ['Soğutucu ihtiyacı', Pl > Pt ? `<b>${f(Pl - Pt, 2)} kW</b> (yağ soğutucusu gerekli)` : badge(true, 'Tank yeterli, soğutucu gerekmez')]);
      }
      if ([v.p1, v.p2, v.dV].every(ok) && v.p2 > v.p1) {
        const n = num(v.n) || 1.4, a1 = v.p1 + 1, a2 = v.p2 + 1, a0 = 0.9 * a1, V0 = v.dV / (Math.pow(a0 / a1, 1 / n) - Math.pow(a0 / a2, 1 / n)), s = nextIn(ACCU, V0);
        r.push(['Ön dolum basıncı (azot)', `${f(a0 - 1, 0)} bar (p1'in %90'ı)`], ['Gereken akümülatör', `${f(V0, 2)} litre → <b>${s ? s + ' l' : 'çok büyük'}</b> (standart)`]);
      }
      out.innerHTML = r.length ? kv(r) + '<p class="note">Tank yüzey alanı A ≈ 0,065·V^(2/3) ve ısı geçişi ~12 W/m²K varsayımıyla kaba hesaptır. Akümülatör: Boyle–Mariotte, mutlak basınçlarla.</p>' : warnP('Değerleri girin.');
    });
    root.innerHTML = F.html + '<div id="hyOut"></div>'; F.bind(root);
  });

  /* ---------- 7. Valf boyutu ---------- */
  tool('valf', 'Hesap', 'Valf boyutu seçimi', 'Debiye göre yön kontrol valfi boyutu (NG / CETOP)', root => {
    const F = form('valf', [{ k: 'Q', l: 'Valften geçecek en yüksek debi', u: 'l/dk', d: 60, hint: 'Silindir dönüşünde tanka giden debi alan oranı kadar artar!' }], v => {
      const out = $('#hyOut'); if (!ok(v.Q)) { out.innerHTML = warnP('Debiyi girin.'); return; }
      const pick = VALVES.find(x => x[1] * 0.8 >= v.Q) || null;
      out.innerHTML = table(['Boyut', 'Tipik en yüksek debi', 'Durum'], VALVES.map(([n, q]) => [n, `${q} l/dk`, q * 0.8 >= v.Q ? (pick && pick[0] === n ? '<b>Önerilen</b>' : 'Uygun') : '—'])) +
        '<p class="note">Valfi tablo değerinin %80\'ine kadar yüklemek basınç kaybını ve ısınmayı düşük tutar. Değerler tipik katalog değerleridir; markaya göre değişir.</p>';
    });
    root.innerHTML = F.html + '<div id="hyOut"></div>'; F.bind(root);
  });

  /* ---------- 8. Birim çevirici ---------- */
  const UNITS = {
    'Basınç': [['bar', 1], ['psi', 1 / 14.5038], ['MPa', 10], ['kPa', 0.01], ['kgf/cm²', 0.980665]],
    'Debi': [['l/dk', 1], ['gpm (ABD)', 3.78541], ['m³/saat', 1000 / 60], ['l/s', 60]],
    'Kuvvet': [['kN', 1], ['ton (kuvvet)', 9.80665], ['kgf', 0.00980665], ['lbf', 0.00444822]],
    'Hacim / devir': [['cc/dev', 1], ['in³/dev', 16.3871]],
    'Uzunluk': [['mm', 1], ['inç', 25.4], ['m', 1000]],
    'Tork': [['Nm', 1], ['lbf·ft', 1.35582], ['kgf·m', 9.80665]],
    'Güç': [['kW', 1], ['hp (beygir, metrik)', 0.735499], ['hp (ABD)', 0.745700]],
  };
  tool('birim', 'Hesap', 'Birim çevirici', 'bar/psi/MPa, l/dk/gpm, kN/ton, Nm, kW/hp, °C/°F', root => {
    root.innerHTML = Object.entries(UNITS).map(([g, us]) => `<h3>${g}</h3><div class="grid">${us.map(([u, k], i) => `<label class="f"><span>${u}</span><div class="in"><input type="number" inputmode="decimal" data-g="${g}" data-k="${k}"${i === 0 ? ' value="1"' : ''}></div></label>`).join('')}</div>`).join('') +
      `<h3>Sıcaklık</h3><div class="grid"><label class="f"><span>°C</span><div class="in"><input type="number" inputmode="decimal" id="tC" value="50"></div></label><label class="f"><span>°F</span><div class="in"><input type="number" inputmode="decimal" id="tF"></div></label></div>`;
    const sync = src => { const g = src.dataset.g, base = num(src.value) * num(src.dataset.k); root.querySelectorAll(`[data-g="${g}"]`).forEach(i => { if (i !== src) i.value = isFinite(base) ? +(base / num(i.dataset.k)).toPrecision(6) : ''; }); };
    root.querySelectorAll('[data-g]').forEach(i => { i.oninput = () => sync(i); }); root.querySelectorAll('[data-g]').forEach(i => { if (i.value) sync(i); });
    const c = $('#tC'), F = $('#tF'); c.oninput = () => { F.value = +(num(c.value) * 9 / 5 + 32).toFixed(2); }; F.oninput = () => { c.value = +((num(F.value) - 32) * 5 / 9).toFixed(2); }; c.oninput();
  });

  /* ---------- 9. Silindir revizyon teklifi ---------- */
  tool('revizyon', 'Teklif', 'Silindir revizyon teklifi', 'Honlama, krom/mil değişimi, keçe seti, işçilik → teklif, test raporu, QR', root => {
    const F = form('revizyon', [
      { k: 'makine', l: 'Makine / silindir', text: true, d: 'Kova silindiri', wide: true },
      { k: 'D', l: 'Piston çapı', u: 'mm', d: 100 }, { k: 'd', l: 'Mil çapı', u: 'mm', d: 60 }, { k: 's', l: 'Strok', u: 'mm', d: 800 }, { k: 'adet', l: 'Adet', u: '', d: 1 },
      { h: 'Yapılacak işler (0 = yapılmayacak)' },
      { k: 'sok', l: 'Söküm + takma işçiliği', u: 'saat', d: 3 }, { k: 'hon', l: 'Honlama', opts: [['1', 'Var'], ['0', 'Yok']], d: '1' },
      { k: 'mil', l: 'Mil', opts: [['0', 'Mil sağlam'], ['krom', 'Mil krom kaplama'], ['yeni', 'Yeni krom mil']], d: 'krom' },
      { k: 'kece', l: 'Keçe seti', opts: [['1', 'Değişecek'], ['0', 'Değişmeyecek']], d: '1' },
      { k: 'kaynak', l: 'Kaynak / göz tamiri', u: 'saat', d: 0 }, { k: 'parca', l: 'Ek parça (piston, kafa vb.)', u: 'TL', d: 0 },
      { k: 'test', l: 'Basınç testi', opts: [['1', 'Var'], ['0', 'Yok']], d: '1' }, { k: 'nak', l: 'Nakliye / diğer', u: 'TL', d: 0 },
      { k: 'garanti', l: 'Garanti süresi', u: 'ay', d: 6 },
    ], v => {
      const out = $('#hyOut'), L = [];
      if (![v.D, v.d, v.s].every(ok)) { out.innerHTML = warnP('Çap, mil ve stroku girin.'); return; }
      const Lt = v.s + 0.6 * v.D + 50, Lr = v.s + 1.3 * v.D + 60;
      if (ok(v.sok)) L.push([`Söküm, takma (${f(v.sok, 1)} saat)`, v.sok * P('montaj')]);
      if (v.hon === '1') L.push([`Honlama Ø${v.D} × ${f(Lt, 0)} mm`, P('honlama') * v.D * Lt / 1000]);
      if (v.mil === 'krom') { const A = PI * v.d * Lr / 1e4; L.push([`Mil krom kaplama (${f(A, 1)} dm²)`, A * P('krom')]); }
      if (v.mil === 'yeni') { const m = 7.85e-6 * PI / 4 * v.d ** 2 * Lr; L.push([`Yeni krom mil Ø${v.d} × ${f(Lr, 0)} (${f(m, 1)} kg) + işleme`, m * P('kromMil') + (0.8 + v.d / 60) * rate('torna')]); }
      if (v.kece === '1') L.push([`Keçe seti Ø${v.D}/Ø${v.d}`, P('keceA') + P('keceB') * v.D]);
      if (ok(v.kaynak)) L.push([`Kaynak / göz tamiri (${f(v.kaynak, 1)} saat)`, v.kaynak * P('kaynak')]);
      if (ok(v.parca)) L.push(['Ek parça', v.parca]);
      if (v.test === '1') L.push(['Basınç testi', P('test')]);
      if (ok(v.nak)) L.push(['Nakliye / diğer', v.nak]);
      const c = L.reduce((a, l) => a + l[1], 0);
      out.innerHTML = table(null, L.map(([n, x]) => [esc(n), tl(x)]).concat([['<b>Maliyet</b>', `<b>${tl(c)}</b>`], ['Gider + kâr ile birim fiyat', `<b>${tl(c * kFactor())}</b>`]]));
      cur = { v, L };
    });
    let cur = null;
    root.innerHTML = F.html + '<div id="hyOut"></div><div class="row" style="margin-top:10px"><button class="btn tape" id="hyQ">Teklif hazırla</button><button class="btn ghost" id="hyT">Test raporu + QR</button><button class="btn ghost" id="hyH">Hortum seç</button></div>' + templateBar('revizyon');
    F.bind(root); bindTemplates(root, 'revizyon');
    $('#hyQ').onclick = () => { if (!cur) return; const v = cur.v;
      H().openQuote(serviceQuote({ title: 'Hidrolik silindir revizyonu', part: `${v.makine || 'Silindir'} Ø${v.D}/Ø${v.d} × ${f(v.s, 0)}`, qty: ok(v.adet) ? Math.round(v.adet) : 1,
        meta: [['Silindir', `Ø${v.D} / Ø${v.d} × ${f(v.s, 0)} mm`], ['Garanti', ok(v.garanti) ? `${v.garanti} ay` : '-']], lines: cur.L })); };
    $('#hyT').onclick = () => { if (!cur) return; openTool('test', { vals: S_({ tanim: `${cur.v.makine || 'Silindir'} Ø${cur.v.D}/Ø${cur.v.d} × ${f(cur.v.s, 0)} revizyon`, garanti: cur.v.garanti, tip: '1.5', kece: cur.v.kece === '1' ? `Keçe seti Ø${cur.v.D}/Ø${cur.v.d} değişti` : '' }) }); };
    $('#hyH').onclick = () => openTool('hortum');
  });

  /* ---------- 10. Hortum imalat teklifi ---------- */
  tool('hortumImalat', 'Teklif', 'Hortum imalat teklifi', 'Hortum metre + rakor + presleme, çoklu satır → teklif', root => {
    const st = H().store.get('hyd.in.hortumImalat.rows', [{ t: '2SN', dn: 12, L: 1.5, n: 2, sp: 0 }]);
    const draw = () => {
      const rows = st.map((r, i) => `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(90px,1fr));border-top:1px solid var(--line);padding-top:8px;margin-top:8px">
        <label class="f"><span>Tip</span><div class="in"><select data-r="${i}" data-c="t">${HOSE_ORDER.map(t => `<option${t === r.t ? ' selected' : ''}>${t}</option>`).join('')}</select></div></label>
        <label class="f"><span>DN</span><div class="in"><select data-r="${i}" data-c="dn">${HOSES[r.t].rows.map(x => `<option${x[0] === +r.dn ? ' selected' : ''}>${x[0]}</option>`).join('')}</select></div></label>
        <label class="f"><span>Boy (m)</span><div class="in"><input type="number" inputmode="decimal" data-r="${i}" data-c="L" value="${r.L}"></div></label>
        <label class="f"><span>Adet</span><div class="in"><input type="number" inputmode="numeric" data-r="${i}" data-c="n" value="${r.n}"></div></label>
        <label class="f"><span>Spiral</span><div class="in"><select data-r="${i}" data-c="sp"><option value="0"${!+r.sp ? ' selected' : ''}>Yok</option><option value="1"${+r.sp ? ' selected' : ''}>Var</option></select></div></label>
        <button class="btn ghost" data-del="${i}" style="align-self:end">Sil</button></div>`).join('');
      root.innerHTML = `<p class="note">Her satır bir hortum takımıdır (iki uçta pres rakor). Fiyatlar Hidrolik → Fiyatlar'dan değişir.</p>${rows}
        <div class="row" style="margin-top:8px"><button class="btn" id="hyAdd">Satır ekle</button></div><div id="hyOut"></div>
        <div class="row" style="margin-top:10px"><button class="btn tape" id="hyQ">Teklif hazırla</button><button class="btn ghost" id="hyT">Test raporu + QR</button></div>`;
      root.querySelectorAll('[data-r]').forEach(i => i.onchange = i.oninput = () => { const r = st[+i.dataset.r]; r[i.dataset.c] = i.dataset.c === 't' ? i.value : num(i.value); if (i.dataset.c === 't' && !HOSES[r.t].rows.some(x => x[0] === +r.dn)) { r.dn = HOSES[r.t].rows[0][0]; } H().store.set('hyd.in.hortumImalat.rows', st); if (i.dataset.c === 't') draw(); else calc(); });
      root.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { st.splice(+b.dataset.del, 1); if (!st.length) st.push({ t: '2SN', dn: 12, L: 1, n: 1, sp: 0 }); H().store.set('hyd.in.hortumImalat.rows', st); draw(); });
      $('#hyAdd').onclick = () => { st.push({ ...st[st.length - 1] }); H().store.set('hyd.in.hortumImalat.rows', st); draw(); };
      $('#hyQ').onclick = () => { const L = lines(); H().openQuote(serviceQuote({ title: 'Hidrolik hortum imalatı', part: `${st.reduce((a, r) => a + (r.n || 0), 0)} adet hortum takımı`, meta: [['Takımlar', st.map(r => `${r.n}× ${r.t} DN${r.dn} ${f(r.L, 2)} m`).join(', ')]], lines: L })); };
      $('#hyT').onclick = () => { const r = st[0], h = HOSES[r.t].rows.find(x => x[0] === +r.dn); openTool('test', { vals: S_({ tanim: `Hortum ${r.t} DN${r.dn} × ${f(r.L, 2)} m`, pw: h ? h[2] : undefined, tip: '2' }) }); };
      calc();
    };
    const lines = () => st.filter(r => ok(r.L) && ok(r.n)).map(r => {
      const m = HOSE_MULT[r.t] || 1, hose = P('hortumK') * m * r.dn * r.L, fit = 2 * (P('rakorA') + P('rakorB') * r.dn * Math.sqrt(m)), lab = 2 * P('presleme'), sp = +r.sp ? P('spiral') * r.L : 0;
      return [`${r.n} × ${r.t} DN${r.dn} × ${f(r.L, 2)} m (hortum ${tl(hose)}, 2 rakor ${tl(fit)}, presleme ${tl(lab)}${sp ? ', spiral ' + tl(sp) : ''})`, (hose + fit + lab + sp) * r.n];
    });
    const calc = () => { const L = lines(), c = L.reduce((a, l) => a + l[1], 0); $('#hyOut').innerHTML = table(null, L.map(([n, x]) => [esc(n), tl(x)]).concat([['<b>Maliyet</b>', `<b>${tl(c)}</b>`], ['Gider + kâr ile', `<b>${tl(c * kFactor())}</b>`]])); };
    draw();
  });

  /* ---------- 11. Kova imalat teklifi ---------- */
  tool('kova', 'Teklif', 'Kova imalat teklifi', 'Sac ağırlıkları, diş/adaptör, kaynak, boya; SAE J296 kapasite tahmini', root => {
    const F = form('kova', [
      { h: 'Hızlı tahmin' }, { k: 'ton', l: 'Makine tonajı', u: 'ton', d: 20 }, { k: 'Vh', l: 'İstenen kova hacmi (tepeleme)', u: 'm³', d: 1.0 },
      { note: 'Tonaj ve hacmi yazıp "Tahmini ölçüleri doldur"a basın; aşağıdaki ölçüler tipik oranlarla dolar, siz düzeltirsiniz.' },
      { h: 'Kova ölçüleri' }, { k: 'W', l: 'İç genişlik', u: 'mm', d: 1000 }, { k: 'Ls', l: 'Sarım (alt+sırt) sac açınım boyu', u: 'mm', d: 1600 }, { k: 't1', l: 'Sarım sacı kalınlığı', u: 'mm', d: 10 },
      { k: 'Ay', l: 'Bir yan sacın alanı', u: 'cm²', d: 3200, hint: 'Yan profil çiziminden; bilinmiyorsa derinlik × boy × 0,75' }, { k: 't2', l: 'Yan sac kalınlığı', u: 'mm', d: 12 },
      { k: 'bh', l: 'Bıçak yüksekliği', u: 'mm', d: 200 }, { k: 't3', l: 'Bıçak kalınlığı', u: 'mm', d: 25 }, { k: 'kul', l: 'Kulak, göz, takviyeler', u: 'kg', d: 60 },
      { k: 'nd', l: 'Diş sayısı', u: 'adet', d: 5 }, { k: 'hk', l: 'Kesim + büküm + kaynak', u: 'saat', d: 14 }, { k: 'hard', l: 'Aşınma sacı (Hardox) kullanılan', opts: [['bicak', 'Yalnız bıçak'], ['bicak+sarim', 'Bıçak + sarım'], ['hepsi', 'Hepsi']], d: 'bicak+sarim' },
      { h: 'Kapasite tahmini (isteğe bağlı)' }, { k: 'Ap', l: 'Yan profil iç alanı', u: 'cm²', d: 2800 }, { k: 'ao', l: 'Ağız açıklığı (bıçak–arka kenar)', u: 'mm', d: 900 },
    ], v => calc(v));
    let cur = null;
    root.innerHTML = F.html + '<div id="hyOut"></div><div class="row" style="margin-top:10px"><button class="btn tape" id="hyQ">Teklif hazırla</button><button class="btn" id="hyE">Tahmini ölçüleri doldur</button><button class="btn ghost" id="hyK">Kaldırma kapasitesine aktar</button></div>' + templateBar('kova');
    function calc(v) {
      const rho = 7.85e-6, mS = rho * v.W * v.Ls * v.t1, mY = 2 * rho * v.Ay * 100 * v.t2, mB = rho * v.W * v.bh * v.t3, mK = ok(v.kul) ? v.kul : 0;
      const hx = v.hard, pr = (isH) => isH ? P('hardox') : P('st52');
      const L = [[`Sarım sacı ${v.W}×${v.Ls}×${v.t1} (${f(mS, 0)} kg)`, mS * pr(hx !== 'bicak')], [`Yan saclar 2×${f(v.Ay, 0)} cm² × ${v.t2} (${f(mY, 0)} kg)`, mY * pr(hx === 'hepsi')],
        [`Bıçak ${v.W}×${v.bh}×${v.t3} (${f(mB, 0)} kg)`, mB * P('hardox')], [`Kulak, göz, takviye (${f(mK, 0)} kg)`, mK * P('st52')],
        [`Diş + adaptör (${v.nd || 0} takım)`, (v.nd || 0) * (P('dis') + P('adaptor'))], [`Kesim, büküm, kaynak (${f(v.hk, 1)} saat)`, (v.hk || 0) * P('kaynak')],
        [`Boya (~${f((2 * v.W * v.Ls + 2 * v.Ay * 100) * 1e-6, 1)} m²)`, (2 * v.W * v.Ls + 2 * v.Ay * 100) * 1e-6 * P('boya')]];
      const kg = mS + mY + mB + mK, c = L.reduce((a, l) => a + l[1], 0);
      let cap = '';
      if (ok(v.Ap) && ok(v.W)) { const Vs = v.Ap * 100 * v.W / 1e9, a = (v.ao || 0) / 1000, b = v.W / 1000, Vh = Vs + (b * a * a) / 4 - (a ** 3) / 12; cap = kv([['Düz (struck) kapasite', `${f(Vs, 3)} m³`], ['Tepeleme (heaped, 1:1) kapasite', ok(v.ao) ? `${f(Vh, 3)} m³` : '-']]) + '<p class="note">SAE J296 yaklaşımı; yan profil iç alanı × iç genişlik. Kesin değer için standarttaki ölçüm yöntemi uygulanmalıdır.</p>'; }
      $('#hyOut').innerHTML = `<div class="plate" style="margin-top:12px"><div class="lbl">Kova ağırlığı (yaklaşık)</div><div class="big">${f(kg, 0)} kg</div></div>` +
        table(null, L.map(([n, x]) => [esc(n), tl(x)]).concat([['<b>Maliyet</b>', `<b>${tl(c)}</b>`], ['Gider + kâr ile', `<b>${tl(c * kFactor())}</b>`]])) + cap;
      cur = { v, L, kg };
    }
    F.bind(root); bindTemplates(root, 'kova');
    root.querySelector('#hyE').onclick = () => { // tipik oranlar (kaba): genişlik ~ V^0,45, sac kalınlığı tonajla artar
      const v = saved('kova'), T = num(v.ton), V = num(v.Vh); if (!ok(T) || !ok(V)) { H().toast('Tonaj ve hacmi girin'); return; }
      const W = Math.round(1150 * Math.pow(V, 0.45) / 10) * 10, Ap = V / 1.2 / (W / 1000), Ls = Math.round(1.9 * Math.sqrt(Ap / 0.75) * 1000 / 10) * 10;
      const t1 = Math.min(25, Math.max(5, Math.round(5 + 0.3 * T))), cl = x => Math.min(40, x);
      H().store.set('hyd.in.kova', Object.assign(v, S_({ W, Ls, t1, t2: t1 + 2, Ay: Math.round(Ap * 1.15 * 1e4 / 10) * 10, Ap: Math.round(Ap * 1e4 / 10) * 10, ao: Math.round(Math.sqrt(Ap) * 1100 / 10) * 10,
        bh: Math.round((150 + 5 * T) / 10) * 10, t3: cl(Math.round(t1 * 2)), kul: Math.round(25 * Math.pow(T, 0.8)), nd: Math.max(3, Math.round(W / 220)), hk: Math.round(6 + 0.5 * T) })));
      openTool('kova'); H().toast('Tahmini ölçüler dolduruldu; kontrol edip düzeltin');
    };
    root.querySelector('#hyK').onclick = () => { if (!cur) return; const q = H().store.get('kal.quick', {}); q.m2 = String(Math.round(cur.kg)); if (ok(num(saved('kova').Vh))) q.V2 = saved('kova').Vh; H().store.set('kal.quick', q); H().store.set('kal.mode', 'quick'); openTool('kaldirma'); H().toast('Yeni kova ağırlığı aktarıldı'); };
    $('#hyQ').onclick = () => { if (!cur) return; H().openQuote(serviceQuote({ title: 'Kova imalatı', part: `Kova ${cur.v.W} mm`, mat: 'Hardox / S355', meta: [['İç genişlik', `${cur.v.W} mm`], ['Ağırlık', `~${f(cur.kg, 0)} kg`]], lines: cur.L })); };
  });

  /* ---------- 12. Basınç testi raporu + QR ---------- */
  function qrSVG(text, cell = 3) { if (typeof qrcode === 'undefined') return ''; const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: cell, margin: 2, scalable: true }); }
  tool('test', 'Belge', 'Basınç testi raporu + QR etiket', 'Test belgesi (PDF) ve silindir/hortuma yapıştırılacak QR etiket', (root, pre) => {
    const today = new Date().toISOString().slice(0, 10);
    const F = form('test', [
      { k: 'musteri', l: 'Müşteri', text: true, d: '' }, { k: 'isno', l: 'İş / seri no', text: true, d: '' },
      { k: 'tanim', l: 'Ürün', text: true, d: (pre && pre.tanim) || 'Hidrolik silindir', wide: true },
      { k: 'tip', l: 'Test edilen', opts: [['1.5', 'Silindir / valf bloğu (1,5 × çalışma)'], ['2', 'Hortum takımı (2 × çalışma, EN 853/856)']], d: '1.5', wide: true },
      { k: 'pw', l: 'Çalışma basıncı', u: 'bar', d: (pre && pre.pw) || 200 }, { k: 'pt', l: 'Test basıncı (0 = otomatik)', u: 'bar', d: 0 },
      { k: 'sure', l: 'Test süresi', u: 'dk', d: 5 }, { k: 'dus', l: 'Basınç düşümü', u: 'bar', d: 0 },
      { k: 'sonuc', l: 'Sonuç', opts: [['ok', 'Sızıntı yok — UYGUN'], ['no', 'Sızıntı var — UYGUN DEĞİL']], d: 'ok' },
      { k: 'tarih', l: 'Test tarihi', text: true, d: today }, { k: 'garanti', l: 'Garanti', u: 'ay', d: (pre && pre.garanti) || 6 },
      { k: 'eden', l: 'Testi yapan', text: true, d: '' }, { k: 'kece', l: 'Keçe seti / not', text: true, d: '', wide: true },
    ], v => { cur = v; draw(); });
    let cur = null;
    root.innerHTML = F.html + '<div id="hyOut"></div><div class="row" style="margin-top:10px"><button class="btn tape" id="hyP">Raporu yazdır / PDF</button><button class="btn" id="hyL">Etiket yazdır</button><button class="btn ghost" id="hyB">Bakım kaydına ekle</button></div>';
    if (pre && !pre.vals) { const s = saved('test'); Object.assign(s, pre.tanim ? { tanim: pre.tanim } : {}, pre.pw ? { pw: String(pre.pw) } : {}, pre.garanti ? { garanti: String(pre.garanti) } : {}); H().store.set('hyd.in.test', s); root.querySelectorAll('[data-hk]').forEach(i => { if (s[i.dataset.hk] !== undefined) i.value = s[i.dataset.hk]; }); }
    const pt = v => ok(v.pt) ? v.pt : v.pw * (num(v.tip) || 1.5);
    const gEnd = v => { const d = new Date(v.tarih); if (isNaN(d) || !ok(v.garanti)) return ''; d.setMonth(d.getMonth() + v.garanti); return d.toLocaleDateString('tr-TR'); };
    const qrText = v => `${H().prof().firma || 'Tornaly'}\n${v.tanim}\nNo: ${v.isno || '-'}\nTest: ${f(pt(v), 0)} bar ${v.sure} dk ${v.sonuc === 'ok' ? 'UYGUN' : 'UYGUN DEĞİL'}\nÇalışma: ${f(v.pw, 0)} bar\nTarih: ${new Date(v.tarih).toLocaleDateString('tr-TR')}${gEnd(v) ? '\nGaranti: ' + gEnd(v) : ''}${v.kece ? '\n' + v.kece : ''}${H().prof().tel ? '\nTel: ' + H().prof().tel : ''}`;
    function doc(v) {
      const pr = H().prof();
      return `<div class="doc"><div class="dh"><div>${pr.logo ? `<img src="${pr.logo}" alt="">` : ''}<div style="font-weight:600;font-size:1.1rem">${esc(pr.firma || 'Firma adınız')}</div><div style="font-size:.88rem;color:#566771">${[pr.adres, pr.tel, pr.mail].filter(Boolean).map(esc).join('<br>')}</div></div>
        <div style="text-align:right"><h2>Basınç testi raporu</h2><div style="font-size:.9rem">${esc(v.isno || '')}<br>${new Date(v.tarih).toLocaleDateString('tr-TR')}</div></div></div>
        <div class="meta"><div>Müşteri<br><b>${esc(v.musteri || '-')}</b></div><div>Ürün<br><b>${esc(v.tanim)}</b></div><div>Çalışma basıncı<br><b>${f(v.pw, 0)} bar</b></div><div>Test basıncı<br><b>${f(pt(v), 0)} bar</b></div>
          <div>Test süresi<br><b>${f(v.sure || 0, 0)} dk</b></div><div>Basınç düşümü<br><b>${f(v.dus || 0, 1)} bar</b></div><div>Garanti<br><b>${ok(v.garanti) ? v.garanti + ' ay (' + gEnd(v) + ')' : '-'}</b></div><div>Keçe / not<br><b>${esc(v.kece || '-')}</b></div></div>
        <div style="display:flex;gap:16px;align-items:center;margin:12px 0"><div style="width:120px">${qrSVG(qrText(v))}</div><div style="font-size:1.4rem;font-weight:700;color:${v.sonuc === 'ok' ? '#2B6683' : '#A3262A'}">${v.sonuc === 'ok' ? 'SONUÇ: UYGUN' : 'SONUÇ: UYGUN DEĞİL'}</div></div>
        <div class="foot">Test, ürün ${f(pt(v), 0)} bar basınçta ${f(v.sure || 0, 0)} dakika bekletilerek yapılmıştır.<br><br>Testi yapan: ${esc(v.eden || '................')} &nbsp;&nbsp; İmza: ................</div></div>`;
    }
    function label(v) { return `<div style="display:inline-flex;gap:6px;align-items:center;border:1px dashed #999;padding:4px;width:68mm;height:34mm;box-sizing:border-box;font:9pt/1.2 sans-serif;color:#000;background:#fff;margin:2mm;vertical-align:top"><div style="width:30mm;height:30mm;flex:none">${qrSVG(qrText(v))}</div><div><b>${esc(v.tanim)}</b><br>No: ${esc(v.isno || '-')}<br>${f(pt(v), 0)} bar test · ${v.sonuc === 'ok' ? 'UYGUN' : 'RED'}<br>${new Date(v.tarih).toLocaleDateString('tr-TR')}${gEnd(v) ? '<br>Garanti: ' + gEnd(v) : ''}</div></div>`; }
    function draw() { if (!cur) return; $('#hyOut').innerHTML = `<div style="margin-top:12px">${doc(cur)}</div><h3>Etiket önizleme</h3>${label(cur)}`; }
    F.bind(root);
    $('#hyP').onclick = () => cur && H().printDoc(doc(cur));
    $('#hyB').onclick = async () => {
      if (!cur) return; const db = H().store.get('hyd.bakim', { mak: [] });
      const ad = await H().askText('Hangi makineye eklensin? (Bakım kaydındaki adı; yoksa yeni açılır)', (db.mak[0] && db.mak[0].ad) || cur.musteri || ''); if (!ad) return;
      let m = db.mak.find(x => x.ad.toLocaleLowerCase('tr') === ad.toLocaleLowerCase('tr'));
      if (!m) { m = { ad, musteri: cur.musteri || '', seri: '', saat: 0, yagSaat: 1000, filSaat: 500, kayit: [], yag: [] }; db.mak.unshift(m); }
      const last = (m.kayit || [])[0] || {};
      (m.kayit = m.kayit || []).unshift({ tarih: cur.tarih, is: `${cur.tanim} — ${f(pt(cur), 0)} bar test ${cur.sonuc === 'ok' ? 'uygun' : 'UYGUN DEĞİL'}${cur.isno ? ' (' + cur.isno + ')' : ''}`, saat: m.saat, garanti: cur.garanti || 0, tutar: 0, yagSaat: last.yagSaat || 0, filSaat: last.filSaat || 0 });
      H().store.set('hyd.bakim', db); H().toast('Bakım kaydına eklendi: ' + m.ad);
    };
    $('#hyL').onclick = async () => { if (!cur) return; const n = await H().askNum('Kaç etiket basılsın?', 1); if (!(n > 0)) return; H().printDoc(`<div>${Array.from({ length: Math.min(60, n) }, () => label(cur)).join('')}</div>`); };
  });

  /* ---------- 13. Bakım kaydı ve garanti ---------- */
  tool('bakim', 'Kayıt', 'Bakım kaydı ve garanti takibi', 'Makine kartı, çalışma saati, yağ/filtre hatırlatma, garanti bitişleri, servis raporu', root => {
    const db = H().store.get('hyd.bakim', { mak: [] });
    const save = () => H().store.set('hyd.bakim', db);
    const due = m => {
      const r = (m.kayit || [])[0], out = [];
      if (m.yagSaat && r && m.saat - (r.yagSaat || 0) >= m.yagSaat) out.push('yağ değişimi saati geldi');
      if (m.filSaat && r && m.saat - (r.filSaat || 0) >= m.filSaat) out.push('filtre değişimi saati geldi');
      (m.kayit || []).forEach(k => { if (k.garanti) { const d = new Date(k.tarih); d.setMonth(d.getMonth() + k.garanti); const left = (d - new Date()) / 864e5; if (left >= 0 && left < 30) out.push(`garanti ${Math.ceil(left)} gün içinde bitiyor (${esc(k.is)})`); } });
      return out;
    };
    const list = () => {
      root.innerHTML = `<p class="note">Kayıtlar yalnızca bu telefonda tutulur. Yedek için Ayarlar → Yedek dosyası.</p>
        <div class="row"><button class="btn tape" id="bkNew">Makine ekle</button></div>
        <ul class="hist">${db.mak.map((m, i) => { const d = due(m); return `<li><div><b>${esc(m.ad)}</b><br><small>${esc(m.musteri || '-')} · ${esc(m.seri || '')} · ${f(m.saat || 0, 0)} saat</small>${d.length ? `<br><small style="color:var(--warn)">⚠ ${d.join('; ')}</small>` : ''}</div><div class="row" style="flex-wrap:nowrap"><button class="btn" data-o="${i}">Aç</button></div></li>`; }).join('') || '<li><span class="muted">Henüz makine yok.</span></li>'}</ul>`;
      $('#bkNew').onclick = () => { db.mak.unshift({ ad: 'Yeni makine', musteri: '', seri: '', saat: 0, yagSaat: 1000, filSaat: 500, kayit: [], yag: [] }); save(); card(0); };
      root.querySelectorAll('[data-o]').forEach(b => b.onclick = () => card(+b.dataset.o));
    };
    const card = i => {
      const m = db.mak[i], today = new Date().toISOString().slice(0, 10);
      root.innerHTML = `<div class="row"><button class="btn ghost" id="bkBack">← Makineler</button></div>
        <div class="grid">${[['ad', 'Makine (marka/model)'], ['musteri', 'Müşteri'], ['seri', 'Şase / seri no']].map(([k, l]) => `<label class="f"><span>${l}</span><div class="in"><input data-m="${k}" value="${esc(m[k] || '')}"></div></label>`).join('')}
        ${[['saat', 'Çalışma saati'], ['yagSaat', 'Yağ değişim aralığı (saat)'], ['filSaat', 'Filtre değişim aralığı (saat)']].map(([k, l]) => `<label class="f"><span>${l}</span><div class="in"><input type="number" inputmode="decimal" data-m="${k}" value="${m[k] || 0}"></div></label>`).join('')}</div>
        ${due(m).length ? warnP('⚠ ' + due(m).join('; ')) : ''}
        <h3>Yeni servis kaydı</h3><div class="grid">
          <label class="f"><span>Tarih</span><div class="in"><input id="kT" value="${today}"></div></label>
          <label class="f" style="grid-column:1/-1"><span>Yapılan iş</span><div class="in"><input id="kI" placeholder="Örn. kova silindiri revizyonu, 2 hortum"></div></label>
          <label class="chk"><input type="checkbox" id="kY"> Yağ değişti</label><label class="chk"><input type="checkbox" id="kF"> Filtre değişti</label>
          <label class="f"><span>Garanti (ay)</span><div class="in"><input type="number" inputmode="numeric" id="kG" value="0"></div></label>
          <label class="f"><span>Tutar (TL)</span><div class="in"><input type="number" inputmode="decimal" id="kTu" value="0"></div></label></div>
        <div class="row" style="margin-top:8px"><button class="btn tape" id="kAdd">Kaydı ekle</button><button class="btn ghost" id="kDel">Makineyi sil</button></div>
        <h3>Geçmiş</h3>${table(['Tarih', 'Saat', 'İş', 'Garanti', 'Tutar'], (m.kayit || []).map(k => [new Date(k.tarih).toLocaleDateString('tr-TR'), f(k.saat || 0, 0), esc(k.is) + (k.yag ? ' · yağ' : '') + (k.fil ? ' · filtre' : ''), k.garanti ? k.garanti + ' ay' : '-', k.tutar ? tl(k.tutar) : '-']))}
        <div class="row" style="margin-top:8px"><button class="btn" id="kRap">Servis raporu yazdır</button></div>`;
      root.querySelectorAll('[data-m]').forEach(inp => inp.oninput = () => { m[inp.dataset.m] = inp.type === 'number' ? num(inp.value) : inp.value; save(); });
      $('#bkBack').onclick = list;
      $('#kAdd').onclick = () => { const k = { tarih: $('#kT').value, is: $('#kI').value || 'Servis', saat: m.saat, yag: $('#kY').checked, fil: $('#kF').checked, garanti: num($('#kG').value) || 0, tutar: num($('#kTu').value) || 0 };
        if (k.yag) k.yagSaat = m.saat; else k.yagSaat = ((m.kayit || []).find(x => x.yagSaat !== undefined) || {}).yagSaat || 0;
        if (k.fil) k.filSaat = m.saat; else k.filSaat = ((m.kayit || []).find(x => x.filSaat !== undefined) || {}).filSaat || 0;
        (m.kayit = m.kayit || []).unshift(k); save(); H().toast('Kayıt eklendi'); card(i); };
      $('#kDel').onclick = async () => { if (!(await H().ask('Bu makine ve tüm kayıtları silinsin mi?'))) return; db.mak.splice(i, 1); save(); list(); };
      $('#kRap').onclick = () => { const pr = H().prof(); H().printDoc(`<div class="doc"><div class="dh"><div><div style="font-weight:600;font-size:1.1rem">${esc(pr.firma || '')}</div><div style="font-size:.88rem;color:#566771">${[pr.adres, pr.tel].filter(Boolean).map(esc).join('<br>')}</div></div><div style="text-align:right"><h2>Servis raporu</h2><div>${new Date().toLocaleDateString('tr-TR')}</div></div></div>
        <div class="meta"><div>Makine<br><b>${esc(m.ad)}</b></div><div>Müşteri<br><b>${esc(m.musteri || '-')}</b></div><div>Seri no<br><b>${esc(m.seri || '-')}</b></div><div>Çalışma saati<br><b>${f(m.saat || 0, 0)}</b></div></div>
        ${table(['Tarih', 'Saat', 'Yapılan iş', 'Garanti'], (m.kayit || []).map(k => [new Date(k.tarih).toLocaleDateString('tr-TR'), f(k.saat || 0, 0), esc(k.is) + (k.yag ? ' · yağ değişti' : '') + (k.fil ? ' · filtre değişti' : ''), k.garanti ? k.garanti + ' ay' : '-']))}
        <div class="foot">Servis sorumlusu: ................ &nbsp; İmza: ................</div></div>`); };
    };
    list();
  });

  /* ---------- 14. Yağ temizlik takibi ---------- */
  const ISO_TARGET = [['Servo valf', '16/14/11'], ['Oransal valf', '17/15/12'], ['Pistonlu pompa / motor', '18/16/13'], ['Paletli/dişli pompa, yön valfi', '19/17/14'], ['Silindir, genel mobil sistem', '20/18/15']];
  tool('yag', 'Kayıt', 'Yağ temizlik takibi (ISO 4406)', 'Kirlilik kodunu hedefle karşılaştırma ve makineye göre eğilim', root => {
    const db = H().store.get('hyd.bakim', { mak: [] });
    const F = form('yag', [
      { k: 'mak', l: 'Makine', opts: [['', '— seçiniz —']].concat(db.mak.map((m, i) => [String(i), m.ad])), d: '' },
      { k: 'kod', l: 'Ölçülen kod (örn. 19/17/14)', text: true, d: '19/17/14' }, { k: 'hedef', l: 'Sistemdeki en hassas eleman', opts: ISO_TARGET.map(([n, c]) => [c, `${n} → ${c}`]), d: '18/16/13', wide: true },
    ], v => {
      const out = $('#hyOut'), a = String(v.kod).split('/').map(x => parseInt(x, 10)), b = String(v.hedef).split('/').map(x => parseInt(x, 10));
      if (a.length !== 3 || a.some(isNaN)) { out.innerHTML = warnP('Kodu 19/17/14 biçiminde girin.'); return; }
      const diff = Math.max(...a.map((x, i) => x - b[i]));
      out.innerHTML = kv([['Durum', diff <= 0 ? badge(true, 'Hedef içinde') : badge(false, `Hedefin ${diff} sınıf üstünde (her sınıf ≈ 2 kat daha fazla parçacık)`)], ['Öneri', diff <= 0 ? 'Mevcut filtrasyonu sürdürün.' : diff <= 2 ? 'Filtre elemanını değiştirin, havalandırma filtresini kontrol edin, tekrar ölçün.' : 'Yağı süzün ya da değiştirin, filtre inceliğini (β değeri) artırın, kirlilik kaynağını (keçe, tank kapağı) arayın.']]) +
        (v.mak !== '' ? (() => { const m = db.mak[+v.mak], y = (m && m.yag) || []; return `<div class="row" style="margin-top:8px"><button class="btn" id="yKay">Bu ölçümü makineye kaydet</button></div>` + (y.length ? table(['Tarih', 'Kod'], y.map(r => [new Date(r.t).toLocaleDateString('tr-TR'), r.k])) : ''); })() : '');
      const kb = $('#yKay'); if (kb) kb.onclick = () => { const m = db.mak[+v.mak]; (m.yag = m.yag || []).unshift({ t: new Date().toISOString(), k: v.kod }); H().store.set('hyd.bakim', db); H().toast('Kaydedildi'); kb.closest('#hyOut') && F.bind(root); };
    });
    root.innerHTML = F.html + '<div id="hyOut"></div>' + table(['Eleman', 'Tipik hedef (ISO 4406)'], ISO_TARGET) + '<p class="note">Hedefler tipik üretici önerileridir; kendi ekipman kataloğunuz önceliklidir.</p>';
    F.bind(root);
  });

  /* ---------- 15. Keçe ve O-ring rehberi ---------- */
  tool('kece', 'Rehber', 'Keçe ve O-ring rehberi', 'Keçe tipleri, malzeme sınırları, O-ring kanal ölçüsü', root => {
    const F = form('kece', [{ k: 'W', l: 'O-ring kesit çapı', u: 'mm', d: 3.53 }, { k: 'tip', l: 'Kullanım', opts: [['s', 'Statik radyal'], ['d', 'Dinamik (hareketli)'], ['e', 'Eksenel (flanş yüzü)']], d: 's' }], v => {
      const out = $('#hyOut'); if (!ok(v.W)) { out.innerHTML = warnP('Kesit çapını girin.'); return; }
      const sq = { s: [0.15, 0.25], d: [0.10, 0.18], e: [0.20, 0.30] }[v.tip], dep = [v.W * (1 - sq[1]), v.W * (1 - sq[0])];
      out.innerHTML = kv([['Önerilen ezilme', `%${sq[0] * 100}–%${sq[1] * 100}`], ['Kanal derinliği', `${f(dep[0], 2)} – ${f(dep[1], 2)} mm`], ['Kanal genişliği (yedek halkasız)', `${f(v.W * 1.3, 2)} – ${f(v.W * 1.45, 2)} mm`], ['Kanal genişliği (tek yedek halka)', `${f(v.W * 1.3 + 1.4, 2)} – ${f(v.W * 1.45 + 1.4, 2)} mm`]]) + '<p class="note">ISO 3601-2 / üretici tasarım kılavuzlarındaki aralıklara göre yaklaşık değerdir; kesin ölçü için kullandığınız O-ring üreticisinin tablosuna bakın. 100 bar üstü dinamik ve 160 bar üstü statik uygulamada yedek halka kullanın.</p>';
    });
    root.innerHTML = `<h3>Keçe tipleri</h3>` + table(['Yer', 'Tip', 'Not'], [
      ['Piston', 'Kompakt piston keçesi (PU + kılavuz)', 'Mobil silindirlerde en yaygın, çift etkili'], ['Piston', 'Basamaklı PTFE keçe (step seal) + O-ring', 'Düşük sürtünme, yüksek hız, hassas konum'],
      ['Mil', 'U-keçe (PU)', 'Ana mil sızdırmazlığı'], ['Mil', 'Tampon (buffer) keçe', 'Basınç darbelerinden U-keçeyi korur'], ['Mil', 'Toz keçesi (silecek)', 'Kir girişini önler; sık değişen parça'],
      ['Kılavuz', 'Kılavuz bant (PTFE-bronz / fenolik)', 'Metal temasını önler, yan yükü taşır']]) +
      `<h3>Malzeme sınırları (tipik)</h3>` + table(['Malzeme', 'Sıcaklık', 'Not'], [['PU (poliüretan, 93–95 ShA)', '−35 … +110 °C', 'Mobil hidrolikte standart, 400 bar\'a kadar'], ['NBR', '−30 … +100 °C', 'O-ring ve statik keçeler'], ['FKM (Viton)', '−20 … +200 °C', 'Sıcak ve yanmaz sıvılar'], ['PTFE + bronz', '−50 … +200 °C', 'Düşük sürtünme, kayma halkaları']]) +
      `<h3>O-ring kanal ölçüsü</h3>` + F.html + '<div id="hyOut"></div>';
    F.bind(root);
  });

  /* ---------- 16. Rakor rehberi ---------- */
  const THREADS = [
    ['BSP (BSPP, 60° koni / düz)', '1/8"', 9.73, '28 diş/inç'], ['BSP', '1/4"', 13.16, '19 diş/inç'], ['BSP', '3/8"', 16.66, '19 diş/inç'], ['BSP', '1/2"', 20.96, '14 diş/inç'], ['BSP', '5/8"', 22.91, '14 diş/inç'], ['BSP', '3/4"', 26.44, '14 diş/inç'], ['BSP', '1"', 33.25, '11 diş/inç'], ['BSP', '1 1/4"', 41.91, '11 diş/inç'], ['BSP', '1 1/2"', 47.80, '11 diş/inç'],
    ['JIC (37° havşa, UNF)', '-4 (7/16-20)', 11.11, '20 diş/inç'], ['JIC', '-5 (1/2-20)', 12.70, '20 diş/inç'], ['JIC', '-6 (9/16-18)', 14.29, '18 diş/inç'], ['JIC', '-8 (3/4-16)', 19.05, '16 diş/inç'], ['JIC', '-10 (7/8-14)', 22.23, '14 diş/inç'], ['JIC', '-12 (1 1/16-12)', 26.99, '12 diş/inç'], ['JIC', '-16 (1 5/16-12)', 33.34, '12 diş/inç'], ['JIC', '-20 (1 5/8-12)', 41.28, '12 diş/inç'],
    ['ORFS (O-ringli düz yüz)', '-4 (9/16-18)', 14.29, '18 diş/inç'], ['ORFS', '-6 (11/16-16)', 17.46, '16 diş/inç'], ['ORFS', '-8 (13/16-16)', 20.64, '16 diş/inç'], ['ORFS', '-10 (1-14)', 25.40, '14 diş/inç'], ['ORFS', '-12 (1 3/16-12)', 30.16, '12 diş/inç'], ['ORFS', '-16 (1 7/16-12)', 36.51, '12 diş/inç'],
    ['Metrik L (DIN 2353, 24°)', 'Boru 6 / M12×1,5', 12, '1,5 mm'], ['Metrik L', 'Boru 8 / M14×1,5', 14, '1,5 mm'], ['Metrik L', 'Boru 10 / M16×1,5', 16, '1,5 mm'], ['Metrik L', 'Boru 12 / M18×1,5', 18, '1,5 mm'], ['Metrik L', 'Boru 15 / M22×1,5', 22, '1,5 mm'], ['Metrik L', 'Boru 18 / M26×1,5', 26, '1,5 mm'], ['Metrik L', 'Boru 22 / M30×2', 30, '2 mm'], ['Metrik L', 'Boru 28 / M36×2', 36, '2 mm'], ['Metrik L', 'Boru 35 / M45×2', 45, '2 mm'], ['Metrik L', 'Boru 42 / M52×2', 52, '2 mm'],
    ['Metrik S (DIN 2353, 24°)', 'Boru 6 / M14×1,5', 14, '1,5 mm'], ['Metrik S', 'Boru 8 / M16×1,5', 16, '1,5 mm'], ['Metrik S', 'Boru 10 / M18×1,5', 18, '1,5 mm'], ['Metrik S', 'Boru 12 / M20×1,5', 20, '1,5 mm'], ['Metrik S', 'Boru 14 / M22×1,5', 22, '1,5 mm'], ['Metrik S', 'Boru 16 / M24×1,5', 24, '1,5 mm'], ['Metrik S', 'Boru 20 / M30×2', 30, '2 mm'], ['Metrik S', 'Boru 25 / M36×2', 36, '2 mm'], ['Metrik S', 'Boru 30 / M42×2', 42, '2 mm'], ['Metrik S', 'Boru 38 / M52×2', 52, '2 mm'],
  ];
  tool('rakor', 'Rehber', 'Rakor diş tanıma', 'Ölçülen diş çapından BSP, JIC, ORFS, metrik L/S tanıma', root => {
    const F = form('rakor', [{ k: 'od', l: 'Ölçülen diş dış çapı (kumpasla)', u: 'mm', d: 20.9 }], v => {
      const out = $('#hyOut'); if (!ok(v.od)) { out.innerHTML = ''; return; }
      const c = THREADS.filter(t => Math.abs(t[2] - v.od) <= 0.6).sort((a, b) => Math.abs(a[2] - v.od) - Math.abs(b[2] - v.od));
      out.innerHTML = c.length ? table(['Aile', 'Ölçü', 'Diş Ø', 'Hatve'], c.map(t => [esc(t[0]), esc(t[1]), f(t[2], 2), t[3]])) + '<p class="note">Aynı çapa yakın birden fazla aile çıkarsa hatveyi diş tarağıyla ölçün ve sızdırmazlık şekline bakın: BSP 60° koni ya da düz yüz, JIC 37° havşa, ORFS düz yüzde O-ring, metrik 24° koni.</p>' : warnP('±0,6 mm içinde eşleşme yok; ölçümü tekrarlayın.');
    });
    root.innerHTML = F.html + '<div id="hyOut"></div><h3>Tüm tablo</h3>' + table(['Aile', 'Ölçü', 'Diş Ø (mm)', 'Hatve'], THREADS.map(t => [esc(t[0]), esc(t[1]), f(t[2], 2), t[3]]));
    F.bind(root);
  });

  /* ---------- 17. Arıza teşhis ---------- */
  const FAULTS = [
    ['Silindir yavaş ya da güçsüz', ['Pompa debisi düşük: pompa aşınması, emiş filtresi tıkalı, devir düşük', 'Emniyet valfi düşük ayarlı ya da kaçırıyor: basınç ölçün', 'Silindir içi kaçak (piston keçesi): bir tarafı basınçlayıp diğer porttan akış kontrolü', 'Yön valfi sürgüsü tam açılmıyor / iç kaçak', 'Yağ çok sıcak (viskozite düşük)']],
    ['Silindir kendi kendine iniyor (sürünme)', ['Piston keçesi kaçırıyor (en sık)', 'Kilit / yük tutma valfi (çek valf, dengeleme valfi) kaçırıyor', 'Yön valfi sürgüsünde iç kaçak', 'Hortum ya da rakorda dış kaçak']],
    ['Sistem aşırı ısınıyor', ['Emniyet valfi sürekli açık çalışıyor (yük çok yüksek ya da ayar düşük)', 'Soğutucu kirli / fan çalışmıyor', 'Tank seviyesi düşük', 'Yanlış viskozite', 'Pompa ya da motor iç kaçağı (verim düşmüş)', 'Hat çapları küçük, basınç kaybı yüksek']],
    ['Pompa gürültülü (vınlama, çakıl sesi)', ['Kavitasyon: emiş filtresi tıkalı, emiş hortumu ince ya da ezilmiş, yağ soğuk/koyu', 'Hava emme: emiş rakoru gevşek, tank seviyesi düşük, mil keçesi', 'Kaplin hizasızlığı', 'Pompa aşınması']],
    ['Yağ köpürüyor', ['Emişten hava giriyor', 'Dönüş hattı yağ seviyesinin üstünde boşalıyor', 'Su karışmış (süt gibi görünüm)', 'Yanlış yağ / köpük önleyici katkı bitmiş']],
    ['Silindir sarsıntılı / kesik kesik hareket', ['Sistemde hava var: silindiri birkaç kez tam strok çalıştırarak havasını alın', 'Kılavuz bant ya da keçe aşınmış, sürtünme düzensiz', 'Mil eğik ya da boru ovalleşmiş', 'Debi çok düşük (tıkalı kısma)']],
    ['Mil keçesinden yağ sızıyor', ['Mil kromunda çizik/çukur', 'Toz keçesi yırtılmış, kir girmiş', 'Mil eğilmiş', 'Keçe malzemesi sıcaklığa uygun değil', 'Basınç darbesi: tampon keçe yok']],
    ['Hortum sık patlıyor', ['Bükülme yarıçapının altında montaj, rakor dibinden kırılma', 'Basınç sınıfı yetersiz (darbeli hat)', 'Sürtünme: spiral koruma yok', 'Burulma: montajda hortum çizgisi düz değil', 'Yanlış ya da eksik presleme']],
    ['Basınç oluşmuyor', ['Emniyet valfi açık kalmış / yayı kırık', 'Pompa yağ basmıyor (dönüş yönü, kavitasyon)', 'Yön valfi orta konumu açık merkezli', 'Büyük iç kaçak (silindir ya da motor)']],
    ['Valf takılıyor', ['Kirli yağ (ISO kodu yüksek)', 'Bobin voltajı düşük / bobin yanmış', 'Sürgü ısıl genleşmeyle sıkışıyor', 'Gövde bağlantı cıvataları fazla sıkılmış']],
  ];
  tool('ariza', 'Rehber', 'Arıza teşhis rehberi', 'Belirtiye göre olası sebepler ve kontrol sırası', root => {
    root.innerHTML = FAULTS.map(([s, cs]) => `<details><summary><b>${esc(s)}</b></summary><ol>${cs.map(c => `<li>${esc(c)}</li>`).join('')}</ol></details>`).join('') +
      '<p class="note">Sebepler genelde en sık görülenden en aza doğru sıralıdır. Basınç ve debi ölçmeden parça değiştirmeyin; manometre ve debimetre en ucuz teşhis aracıdır.</p>';
  });

  /* ---------- 18. Kaldırma kapasitesi (ayrı modülde) ---------- */
  tool('kaldirma', 'Hesap', 'Kaldırma kapasitesi', 'Ekskavatör, beko, loder, sepetli platform: devrilme, hidrolik sınır, kova ağırlığı etkisi, mekanizma hesabı', root => {
    if (window.TornalyKaldirma) window.TornalyKaldirma.render(root, H); else root.innerHTML = warnP('Kaldırma modülü yüklenemedi.');
  });

  /* ---------- 19. Fiyatlar ---------- */
  tool('fiyat', 'Ayar', 'Hidrolik fiyatları', 'Boru, krom mil, keçe, hortum, rakor, işçilik (TL / € / $)', root => {
    const pr = prices();
    root.innerHTML = '<p class="note">Başlangıç değerleri yaklaşık piyasa değerleridir; kendi tedarikçi fiyatlarınızı girin. Döviz kurları Ayarlar → Döviz kurları\'ndan değişir.</p>' +
      `<div class="tw"><table class="matTable"><thead><tr><th>Kalem</th><th>Fiyat</th><th>Para</th><th>Birim</th></tr></thead><tbody>${Object.entries(DEF_PRICES).map(([k, d]) => `<tr><td>${esc(d[2])}</td><td><input data-pk="${k}" value="${pr[k].v}" inputmode="decimal"></td><td><select data-pc="${k}">${['TL', 'EUR', 'USD'].map(c => `<option${c === pr[k].cur ? ' selected' : ''}>${c}</option>`).join('')}</select></td><td>${esc(d[3])}</td></tr>`).join('')}</tbody></table></div>
      <div class="row" style="margin-top:8px"><button class="btn ghost" id="fpR">Varsayılanlara dön</button></div>`;
    const save = () => { const o = {}; root.querySelectorAll('[data-pk]').forEach(i => { o[i.dataset.pk] = [num(i.value), root.querySelector(`[data-pc="${i.dataset.pk}"]`).value]; }); H().store.set('hyd.prices', o); };
    root.querySelectorAll('[data-pk],[data-pc]').forEach(i => { i.oninput = save; i.onchange = save; });
    $('#fpR').onclick = async () => { if (await H().ask('Hidrolik fiyatları varsayılana dönsün mü?')) { H().store.set('hyd.prices', {}); openTool('fiyat'); } };
  });

  /* ================= Şablonlar (sık işler) ================= */
  function templateBar(id) {
    return `<details style="margin-top:12px"><summary>Şablonlar (sık yapılan işler)</summary><div class="row" style="margin-top:6px"><button class="btn" data-ts="${id}">Bu girdileri şablon olarak kaydet</button></div><div data-tl="${id}"></div></details>`;
  }
  function bindTemplates(root, id) {
    const drawL = () => {
      const all = H().store.get('hyd.sablon', []).filter(t => t.id === id);
      root.querySelector(`[data-tl="${id}"]`).innerHTML = all.length ? `<ul class="hist">${all.map((t, i) => `<li><div><b>${esc(t.ad)}</b></div><div class="row" style="flex-wrap:nowrap"><button class="btn" data-tu="${i}">Kullan</button><button class="btn ghost" data-td="${i}">Sil</button></div></li>`).join('')}</ul>` : '<p class="note">Henüz şablon yok.</p>';
      root.querySelectorAll('[data-tu]').forEach(b => b.onclick = () => { const t = all[+b.dataset.tu]; H().store.set('hyd.in.' + id, t.v); openTool(id); H().toast('Şablon yüklendi: ' + t.ad); });
      root.querySelectorAll('[data-td]').forEach(b => b.onclick = () => { const L = H().store.get('hyd.sablon', []), t = all[+b.dataset.td]; H().store.set('hyd.sablon', L.filter(x => x !== L.find(y => y.id === t.id && y.ad === t.ad && JSON.stringify(y.v) === JSON.stringify(t.v)))); drawL(); });
    };
    root.querySelector(`[data-ts="${id}"]`).onclick = async () => {
      const ad = await H().askText('Şablon adı (örn. JCB 3CX kova silindiri)', ''); if (!ad) return;
      const L = H().store.get('hyd.sablon', []); L.unshift({ id, ad, v: H().store.get('hyd.in.' + id, {}) }); H().store.set('hyd.sablon', L.slice(0, 80)); drawL(); H().toast('Şablon kaydedildi');
    };
    drawL();
  }

  /* ================= Menü ve gezinme ================= */
  let rootEl = null;
  const GROUPS = [['Hesap', 'Hesaplar'], ['Teklif', 'Teklifler'], ['Belge', 'Belgeler'], ['Kayıt', 'Kayıtlar'], ['Rehber', 'Rehberler'], ['Ayar', 'Ayarlar']];
  function menu() {
    const db = H().store.get('hyd.bakim', { mak: [] });
    const dueN = db.mak.filter(m => (m.kayit || []).length && ((m.yagSaat && m.saat - ((m.kayit[0] || {}).yagSaat || 0) >= m.yagSaat) || (m.filSaat && m.saat - ((m.kayit[0] || {}).filSaat || 0) >= m.filSaat))).length;
    rootEl.innerHTML = `<h2>Hidrolik</h2>${dueN ? warnP(`⚠ ${dueN} makinede bakım zamanı geldi (Kayıtlar → Bakım kaydı).`) : ''}` + GROUPS.map(([g, gt]) => {
      const ts = TOOLS.filter(t => t.grp === g); if (!ts.length) return '';
      return `<h3>${gt}</h3><div class="hytools">${ts.map(t => `<button class="hytool" data-tool="${t.id}"><b>${esc(t.title)}</b><small>${esc(t.desc)}</small></button>`).join('')}</div>`;
    }).join('') + '<p class="note">Tüm hesaplar ön hesaptır; tasarım, üretim ve güvenlik kararlarında ilgili standartlar, üretici katalogları ve yetkili muayene esastır.</p>';
    rootEl.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => openTool(b.dataset.tool));
  }
  function openTool(id, pre) {
    const t = TOOLS.find(x => x.id === id); if (!t) return menu();
    rootEl.innerHTML = `<div class="row" style="margin:4px 0 8px"><button class="btn ghost" id="hyBack">← Hidrolik araçları</button></div><h2 style="margin-top:4px">${esc(t.title)}</h2><div id="hyTool"></div>`;
    $('#hyBack').onclick = () => { menu(); window.scrollTo(0, 0); };
    if (pre && pre.vals) H().store.set('hyd.in.' + id, Object.assign(saved(id), pre.vals));
    const c = ctx();
    if (c && LINKS[id] && !(pre && pre.vals)) {
      rootEl.querySelector('#hyTool').insertAdjacentHTML('beforebegin', `<div class="note" style="display:flex;gap:8px;align-items:center;justify-content:space-between;background:var(--surface);border:1px solid var(--line);border-radius:var(--r-s);padding:8px 10px;margin:0 0 8px"><span>Son silindir: <b>Ø${c.D}/Ø${c.d} × ${f(c.s, 0)}</b>, ${f(c.p, 0)} bar${c.Q ? ', ' + f(c.Q, 0) + ' l/dk' : ''}</span><button class="btn" id="hyCtx" style="flex:none">Değerleri kullan</button></div>`);
      $('#hyCtx').onclick = () => openTool(id, { vals: S_(LINKS[id](c)) });
    }
    try { t.render($('#hyTool'), pre); } catch (e) { $('#hyTool').innerHTML = warnP('Bu araç açılamadı: ' + esc(e.message)); console.error(e); }
    window.scrollTo(0, 0);
  }
  function mount(el) { rootEl = el; menu(); }
  // Sesli komut ve dış çağrılar için
  window.TornalyHydraulic = { mount, openTool, menu, tools: () => TOOLS.map(t => [t.id, t.title]), HOSES, BORES, RODS, buckling, dpLoss, vTarget, prices };
})();
