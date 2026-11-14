// The design editor: canvas interaction, panels, pages, history and autosave.
(function (root) {
  'use strict';
  const { formats, doc: D, render, templates, ui, exporter } = root.DS;
  const { h, icon } = ui;
  const $ = (id) => document.getElementById(id);

  const FONTS = ['Segoe UI', 'Arial', 'Arial Black', 'Bahnschrift', 'Calibri', 'Cambria', 'Candara', 'Comic Sans MS', 'Consolas',
    'Constantia', 'Corbel', 'Courier New', 'Franklin Gothic Medium', 'Gabriola', 'Georgia', 'Impact', 'Ink Free', 'Lucida Console',
    'Palatino Linotype', 'Segoe Print', 'Segoe Script', 'Sitka Text', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana',
    'Urdu Typesetting', 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu'];
  const SWATCHES = ['#ffffff', '#f8fafc', '#e2e8f0', '#94a3b8', '#475569', '#1f2333', '#000000', '#fee2e2', '#ef4444', '#b91c1c',
    '#ffedd5', '#f97316', '#fef3c7', '#facc15', '#dcfce7', '#22c55e', '#15803d', '#ccfbf1', '#14b8a6', '#dbeafe', '#3b82f6', '#1e3a8a',
    '#ede9fe', '#8b5cf6', '#fce7f3', '#ec4899', '#064e3b', '#7c2d12'];
  const GRADIENTS = [['#ff4d6d', '#ff9e40'], ['#4f46e5', '#ec4899'], ['#0ea5e9', '#22c55e'], ['#0f172a', '#312e81'], ['#f6d365', '#fda085'],
    ['#a1c4fd', '#c2e9fb'], ['#064e3b', '#10b981'], ['#111827', '#6b7280'], ['#fbc2eb', '#a6c1ee'], ['#f83600', '#f9d423']];

  const E = {
    doc: null, filePath: null, pageIndex: 0, sel: [], zoom: 1, history: new D.History(100),
    dirty: false, saving: false, clipboard: null, snap: true, grid: false, leftTab: 'templates',
    drag: null, editingText: null, spaceDown: false, blobUrls: new Map(), onExit: null
  };

  // ---------------------------------------------------------------- helpers
  const page = () => E.doc.pages[E.pageIndex];
  const size = () => formats.canvasSize(E.doc.format);
  const selected = () => page().elements.filter((e) => E.sel.includes(e.id));
  const byId = (id) => page().elements.find((e) => e.id === id);

  function dataUrlToBlob(dataUrl) {
    const [head, body] = dataUrl.split(',');
    const mime = (/data:([^;]+)/.exec(head) || [])[1] || 'application/octet-stream';
    if (/;base64/.test(head)) {
      const bin = atob(body);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: mime });
    }
    return new Blob([decodeURIComponent(body)], { type: mime });
  }

  // In the editor, images are shown through short blob: URLs instead of huge data URLs.
  function resolveSrcForEditor(src) {
    if (typeof src !== 'string' || !src.startsWith('asset:')) return src || '';
    const id = src.slice(6);
    if (!E.blobUrls.has(id)) {
      const data = E.doc.assets[id];
      if (!data) return '';
      E.blobUrls.set(id, URL.createObjectURL(dataUrlToBlob(data)));
    }
    return E.blobUrls.get(id);
  }
  function releaseBlobs() {
    for (const u of E.blobUrls.values()) URL.revokeObjectURL(u);
    E.blobUrls.clear();
  }

  function rot(x, y, deg) {
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return [x * c - y * s, x * s + y * c];
  }
  // local (0..w, 0..h) point of element -> page point
  function localToPage(el, lx, ly) {
    const hh = el.type === 'line' ? 0 : el.h;
    const cx = el.x + el.w / 2, cy = el.y + hh / 2;
    const [rx, ry] = rot(lx - el.w / 2, ly - hh / 2, el.rotation || 0);
    return [cx + rx, cy + ry];
  }
  function pointerToPage(e) {
    const r = $('page-svg').getBoundingClientRect();
    return [(e.clientX - r.left) / E.zoom, (e.clientY - r.top) / E.zoom];
  }

  // ---------------------------------------------------------------- history & saving
  function commit() {
    if (E.history.push(D.snapshot(E.doc))) {
      E.dirty = true;
      setSaveStatus('Unsaved changes');
      autosave();
      updateToolbar();
      schedulePageThumbs();
    }
  }
  function restore(state) {
    if (!state) return;
    const assets = E.doc.assets;
    E.doc = Object.assign(state, { assets });
    E.pageIndex = Math.min(E.pageIndex, E.doc.pages.length - 1);
    E.sel = E.sel.filter((id) => page().elements.some((e) => e.id === id));
    E.dirty = true;
    autosave();
    renderAll();
  }
  const undo = () => { finishTextEdit(); restore(E.history.undo()); };
  const redo = () => { finishTextEdit(); restore(E.history.redo()); };

  function setSaveStatus(t) { $('save-status').textContent = t; }

  const autosave = ui.debounce(() => save(false), 1500);

  async function save(manual) {
    if (!E.doc || E.saving) { if (E.saving) autosave(); return; }
    E.saving = true;
    setSaveStatus('Saving…');
    try {
      E.doc.updatedAt = Date.now();
      D.pruneAssets(E.doc);
      E.doc.thumbnail = await exporter.thumbnail(E.doc);
      const res = await window.api.saveProject(E.doc, E.filePath);
      E.filePath = res.path;
      E.dirty = false;
      setSaveStatus('All changes saved');
      if (manual) ui.toast('Design saved', 'success');
    } catch (err) {
      setSaveStatus('Not saved');
      ui.toast('Could not save: ' + err.message, 'error');
    } finally {
      E.saving = false;
    }
  }

  // ---------------------------------------------------------------- rendering
  function renderAll() {
    renderCanvas();
    renderOverlay();
    renderRightPanel();
    renderLeftPanel();
    renderPages();
    updateToolbar();
  }

  function renderCanvas() {
    const s = size();
    const out = render.renderPage(page(), E.doc.format, { measure: ui.measure, editor: true, resolveSrc: resolveSrcForEditor });
    // keep text boxes as tall as their wrapped text
    for (const el of page().elements) {
      if (el.type === 'text' && out.heights[el.id] && Math.abs(out.heights[el.id] - el.h) > 0.01) el.h = out.heights[el.id];
    }
    const holder = $('page-svg');
    holder.innerHTML = out.svg;
    const svg = holder.firstChild;
    svg.style.width = s.w * E.zoom + 'px';
    svg.style.height = s.h * E.zoom + 'px';
    svg.setAttribute('width', s.w * E.zoom);
    svg.setAttribute('height', s.h * E.zoom);
    if (E.editingText) {
      const g = holder.querySelector(`[data-id="${CSS.escape(E.editingText)}"]`);
      if (g) g.style.opacity = '0';
    }
    const ph = $('page-holder');
    ph.style.width = s.w * E.zoom + 'px';
    ph.style.height = s.h * E.zoom + 'px';
    if (E.doc.format.shape === 'circle') ph.classList.add('circle-guide'); else ph.classList.remove('circle-guide');
  }

  function svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    return el;
  }

  function renderOverlay(guides) {
    const s = size();
    const ov = $('overlay');
    ov.setAttribute('viewBox', `0 0 ${s.w} ${s.h}`);
    ov.style.width = s.w * E.zoom + 'px';
    ov.style.height = s.h * E.zoom + 'px';
    ov.innerHTML = '';
    const z = E.zoom;
    const lw = 1.5 / z;

    if (E.grid) {
      const step = gridStep();
      const g = svgEl('g', { stroke: '#6366f1', 'stroke-opacity': 0.18, 'stroke-width': 1 / z });
      for (let x = step; x < s.w; x += step) g.appendChild(svgEl('line', { x1: x, y1: 0, x2: x, y2: s.h }));
      for (let y = step; y < s.h; y += step) g.appendChild(svgEl('line', { x1: 0, y1: y, x2: s.w, y2: y }));
      ov.appendChild(g);
    }
    // print safety margin (3 mm inside the trim) for print formats
    if (E.doc.format.kind === 'print') {
      const m = formats.toPx(3, 'mm');
      ov.appendChild(svgEl('rect', { x: m, y: m, width: s.w - 2 * m, height: s.h - 2 * m, fill: 'none', stroke: '#06b6d4', 'stroke-width': 1 / z, 'stroke-dasharray': `${4 / z} ${4 / z}`, opacity: 0.6 }));
    }

    const sel = selected();
    for (const el of sel) {
      if (el.type === 'line') {
        const [x1, y1] = localToPage(el, 0, 0), [x2, y2] = localToPage(el, el.w, 0);
        ov.appendChild(svgEl('line', { x1, y1, x2, y2, stroke: '#7c3aed', 'stroke-width': lw * 1.5, 'stroke-dasharray': `${4 / z} ${3 / z}` }));
      } else {
        const pts = [[0, 0], [el.w, 0], [el.w, el.h], [0, el.h]].map(([a, b]) => localToPage(el, a, b).join(',')).join(' ');
        ov.appendChild(svgEl('polygon', { points: pts, fill: 'none', stroke: '#7c3aed', 'stroke-width': lw }));
      }
    }

    if (sel.length > 1) {
      const b = D.unionBounds(sel);
      ov.appendChild(svgEl('rect', { x: b.x, y: b.y, width: b.w, height: b.h, fill: 'none', stroke: '#7c3aed', 'stroke-width': lw, 'stroke-dasharray': `${5 / z} ${4 / z}` }));
      if (!sel.some((e) => e.locked)) {
        for (const [name, x, y] of [['nw', b.x, b.y], ['ne', b.x + b.w, b.y], ['se', b.x + b.w, b.y + b.h], ['sw', b.x, b.y + b.h]]) {
          ov.appendChild(handle(name, x, y, 'multi'));
        }
      }
    } else if (sel.length === 1 && !sel[0].locked && !E.editingText) {
      const el = sel[0];
      let names;
      if (el.type === 'line') names = { p1: [0, 0], p2: [el.w, 0] };
      else {
        const all = { nw: [0, 0], n: [el.w / 2, 0], ne: [el.w, 0], e: [el.w, el.h / 2], se: [el.w, el.h], s: [el.w / 2, el.h], sw: [0, el.h], w: [0, el.h / 2] };
        names = {};
        const keep = el.type === 'text' ? ['nw', 'ne', 'se', 'sw', 'e', 'w'] : Object.keys(all);
        for (const k of keep) names[k] = all[k];
      }
      for (const [name, [lx, ly]] of Object.entries(names)) {
        const [x, y] = localToPage(el, lx, ly);
        ov.appendChild(handle(name, x, y, el.rotation));
      }
      if (el.type !== 'line') {
        const [rx, ry] = localToPage(el, el.w / 2, el.h + 28 / z);
        const [bx, by] = localToPage(el, el.w / 2, el.h);
        ov.appendChild(svgEl('line', { x1: bx, y1: by, x2: rx, y2: ry, stroke: '#7c3aed', 'stroke-width': lw }));
        const c = svgEl('circle', { cx: rx, cy: ry, r: 7 / z, fill: '#ffffff', stroke: '#7c3aed', 'stroke-width': lw, class: 'handle rotate' });
        c.dataset.handle = 'rotate';
        ov.appendChild(c);
      }
    }

    for (const g of guides || []) {
      if (g.x != null) ov.appendChild(svgEl('line', { x1: g.x, y1: 0, x2: g.x, y2: s.h, stroke: '#ec4899', 'stroke-width': lw }));
      if (g.y != null) ov.appendChild(svgEl('line', { x1: 0, y1: g.y, x2: s.w, y2: g.y, stroke: '#ec4899', 'stroke-width': lw }));
    }
    if (E.drag && E.drag.mode === 'marquee' && E.drag.rect) {
      const r = E.drag.rect;
      ov.appendChild(svgEl('rect', { x: r.x, y: r.y, width: r.w, height: r.h, fill: '#7c3aed22', stroke: '#7c3aed', 'stroke-width': lw }));
    }
  }

  function handle(name, x, y, rotation) {
    const z = E.zoom, sz = 10 / z;
    const cursorMap = { n: 'ns', s: 'ns', e: 'ew', w: 'ew', nw: 'nwse', se: 'nwse', ne: 'nesw', sw: 'nesw', p1: 'move', p2: 'move' };
    const r = svgEl('rect', { x: x - sz / 2, y: y - sz / 2, width: sz, height: sz, rx: 2 / z, fill: '#ffffff', stroke: '#7c3aed', 'stroke-width': 1.5 / z, class: 'handle' });
    if (typeof rotation === 'number' && rotation) r.setAttribute('transform', `rotate(${rotation} ${x} ${y})`);
    r.style.cursor = cursorMap[name] === 'move' ? 'move' : cursorMap[name] + '-resize';
    r.dataset.handle = name;
    return r;
  }

  function gridStep() {
    const s = size();
    const raw = Math.min(s.w, s.h) / 20;
    const nice = [5, 10, 20, 25, 40, 50, 100, 200];
    return nice.find((v) => v >= raw) || 200;
  }

  // ---------------------------------------------------------------- zoom
  function setZoom(z, anchorClient) {
    const ws = $('workspace');
    const old = E.zoom;
    z = Math.max(0.05, Math.min(4, z));
    let ax, ay;
    if (anchorClient) {
      const r = $('page-holder').getBoundingClientRect();
      ax = (anchorClient.x - r.left) / old; ay = (anchorClient.y - r.top) / old;
    }
    E.zoom = z;
    renderCanvas();
    renderOverlay();
    positionTextEditor();
    $('zoom-range').value = Math.round(z * 100);
    $('zoom-label').textContent = Math.round(z * 100) + '%';
    if (anchorClient) {
      const r = $('page-holder').getBoundingClientRect();
      ws.scrollLeft += r.left + ax * z - anchorClient.x;
      ws.scrollTop += r.top + ay * z - anchorClient.y;
    }
  }
  function zoomToFit() {
    const ws = $('workspace');
    const s = size();
    const z = Math.min((ws.clientWidth - 80) / s.w, (ws.clientHeight - 80) / s.h);
    setZoom(Math.max(0.05, Math.min(z, 2)));
  }

  // ---------------------------------------------------------------- selection
  function select(ids, additive) {
    finishTextEdit();
    ids = D.expandGroups(page(), ids);
    if (additive) {
      const allIn = ids.every((id) => E.sel.includes(id));
      E.sel = allIn ? E.sel.filter((id) => !ids.includes(id)) : Array.from(new Set(E.sel.concat(ids)));
    } else E.sel = ids;
    renderOverlay();
    renderRightPanel();
    if (E.leftTab === 'layers') renderLeftPanel();
  }

  // ---------------------------------------------------------------- pointer interaction
  function onPointerDown(e) {
    if (e.button === 1 || (e.button === 0 && E.spaceDown)) { startPan(e); return; }
    if (e.button !== 0) return;
    if (e.target.closest('#text-editor')) return;
    const handleName = e.target.dataset && e.target.dataset.handle;
    const p = pointerToPage(e);

    if (handleName) {
      finishTextEdit();
      e.preventDefault();
      const sel = selected();
      E.drag = {
        mode: handleName === 'rotate' ? 'rotate' : (sel.length > 1 ? 'multi-resize' : 'resize'),
        handle: handleName, start: p, orig: D.clone(sel), bounds: D.unionBounds(sel), moved: false
      };
      capture(e);
      return;
    }

    const g = e.target.closest && e.target.closest('#page-svg [data-id]');
    if (g) {
      const id = g.dataset.id;
      const el = byId(id);
      if (E.editingText && E.editingText === id) return;
      if (!E.sel.includes(id) || e.shiftKey) select([id], e.shiftKey);
      else finishTextEdit();
      if (!el || !E.sel.length) return;
      e.preventDefault();
      E.drag = { mode: 'move', start: p, orig: D.clone(selected()), bounds: D.unionBounds(selected()), moved: false, clickedId: id };
      capture(e);
      return;
    }

    // empty space: marquee selection
    finishTextEdit();
    if (!e.shiftKey) select([]);
    E.drag = { mode: 'marquee', start: p, rect: null, base: e.shiftKey ? E.sel.slice() : [] };
    capture(e);
  }

  function capture(e) {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
  }

  function onPointerMove(e) {
    const d = E.drag;
    if (!d) return;
    const p = pointerToPage(e);
    const dx = p[0] - d.start[0], dy = p[1] - d.start[1];
    if (!d.moved && Math.hypot(dx * E.zoom, dy * E.zoom) < 3) return;
    d.moved = true;
    let guides = [];
    if (d.mode === 'move') guides = doMove(d, dx, dy);
    else if (d.mode === 'resize') doResize(d, p, e.shiftKey);
    else if (d.mode === 'multi-resize') doMultiResize(d, dx, dy);
    else if (d.mode === 'rotate') doRotate(d, p, e.shiftKey);
    else if (d.mode === 'marquee') {
      const x = Math.min(d.start[0], p[0]), y = Math.min(d.start[1], p[1]);
      d.rect = { x, y, w: Math.abs(dx), h: Math.abs(dy) };
      const hit = page().elements.filter((el) => {
        if (el.hidden) return false;
        const b = D.bounds(el);
        return b.x >= x && b.y >= y && b.x + b.w <= x + d.rect.w && b.y + b.h <= y + d.rect.h;
      }).map((el) => el.id);
      E.sel = D.expandGroups(page(), Array.from(new Set(d.base.concat(hit))));
      renderOverlay();
      return;
    }
    renderCanvas();
    renderOverlay(guides);
  }

  function onPointerUp() {
    window.removeEventListener('pointermove', onPointerMove);
    const d = E.drag;
    E.drag = null;
    if (!d) return;
    if (d.mode === 'marquee') { renderOverlay(); renderRightPanel(); if (E.leftTab === 'layers') renderLeftPanel(); return; }
    if (d.moved) { commit(); renderOverlay(); renderRightPanel(); }
    else if (d.mode === 'move' && d.clickedId && E.sel.length > 1 && !d.shift) {
      // plain click on an already-selected item inside a multi-selection: keep selection
      renderOverlay();
    }
  }

  function doMove(d, dx, dy) {
    const guides = [];
    if (d.orig.some((o) => o.locked)) return guides;
    if (E.snap) {
      const s = size();
      const thr = 6 / E.zoom;
      const b = d.bounds;
      const moving = new Set(d.orig.map((o) => o.id));
      const others = page().elements.filter((el) => !moving.has(el.id) && !el.hidden).map((el) => D.bounds(el));
      const xs = [0, s.w / 2, s.w], ys = [0, s.h / 2, s.h];
      for (const o of others) { xs.push(o.x, o.x + o.w / 2, o.x + o.w); ys.push(o.y, o.y + o.h / 2, o.y + o.h); }
      const snapAxis = (targets, pos, len) => {
        let best = null;
        for (const t of targets) for (const off of [0, len / 2, len]) {
          const diff = t - (pos + off);
          if (Math.abs(diff) < thr && (!best || Math.abs(diff) < Math.abs(best.diff))) best = { diff, line: t };
        }
        return best;
      };
      if (E.grid) {
        const st = gridStep();
        const gx = Math.round((b.x + dx) / st) * st - (b.x + dx);
        const gy = Math.round((b.y + dy) / st) * st - (b.y + dy);
        if (Math.abs(gx) < thr) dx += gx;
        if (Math.abs(gy) < thr) dy += gy;
      }
      const sx = snapAxis(xs, b.x + dx, b.w);
      if (sx) { dx += sx.diff; guides.push({ x: sx.line }); }
      const sy = snapAxis(ys, b.y + dy, b.h);
      if (sy) { dy += sy.diff; guides.push({ y: sy.line }); }
    }
    for (const o of d.orig) {
      const el = byId(o.id);
      if (el) { el.x = o.x + dx; el.y = o.y + dy; }
    }
    return guides;
  }

  function doResize(d, p, shift) {
    const o = d.orig[0];
    const el = byId(o.id);
    if (!el) return;
    if (el.type === 'line') {
      let a = localToPage(o, 0, 0), b = localToPage(o, o.w, 0);
      if (d.handle === 'p1') a = p.slice(); else b = p.slice();
      let ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
      let len = Math.max(4, Math.hypot(b[0] - a[0], b[1] - a[1]));
      if (shift) {
        ang = Math.round(ang / 15) * 15;
        const fixed = d.handle === 'p1' ? b : a;
        const sign = d.handle === 'p1' ? -1 : 1;
        const [ux, uy] = [Math.cos(ang * Math.PI / 180), Math.sin(ang * Math.PI / 180)];
        if (d.handle === 'p1') a = [fixed[0] + sign * ux * len, fixed[1] + sign * uy * len];
        else b = [fixed[0] + ux * len, fixed[1] + uy * len];
      }
      const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
      el.w = len; el.rotation = ang; el.x = cx - len / 2; el.y = cy;
      return;
    }
    const dirs = { nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0] };
    const [hx, hy] = dirs[d.handle];
    const [ldx, ldy] = rot(p[0] - d.start[0], p[1] - d.start[1], -(o.rotation || 0));
    const corner = hx !== 0 && hy !== 0;
    let nw = o.w + hx * ldx, nh = o.h + hy * ldy;
    const keepRatio = corner && (o.type === 'text' || o.type === 'image' || shift);
    let scale = 1;
    if (keepRatio) {
      scale = (hx * ldx * o.w + hy * ldy * o.h) / (o.w * o.w + o.h * o.h) + 1;
      scale = Math.max(scale, 8 / Math.min(o.w, o.h || 1));
      nw = o.w * scale; nh = o.h * scale;
    }
    nw = Math.max(8, nw); nh = Math.max(8, nh);
    if (o.type === 'text' && !corner) nh = o.h;
    const [cdx, cdy] = rot(hx * (nw - o.w) / 2, hy * (nh - o.h) / 2, o.rotation || 0);
    const cx = o.x + o.w / 2 + cdx, cy = o.y + o.h / 2 + cdy;
    el.w = nw;
    el.x = cx - nw / 2;
    if (o.type === 'text') {
      if (corner) {
        el.fontSize = Math.max(4, o.fontSize * scale);
        if (o.outline) el.outline.width = o.outline.width * scale;
        if (o.letterSpacing) el.letterSpacing = o.letterSpacing * scale;
        el.h = nh;
      }
      el.y = cy - (corner ? nh : o.h) / 2;
    } else {
      el.h = nh;
      el.y = cy - nh / 2;
    }
  }

  function doMultiResize(d, dx, dy) {
    const b = d.bounds;
    const dirs = { nw: [-1, -1], ne: [1, -1], se: [1, 1], sw: [-1, 1] };
    const [hx, hy] = dirs[d.handle];
    let s = (hx * dx * b.w + hy * dy * b.h) / (b.w * b.w + b.h * b.h) + 1;
    s = Math.max(0.05, s);
    const ax = hx < 0 ? b.x + b.w : b.x, ay = hy < 0 ? b.y + b.h : b.y;
    for (const o of d.orig) {
      const el = byId(o.id);
      if (!el) continue;
      const oh = o.type === 'line' ? 0 : o.h;
      const ocx = o.x + o.w / 2, ocy = o.y + oh / 2;
      const ncx = ax + (ocx - ax) * s, ncy = ay + (ocy - ay) * s;
      el.w = o.w * s;
      el.h = o.h * s;
      if (o.type === 'text') { el.fontSize = o.fontSize * s; if (o.letterSpacing) el.letterSpacing = o.letterSpacing * s; }
      el.x = ncx - el.w / 2;
      el.y = ncy - (o.type === 'line' ? 0 : el.h / 2);
    }
  }

  function doRotate(d, p, shift) {
    const o = d.orig[0];
    const el = byId(o.id);
    if (!el) return;
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    let ang = Math.atan2(p[1] - cy, p[0] - cx) * 180 / Math.PI - 90;
    if (shift) ang = Math.round(ang / 15) * 15;
    else for (const snapA of [0, 90, 180, 270, -90, -180, -270]) if (Math.abs(ang - snapA) < 3) ang = snapA;
    ang = ((ang % 360) + 540) % 360 - 180;
    el.rotation = Math.round(ang * 10) / 10;
  }

  function startPan(e) {
    e.preventDefault();
    const ws = $('workspace');
    const sx = e.clientX, sy = e.clientY, sl = ws.scrollLeft, st = ws.scrollTop;
    ws.classList.add('panning');
    const move = (ev) => { ws.scrollLeft = sl - (ev.clientX - sx); ws.scrollTop = st - (ev.clientY - sy); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', () => { window.removeEventListener('pointermove', move); ws.classList.remove('panning'); }, { once: true });
  }

  // ---------------------------------------------------------------- text editing
  function startTextEdit(id, selectAll) {
    const el = byId(id);
    if (!el || el.type !== 'text' || el.locked) return;
    E.sel = [id];
    E.editingText = id;
    const ta = $('text-editor');
    ta.value = el.text;
    ta.classList.remove('hidden');
    renderCanvas();
    renderOverlay();
    positionTextEditor();
    ta.focus();
    if (selectAll) ta.select();
    else ta.setSelectionRange(ta.value.length, ta.value.length);
    renderRightPanel();
  }

  function positionTextEditor() {
    if (!E.editingText) return;
    const el = byId(E.editingText);
    const ta = $('text-editor');
    if (!el) { finishTextEdit(); return; }
    const z = E.zoom;
    const rtl = render.isRtl(el);
    Object.assign(ta.style, {
      left: el.x * z + 'px', top: el.y * z + 'px', width: el.w * z + 'px', height: Math.max(el.h, el.fontSize * el.lineHeight) * z + 'px',
      transform: el.rotation ? `rotate(${el.rotation}deg)` : '',
      font: render.fontCss(el, el.fontSize * z),
      lineHeight: el.lineHeight,
      letterSpacing: (el.letterSpacing || 0) * z + 'px',
      color: el.color, textAlign: el.align,
      direction: rtl ? 'rtl' : 'ltr',
      textTransform: el.uppercase ? 'uppercase' : 'none',
      textDecoration: el.underline ? 'underline' : 'none'
    });
  }

  function onTextInput() {
    const el = byId(E.editingText);
    if (!el) return;
    el.text = $('text-editor').value;
    renderCanvas();
    positionTextEditor();
  }

  function finishTextEdit() {
    if (!E.editingText) return;
    const id = E.editingText;
    E.editingText = null;
    const ta = $('text-editor');
    ta.classList.add('hidden');
    ta.blur();
    const el = byId(id);
    if (el && !el.text.trim()) { D.remove(page(), [id]); E.sel = []; }
    commit();
    renderCanvas();
    renderOverlay();
    renderRightPanel();
  }

  // ---------------------------------------------------------------- adding things
  function addElement(el, opts) {
    const s = size();
    const o = opts || {};
    if (o.center !== false) {
      el.x = (o.at ? o.at[0] : s.w / 2) - el.w / 2;
      el.y = (o.at ? o.at[1] : s.h / 2) - (el.type === 'line' ? 0 : el.h / 2);
    }
    page().elements.push(el);
    E.sel = [el.id];
    commit();
    renderAll();
    return el;
  }

  function addText(preset) {
    const s = size();
    const k = Math.min(s.w, s.h) / 1080;
    const presets = {
      heading: { text: 'Add a heading', fontSize: 96 * k, fontWeight: 800 },
      subheading: { text: 'Add a subheading', fontSize: 56 * k, fontWeight: 600 },
      body: { text: 'Add a little bit of body text', fontSize: 34 * k, fontWeight: 400 },
      urdu: { text: 'یہاں اردو لکھیں', fontSize: 64 * k, fontWeight: 400, rtl: 'rtl', align: 'right' }
    };
    const p = presets[preset] || presets.body;
    const el = D.createElement('text', Object.assign({ w: Math.min(s.w * 0.8, p.fontSize * 12) }, p));
    el.h = render.layoutText(el, ui.measure).height;
    addElement(el);
    startTextEdit(el.id, true);
  }

  function addShape(kind) {
    const s = size();
    const d = Math.min(s.w, s.h) * 0.3;
    if (kind === 'line' || kind === 'arrow-line') {
      addElement(D.createElement('line', { w: d * 1.4, strokeWidth: Math.max(2, d / 40), endCap: kind === 'arrow-line' ? 'arrow' : 'none', name: kind === 'line' ? 'Line' : 'Arrow' }));
      return;
    }
    const isIcon = kind.startsWith('icon:');
    const props = { shape: kind, w: d, h: d, name: isIcon ? 'Icon' : kind[0].toUpperCase() + kind.slice(1) };
    if (isIcon) { props.fill = '#1f2333'; props.strokeWidth = 2; props.w = props.h = d * 0.6; }
    if (kind === 'arrow') { props.h = d * 0.55; }
    if (kind === 'speech') { props.w = d * 1.3; }
    addElement(D.createElement('shape', props));
  }

  async function readImageFile(file) {
    const dataUrl = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = () => rej(new Error('Could not read ' + file.name));
      fr.readAsDataURL(file);
    });
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error(file.name + ' is not a supported image'));
      i.src = dataUrl;
    });
    let w = img.naturalWidth || 800, hh = img.naturalHeight || 600;
    let out = dataUrl;
    const MAX = 4096;
    if (file.type !== 'image/svg+xml' && (w > MAX || hh > MAX)) {
      const k = MAX / Math.max(w, hh);
      const c = document.createElement('canvas');
      c.width = Math.round(w * k); c.height = Math.round(hh * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      out = c.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.92);
      w = c.width; hh = c.height;
    }
    return { dataUrl: out, w, h: hh, name: file.name };
  }

  function placeImage(src, w, hh, at, name) {
    const s = size();
    const k = Math.min(1, (s.w * 0.6) / w, (s.h * 0.6) / hh);
    return addElement(D.createElement('image', { src, w: w * k, h: hh * k, naturalW: w, naturalH: hh, name: name || 'Image' }), { at });
  }

  async function addImageFiles(files, at) {
    const list = Array.from(files).filter((f) => /^image\//.test(f.type));
    if (!list.length) { ui.toast('Please choose an image file (PNG, JPEG, WebP, GIF, SVG).', 'error'); return; }
    for (const f of list) {
      try {
        const r = await readImageFile(f);
        placeImage(D.addAsset(E.doc, r.dataUrl), r.w, r.h, at, r.name.replace(/\.[^.]+$/, ''));
      } catch (err) {
        ui.toast(err.message, 'error');
      }
    }
    if (E.leftTab === 'uploads') renderLeftPanel();
  }

  function applyTemplate(t, asNewPage) {
    const s = size();
    const out = t.build(s.w, s.h);
    if (asNewPage) {
      const pg = D.newPage(out.background);
      pg.elements = out.elements;
      E.doc.pages.splice(E.pageIndex + 1, 0, pg);
      E.pageIndex++;
    } else {
      page().background = out.background;
      page().elements = out.elements;
    }
    E.sel = [];
    commit();
    renderAll();
  }

  // ---------------------------------------------------------------- commands
  function modifySelected(fn, noCommit) {
    const sel = selected();
    if (!sel.length) return;
    sel.forEach(fn);
    if (!noCommit) commit();
    renderCanvas();
    renderOverlay();
  }

  const cmd = {
    delete() {
      if (!E.sel.length) return;
      const removable = selected().filter((e) => !e.locked).map((e) => e.id);
      if (!removable.length) { ui.toast('Unlock the element to delete it.'); return; }
      D.remove(page(), removable);
      E.sel = [];
      commit(); renderAll();
    },
    duplicate() {
      if (!E.sel.length) return;
      E.sel = D.duplicate(page(), E.sel, Math.min(size().w, size().h) * 0.03);
      commit(); renderAll();
    },
    copy() {
      if (!E.sel.length) return;
      E.clipboard = D.clone(selected());
      ui.toast(`Copied ${E.clipboard.length} item${E.clipboard.length > 1 ? 's' : ''}`);
    },
    cut() { cmd.copy(); cmd.delete(); },
    paste() {
      if (!E.clipboard) return;
      const groupMap = {};
      const copies = E.clipboard.map((c) => {
        const n = D.clone(c);
        n.id = D.uid();
        n.x += 20; n.y += 20;
        if (n.groupId) n.groupId = groupMap[n.groupId] || (groupMap[n.groupId] = D.uid());
        return n;
      });
      E.clipboard = D.clone(copies);
      page().elements.push(...copies);
      E.sel = copies.map((c) => c.id);
      commit(); renderAll();
    },
    selectAll() { E.sel = page().elements.filter((e) => !e.hidden).map((e) => e.id); renderOverlay(); renderRightPanel(); },
    group() { if (E.sel.length > 1) { D.group(page(), E.sel); commit(); renderAll(); } },
    ungroup() { D.ungroup(page(), E.sel); commit(); renderAll(); },
    arrange(dir) { D.reorder(page(), E.sel, dir); commit(); renderAll(); },
    align(mode) { const s = size(); D.align(page(), E.sel, mode, s.w, s.h); commit(); renderAll(); },
    distribute(axis) { D.distribute(page(), E.sel, axis); commit(); renderAll(); },
    toggleLock() {
      const anyUnlocked = selected().some((e) => !e.locked);
      modifySelected((e) => { e.locked = anyUnlocked; });
      renderRightPanel();
    },
    flip(axis) { modifySelected((e) => { if (axis === 'x') e.flipX = !e.flipX; else e.flipY = !e.flipY; }); },
    nudge(dx, dy) {
      const sel = selected().filter((e) => !e.locked);
      if (!sel.length) return;
      sel.forEach((e) => { e.x += dx; e.y += dy; });
      renderCanvas(); renderOverlay();
      nudgeCommit();
    }
  };
  const nudgeCommit = ui.debounce(() => { commit(); renderRightPanel(); }, 400);

  // ---------------------------------------------------------------- pages
  const pageCmd = {
    add() { E.doc.pages.splice(E.pageIndex + 1, 0, D.newPage(D.clone(page().background))); E.pageIndex++; E.sel = []; commit(); renderAll(); },
    duplicate() {
      const copy = D.clone(page());
      copy.id = D.uid();
      copy.elements.forEach((e) => { e.id = D.uid(); });
      E.doc.pages.splice(E.pageIndex + 1, 0, copy);
      E.pageIndex++; E.sel = []; commit(); renderAll();
    },
    async remove() {
      if (E.doc.pages.length < 2) { ui.toast('A design needs at least one page.'); return; }
      if (page().elements.length && !(await ui.confirmDialog('Delete page', `Delete page ${E.pageIndex + 1}?`, 'Delete', true))) return;
      E.doc.pages.splice(E.pageIndex, 1);
      E.pageIndex = Math.min(E.pageIndex, E.doc.pages.length - 1);
      E.sel = []; commit(); renderAll();
    },
    move(delta) {
      const i = E.pageIndex, j = i + delta;
      if (j < 0 || j >= E.doc.pages.length) return;
      const ps = E.doc.pages;
      [ps[i], ps[j]] = [ps[j], ps[i]];
      E.pageIndex = j; commit(); renderAll();
    },
    go(i) { finishTextEdit(); E.pageIndex = i; E.sel = []; renderAll(); }
  };

  const schedulePageThumbs = ui.debounce(() => renderPages(), 600);

  function renderPages() {
    const box = $('pages');
    box.innerHTML = '';
    const s = size();
    const th = 46, tw = Math.max(26, Math.min(110, th * s.w / s.h));
    E.doc.pages.forEach((pg, i) => {
      const svg = render.renderPage(pg, E.doc.format, { measure: ui.measure, resolveSrc: resolveSrcForEditor, outW: tw, outH: th }).svg;
      const img = h('img', { src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), width: tw, height: th, draggable: false });
      box.appendChild(h('button.page-thumb' + (i === E.pageIndex ? '.active' : ''), { title: `Page ${i + 1}`, on: { click: () => pageCmd.go(i) } }, img, h('span', null, String(i + 1))));
    });
    const btn = (ic, title, fn, disabled) => h('button.tb-btn.icon.small', { title, html: icon(ic), disabled: !!disabled, on: { click: fn } });
    box.appendChild(h('div.page-actions', null,
      btn('plus', 'Add page', pageCmd.add),
      btn('copy', 'Duplicate page', pageCmd.duplicate),
      btn('up', 'Move page left', () => pageCmd.move(-1), E.pageIndex === 0),
      btn('down', 'Move page right', () => pageCmd.move(1), E.pageIndex === E.doc.pages.length - 1),
      btn('trash', 'Delete page', pageCmd.remove, E.doc.pages.length < 2)));
    box.querySelectorAll('.page-actions .tb-btn')[2].style.transform = 'rotate(-90deg)';
    box.querySelectorAll('.page-actions .tb-btn')[3].style.transform = 'rotate(-90deg)';
  }

  // ---------------------------------------------------------------- toolbar
  function updateToolbar() {
    $('tb-undo').disabled = !E.history.canUndo();
    $('tb-redo').disabled = !E.history.canRedo();
    const nameInput = $('doc-name');
    if (document.activeElement !== nameInput) nameInput.value = E.doc.name;
    const f = E.doc.format;
    $('doc-format').textContent = `${f.name} · ${formats.label(f)}`;
    renderCtxBar();
  }

  function renderCtxBar() {
    const bar = $('ctx-bar');
    bar.innerHTML = '';
    const tog = (ic, label, on, fn) => h('button.chip' + (on ? '.on' : ''), { title: label, on: { click: fn } }, h('span.ic', { html: icon(ic) }), label);
    bar.appendChild(tog('magnet', 'Snap', E.snap, () => { E.snap = !E.snap; renderCtxBar(); }));
    bar.appendChild(tog('grid', 'Grid', E.grid, () => { E.grid = !E.grid; renderCtxBar(); renderOverlay(); }));
    if (E.doc.format.kind === 'video') bar.appendChild(h('span.chip.info', { title: 'Timeline video editing is part of Phase 3' }, 'Video frame design · timeline editing arrives in Phase 3'));
    if (E.doc.format.kind === 'print') bar.appendChild(h('span.chip.info', { title: 'Keep important content inside the dashed line' }, 'Dashed line = safe area for printing'));
    const sel = selected();
    if (sel.length) {
      bar.appendChild(h('span.spacer'));
      bar.appendChild(h('span.muted', null, sel.length > 1 ? `${sel.length} selected` : (sel[0].name || sel[0].type)));
    }
  }

  // ---------------------------------------------------------------- left panel
  const TABS = [
    ['templates', 'Templates', 'templates'], ['elements', 'Elements', 'elements'], ['text', 'Text', 'text'],
    ['uploads', 'Uploads', 'uploads'], ['background', 'Background', 'background'], ['layers', 'Layers', 'layers'], ['ai', 'AI Tools', 'ai']
  ];

  function renderRail() {
    const rail = $('rail');
    rail.innerHTML = '';
    for (const [id, label, ic] of TABS) {
      rail.appendChild(h('button.rail-btn' + (E.leftTab === id ? '.active' : ''), {
        on: { click: () => { E.leftTab = id; renderRail(); renderLeftPanel(); } }
      }, h('span.ic', { html: icon(ic) }), h('span', null, label)));
    }
  }

  function renderLeftPanel() {
    const lp = $('left-panel');
    lp.innerHTML = '';
    const tab = E.leftTab;
    if (tab === 'templates') leftTemplates(lp);
    else if (tab === 'elements') leftElements(lp);
    else if (tab === 'text') leftText(lp);
    else if (tab === 'uploads') leftUploads(lp);
    else if (tab === 'background') leftBackground(lp);
    else if (tab === 'layers') leftLayers(lp);
    else if (tab === 'ai') leftAi(lp);
  }

  function leftTemplates(lp) {
    const s = size();
    lp.appendChild(h('h4', null, 'Templates'));
    lp.appendChild(h('p.muted.small', null, 'Click to apply to this page. Shift-click to add as a new page. Best matches for this size come first.'));
    const grid = h('div.tpl-grid');
    for (const t of templates.forFormat(E.doc.format)) {
      const out = t.build(s.w, s.h);
      const pg = Object.assign(D.newPage(out.background), { elements: out.elements });
      const tw = 128, th = Math.round(tw * s.h / s.w);
      const svg = render.renderPage(pg, E.doc.format, { measure: ui.measure, outW: tw, outH: Math.min(th, 220) }).svg;
      grid.appendChild(h('button.tpl', {
        title: t.name,
        on: {
          click: async (e) => {
            const asNew = e.shiftKey;
            if (!asNew && page().elements.length && !(await ui.confirmDialog('Apply template', 'Replace the content of this page with the template?', 'Replace'))) return;
            applyTemplate(t, asNew);
          }
        }
      }, h('img', { src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), draggable: false }), h('span', null, t.name)));
    }
    lp.appendChild(grid);
  }

  function leftElements(lp) {
    lp.appendChild(h('h4', null, 'Shapes'));
    const grid = h('div.el-grid');
    const preview = (props) => {
      const el = D.createElement('shape', Object.assign({ x: 6, y: 6, w: 52, h: 52, fill: '#6366f1', strokeWidth: 2 }, props));
      if (props.shape === 'arrow') { el.h = 30; el.y = 17; }
      const pg = { background: { type: 'solid', color: 'transparent' }, elements: [el] };
      return render.renderPage(pg, formats.custom(64, 64, 'px'), { measure: ui.measure, transparent: true }).svg;
    };
    for (const k of render.SHAPES) {
      grid.appendChild(h('button.el-btn', { title: k, html: preview({ shape: k, radius: k === 'rect' ? 0 : 0 }), on: { click: () => addShape(k) } }));
    }
    grid.appendChild(h('button.el-btn', { title: 'rounded rectangle', html: preview({ shape: 'rect', radius: 12 }), on: { click: () => { addShape('rect'); selected()[0].radius = Math.min(selected()[0].w, selected()[0].h) * 0.15; commit(); renderAll(); } } }));
    lp.appendChild(grid);

    lp.appendChild(h('h4', null, 'Lines'));
    const lines = h('div.el-grid');
    lines.appendChild(h('button.el-btn', { title: 'Line', html: '<svg viewBox="0 0 64 64"><line x1="8" y1="32" x2="56" y2="32" stroke="#1f2333" stroke-width="4" stroke-linecap="round"/></svg>', on: { click: () => addShape('line') } }));
    lines.appendChild(h('button.el-btn', { title: 'Arrow', html: '<svg viewBox="0 0 64 64"><line x1="8" y1="32" x2="46" y2="32" stroke="#1f2333" stroke-width="4" stroke-linecap="round"/><polygon points="58,32 44,23 44,41" fill="#1f2333"/></svg>', on: { click: () => addShape('arrow-line') } }));
    lp.appendChild(lines);

    lp.appendChild(h('h4', null, 'Icons'));
    const icons = h('div.el-grid');
    for (const name of Object.keys(render.ICONS)) {
      icons.appendChild(h('button.el-btn', { title: name, html: `<svg viewBox="-4 -4 32 32" fill="none" stroke="#1f2333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${render.ICONS[name]}</svg>`, on: { click: () => addShape('icon:' + name) } }));
    }
    lp.appendChild(icons);
    lp.appendChild(h('p.muted.small', null, 'Stock illustrations, stickers and photos come with the asset library (Phase 4).'));
  }

  function leftText(lp) {
    lp.appendChild(h('h4', null, 'Text'));
    lp.appendChild(h('button.btn.primary.wide', { on: { click: () => addText('body') } }, 'Add a text box'));
    lp.appendChild(h('button.text-preset.heading', { on: { click: () => addText('heading') } }, 'Add a heading'));
    lp.appendChild(h('button.text-preset.subheading', { on: { click: () => addText('subheading') } }, 'Add a subheading'));
    lp.appendChild(h('button.text-preset.body', { on: { click: () => addText('body') } }, 'Add a little bit of body text'));
    lp.appendChild(h('button.text-preset.urdu', { on: { click: () => addText('urdu') } }, 'اردو متن شامل کریں'));
    lp.appendChild(h('p.muted.small', null, 'Double-click any text on the page to edit it. Urdu and Arabic text is detected automatically and written right-to-left.'));
  }

  function leftUploads(lp) {
    lp.appendChild(h('h4', null, 'Uploads'));
    lp.appendChild(h('button.btn.primary.wide', { on: { click: () => $('file-input').click() } }, 'Upload images'));
    lp.appendChild(h('p.muted.small', null, 'Or drag image files from Explorer onto the page, or paste with Ctrl+V.'));
    const ids = Object.keys(E.doc.assets || {});
    if (!ids.length) { lp.appendChild(h('p.muted', null, 'No images in this design yet.')); return; }
    lp.appendChild(h('h4', null, 'In this design'));
    const grid = h('div.up-grid');
    for (const id of ids) {
      const src = 'asset:' + id;
      grid.appendChild(h('button.up-item', {
        title: 'Add to page',
        on: {
          click: () => {
            const img = new Image();
            img.onload = () => placeImage(src, img.naturalWidth, img.naturalHeight);
            img.src = resolveSrcForEditor(src);
          }
        }
      }, h('img', { src: resolveSrcForEditor(src), draggable: false })));
    }
    lp.appendChild(grid);
  }

  function leftBackground(lp) {
    const bg = page().background;
    lp.appendChild(h('h4', null, 'Background colour'));
    const sw = h('div.swatches');
    for (const c of SWATCHES) {
      sw.appendChild(h('button.swatch', { style: { background: c }, title: c, on: { click: () => { page().background = { type: 'solid', color: c }; commit(); renderAll(); } } }));
    }
    lp.appendChild(sw);
    lp.appendChild(h('h4', null, 'Gradients'));
    const gr = h('div.swatches');
    for (const [a, b] of GRADIENTS) {
      gr.appendChild(h('button.swatch', { style: { background: `linear-gradient(135deg, ${a}, ${b})` }, on: { click: () => { page().background = { type: 'gradient', color: a, color2: b, angle: 135 }; commit(); renderAll(); } } }));
    }
    lp.appendChild(gr);
    lp.appendChild(h('h4', null, 'Background image'));
    lp.appendChild(h('button.btn.wide', {
      on: {
        click: () => pickFiles(async (files) => {
          try {
            const r = await readImageFile(files[0]);
            page().background = { type: 'image', src: D.addAsset(E.doc, r.dataUrl), color: bg.color || '#ffffff', imageOpacity: 1 };
            commit(); renderAll();
          } catch (err) { ui.toast(err.message, 'error'); }
        })
      }
    }, 'Choose image…'));
    lp.appendChild(h('p.muted.small', null, 'Tip: select an image on the page and use “Set as background” in the right panel.'));
  }

  function leftLayers(lp) {
    lp.appendChild(h('h4', null, 'Layers'));
    lp.appendChild(h('p.muted.small', null, 'Top of the list is in front. Click to select, Shift-click to add.'));
    const list = h('div.layers');
    const els = page().elements.slice().reverse();
    if (!els.length) list.appendChild(h('p.muted', null, 'This page is empty.'));
    for (const el of els) {
      const label = el.name && el.type !== 'text' ? el.name : (el.type === 'text' ? '“' + (el.text || '').slice(0, 24) + '”' : el.type);
      const row = h('div.layer' + (E.sel.includes(el.id) ? '.active' : '') + (el.hidden ? '.dim' : ''), {
        on: { click: (e) => select([el.id], e.shiftKey) }
      },
        h('span.layer-type', { html: icon(el.type === 'text' ? 'text' : el.type === 'image' ? 'image' : 'elements') }),
        h('span.layer-name', null, label, el.groupId ? h('span.tag', null, 'group') : null),
        h('button.icon-btn', { title: el.hidden ? 'Show' : 'Hide', html: icon(el.hidden ? 'eyeOff' : 'eye'), on: { click: (e) => { e.stopPropagation(); el.hidden = !el.hidden; if (el.hidden) E.sel = E.sel.filter((x) => x !== el.id); commit(); renderAll(); } } }),
        h('button.icon-btn', { title: el.locked ? 'Unlock' : 'Lock', html: icon(el.locked ? 'lock' : 'unlock'), on: { click: (e) => { e.stopPropagation(); el.locked = !el.locked; commit(); renderAll(); } } }));
      list.appendChild(row);
    }
    lp.appendChild(list);
  }

  function leftAi(lp) {
    lp.appendChild(h('h4', null, 'AI Tools'));
    lp.appendChild(h('p.muted.small', null, 'These tools need an AI service and are being built in Phase 2. They are listed here so you know what is coming — none of them produce fake results.'));
    const items = [
      ['AI Image Generator', 'Create images from a text prompt (OpenAI, Stability AI or Replicate — your own API key).'],
      ['Magic Write', 'Headlines, captions, slogans and rewrites using the Claude API.'],
      ['Magic Design', 'Complete layouts from a short description.'],
      ['Background Remover', 'Cut out photos on your own computer (no upload needed).'],
      ['Magic Resize', 'Smart re-layout for other formats. Until then, use Resize in the top bar.'],
      ['AI Design Assistant', 'Chat to edit: “make the background dark blue”.']
    ];
    for (const [t, d] of items) lp.appendChild(h('div.ai-card', null, h('div.ai-title', null, h('span.ic', { html: icon('ai') }), t, h('span.tag', null, 'Phase 2')), h('div.muted.small', null, d)));
  }

  function pickFiles(cb) {
    const input = $('file-input');
    input.value = '';
    input.onchange = () => { if (input.files.length) cb(input.files); input.onchange = defaultFileHandler; };
    input.click();
  }
  function defaultFileHandler() {
    const input = $('file-input');
    if (input.files.length) addImageFiles(input.files);
  }

  // ---------------------------------------------------------------- right panel (properties)
  function field(label, control, cls) {
    return h('label.field' + (cls ? '.' + cls : ''), null, h('span', null, label), control);
  }

  // A number input bound to a property path on all selected elements.
  function num(key, opts) {
    const o = opts || {};
    const sel = selected();
    const get = (e) => key.split('.').reduce((a, k) => (a == null ? a : a[k]), e);
    const set = (e, v) => { const ks = key.split('.'); let t = e; while (ks.length > 1) t = t[ks.shift()]; t[ks[0]] = v; };
    const v = get(sel[0]);
    const input = h('input.input.num', { type: 'number', step: o.step || 1, min: o.min, max: o.max, value: v == null ? '' : Math.round(v * (o.factor || 1) * 100) / 100 });
    input.addEventListener('input', () => {
      const x = parseFloat(input.value);
      if (!Number.isFinite(x)) return;
      sel.forEach((e) => set(e, x / (o.factor || 1)));
      renderCanvas(); renderOverlay();
    });
    input.addEventListener('change', () => { commit(); renderOverlay(); });
    return input;
  }
  function slider(key, min, max, step, opts) {
    const o = opts || {};
    const sel = selected();
    const get = (e) => key.split('.').reduce((a, k) => (a == null ? a : a[k]), e);
    const set = (e, v) => { const ks = key.split('.'); let t = e; while (ks.length > 1) t = t[ks.shift()]; t[ks[0]] = v; };
    const v = get(sel[0]);
    const out = h('span.val', null, '');
    const input = h('input', { type: 'range', min, max, step, value: (v == null ? min : v) * (o.factor || 1) });
    const show = () => { out.textContent = (o.decimals ? (+input.value).toFixed(o.decimals) : Math.round(input.value)) + (o.unit || ''); };
    show();
    input.addEventListener('input', () => { sel.forEach((e) => set(e, parseFloat(input.value) / (o.factor || 1))); show(); renderCanvas(); renderOverlay(); });
    input.addEventListener('change', () => commit());
    return h('div.slider', null, input, out);
  }
  function color(key) {
    const sel = selected();
    const get = (e) => key.split('.').reduce((a, k) => (a == null ? a : a[k]), e);
    const set = (e, v) => { const ks = key.split('.'); let t = e; while (ks.length > 1) t = t[ks.shift()]; t[ks[0]] = v; };
    return colorControl(get(sel[0]), (v, final) => { sel.forEach((e) => set(e, v)); renderCanvas(); if (final) commit(); });
  }
  // colour picker + alpha slider; onChange(value, isFinal)
  function colorControl(value, onChange) {
    const c = render.parseColor(value || '#000000');
    const picker = h('input.color', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : '#000000' });
    const alpha = h('input.alpha', { type: 'range', min: 0, max: 100, value: Math.round(c.alpha * 100), title: 'Transparency' });
    const compose = () => {
      const a = Math.round(alpha.value * 2.55);
      return a >= 255 ? picker.value : picker.value + a.toString(16).padStart(2, '0');
    };
    picker.addEventListener('input', () => onChange(compose(), false));
    picker.addEventListener('change', () => onChange(compose(), true));
    alpha.addEventListener('input', () => onChange(compose(), false));
    alpha.addEventListener('change', () => onChange(compose(), true));
    return h('div.color-row', null, picker, alpha);
  }
  function select_(key, options, onAfter) {
    const sel = selected();
    const s = h('select.input');
    for (const [v, l] of options) s.appendChild(h('option', { value: v }, l));
    s.value = String(sel[0][key]);
    s.addEventListener('change', () => {
      const raw = s.value;
      const v = raw === 'true' ? true : raw === 'false' ? false : (/^-?\d+(\.\d+)?$/.test(raw) && typeof sel[0][key] === 'number' ? parseFloat(raw) : raw);
      sel.forEach((e) => { e[key] = v; });
      commit(); renderCanvas(); renderOverlay();
      if (onAfter) onAfter();
    });
    return s;
  }
  function toggle(label, key, iconHtml) {
    const sel = selected();
    const get = (e) => key.split('.').reduce((a, k) => (a == null ? a : a[k]), e);
    const set = (e, v) => { const ks = key.split('.'); let t = e; while (ks.length > 1) t = t[ks.shift()]; t[ks[0]] = v; };
    const on = !!get(sel[0]);
    return h('button.tog' + (on ? '.on' : ''), {
      title: label, html: iconHtml || label,
      on: { click: () => { sel.forEach((e) => set(e, !on)); commit(); renderCanvas(); renderOverlay(); renderRightPanel(); } }
    });
  }
  function section(title, ...content) {
    return h('div.section', null, h('div.section-title', null, title), ...content);
  }
  function iconBtn(ic, title, fn, active) {
    return h('button.tog' + (active ? '.on' : ''), { title, html: icon(ic), on: { click: fn } });
  }

  function renderRightPanel() {
    const rp = $('right-panel');
    rp.innerHTML = '';
    const sel = selected();
    if (!sel.length) { rightPage(rp); return; }
    const one = sel.length === 1 ? sel[0] : null;
    const types = new Set(sel.map((e) => e.type));
    const sameType = types.size === 1 ? sel[0].type : null;

    rp.appendChild(h('div.panel-title', null, one ? (one.type === 'text' ? 'Text' : one.type === 'image' ? 'Image' : one.type === 'line' ? 'Line' : 'Shape') : `${sel.length} items`));

    // quick actions
    const locked = sel.some((e) => e.locked);
    rp.appendChild(h('div.btn-row', null,
      iconBtn('copy', 'Duplicate (Ctrl+D)', cmd.duplicate),
      iconBtn(locked ? 'lock' : 'unlock', locked ? 'Unlock' : 'Lock', cmd.toggleLock, locked),
      iconBtn('flipH', 'Flip horizontal', () => cmd.flip('x')),
      iconBtn('flipV', 'Flip vertical', () => cmd.flip('y')),
      sel.length > 1 ? iconBtn('group', sel.every((e) => e.groupId && e.groupId === sel[0].groupId) ? 'Ungroup (Ctrl+Shift+G)' : 'Group (Ctrl+G)', () => (sel.every((e) => e.groupId && e.groupId === sel[0].groupId) ? cmd.ungroup() : cmd.group())) : null,
      iconBtn('trash', 'Delete (Del)', cmd.delete)));

    if (sameType === 'text') rightText(rp, sel);
    if (sameType === 'shape') rightShape(rp, sel);
    if (sameType === 'line') rightLine(rp, sel);
    if (sameType === 'image') rightImage(rp, sel);

    // position
    if (one) {
      rp.appendChild(section('Position & size',
        h('div.grid2', null,
          field('X', num('x')), field('Y', num('y')),
          field('Width', num('w', { min: 1 })), one.type === 'line' || one.type === 'text' ? field('Rotation °', num('rotation')) : field('Height', num('h', { min: 1 })),
          one.type !== 'line' && one.type !== 'text' ? field('Rotation °', num('rotation')) : null)));
    }
    rp.appendChild(section('Align to ' + (sel.length > 1 ? 'selection' : 'page'),
      h('div.btn-row', null,
        iconBtn('alignLeft', 'Align left', () => cmd.align('left')), iconBtn('alignCenter', 'Align centre', () => cmd.align('center')), iconBtn('alignRight', 'Align right', () => cmd.align('right')),
        iconBtn('alignTop', 'Align top', () => cmd.align('top')), iconBtn('alignMiddle', 'Align middle', () => cmd.align('middle')), iconBtn('alignBottom', 'Align bottom', () => cmd.align('bottom'))),
      sel.length > 2 ? h('div.btn-row', null, iconBtn('distH', 'Distribute horizontally', () => cmd.distribute('h')), iconBtn('distV', 'Distribute vertically', () => cmd.distribute('v'))) : null));
    rp.appendChild(section('Arrange',
      h('div.btn-row.text-btns', null,
        h('button.tog', { on: { click: () => cmd.arrange('front') } }, 'To front'),
        h('button.tog', { on: { click: () => cmd.arrange('forward') } }, 'Forward'),
        h('button.tog', { on: { click: () => cmd.arrange('backward') } }, 'Backward'),
        h('button.tog', { on: { click: () => cmd.arrange('back') } }, 'To back'))));
    rp.appendChild(section('Transparency', slider('opacity', 0, 100, 1, { factor: 100, unit: '%' })));
    rp.appendChild(section('Shadow',
      h('label.check', null, (() => { const c = h('input', { type: 'checkbox', checked: !!sel[0].shadow.on }); c.addEventListener('change', () => { sel.forEach((e) => { e.shadow.on = c.checked; }); commit(); renderCanvas(); renderRightPanel(); }); return c; })(), ' Drop shadow'),
      sel[0].shadow.on ? h('div', null,
        h('div.grid2', null, field('Offset X', num('shadow.x')), field('Offset Y', num('shadow.y'))),
        field('Blur', slider('shadow.blur', 0, 100, 1)),
        field('Colour', color('shadow.color'))) : null));
  }

  function rightText(rp, sel) {
    const el = sel[0];
    const fontSel = h('select.input');
    const fonts = FONTS.includes(el.fontFamily) ? FONTS : [el.fontFamily].concat(FONTS);
    for (const f of fonts) fontSel.appendChild(h('option', { value: f, style: { fontFamily: `'${f}'` } }, f));
    fontSel.appendChild(h('option', { value: '__custom' }, 'Other font installed on this PC…'));
    fontSel.value = el.fontFamily;
    fontSel.addEventListener('change', async () => {
      let f = fontSel.value;
      if (f === '__custom') {
        f = await ui.promptDialog('Use another font', 'Type the exact name of a font installed on this computer', '');
        if (!f) { fontSel.value = el.fontFamily; return; }
      }
      sel.forEach((e) => { e.fontFamily = f; });
      commit(); renderCanvas(); renderOverlay(); renderRightPanel(); positionTextEditor();
    });
    const after = () => { renderRightPanel(); positionTextEditor(); };
    rp.appendChild(section('Font',
      fontSel,
      h('div.grid2', null,
        field('Size', num('fontSize', { min: 4, step: 1 })),
        field('Weight', select_('fontWeight', [[300, 'Light'], [400, 'Regular'], [600, 'Semi-bold'], [700, 'Bold'], [800, 'Extra bold'], [900, 'Black']], after))),
      h('div.btn-row', null,
        h('button.tog' + (el.fontWeight >= 700 ? '.on' : ''), {
          title: 'Bold', html: '<b>B</b>',
          on: { click: () => { const b = el.fontWeight >= 700; sel.forEach((x) => { x.fontWeight = b ? 400 : 700; }); commit(); renderCanvas(); renderOverlay(); after(); } }
        }),
        toggle('Italic', 'italic', '<i>I</i>'),
        toggle('Underline', 'underline', '<u>U</u>'),
        toggle('Uppercase', 'uppercase', 'AA'),
        iconBtn('alignLeft', 'Align left', () => { sel.forEach((e) => { e.align = 'left'; }); commit(); renderCanvas(); after(); }, el.align === 'left'),
        iconBtn('alignCenter', 'Align centre', () => { sel.forEach((e) => { e.align = 'center'; }); commit(); renderCanvas(); after(); }, el.align === 'center'),
        iconBtn('alignRight', 'Align right', () => { sel.forEach((e) => { e.align = 'right'; }); commit(); renderCanvas(); after(); }, el.align === 'right')),
      field('Text colour', color('color'))));
    rp.appendChild(section('Spacing',
      field('Letter spacing', slider('letterSpacing', -10, 60, 0.5)),
      field('Line height', slider('lineHeight', 0.7, 3, 0.05, { decimals: 2 })),
      field('Direction', select_('rtl', [['auto', 'Automatic'], ['ltr', 'Left to right'], ['rtl', 'Right to left (Urdu / Arabic)']], after))));
    rp.appendChild(section('Effects',
      h('label.check', null, (() => { const c = h('input', { type: 'checkbox', checked: !!el.outline.on }); c.addEventListener('change', () => { sel.forEach((e) => { e.outline.on = c.checked; }); commit(); renderCanvas(); renderRightPanel(); }); return c; })(), ' Outline'),
      el.outline.on ? h('div.grid2', null, field('Width', num('outline.width', { min: 0, step: 0.5 })), field('Colour', color('outline.color'))) : null,
      h('label.check', null, (() => { const c = h('input', { type: 'checkbox', checked: !!el.background.on }); c.addEventListener('change', () => { sel.forEach((e) => { e.background.on = c.checked; }); commit(); renderCanvas(); renderRightPanel(); }); return c; })(), ' Highlight box behind text'),
      el.background.on ? h('div', null, field('Box colour', color('background.color')), h('div.grid2', null, field('Padding', num('background.padding', { min: 0 })), field('Roundness', num('background.radius', { min: 0 })))) : null));
    rp.appendChild(h('p.muted.small', null, 'Double-click the text on the page to change the words.'));
  }

  function rightShape(rp, sel) {
    const el = sel[0];
    const isIcon = String(el.shape).startsWith('icon:');
    if (!isIcon) {
      rp.appendChild(section('Shape',
        select_('shape', render.SHAPES.map((s) => [s, s[0].toUpperCase() + s.slice(1)])),
        el.shape === 'rect' ? field('Corner roundness', num('radius', { min: 0 })) : null,
        el.shape === 'star' ? field('Points', num('points', { min: 3, max: 30 })) : null));
      rp.appendChild(section('Fill',
        select_('fillType', [['solid', 'Solid colour'], ['gradient', 'Gradient'], ['none', 'No fill']], () => renderRightPanel()),
        el.fillType !== 'none' ? field(el.fillType === 'gradient' ? 'Colour 1' : 'Colour', color('fill')) : null,
        el.fillType === 'gradient' ? field('Colour 2', color('fill2')) : null,
        el.fillType === 'gradient' ? field('Angle', slider('gradientAngle', 0, 360, 1, { unit: '°' })) : null));
      rp.appendChild(section('Border',
        h('div.grid2', null, field('Width', num('strokeWidth', { min: 0, step: 0.5 })), field('Style', select_('strokeDash', [['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']]))),
        field('Colour', color('stroke'))));
    } else {
      rp.appendChild(section('Icon', field('Colour', color('fill')), field('Line thickness', num('strokeWidth', { min: 0.5, max: 6, step: 0.25 }))));
    }
  }

  function rightLine(rp) {
    const caps = [['none', 'None'], ['arrow', 'Arrow'], ['circle', 'Circle']];
    rp.appendChild(section('Line',
      field('Colour', color('stroke')),
      h('div.grid2', null, field('Thickness', num('strokeWidth', { min: 0.5, step: 0.5 })), field('Style', select_('strokeDash', [['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']]))),
      h('div.grid2', null, field('Start', select_('startCap', caps)), field('End', select_('endCap', caps)))));
  }

  function rightImage(rp, sel) {
    const el = sel[0];
    rp.appendChild(section('Image',
      field('Fit in frame', select_('fit', [['cover', 'Fill frame (crop)'], ['contain', 'Fit whole image'], ['stretch', 'Stretch']])),
      h('p.muted.small', null, 'To crop: choose “Fill frame”, then drag the side handles.'),
      h('div.grid2', null, field('Corner roundness', num('radius', { min: 0 })), field('Border width', num('strokeWidth', { min: 0 }))),
      el.strokeWidth > 0 ? field('Border colour', color('stroke')) : null,
      h('div.btn-row.text-btns', null,
        h('button.tog', { on: { click: () => pickFiles(async (files) => { try { const r = await readImageFile(files[0]); el.src = D.addAsset(E.doc, r.dataUrl); el.naturalW = r.w; el.naturalH = r.h; commit(); renderAll(); } catch (err) { ui.toast(err.message, 'error'); } }) } }, 'Replace image'),
        h('button.tog', { on: { click: () => { page().background = { type: 'image', src: el.src, color: '#ffffff', imageOpacity: el.opacity }; D.remove(page(), [el.id]); E.sel = []; commit(); renderAll(); } } }, 'Set as background'),
        h('button.tog', { on: { click: () => { const k = el.naturalW / el.naturalH; el.h = el.w / k; commit(); renderAll(); } } }, 'Original shape'))));
    rp.appendChild(section('Adjust',
      field('Brightness', slider('filters.brightness', 0, 200, 1, { unit: '%' })),
      field('Contrast', slider('filters.contrast', 0, 200, 1, { unit: '%' })),
      field('Saturation', slider('filters.saturation', 0, 200, 1, { unit: '%' })),
      field('Blur', slider('filters.blur', 0, 30, 0.5)),
      h('div.btn-row.text-btns', null,
        toggle('Black & white', 'filters.grayscale', 'Black & white'),
        toggle('Sepia', 'filters.sepia', 'Sepia'),
        h('button.tog', { on: { click: () => { sel.forEach((e) => { e.filters = { brightness: 100, contrast: 100, saturation: 100, blur: 0, grayscale: false, sepia: false }; }); commit(); renderCanvas(); renderRightPanel(); } } }, 'Reset'))));
    rp.appendChild(h('div.ai-card', null, h('div.ai-title', null, h('span.ic', { html: icon('ai') }), 'Remove background', h('span.tag', null, 'Phase 2')), h('div.muted.small', null, 'Automatic cut-out runs on your PC once the background remover is added.')));
  }

  function rightPage(rp) {
    const f = E.doc.format;
    const s = size();
    const bg = page().background;
    rp.appendChild(h('div.panel-title', null, `Page ${E.pageIndex + 1}`));
    rp.appendChild(section('Size',
      h('div.kv', null, h('span', null, f.name)),
      h('div.kv.muted', null, `${formats.label(f)} · ${Math.round(s.w)} × ${Math.round(s.h)} px editor · ${formats.aspectLabel(f)}`),
      f.kind === 'print' ? h('div.kv.muted', null, `Print: ${(s.w / 96 * 300).toFixed(0)} × ${(s.h / 96 * 300).toFixed(0)} px at 300 DPI · ${f.bleedMm || 0} mm bleed available`) : null,
      h('button.btn.wide', { on: { click: openResizeDialog } }, 'Resize design…')));
    const typeSel = h('select.input', null, h('option', { value: 'solid' }, 'Solid colour'), h('option', { value: 'gradient' }, 'Gradient'), h('option', { value: 'image' }, 'Image'));
    typeSel.value = bg.type;
    typeSel.addEventListener('change', () => {
      if (typeSel.value === 'image') { E.leftTab = 'background'; renderRail(); renderLeftPanel(); typeSel.value = bg.type; return; }
      bg.type = typeSel.value;
      if (bg.type === 'gradient' && !bg.color2) bg.color2 = '#4f46e5';
      if (bg.angle == null) bg.angle = 135;
      commit(); renderAll();
    });
    const setBg = (k) => (v, final) => { bg[k] = v; renderCanvas(); if (final) { commit(); schedulePageThumbs(); } };
    rp.appendChild(section('Background',
      typeSel,
      field(bg.type === 'gradient' ? 'Colour 1' : 'Colour', colorControl(bg.color || '#ffffff', setBg('color'))),
      bg.type === 'gradient' ? field('Colour 2', colorControl(bg.color2 || '#000000', setBg('color2'))) : null,
      bg.type === 'gradient' ? field('Angle', (() => { const r = h('input', { type: 'range', min: 0, max: 360, value: bg.angle || 0 }); r.addEventListener('input', () => { bg.angle = +r.value; renderCanvas(); }); r.addEventListener('change', commit); return r; })()) : null,
      bg.type === 'image' ? field('Image transparency', (() => { const r = h('input', { type: 'range', min: 0, max: 100, value: Math.round((bg.imageOpacity == null ? 1 : bg.imageOpacity) * 100) }); r.addEventListener('input', () => { bg.imageOpacity = r.value / 100; renderCanvas(); }); r.addEventListener('change', commit); return r; })()) : null,
      bg.type === 'image' ? h('button.btn.wide', { on: { click: () => { page().background = { type: 'solid', color: bg.color || '#ffffff' }; commit(); renderAll(); } } }, 'Remove background image') : null));
    rp.appendChild(section('Shortcuts', h('div.shortcuts', {
      html: '<div><kbd>Ctrl</kbd>+<kbd>Z</kbd> undo · <kbd>Ctrl</kbd>+<kbd>Y</kbd> redo</div><div><kbd>Ctrl</kbd>+<kbd>C</kbd>/<kbd>V</kbd>/<kbd>D</kbd> copy, paste, duplicate</div><div><kbd>Ctrl</kbd>+<kbd>G</kbd> group · <kbd>Del</kbd> delete</div><div>Arrows nudge (Shift = 10 px)</div><div><kbd>Ctrl</kbd>+scroll zoom · <kbd>Space</kbd>+drag pan</div><div>Shift while resizing keeps proportions</div>'
    })));
  }

  // ---------------------------------------------------------------- resize dialog
  async function openResizeDialog() {
    const sel = h('select.input');
    for (const g of formats.GROUPS) {
      const og = h('optgroup', { label: g.name });
      for (const f of formats.FORMATS.filter((x) => x.group === g.id)) og.appendChild(h('option', { value: f.id }, `${f.name} — ${formats.label(f)}`));
      sel.appendChild(og);
    }
    sel.appendChild(h('optgroup', { label: 'Custom' }, h('option', { value: 'custom' }, 'Custom size…')));
    sel.value = formats.byId(E.doc.format.id) ? E.doc.format.id : 'custom';
    const cw = h('input.input.num', { type: 'number', value: E.doc.format.width, min: 1 });
    const ch = h('input.input.num', { type: 'number', value: E.doc.format.height, min: 1 });
    const cu = h('select.input', null, h('option', { value: 'px' }, 'px'), h('option', { value: 'mm' }, 'mm'), h('option', { value: 'in' }, 'in'));
    cu.value = E.doc.format.unit;
    const customRow = h('div.grid3', null, field('Width', cw), field('Height', ch), field('Unit', cu));
    const scale = h('input', { type: 'checkbox', checked: true });
    const refresh = () => { customRow.style.display = sel.value === 'custom' ? '' : 'none'; };
    sel.addEventListener('change', refresh);
    refresh();
    const ok = await ui.modal({
      title: 'Resize design',
      body: h('div', null,
        field('New size', sel), customRow,
        h('label.check', null, scale, ' Scale content to fit the new size'),
        h('p.muted.small', null, 'This changes the size of every page. AI Magic Resize (smart re-layout) is planned for Phase 2.')),
      actions: [{ label: 'Cancel', value: false }, { label: 'Resize', value: true, primary: true }]
    });
    if (!ok) return;
    let nf;
    if (sel.value === 'custom') {
      const w = parseFloat(cw.value), hh = parseFloat(ch.value);
      if (!(w > 0 && hh > 0)) { ui.toast('Please enter a valid width and height.', 'error'); return; }
      nf = formats.custom(w, hh, cu.value);
    } else nf = formats.byId(sel.value);
    D.resizeDocument(E.doc, nf, scale.checked);
    E.sel = [];
    commit();
    renderAll();
    zoomToFit();
  }

  // ---------------------------------------------------------------- keyboard
  function onKeyDown(e) {
    if ($('editor').classList.contains('hidden') || document.querySelector('.modal-back')) return;
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();

    if (E.editingText && e.key === 'Escape') { e.preventDefault(); finishTextEdit(); return; }
    if (ctrl && k === 's') { e.preventDefault(); finishTextEdit(); save(true); return; }
    if (ctrl && k === 'e') { e.preventDefault(); finishTextEdit(); exporter.openDialog(E.doc, E.pageIndex); return; }
    if (typing) return;

    if (e.key === ' ' && !E.spaceDown) { E.spaceDown = true; $('workspace').classList.add('can-pan'); e.preventDefault(); return; }
    if (ctrl && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if ((ctrl && k === 'y') || (ctrl && e.shiftKey && k === 'z')) { e.preventDefault(); redo(); return; }
    if (ctrl && k === 'c') { e.preventDefault(); cmd.copy(); return; }
    if (ctrl && k === 'x') { e.preventDefault(); cmd.cut(); return; }
    if (ctrl && k === 'v') { return; } // handled by the paste event (supports images too)
    if (ctrl && k === 'd') { e.preventDefault(); cmd.duplicate(); return; }
    if (ctrl && k === 'a') { e.preventDefault(); cmd.selectAll(); return; }
    if (ctrl && k === 'g') { e.preventDefault(); if (e.shiftKey) cmd.ungroup(); else cmd.group(); return; }
    if (ctrl && (k === '=' || k === '+')) { e.preventDefault(); setZoom(E.zoom * 1.2); return; }
    if (ctrl && k === '-') { e.preventDefault(); setZoom(E.zoom / 1.2); return; }
    if (ctrl && k === '0') { e.preventDefault(); zoomToFit(); return; }
    if (ctrl && k === ']') { e.preventDefault(); cmd.arrange(e.shiftKey ? 'front' : 'forward'); return; }
    if (ctrl && k === '[') { e.preventDefault(); cmd.arrange(e.shiftKey ? 'back' : 'backward'); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); cmd.delete(); return; }
    if (e.key === 'Escape') { select([]); return; }
    if (e.key === 'Enter' && E.sel.length === 1 && byId(E.sel[0]).type === 'text') { e.preventDefault(); startTextEdit(E.sel[0]); return; }
    if (!ctrl && k === 't') { addText('body'); return; }
    const step = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft') { e.preventDefault(); cmd.nudge(-step, 0); }
    if (e.key === 'ArrowRight') { e.preventDefault(); cmd.nudge(step, 0); }
    if (e.key === 'ArrowUp') { e.preventDefault(); cmd.nudge(0, -step); }
    if (e.key === 'ArrowDown') { e.preventDefault(); cmd.nudge(0, step); }
  }
  function onKeyUp(e) {
    if (e.key === ' ') { E.spaceDown = false; $('workspace').classList.remove('can-pan'); }
  }

  function onPaste(e) {
    if ($('editor').classList.contains('hidden') || document.querySelector('.modal-back')) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    const files = Array.from(e.clipboardData ? e.clipboardData.files : []).filter((f) => /^image\//.test(f.type));
    if (files.length) { e.preventDefault(); addImageFiles(files); return; }
    const text = e.clipboardData && e.clipboardData.getData('text/plain');
    if (E.clipboard) { e.preventDefault(); cmd.paste(); return; }
    if (text && text.trim()) {
      e.preventDefault();
      const s = size();
      const el = D.createElement('text', { text: text.trim().slice(0, 5000), fontSize: Math.min(s.w, s.h) / 30, w: s.w * 0.7 });
      el.h = render.layoutText(el, ui.measure).height;
      addElement(el);
    }
  }

  // ---------------------------------------------------------------- open / close
  let wired = false;
  function wire() {
    if (wired) return;
    wired = true;
    ui.hydrateIcons($('editor'));
    $('tb-home').addEventListener('click', () => exit());
    $('tb-undo').addEventListener('click', undo);
    $('tb-redo').addEventListener('click', redo);
    $('tb-save').addEventListener('click', () => { finishTextEdit(); save(true); });
    $('tb-export').addEventListener('click', () => { finishTextEdit(); exporter.openDialog(E.doc, E.pageIndex); });
    $('tb-resize').addEventListener('click', openResizeDialog);
    const nameInput = $('doc-name');
    nameInput.addEventListener('change', () => { E.doc.name = nameInput.value.trim() || 'Untitled design'; nameInput.value = E.doc.name; commit(); });
    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInput.blur(); });

    const ws = $('workspace');
    ws.addEventListener('pointerdown', onPointerDown);
    ws.addEventListener('dblclick', (e) => {
      const g = e.target.closest && e.target.closest('#page-svg [data-id]');
      if (g) { const el = byId(g.dataset.id); if (el && el.type === 'text') startTextEdit(el.id); }
    });
    ws.addEventListener('wheel', (e) => {
      if (e.ctrlKey) { e.preventDefault(); setZoom(E.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), { x: e.clientX, y: e.clientY }); }
    }, { passive: false });
    ws.addEventListener('dragover', (e) => { e.preventDefault(); ws.classList.add('drop'); });
    ws.addEventListener('dragleave', () => ws.classList.remove('drop'));
    ws.addEventListener('drop', (e) => {
      e.preventDefault();
      ws.classList.remove('drop');
      if (e.dataTransfer.files.length) addImageFiles(e.dataTransfer.files, pointerToPage(e));
    });

    const ta = $('text-editor');
    ta.addEventListener('input', onTextInput);
    ta.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== ta) finishTextEdit(); }, 0));

    $('zoom-range').addEventListener('input', (e) => setZoom(e.target.value / 100));
    $('zoom-in').addEventListener('click', () => setZoom(E.zoom * 1.2));
    $('zoom-out').addEventListener('click', () => setZoom(E.zoom / 1.2));
    $('zoom-label').addEventListener('click', zoomToFit);

    $('file-input').onchange = defaultFileHandler;
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('paste', onPaste);
    window.addEventListener('resize', ui.debounce(() => { if (!$('editor').classList.contains('hidden')) renderOverlay(); }, 100));
  }

  function open(docIn, filePath, onExit) {
    wire();
    releaseBlobs();
    E.doc = D.migrate(docIn);
    E.filePath = filePath || null;
    E.pageIndex = 0;
    E.sel = [];
    E.editingText = null;
    E.onExit = onExit;
    E.history.reset(D.snapshot(E.doc));
    E.dirty = !filePath;
    setSaveStatus(filePath ? 'All changes saved' : 'New design');
    E.leftTab = 'templates';
    $('home').classList.add('hidden');
    $('editor').classList.remove('hidden');
    renderRail();
    renderAll();
    requestAnimationFrame(zoomToFit);
    if (!filePath) save(false); // put new designs into the projects library straight away
  }

  async function exit() {
    finishTextEdit();
    autosave.cancel();
    if (E.dirty || E.saving) {
      while (E.saving) await new Promise((r) => setTimeout(r, 50));
      if (E.dirty) await save(false);
    }
    $('editor').classList.add('hidden');
    $('home').classList.remove('hidden');
    const cb = E.onExit;
    releaseBlobs();
    E.doc = null;
    if (cb) cb();
  }

  async function saveCopyAs() {
    if (!E.doc) return;
    finishTextEdit();
    const res = await window.api.saveProjectAs(D.pruneAssets(E.doc));
    if (res) ui.toast('Copy saved to ' + res.path, 'success');
  }

  const isOpen = () => !!E.doc;

  root.DS.editor = {
    open, exit, save: () => save(true), saveCopyAs, isOpen, isDirty: () => E.dirty,
    exportDialog: () => E.doc && exporter.openDialog(E.doc, E.pageIndex),
    _state: E, _cmd: cmd, _addText: addText, _addShape: addShape, _applyTemplate: applyTemplate, _addImageFiles: addImageFiles
  };
})(self);
