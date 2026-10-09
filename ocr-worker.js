/* Tornaly OCR işçisi: resimdeki rakamları telefonda okur, hiçbir yere göndermez.
   Motor: Tesseract (tesseract.js-core 5.1.0, Apache 2.0). */
let M = null, api = null;
async function init() {
  if (api) return;
  importScripts('tesseract-core-lstm.js');
  M = await TesseractCore({ locateFile: p => p });
  const r = await fetch('eng.traineddata');
  if (!r.ok) throw new Error('OCR dil dosyası indirilemedi');
  M.FS.writeFile('/eng.traineddata', new Uint8Array(await r.arrayBuffer()));
  api = new M.TessBaseAPI();
  if (api.Init('/', 'eng', 1) !== 0) throw new Error('OCR başlatılamadı');
}
self.onmessage = async e => {
  const { id, png, psm, white } = e.data;
  try {
    await init();
    api.SetVariable('tessedit_pageseg_mode', String(psm || 11));
    api.SetVariable('tessedit_char_whitelist', white || '0123456789.,');
    M.FS.writeFile('/input', new Uint8Array(png));
    if (api.SetImageFile(1, 0) === 1) throw new Error('Resim okunamadı');
    api.Recognize(null);
    const tsv = api.GetTSVText(0);
    api.Clear();
    self.postMessage({ id, tsv });
  } catch (err) { self.postMessage({ id, error: String(err && err.message || err) }); }
};
