/* Tornaly – 3B model okuma: STL, OBJ, 3MF (doğrudan), STEP/IGES (OpenCascade, ilk kullanımda yüklenir).
   Hacim, yüzey alanı, dış ölçüler, delik sayısı (cins/genus) ve torna zarfı hesaplanır. Dosya telefondan çıkmaz. */
(function () {
  'use strict';

  /* ---------- Biçim okuyucular: hepsi düz üçgen dizisi (Float32Array, 9 sayı/üçgen) döndürür ---------- */
  function parseSTL(buf) {
    const dv = new DataView(buf);
    if (buf.byteLength >= 84) {
      const n = dv.getUint32(80, true);
      if (84 + n * 50 === buf.byteLength) {
        const out = new Float32Array(n * 9);
        for (let i = 0; i < n; i++) { const o = 84 + i * 50 + 12; for (let k = 0; k < 9; k++) out[i * 9 + k] = dv.getFloat32(o + k * 4, true); }
        return out;
      }
    }
    const txt = new TextDecoder().decode(new Uint8Array(buf));
    const re = /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g, v = []; let m;
    while ((m = re.exec(txt))) v.push(+m[1], +m[2], +m[3]);
    if (!v.length || v.length % 9) throw new Error('STL dosyası okunamadı.');
    return new Float32Array(v);
  }
  function parseOBJ(buf) {
    const lines = new TextDecoder().decode(new Uint8Array(buf)).split(/\r?\n/), V = [], out = [];
    for (const ln of lines) {
      const s = ln.trim();
      if (s.startsWith('v ')) { const p = s.split(/\s+/); V.push([+p[1], +p[2], +p[3]]); }
      else if (s.startsWith('f ')) {
        const idx = s.split(/\s+/).slice(1).map(t => { const i = parseInt(t.split('/')[0], 10); return i < 0 ? V.length + i : i - 1; });
        for (let k = 1; k + 1 < idx.length; k++) for (const j of [idx[0], idx[k], idx[k + 1]]) { const p = V[j]; if (!p) throw new Error('OBJ dosyası bozuk.'); out.push(p[0], p[1], p[2]); }
      }
    }
    if (!out.length) throw new Error('OBJ dosyasında yüzey bulunamadı.');
    return new Float32Array(out);
  }
  async function unzipEntry(buf, test) {
    const u8 = new Uint8Array(buf), dv = new DataView(buf);
    let e = -1; for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('3MF (zip) dosyası okunamadı.');
    let p = dv.getUint32(e + 16, true); const n = dv.getUint16(e + 10, true);
    for (let k = 0; k < n; k++) {
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
      if (test(name)) {
        const lnl = dv.getUint16(lo + 26, true), lxl = dv.getUint16(lo + 28, true), data = u8.subarray(lo + 30 + lnl + lxl, lo + 30 + lnl + lxl + csize);
        if (method === 0) return new TextDecoder().decode(data);
        if (method !== 8 || typeof DecompressionStream === 'undefined') throw new Error('Bu 3MF sıkıştırması desteklenmiyor.');
        const st = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return await new Response(st).text();
      }
      p += 46 + nl + xl + cl;
    }
    throw new Error('3MF içinde model bulunamadı.');
  }
  async function parse3MF(buf) {
    const xml = await unzipEntry(buf, n => /\.model$/i.test(n) && /3d\//i.test(n));
    const doc = new DOMParser().parseFromString(xml, 'application/xml'), root = doc.documentElement;
    const unit = { micron: 0.001, millimeter: 1, centimeter: 10, inch: 25.4, foot: 304.8, meter: 1000 }[root.getAttribute('unit') || 'millimeter'] || 1;
    const objs = {};
    for (const o of root.getElementsByTagNameNS('*', 'object')) objs[o.getAttribute('id')] = o;
    const mat = s => { if (!s) return null; const a = s.trim().split(/\s+/).map(Number); return a.length === 12 ? a : null; };
    const mul = (A, B) => { if (!A) return B; if (!B) return A; // 3x4 (satır sırası m00 m01 m02 m10 ... m32)
      const r = new Array(12);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
      for (let j = 0; j < 3; j++) r[9 + j] = A[9] * B[j] + A[10] * B[3 + j] + A[11] * B[6 + j] + B[9 + j];
      return r; };
    const out = [];
    const emit = (o, T, depth) => {
      if (depth > 16) return;
      const mesh = o.getElementsByTagNameNS('*', 'mesh')[0];
      if (mesh) {
        const vs = [...mesh.getElementsByTagNameNS('*', 'vertex')].map(v => { let x = +v.getAttribute('x'), y = +v.getAttribute('y'), z = +v.getAttribute('z'); if (T) [x, y, z] = [x * T[0] + y * T[3] + z * T[6] + T[9], x * T[1] + y * T[4] + z * T[7] + T[10], x * T[2] + y * T[5] + z * T[8] + T[11]]; return [x * unit, y * unit, z * unit]; });
        for (const t of mesh.getElementsByTagNameNS('*', 'triangle')) for (const k of ['v1', 'v2', 'v3']) { const p = vs[+t.getAttribute(k)]; out.push(p[0], p[1], p[2]); }
      }
      for (const c of o.getElementsByTagNameNS('*', 'component')) { const ch = objs[c.getAttribute('objectid')]; if (ch) emit(ch, mul(mat(c.getAttribute('transform')), T), depth + 1); }
    };
    const items = root.getElementsByTagNameNS('*', 'item');
    if (items.length) for (const it of items) { const o = objs[it.getAttribute('objectid')]; if (o) emit(o, mat(it.getAttribute('transform')), 0); }
    else Object.values(objs).forEach(o => emit(o, null, 0));
    if (!out.length) throw new Error('3MF dosyasında yüzey bulunamadı.');
    return new Float32Array(out);
  }
  function parseCAD(buf, format, onBusy) {
    return new Promise((res, rej) => {
      let w;
      try { w = new Worker('occt-import-js-worker.js'); } catch { return rej(new Error('STEP okuyucu başlatılamadı.')); }
      const tm = setTimeout(() => { w.terminate(); rej(new Error('STEP dosyası çok büyük ya da okunamadı (zaman aşımı).')); }, 180000);
      w.onerror = ev => { ev.preventDefault && ev.preventDefault(); clearTimeout(tm); w.terminate(); rej(new Error('STEP okuyucu yüklenemedi; ilk kullanım için internet gerekir.')); };
      w.onmessage = ev => {
        clearTimeout(tm); w.terminate();
        const r = ev.data;
        if (!r || !r.success || !r.meshes || !r.meshes.length) return rej(new Error(format.toUpperCase() + ' dosyasında katı model bulunamadı.'));
        let n = 0; r.meshes.forEach(m => { n += m.index.array.length; });
        const out = new Float32Array(n * 3); let o = 0;
        r.meshes.forEach(m => { const P = m.attributes.position.array, I = m.index.array; for (let i = 0; i < I.length; i++) { const j = I[i] * 3; out[o++] = P[j]; out[o++] = P[j + 1]; out[o++] = P[j + 2]; } });
        res({ pos: out, bodies: r.meshes.length });
      };
      onBusy && onBusy();
      w.postMessage({ format, buffer: new Uint8Array(buf), params: { linearUnit: 'millimeter', linearDeflectionType: 'bounding_box_ratio', linearDeflection: 0.0008, angularDeflection: 0.15 } });
    });
  }

  /* ---------- Analiz ---------- */
  function analyze(pos) {
    const nT = pos.length / 9;
    let V = 0, S = 0, x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < pos.length; i += 3) { const x = pos[i], y = pos[i + 1], z = pos[i + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
    for (let t = 0; t < nT; t++) {
      const o = t * 9, ax = pos[o] - cx, ay = pos[o + 1] - cy, az = pos[o + 2] - cz, bx = pos[o + 3] - cx, by = pos[o + 4] - cy, bz = pos[o + 5] - cz, qx = pos[o + 6] - cx, qy = pos[o + 7] - cy, qz = pos[o + 8] - cz;
      V += ax * (by * qz - bz * qy) - ay * (bx * qz - bz * qx) + az * (bx * qy - by * qx);
      const ux = bx - ax, uy = by - ay, uz = bz - az, vx = qx - ax, vy = qy - ay, vz = qz - az;
      S += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    }
    V = Math.abs(V / 6);
    const dims = [x1 - x0, y1 - y0, z1 - z0];
    // köşe kaynaştırma → Euler karakteristiği, kabuk sayısı, delik (genus)
    const diag = Math.hypot(...dims) || 1, q = diag * 1e-5, map = new Map(), vid = new Int32Array(nT * 3);
    for (let i = 0; i < nT * 3; i++) {
      const k = Math.round(pos[i * 3] / q) + ',' + Math.round(pos[i * 3 + 1] / q) + ',' + Math.round(pos[i * 3 + 2] / q);
      let id = map.get(k); if (id === undefined) { id = map.size; map.set(k, id); } vid[i] = id;
    }
    const nV = map.size, edges = new Map(), parent = new Int32Array(nV).map((_, i) => i);
    const find = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    let degenerate = 0;
    for (let t = 0; t < nT; t++) {
      const a = vid[t * 3], b = vid[t * 3 + 1], c = vid[t * 3 + 2];
      if (a === b || b === c || a === c) { degenerate++; continue; }
      for (const [u, w] of [[a, b], [b, c], [c, a]]) { const k = u < w ? u * nV + w : w * nV + u; edges.set(k, (edges.get(k) || 0) + 1); }
      const ra = find(a), rb = find(b), rc = find(c); parent[rb] = ra; parent[find(rc)] = ra;
    }
    const used = new Set(); for (let i = 0; i < nT * 3; i++) used.add(find(vid[i]));
    const shells = used.size;
    let open = 0; for (const c of edges.values()) if (c !== 2) open++;
    const chi = nV - edges.size + (nT - degenerate);
    const genus = Math.max(0, Math.round((2 * shells - chi) / 2));
    // torna zarfı: her eksen için silindir zarfı, en küçüğü
    const axes = [0, 1, 2].map(a => {
      const b = (a + 1) % 3, c = (a + 2) % 3, cb = [cx, cy, cz][b], cc = [cx, cy, cz][c];
      let r2 = 0; for (let i = 0; i < pos.length; i += 3) { const d = (pos[i + b] - cb) ** 2 + (pos[i + c] - cc) ** 2; if (d > r2) r2 = d; }
      const R = Math.sqrt(r2), L = dims[a];
      return { a, D: 2 * R, L, env: Math.PI * R * R * L, round: Math.abs(dims[b] - dims[c]) / Math.max(dims[b], dims[c], 1e-9) };
    });
    const turn = axes.slice().sort((p, r) => p.env - r.env)[0];
    { // dönel mi? en dış çaptaki noktalar çemberin her yönüne yayılmış olmalı (küpte yalnız 4 köşe olur)
      const a = turn.a, b = (a + 1) % 3, c = (a + 2) % 3, cb = [cx, cy, cz][b], cc = [cx, cy, cz][c], R = turn.D / 2, bins = new Set();
      for (let i = 0; i < pos.length; i += 3) { const u = pos[i + b] - cb, v = pos[i + c] - cc; if (Math.hypot(u, v) >= 0.97 * R) bins.add(Math.floor((Math.atan2(v, u) + Math.PI) / (2 * Math.PI) * 24) % 24); }
      turn.cover = bins.size / 24;
    }
    const sorted = dims.slice().sort((a, b) => b - a);
    return { V, S, dims, sorted, center: [cx, cy, cz], genus, shells, open, turn, nT };
  }

  /* ---------- Yükleme ---------- */
  async function load(file, onBusy) {
    const name = file.name, ext = (/\.([a-z0-9]+)$/i.exec(name) || [])[1]?.toLowerCase();
    const buf = await file.arrayBuffer();
    let pos, bodies = 1;
    if (ext === 'stl') pos = parseSTL(buf);
    else if (ext === 'obj') pos = parseOBJ(buf);
    else if (ext === '3mf') pos = await parse3MF(buf);
    else if (ext === 'step' || ext === 'stp') ({ pos, bodies } = await parseCAD(buf, 'step', onBusy));
    else if (ext === 'iges' || ext === 'igs') ({ pos, bodies } = await parseCAD(buf, 'iges', onBusy));
    else throw new Error('Desteklenmeyen 3B biçim.');
    if (pos.length < 36) throw new Error('Modelde yeterli yüzey yok.');
    return { pos, bodies, info: analyze(pos) };
  }

  window.TornalyModel3D = { load, analyze, parseSTL, parseOBJ, parse3MF, exts: /\.(stl|obj|3mf|step|stp|iges|igs)$/i };
})();
