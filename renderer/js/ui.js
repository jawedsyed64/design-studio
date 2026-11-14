// Small UI helpers shared by the dashboard and the editor: icons, DOM builder,
// toasts, modal dialogs, and the canvas-based text measurer used by the renderer.
(function (root) {
  'use strict';

  const P = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICONS = {
    home: P('<polyline points="3,11 12,3 21,11"/><polyline points="5.5,9 5.5,21 18.5,21 18.5,9"/>'),
    undo: P('<polyline points="9,5 4,10 9,15"/><path d="M4 10h10a6 6 0 0 1 0 12h-3"/>'),
    redo: P('<polyline points="15,5 20,10 15,15"/><path d="M20 10H10a6 6 0 0 0 0 12h3"/>'),
    resize: P('<rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="14,3 21,3 21,10"/><line x1="21" y1="3" x2="13" y2="11"/>'),
    save: P('<path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><rect x="7" y="13" width="10" height="8"/><rect x="7" y="3" width="8" height="5"/>'),
    download: P('<path d="M12 3v12"/><polyline points="7,10 12,15 17,10"/><path d="M4 17v3h16v-3"/>'),
    templates: P('<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/>'),
    elements: P('<circle cx="7.5" cy="7.5" r="4.5"/><rect x="13" y="3" width="8" height="8" rx="1"/><polygon points="7.5,13 12,21 3,21"/><path d="M17 13l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4z"/>'),
    text: P('<polyline points="4,7 4,4 20,4 20,7"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="9" y1="20" x2="15" y2="20"/>'),
    uploads: P('<path d="M12 16V4"/><polyline points="7,9 12,4 17,9"/><path d="M4 16v4h16v-4"/>'),
    background: P('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15l5-5 4 4 3-3 6 6"/><circle cx="16" cy="8" r="1.5"/>'),
    layers: P('<polygon points="12,3 21,8 12,13 3,8"/><polyline points="3,12.5 12,17.5 21,12.5"/><polyline points="3,17 12,22 21,17"/>'),
    ai: P('<path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>'),
    trash: P('<polyline points="4,7 20,7"/><path d="M6 7l1 14h10l1-14"/><path d="M9 7V4h6v3"/>'),
    copy: P('<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>'),
    lock: P('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    unlock: P('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>'),
    eye: P('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    eyeOff: P('<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.1 3.9M6.3 6.3C3.6 8.1 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.4-1"/>'),
    up: P('<polyline points="6,15 12,9 18,15"/>'),
    down: P('<polyline points="6,9 12,15 18,9"/>'),
    plus: P('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
    folder: P('<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    open: P('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1"/><path d="M3 7v11a2 2 0 0 0 2 2h13l3-9H7l-4 9"/>'),
    settings: P('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    social: P('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/>'),
    slides: P('<rect x="2" y="4" width="20" height="13" rx="2"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/>'),
    doc: P('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="14,3 14,9 20,9"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>'),
    video: P('<rect x="2" y="5" width="15" height="14" rx="2"/><polygon points="17,10 22,7 22,17 17,14"/>'),
    image: P('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>'),
    write: P('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
    web: P('<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><line x1="3" y1="12" x2="21" y2="12"/>'),
    brand: P('<circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="12.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="13.5" r="2.5"/><path d="M12 22a10 10 0 1 1 10-10c0 2-1.5 3-3.5 3H16a2 2 0 0 0-1.5 3.3A2 2 0 0 1 12 22z"/>'),
    print: P('<polyline points="6,9 6,2 18,2 18,9"/><rect x="2" y="9" width="20" height="9" rx="2"/><rect x="6" y="14" width="12" height="8"/>'),
    shirt: P('<path d="M8 3L3 6l2 5 3-1v11h8V10l3 1 2-5-5-3a4 4 0 0 1-8 0z"/>'),
    group: P('<rect x="3" y="3" width="10" height="10" rx="1"/><rect x="11" y="11" width="10" height="10" rx="1"/>'),
    flipH: P('<line x1="12" y1="3" x2="12" y2="21" stroke-dasharray="2 2"/><polygon points="9,7 3,17 9,17"/><polygon points="15,7 21,17 15,17"/>'),
    flipV: P('<line x1="3" y1="12" x2="21" y2="12" stroke-dasharray="2 2"/><polygon points="7,9 17,9 17,3"/><polygon points="7,15 17,15 17,21"/>'),
    alignLeft: P('<line x1="4" y1="3" x2="4" y2="21"/><rect x="7" y="6" width="12" height="4" rx="1"/><rect x="7" y="14" width="8" height="4" rx="1"/>'),
    alignCenter: P('<line x1="12" y1="3" x2="12" y2="21"/><rect x="5" y="6" width="14" height="4" rx="1"/><rect x="7" y="14" width="10" height="4" rx="1"/>'),
    alignRight: P('<line x1="20" y1="3" x2="20" y2="21"/><rect x="5" y="6" width="12" height="4" rx="1"/><rect x="9" y="14" width="8" height="4" rx="1"/>'),
    alignTop: P('<line x1="3" y1="4" x2="21" y2="4"/><rect x="6" y="7" width="4" height="12" rx="1"/><rect x="14" y="7" width="4" height="8" rx="1"/>'),
    alignMiddle: P('<line x1="3" y1="12" x2="21" y2="12"/><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="7" width="4" height="10" rx="1"/>'),
    alignBottom: P('<line x1="3" y1="20" x2="21" y2="20"/><rect x="6" y="5" width="4" height="12" rx="1"/><rect x="14" y="9" width="4" height="8" rx="1"/>'),
    distH: P('<line x1="3" y1="3" x2="3" y2="21"/><line x1="21" y1="3" x2="21" y2="21"/><rect x="9" y="7" width="6" height="10" rx="1"/>'),
    distV: P('<line x1="3" y1="3" x2="21" y2="3"/><line x1="3" y1="21" x2="21" y2="21"/><rect x="7" y="9" width="10" height="6" rx="1"/>'),
    grid: P('<rect x="3" y="3" width="18" height="18" rx="1"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>'),
    magnet: P('<path d="M6 3v8a6 6 0 0 0 12 0V3"/><line x1="6" y1="7" x2="10" y2="7"/><line x1="14" y1="7" x2="18" y2="7"/>'),
    close: P('<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>'),
    more: P('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'),
    edit: P('<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>')
  };

  function icon(name) {
    return ICONS[name] || '';
  }

  // Fill every <span data-icon="x"> inside a root element.
  function hydrateIcons(rootEl) {
    (rootEl || document).querySelectorAll('[data-icon]').forEach((elm) => {
      if (!elm.firstChild) elm.innerHTML = icon(elm.dataset.icon);
    });
  }

  // h('div.cls#id', {attrs, on:{click}}, children...)
  function h(tag, attrs, ...children) {
    const m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(tag);
    const elm = document.createElement((m && m[1]) || 'div');
    if (m && m[2]) {
      for (const part of m[2].match(/[.#][\w-]+/g)) {
        if (part[0] === '.') elm.classList.add(part.slice(1));
        else elm.id = part.slice(1);
      }
    }
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'on') for (const [ev, fn] of Object.entries(v)) elm.addEventListener(ev, fn);
        else if (k === 'html') elm.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(elm.style, v);
        else if (k === 'dataset') Object.assign(elm.dataset, v);
        else if (k in elm && typeof v !== 'string') elm[k] = v;
        else elm.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      elm.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return elm;
  }

  function toast(message, kind) {
    const rootEl = document.getElementById('toast-root');
    const t = h('div.toast' + (kind ? '.' + kind : ''), null, message);
    rootEl.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, kind === 'error' ? 6000 : 3200);
  }

  // modal({title, body: Node, actions:[{label, value, primary, danger}], wide}) -> Promise(value|null)
  function modal(opts) {
    return new Promise((resolve) => {
      const rootEl = document.getElementById('modal-root');
      let done = false;
      const close = (v) => {
        if (done) return;
        done = true;
        document.removeEventListener('keydown', onKey, true);
        back.remove();
        resolve(v);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); close(null); }
        if (e.key === 'Enter' && opts.enterValue !== undefined && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); e.stopPropagation(); close(typeof opts.enterValue === 'function' ? opts.enterValue() : opts.enterValue); }
      };
      const actions = (opts.actions || [{ label: 'OK', value: true, primary: true }]).map((a) =>
        h('button.btn' + (a.primary ? '.primary' : '') + (a.danger ? '.danger' : ''), {
          on: { click: () => close(typeof a.value === 'function' ? a.value() : a.value) }
        }, a.label));
      const box = h('div.modal' + (opts.wide ? '.wide' : ''), null,
        h('div.modal-head', null, h('h3', null, opts.title || ''), h('button.icon-btn', { html: icon('close'), title: 'Close', on: { click: () => close(null) } })),
        h('div.modal-body', null, opts.body || ''),
        actions.length ? h('div.modal-actions', null, actions) : null);
      const back = h('div.modal-back', { on: { mousedown: (e) => { if (e.target === back) close(null); } } }, box);
      rootEl.appendChild(back);
      document.addEventListener('keydown', onKey, true);
      const first = box.querySelector('input, select, textarea');
      if (first) setTimeout(() => { first.focus(); if (first.select) first.select(); }, 30);
      if (opts.onMount) opts.onMount(box, close);
    });
  }

  function confirmDialog(title, message, okLabel, danger) {
    return modal({
      title, body: h('p', null, message), enterValue: true,
      actions: [{ label: 'Cancel', value: false }, { label: okLabel || 'OK', value: true, primary: !danger, danger }]
    });
  }

  function promptDialog(title, label, value) {
    const input = h('input.input', { value: value || '' });
    return modal({
      title, body: h('label.field', null, h('span', null, label), input),
      enterValue: () => input.value,
      actions: [{ label: 'Cancel', value: null }, { label: 'OK', value: () => input.value, primary: true }]
    });
  }

  // Text measurement shared with the renderer.
  const mctx = document.createElement('canvas').getContext('2d');
  function measure(text, font) {
    mctx.font = font;
    return mctx.measureText(text).width;
  }

  function debounce(fn, ms) {
    let t = null;
    const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    d.flush = (...a) => { clearTimeout(t); fn(...a); };
    d.cancel = () => clearTimeout(t);
    return d;
  }

  function timeAgo(ts) {
    const s = (Date.now() - ts) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    if (s < 86400 * 7) return Math.floor(s / 86400) + ' days ago';
    return new Date(ts).toLocaleDateString();
  }

  root.DS = root.DS || {};
  root.DS.ui = { icon, hydrateIcons, h, toast, modal, confirmDialog, promptDialog, measure, debounce, timeAgo, ICONS };
})(self);
