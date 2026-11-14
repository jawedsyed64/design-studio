// Document model: a design = format + pages; a page = background + ordered elements.
// Pure functions only (no DOM) so the model can be unit-tested in Node.
(function (root) {
  'use strict';

  const formats = (typeof module !== 'undefined' && module.exports) ? require('./formats.js') : root.DS.formats;

  const DOC_VERSION = 1;

  function uid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function newPage(background) {
    return {
      id: uid(),
      background: background || { type: 'solid', color: '#ffffff', color2: '#4f46e5', angle: 135 },
      elements: []
    };
  }

  function newDocument(format, name) {
    const now = Date.now();
    return {
      app: 'design-studio',
      version: DOC_VERSION,
      id: uid(),
      name: name || 'Untitled design',
      folder: '',
      format: clone(format),
      pages: [newPage()],
      assets: {}, // id -> data URL of an uploaded image; elements refer to them as 'asset:<id>'
      createdAt: now,
      updatedAt: now,
      thumbnail: null
    };
  }

  const BASE = {
    x: 0, y: 0, w: 100, h: 100, rotation: 0, opacity: 1,
    locked: false, hidden: false, flipX: false, flipY: false,
    groupId: null, name: '',
    shadow: { on: false, x: 6, y: 6, blur: 10, color: '#00000055' }
  };

  const FACTORIES = {
    text(o) {
      return Object.assign(clone(BASE), {
        type: 'text', name: 'Text', w: 500, h: 60,
        text: 'Add your text', fontFamily: 'Segoe UI', fontSize: 48, fontWeight: 400,
        italic: false, underline: false, align: 'left', color: '#1f2333',
        letterSpacing: 0, lineHeight: 1.25, rtl: 'auto', uppercase: false,
        outline: { on: false, width: 2, color: '#ffffff' },
        background: { on: false, color: '#ffe066', padding: 12, radius: 8 }
      }, o);
    },
    shape(o) {
      return Object.assign(clone(BASE), {
        type: 'shape', name: 'Shape', shape: 'rect', w: 300, h: 300,
        fill: '#6366f1', fillType: 'solid', fill2: '#ec4899', gradientAngle: 135,
        stroke: '#1f2333', strokeWidth: 0, strokeDash: 'solid', radius: 0, points: 5
      }, o);
    },
    line(o) {
      return Object.assign(clone(BASE), {
        type: 'line', name: 'Line', w: 400, h: 0,
        stroke: '#1f2333', strokeWidth: 6, strokeDash: 'solid', startCap: 'none', endCap: 'none'
      }, o);
    },
    image(o) {
      return Object.assign(clone(BASE), {
        type: 'image', name: 'Image', w: 400, h: 300,
        src: '', naturalW: 400, naturalH: 300, fit: 'cover', radius: 0,
        stroke: '#ffffff', strokeWidth: 0,
        filters: { brightness: 100, contrast: 100, saturation: 100, blur: 0, grayscale: false, sepia: false }
      }, o);
    }
  };

  function createElement(type, props) {
    const f = FACTORIES[type];
    if (!f) throw new Error('Unknown element type: ' + type);
    const el = f(props || {});
    el.id = uid();
    return el;
  }

  // Height of an element as drawn (lines have zero height but need a hit area).
  function bounds(el) {
    const w = el.w, h = el.type === 'line' ? Math.max(el.strokeWidth, 1) : el.h;
    const cx = el.x + el.w / 2, cy = el.y + (el.type === 'line' ? 0 : el.h / 2);
    const a = (el.rotation || 0) * Math.PI / 180;
    const cos = Math.abs(Math.cos(a)), sin = Math.abs(Math.sin(a));
    const bw = w * cos + h * sin, bh = w * sin + h * cos;
    return { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh, cx, cy };
  }

  function unionBounds(els) {
    if (!els.length) return null;
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const el of els) {
      const b = bounds(el);
      x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y);
      x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h);
    }
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 };
  }

  // ----- page / element operations (mutate the given page) -----
  function indexOf(page, id) {
    return page.elements.findIndex((e) => e.id === id);
  }

  // Expand a selection so whole groups are selected together.
  function expandGroups(page, ids) {
    const groups = new Set(page.elements.filter((e) => ids.includes(e.id) && e.groupId).map((e) => e.groupId));
    return page.elements.filter((e) => ids.includes(e.id) || (e.groupId && groups.has(e.groupId))).map((e) => e.id);
  }

  function group(page, ids) {
    if (ids.length < 2) return null;
    const gid = uid();
    page.elements.forEach((e) => { if (ids.includes(e.id)) e.groupId = gid; });
    return gid;
  }
  function ungroup(page, ids) {
    page.elements.forEach((e) => { if (ids.includes(e.id)) e.groupId = null; });
  }

  // direction: 'forward' | 'backward' | 'front' | 'back'
  function reorder(page, ids, direction) {
    const els = page.elements;
    const sel = els.filter((e) => ids.includes(e.id));
    const rest = els.filter((e) => !ids.includes(e.id));
    if (direction === 'front') { page.elements = rest.concat(sel); return; }
    if (direction === 'back') { page.elements = sel.concat(rest); return; }
    if (direction === 'forward') {
      for (let i = els.length - 2; i >= 0; i--) {
        if (ids.includes(els[i].id) && !ids.includes(els[i + 1].id)) [els[i], els[i + 1]] = [els[i + 1], els[i]];
      }
    } else if (direction === 'backward') {
      for (let i = 1; i < els.length; i++) {
        if (ids.includes(els[i].id) && !ids.includes(els[i - 1].id)) [els[i], els[i - 1]] = [els[i - 1], els[i]];
      }
    }
  }

  function duplicate(page, ids, offset) {
    const off = offset == null ? 20 : offset;
    const groupMap = {};
    const copies = [];
    for (const e of page.elements.filter((x) => ids.includes(x.id))) {
      const c = clone(e);
      c.id = uid();
      c.x += off; c.y += off;
      if (c.groupId) c.groupId = groupMap[c.groupId] || (groupMap[c.groupId] = uid());
      copies.push(c);
    }
    page.elements.push(...copies);
    return copies.map((c) => c.id);
  }

  function remove(page, ids) {
    page.elements = page.elements.filter((e) => !ids.includes(e.id));
  }

  // mode: left|center|right|top|middle|bottom. Relative to the page if one element, else to selection.
  function align(page, ids, mode, pageW, pageH) {
    const els = page.elements.filter((e) => ids.includes(e.id) && !e.locked);
    if (!els.length) return;
    const ref = els.length === 1 ? { x: 0, y: 0, w: pageW, h: pageH } : unionBounds(els);
    for (const e of els) {
      const b = bounds(e);
      let dx = 0, dy = 0;
      if (mode === 'left') dx = ref.x - b.x;
      if (mode === 'center') dx = ref.x + ref.w / 2 - (b.x + b.w / 2);
      if (mode === 'right') dx = ref.x + ref.w - (b.x + b.w);
      if (mode === 'top') dy = ref.y - b.y;
      if (mode === 'middle') dy = ref.y + ref.h / 2 - (b.y + b.h / 2);
      if (mode === 'bottom') dy = ref.y + ref.h - (b.y + b.h);
      e.x += dx; e.y += dy;
    }
  }

  function distribute(page, ids, axis) {
    const els = page.elements.filter((e) => ids.includes(e.id) && !e.locked);
    if (els.length < 3) return;
    const key = axis === 'h' ? 'x' : 'y', size = axis === 'h' ? 'w' : 'h';
    const bs = els.map((e) => ({ e, b: bounds(e) })).sort((a, b) => a.b[key] - b.b[key]);
    const first = bs[0].b, last = bs[bs.length - 1].b;
    const total = bs.reduce((s, o) => s + o.b[size], 0);
    const gap = (last[key] + last[size] - first[key] - total) / (bs.length - 1);
    let pos = first[key];
    for (const o of bs) {
      o.e[key] += pos - o.b[key];
      pos += o.b[size] + gap;
    }
  }

  // Scale all content of a document to a new format (manual resize, not AI).
  function resizeDocument(doc, newFormat, scaleContent) {
    const old = formats.canvasSize(doc.format);
    const nw = formats.canvasSize(newFormat);
    doc.format = clone(newFormat);
    if (!scaleContent) return doc;
    const s = Math.min(nw.w / old.w, nw.h / old.h);
    const ox = (nw.w - old.w * s) / 2, oy = (nw.h - old.h * s) / 2;
    for (const p of doc.pages) {
      for (const e of p.elements) {
        e.x = e.x * s + ox; e.y = e.y * s + oy;
        e.w *= s; e.h *= s;
        if (e.type === 'text') {
          e.fontSize *= s;
          if (e.outline) e.outline.width *= s;
          if (e.background) e.background.padding *= s;
        }
        if (e.strokeWidth) e.strokeWidth *= s;
        if (e.radius) e.radius *= s;
      }
    }
    return doc;
  }

  function addAsset(doc, dataUrl) {
    doc.assets = doc.assets || {};
    for (const [id, v] of Object.entries(doc.assets)) if (v === dataUrl) return 'asset:' + id;
    const id = uid();
    doc.assets[id] = dataUrl;
    return 'asset:' + id;
  }

  function resolveAsset(doc, src) {
    if (typeof src === 'string' && src.startsWith('asset:')) return (doc.assets || {})[src.slice(6)] || '';
    return src || '';
  }

  // Asset ids referenced anywhere in the document.
  function usedAssets(doc) {
    const used = new Set();
    const take = (s) => { if (typeof s === 'string' && s.startsWith('asset:')) used.add(s.slice(6)); };
    for (const p of doc.pages) {
      if (p.background) take(p.background.src);
      for (const e of p.elements) take(e.src);
    }
    return used;
  }

  // Drop assets nothing refers to (called before saving).
  function pruneAssets(doc) {
    const used = usedAssets(doc);
    for (const id of Object.keys(doc.assets || {})) if (!used.has(id)) delete doc.assets[id];
    return doc;
  }

  // The parts of a document that undo/redo tracks (assets are append-only, so excluded).
  function snapshot(doc) {
    const { assets, thumbnail, ...rest } = doc;
    return rest;
  }

  // Bring older/foreign documents up to the current shape.
  function migrate(doc) {
    if (!doc.version) doc.version = 1;
    if (!doc.assets) doc.assets = {};
    if (!doc.id) doc.id = uid();
    if (!doc.name) doc.name = 'Untitled design';
    for (const p of doc.pages) {
      if (!p.id) p.id = uid();
      if (!p.background) p.background = { type: 'solid', color: '#ffffff' };
      p.elements = (p.elements || []).map((e) => {
        const def = FACTORIES[e.type] ? FACTORIES[e.type]({}) : clone(BASE);
        const merged = Object.assign(def, e);
        if (!merged.id) merged.id = uid();
        return merged;
      });
    }
    return doc;
  }

  // ----- undo / redo history (stores JSON snapshots) -----
  class History {
    constructor(limit) {
      this.limit = limit || 100;
      this.stack = [];
      this.index = -1;
    }
    reset(state) {
      this.stack = [JSON.stringify(state)];
      this.index = 0;
    }
    push(state) {
      const s = JSON.stringify(state);
      if (this.stack[this.index] === s) return false;
      this.stack = this.stack.slice(0, this.index + 1);
      this.stack.push(s);
      if (this.stack.length > this.limit) this.stack.shift();
      this.index = this.stack.length - 1;
      return true;
    }
    canUndo() { return this.index > 0; }
    canRedo() { return this.index < this.stack.length - 1; }
    undo() { if (!this.canUndo()) return null; this.index--; return JSON.parse(this.stack[this.index]); }
    redo() { if (!this.canRedo()) return null; this.index++; return JSON.parse(this.stack[this.index]); }
  }

  const api = {
    DOC_VERSION, uid, clone, newPage, newDocument, createElement, bounds, unionBounds, indexOf,
    expandGroups, group, ungroup, reorder, duplicate, remove, align, distribute, resizeDocument, migrate, History,
    addAsset, resolveAsset, usedAssets, pruneAssets, snapshot
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.DS = root.DS || {}).doc = api;
})(typeof self !== 'undefined' ? self : this);
