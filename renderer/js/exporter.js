// Real exports: PNG / JPEG are rasterised from the page SVG with a canvas,
// SVG is written as-is, PDF is produced by Chromium's PDF printer in the main process.
(function (root) {
  'use strict';
  const { formats, render, ui } = root.DS;
  const { h } = ui;

  const MAX_SIDE = 16000;

  function pageSvg(doc, page, opts) {
    const o = opts || {};
    const resolveSrc = (s) => root.DS.doc.resolveAsset(doc, s);
    return render.renderPage(page, doc.format, Object.assign({ measure: ui.measure, resolveSrc }, o)).svg;
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not render this page as an image.'));
      img.src = url;
    });
  }

  // Returns a Blob of the rendered page.
  async function rasterize(doc, page, { scale, type, quality, transparent }) {
    const size = formats.canvasSize(doc.format);
    let outW = Math.round(size.w * scale), outH = Math.round(size.h * scale);
    if (outW > MAX_SIDE || outH > MAX_SIDE) {
      const k = MAX_SIDE / Math.max(outW, outH);
      outW = Math.floor(outW * k); outH = Math.floor(outH * k);
    }
    const svg = pageSvg(doc, page, { transparent: type === 'png' && transparent, outW, outH });
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      const img = await loadImage(url);
      const canvas = document.createElement('canvas');
      canvas.width = outW; canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (type === 'jpg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, outW, outH); }
      ctx.drawImage(img, 0, 0, outW, outH);
      const mime = type === 'jpg' ? 'image/jpeg' : 'image/png';
      const blob = await new Promise((res) => canvas.toBlob(res, mime, quality));
      if (!blob) throw new Error('The image is too large to export. Try a smaller size.');
      return { blob, w: outW, h: outH };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function blobBytes(blob) {
    return new Uint8Array(await blob.arrayBuffer());
  }

  async function thumbnail(doc) {
    try {
      const size = formats.canvasSize(doc.format);
      const scale = 360 / Math.max(size.w, size.h);
      const { blob } = await rasterize(doc, doc.pages[0], { scale, type: 'jpg', quality: 0.8 });
      return await new Promise((res) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  // Runs one export. settings: {type, pages:'current'|'all', scale, quality, transparent, bleed}
  async function runExport(doc, pageIndex, settings) {
    const pages = settings.pages === 'all' ? doc.pages : [doc.pages[pageIndex]];
    const name = doc.name || 'design';
    const { type } = settings;

    if (type === 'mp4') return root.DS.video.exportMp4(doc, settings);

    if (type === 'pdf') {
      const b = settings.bleed ? formats.bleedPx(doc.format) : 0;
      const size = formats.canvasSize(doc.format);
      const svgs = pages.map((p) => pageSvg(doc, p, { bleed: !!settings.bleed }));
      return window.api.exportPdf({
        defaultName: name,
        pages: svgs,
        widthIn: (size.w + 2 * b) / formats.PX_PER_IN,
        heightIn: (size.h + 2 * b) / formats.PX_PER_IN
      });
    }

    if (type === 'svg') {
      const files = pages.map((p) => pageSvg(doc, p, { transparent: !!settings.transparent }));
      if (files.length === 1) return window.api.exportSaveFile({ defaultName: name, ext: 'svg', data: files[0] });
      return window.api.exportSaveMany({ baseName: name, ext: 'svg', files });
    }

    const files = [];
    for (const p of pages) {
      const r = await rasterize(doc, p, settings);
      files.push(await blobBytes(r.blob));
    }
    if (files.length === 1) return window.api.exportSaveFile({ defaultName: name, ext: type, data: files[0] });
    return window.api.exportSaveMany({ baseName: name, ext: type, files });
  }

  // The export dialog.
  async function openDialog(doc, pageIndex) {
    const f = doc.format;
    const isPrint = f.kind === 'print';
    const size = formats.canvasSize(f);
    const inches = formats.sizeInInches(f);

    const D = root.DS.doc;
    const videoDoc = D.isVideoDoc(doc);
    const total = D.timeline(doc).total;
    const state = {
      type: videoDoc ? 'mp4' : isPrint ? 'pdf' : 'png',
      pages: doc.pages.length > 1 ? 'all' : 'current',
      scale: isPrint ? 300 / formats.PX_PER_IN : 1,
      quality: 0.92,
      transparent: false,
      bleed: false
    };

    const typeSel = h('select.input', null,
      h('option', { value: 'png' }, 'PNG — best for graphics and transparency'),
      h('option', { value: 'jpg' }, 'JPEG — smaller file, best for photos'),
      h('option', { value: 'pdf' }, isPrint ? 'PDF Print — vector, exact print size' : 'PDF — vector document'),
      h('option', { value: 'svg' }, 'SVG — scalable vector image'),
      h('option', { value: 'mp4' }, videoDoc ? 'MP4 video — with your video clips and audio' : 'MP4 video — pages play as a slideshow'));
    typeSel.value = state.type;
    const resSel = h('select.input', null,
      h('option', { value: 1 }, `Full size (${Math.round(size.w / 2) * 2} × ${Math.round(size.h / 2) * 2})`),
      h('option', { value: 0.6667 }, `Smaller file (${Math.round(size.w * 0.6667 / 2) * 2} × ${Math.round(size.h * 0.6667 / 2) * 2})`),
      h('option', { value: 0.5 }, `Half size (${Math.round(size.w * 0.5 / 2) * 2} × ${Math.round(size.h * 0.5 / 2) * 2})`));
    if (Math.max(size.w, size.h) > 1920) resSel.value = String(1920 / Math.max(size.w, size.h) >= 0.6667 ? 0.6667 : 0.5);

    const pagesSel = h('select.input', null,
      h('option', { value: 'current' }, `Current page (${pageIndex + 1})`),
      h('option', { value: 'all' }, `All pages (${doc.pages.length})`));
    pagesSel.value = state.pages;

    const scaleSel = h('select.input');
    const scaleOpts = isPrint
      ? [[72, 'Screen (72 DPI)'], [150, 'Standard (150 DPI)'], [300, 'High quality print (300 DPI)'], [600, 'Ultra (600 DPI)']].map(([dpi, l]) => [dpi / formats.PX_PER_IN, l])
      : [[0.5, '0.5× (half size)'], [1, '1× (original size)'], [2, '2× (sharp, retina)'], [3, '3×'], [4, '4×']];
    for (const [v, l] of scaleOpts) scaleSel.appendChild(h('option', { value: v }, l));
    scaleSel.value = String(state.scale);

    const qualityIn = h('input', { type: 'range', min: 40, max: 100, value: 92 });
    const qualityVal = h('span.muted', null, '92%');
    const transIn = h('input', { type: 'checkbox' });
    const bleedIn = h('input', { type: 'checkbox' });
    const info = h('div.export-info');

    const rowScale = h('label.field', null, h('span', null, isPrint ? 'Resolution' : 'Size'), scaleSel);
    const rowQuality = h('label.field', null, h('span', null, 'JPEG quality ', qualityVal), qualityIn);
    const rowTrans = h('label.check', null, transIn, ' Transparent background');
    const rowRes = h('label.field', null, h('span', null, 'Video resolution'), resSel);
    const rowBleed = h('label.check', null, bleedIn, ` Include ${f.bleedMm || 3} mm bleed (for professional printing)`);

    function refresh() {
      state.type = typeSel.value;
      state.pages = pagesSel.value;
      state.scale = parseFloat(scaleSel.value);
      state.quality = qualityIn.value / 100;
      state.transparent = transIn.checked;
      state.bleed = bleedIn.checked;
      if (state.type === 'mp4') state.scale = parseFloat(resSel.value);
      qualityVal.textContent = qualityIn.value + '%';
      const raster = state.type === 'png' || state.type === 'jpg';
      rowScale.style.display = raster ? '' : 'none';
      rowQuality.style.display = state.type === 'jpg' ? '' : 'none';
      rowTrans.style.display = state.type === 'png' || state.type === 'svg' ? '' : 'none';
      rowBleed.style.display = state.type === 'pdf' && isPrint && f.bleedMm ? '' : 'none';
      rowRes.style.display = state.type === 'mp4' ? '' : 'none';
      pagesRow.style.display = state.type === 'mp4' ? 'none' : '';
      let txt;
      if (raster) {
        let w = Math.round(size.w * state.scale), hh = Math.round(size.h * state.scale);
        if (w > MAX_SIDE || hh > MAX_SIDE) { const k = MAX_SIDE / Math.max(w, hh); w = Math.floor(w * k); hh = Math.floor(hh * k); txt = `Output: ${w} × ${hh} px (limited to ${MAX_SIDE} px per side)`; }
        else txt = `Output: ${w} × ${hh} px`;
        if (isPrint) txt += ` · ${inches.w.toFixed(2)} × ${inches.h.toFixed(2)} in`;
      } else if (state.type === 'mp4') {
        txt = `Length ${root.DS.video.fmtTime(total)} · ${doc.pages.length} scene${doc.pages.length > 1 ? 's' : ''} · 30 fps · H.264 + AAC. Recording takes as long as the video plays.`;
      } else if (state.type === 'pdf') {
        txt = `Page size: ${formats.label(f)}${state.bleed ? ' + bleed' : ''} · text and shapes stay sharp at any zoom`;
      } else {
        txt = 'Vector file. Embedded photos keep their original resolution.';
      }
      info.textContent = txt;
    }
    const pagesRow = h('label.field', null, h('span', null, 'Pages'), pagesSel);
    if (doc.pages.length < 2) pagesRow.classList.add('hidden');
    [typeSel, pagesSel, scaleSel, qualityIn, transIn, bleedIn, resSel].forEach((el) => el.addEventListener('input', refresh));
    refresh();

    const body = h('div.export-body', null,
      h('label.field', null, h('span', null, 'File type'), typeSel),
      pagesRow, rowScale, rowRes, rowQuality, rowTrans, rowBleed, info);

    const go = await ui.modal({
      title: 'Export your design',
      body,
      actions: [{ label: 'Cancel', value: false }, { label: 'Export', value: true, primary: true }]
    });
    if (!go) return;
    refresh();
    const busy = state.type === 'mp4' ? () => {} : showBusy('Exporting…');
    try {
      const res = await runExport(doc, pageIndex, state);
      if (res && (res.path || res.dir)) {
        const where = res.path || res.dir;
        const t = h('span', null, 'Exported. ', h('a', { href: '#', on: { click: (e) => { e.preventDefault(); window.api.showItemInFolder(res.path || res.paths[0]); } } }, 'Show in folder'));
        ui.toast(t, 'success');
        return where;
      }
    } catch (err) {
      ui.toast('Export failed: ' + err.message, 'error');
    } finally {
      busy();
    }
  }

  function showBusy(message) {
    const text = h('div', null, message);
    const el = h('div.busy', null, h('div.spinner'), text);
    document.body.appendChild(el);
    const done = () => el.remove();
    done.update = (m) => { text.textContent = m; };
    return done;
  }

  root.DS.exporter = { pageSvg, rasterize, thumbnail, runExport, openDialog, showBusy };
})(self);
