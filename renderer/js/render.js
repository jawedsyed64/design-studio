// Renders a page to standalone SVG markup. The same output is used for the
// on-screen canvas and for every export (PNG/JPEG/SVG/PDF), so what you see is what you get.
// Text wrapping needs a measure(text, fontCss) -> width function (canvas in the
// browser, a stub in tests).
(function (root) {
  'use strict';

  const formats = (typeof module !== 'undefined' && module.exports) ? require('./formats.js') : root.DS.formats;

  const RTL_RE = /[֐-ࣿיִ-﷿ﹰ-﻿]/;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function n(v) {
    return Math.round((+v || 0) * 100) / 100;
  }
  function sid(id) {
    return 'e' + String(id).replace(/[^a-zA-Z0-9_-]/g, '');
  }

  // '#rrggbb' or '#rrggbbaa' or '#rgb' -> { hex, alpha }
  function parseColor(c) {
    let s = String(c || '#000000').trim();
    if (s === 'transparent' || s === 'none') return { hex: '#000000', alpha: 0 };
    if (!s.startsWith('#')) return { hex: s, alpha: 1 };
    s = s.slice(1);
    if (s.length === 3 || s.length === 4) s = s.split('').map((ch) => ch + ch).join('');
    const hex = '#' + s.slice(0, 6);
    const alpha = s.length === 8 ? parseInt(s.slice(6, 8), 16) / 255 : 1;
    return { hex, alpha: Math.round(alpha * 1000) / 1000 };
  }
  function paintAttrs(attr, color) {
    const c = parseColor(color);
    let out = `${attr}="${esc(c.hex)}"`;
    if (c.alpha < 1) out += ` ${attr}-opacity="${c.alpha}"`;
    return out;
  }

  function fontCss(el, size) {
    const fam = String(el.fontFamily || 'Segoe UI').replace(/['"]/g, '');
    return `${el.italic ? 'italic ' : ''}${el.fontWeight || 400} ${n(size || el.fontSize)}px '${fam}', sans-serif`;
  }

  function isRtl(el) {
    if (el.rtl === true || el.rtl === 'rtl') return true;
    if (el.rtl === false || el.rtl === 'ltr') return false;
    return RTL_RE.test(el.text || '');
  }

  // ----- text layout -----
  function layoutText(el, measure) {
    const content = el.uppercase ? String(el.text || '').toUpperCase() : String(el.text || '');
    const font = fontCss(el);
    const ls = +el.letterSpacing || 0;
    const width = (s) => measure(s, font) + ls * [...s].length;
    const maxW = Math.max(1, el.w);
    const lines = [];
    for (const para of content.split('\n')) {
      if (para === '') { lines.push(''); continue; }
      const words = para.split(/(\s+)/).filter((t) => t.length);
      let line = '';
      for (const word of words) {
        const candidate = line + word;
        if (width(candidate.trimEnd()) <= maxW || line.trim() === '') {
          if (line.trim() === '' && width(word) > maxW && word.trim()) {
            // a single very long word: break it by characters
            let chunk = line;
            for (const ch of [...word]) {
              if (width(chunk + ch) > maxW && chunk.trim()) { lines.push(chunk.trimEnd()); chunk = ch; }
              else chunk += ch;
            }
            line = chunk;
          } else {
            line = candidate;
          }
        } else {
          lines.push(line.trimEnd());
          line = word.trim() ? word : '';
        }
      }
      lines.push(line.trimEnd());
    }
    const lineH = el.fontSize * (el.lineHeight || 1.25);
    return { lines, lineH, height: Math.max(lineH, lines.length * lineH) };
  }

  // ----- shapes -----
  function polygonPoints(pts) {
    return pts.map((p) => `${n(p[0])},${n(p[1])}`).join(' ');
  }
  function regular(w, h, sides, rotDeg) {
    const pts = [];
    for (let i = 0; i < sides; i++) {
      const a = (rotDeg + (360 / sides) * i) * Math.PI / 180;
      pts.push([w / 2 + (w / 2) * Math.cos(a), h / 2 + (h / 2) * Math.sin(a)]);
    }
    return pts;
  }
  function star(w, h, points, inner) {
    const pts = [];
    const total = points * 2;
    for (let i = 0; i < total; i++) {
      const r = i % 2 === 0 ? 1 : inner;
      const a = (-90 + (360 / total) * i) * Math.PI / 180;
      pts.push([w / 2 + (w / 2) * r * Math.cos(a), h / 2 + (h / 2) * r * Math.sin(a)]);
    }
    return pts;
  }

  // Stroke icons drawn on a 24×24 grid.
  const ICONS = {
    check: '<polyline points="4,12.5 9.5,18 20,6.5"/>',
    plus: '<line x1="12" y1="4" x2="12" y2="20"/><line x1="4" y1="12" x2="20" y2="12"/>',
    close: '<line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/>',
    play: '<polygon points="7,4 20,12 7,20"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3,7 12,13 21,7"/>',
    pin: '<path d="M12 22s7-7.6 7-13a7 7 0 0 0-14 0c0 5.4 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><line x1="3" y1="12" x2="21" y2="12"/>',
    clock: '<circle cx="12" cy="12" r="9"/><polyline points="12,7 12,12 15.5,14"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
    home: '<polyline points="3,11 12,3 21,11"/><polyline points="5.5,9 5.5,21 18.5,21 18.5,9"/>',
    arrowRight: '<line x1="4" y1="12" x2="20" y2="12"/><polyline points="13,5 20,12 13,19"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/>',
    star: '<polygon points="12,3 14.7,9 21,9.6 16.2,13.8 17.6,20.2 12,16.9 6.4,20.2 7.8,13.8 3,9.6 9.3,9"/>',
    heart: '<path d="M12 20s-7.5-4.6-9-9.6C2 6.9 4.4 4 7.5 4c2 0 3.5 1.2 4.5 2.8C13 5.2 14.5 4 16.5 4 19.6 4 22 6.9 21 10.4 19.5 15.4 12 20 12 20z"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><line x1="15.5" y1="15.5" x2="21" y2="21"/>',
    camera: '<path d="M3 8a2 2 0 0 1 2-2h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
    video: '<rect x="2.5" y="6" width="13" height="12" rx="2"/><polygon points="15.5,10.5 21.5,7 21.5,17 15.5,13.5"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><line x1="12" y1="17.5" x2="12" y2="21"/>',
    cart: '<circle cx="9" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/><path d="M2.5 3.5h3l2.6 11.5h10.4l2-8H6.6"/>',
    bag: '<path d="M5 8h14l-1 13H6z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/>',
    gift: '<rect x="3.5" y="9" width="17" height="12" rx="1"/><rect x="2.5" y="6" width="19" height="3.5" rx="1"/><line x1="12" y1="6" x2="12" y2="21"/><path d="M12 6c-1.5-3.5-6-3.5-5 0M12 6c1.5-3.5 6-3.5 5 0"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.4"/>',
    trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="9" y1="18" x2="15" y2="18"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><line x1="8.2" y1="10.8" x2="15.8" y2="7.2"/><line x1="8.2" y1="13.2" x2="15.8" y2="16.8"/>',
    link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    shield: '<path d="M12 2.5l8 3.5v6c0 5-3.5 8.5-8 9.5-4.5-1-8-4.5-8-9.5V6z"/><polyline points="8.5,12 11,14.5 15.5,9.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
    cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 10a4 4 0 0 1-.5 8z"/>',
    leaf: '<path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15z"/><path d="M5 19l8-8"/>',
    flower: '<circle cx="12" cy="12" r="2.5"/><path d="M12 9.5C10 6 10.5 3 12 3s2 3 0 6.5M14.5 12c3.5-2 6.5-1.5 6.5 0s-3 2-6.5 0M12 14.5c2 3.5 1.5 6.5 0 6.5s-2-3 0-6.5M9.5 12C6 14 3 13.5 3 12s3-2 6.5 0"/>',
    coffee: '<path d="M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3.5c-.8 1 .8 2 0 3M12 3.5c-.8 1 .8 2 0 3"/>',
    food: '<path d="M7 3v7a2 2 0 0 0 4 0V3M9 10v11"/><path d="M17 3c-2 0-3 2.5-3 6s1 4 3 4v8"/>',
    car: '<path d="M3 16v-4l2.5-5h13L21 12v4z"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><line x1="3" y1="12" x2="21" y2="12"/>',
    plane: '<path d="M21 15.5v-2L13.5 9V4a1.5 1.5 0 0 0-3 0v5L3 13.5v2l7.5-2.5v4.5L8 19.5V21l4-1 4 1v-1.5l-2.5-2V13z"/>',
    book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20"/>',
    graduation: '<polygon points="12,4 22,9 12,14 2,9"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5"/><line x1="22" y1="9" x2="22" y2="15"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8.5 7V5a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 5v2"/><line x1="3" y1="13" x2="21" y2="13"/>',
    chart: '<line x1="4" y1="20" x2="20" y2="20"/><rect x="6" y="11" width="3" height="7"/><rect x="11" y="6" width="3" height="12"/><rect x="16" y="13" width="3" height="5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    lightbulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    rocket: '<path d="M12 2.5c4 2.5 5.5 7 4.5 11.5h-9C6.5 9.5 8 5 12 2.5z"/><circle cx="12" cy="9" r="1.8"/><path d="M7.5 14L5 17l2.5 1M16.5 14l2.5 3-2.5 1M10 17.5l2 3.5 2-3.5"/>',
    wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1"/>',
    download: '<path d="M12 3v12"/><polyline points="7,10 12,15 17,10"/><path d="M4 17v3h16v-3"/>',
    upload: '<path d="M12 15V3"/><polyline points="7,8 12,3 17,8"/><path d="M4 17v3h16v-3"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    thumbsUp: '<path d="M7 10v11H3V10z"/><path d="M7 10l4-7a2.5 2.5 0 0 1 2.5 3L13 10h6a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 21H7"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14.5a5 5 0 0 0 8 0"/><line x1="9" y1="9.5" x2="9" y2="10"/><line x1="15" y1="9.5" x2="15" y2="10"/>',
    flag: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4.5L17 13H5"/>',
    crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',
    diamond: '<polygon points="6,3 18,3 22,9 12,21 2,9"/><polyline points="2,9 22,9"/><polyline points="9,3 12,9 15,3"/>',
    fire: '<path d="M12 22c4 0 7-2.7 7-7 0-4.5-4-6.5-4.5-11-2.5 2-4 4.5-3.5 7.5C9.5 10 8.5 8.5 8.5 7 6 9 5 12 5 15c0 4.3 3 7 7 7z"/>',
    sparkle: '<path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z"/><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/>',
    info: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16.5"/><circle cx="12" cy="7.8" r=".6"/>',
    question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7v.5"/><circle cx="12" cy="17" r=".6"/>',
    whatsapp: '<path d="M4 20l1.3-4A8.5 8.5 0 1 1 8.5 19z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.5-2-1-1 1c-1-.5-2.5-2-3-3l1-1-1-2z"/>',
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".8"/>',
    facebook: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/>',
    youtube: '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><polygon points="10,9 15.5,12 10,15"/>',
    linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><line x1="8" y1="10.5" x2="8" y2="17"/><circle cx="8" cy="7.3" r=".7"/><path d="M12 17v-6.5M12 13a3 3 0 0 1 5 0v4"/>',
    xsocial: '<path d="M4 4l16 16M20 4L4 20"/>',
    crescent: '<path d="M15 3.5A9 9 0 1 0 20.5 15 7 7 0 1 1 15 3.5z"/><path d="M19 4l.6 1.6 1.7.1-1.3 1.1.4 1.7-1.4-.9-1.4.9.4-1.7-1.3-1.1 1.7-.1z"/>',
    mosque: '<path d="M6 21v-7a6 6 0 0 1 12 0v7"/><path d="M12 8V5.5M12 5.5a1 1 0 1 0 0-.01"/><line x1="3" y1="21" x2="21" y2="21"/><path d="M3 21V11M21 21V11"/><path d="M10 21v-3a2 2 0 0 1 4 0v3"/>',
    lantern: '<path d="M9 5h6M12 2v3"/><path d="M8 7h8l1 11H7z"/><path d="M9.5 21h5M10 18l-.5 3M14 18l.5 3"/><path d="M12 10v5"/>'
  };

  const SHAPES = ['rect', 'ellipse', 'triangle', 'diamond', 'pentagon', 'hexagon', 'octagon', 'star', 'burst', 'heart', 'arrow',
    'speech', 'cloud', 'arch', 'semicircle', 'pill', 'parallelogram', 'trapezoid', 'cross', 'blob', 'ring', 'chevron'];

  function strokeDash(dash, sw) {
    if (dash === 'dashed') return ` stroke-dasharray="${n(sw * 3)} ${n(sw * 2)}"`;
    if (dash === 'dotted') return ` stroke-dasharray="0 ${n(sw * 2)}" stroke-linecap="round"`;
    return '';
  }

  function shapeMarkup(el, fillAttr) {
    const w = el.w, h = el.h;
    const sw = +el.strokeWidth || 0;
    const strokeAttr = sw > 0 ? ` ${paintAttrs('stroke', el.stroke)} stroke-width="${n(sw)}" stroke-linejoin="round"${strokeDash(el.strokeDash, sw)}` : '';
    const common = `${fillAttr}${strokeAttr}`;
    const kind = el.shape || 'rect';

    if (kind.startsWith('icon:')) {
      const body = ICONS[kind.slice(5)] || ICONS.star;
      const iw = Math.max(1, +el.strokeWidth || 2);
      const s = Math.min(w, h) / 24;
      const ox = (w - 24 * s) / 2, oy = (h - 24 * s) / 2;
      return `<g transform="translate(${n(ox)} ${n(oy)}) scale(${n(s * 1000) / 1000})" fill="none" ${paintAttrs('stroke', el.fill)} stroke-width="${n(iw)}" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
    }
    switch (kind) {
      case 'ellipse':
        return `<ellipse cx="${n(w / 2)}" cy="${n(h / 2)}" rx="${n(w / 2)}" ry="${n(h / 2)}" ${common}/>`;
      case 'triangle':
        return `<polygon points="${polygonPoints([[w / 2, 0], [w, h], [0, h]])}" ${common}/>`;
      case 'diamond':
        return `<polygon points="${polygonPoints([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]])}" ${common}/>`;
      case 'pentagon':
        return `<polygon points="${polygonPoints(regular(w, h, 5, -90))}" ${common}/>`;
      case 'hexagon':
        return `<polygon points="${polygonPoints(regular(w, h, 6, 0))}" ${common}/>`;
      case 'star':
        return `<polygon points="${polygonPoints(star(w, h, Math.max(3, el.points || 5), 0.45))}" ${common}/>`;
      case 'heart': {
        const d = `M${n(w / 2)} ${n(h)} C${n(w * 0.1)} ${n(h * 0.7)} 0 ${n(h * 0.45)} 0 ${n(h * 0.28)} C0 ${n(h * 0.1)} ${n(w * 0.15)} 0 ${n(w * 0.28)} 0 C${n(w * 0.38)} 0 ${n(w * 0.46)} ${n(h * 0.06)} ${n(w / 2)} ${n(h * 0.16)} C${n(w * 0.54)} ${n(h * 0.06)} ${n(w * 0.62)} 0 ${n(w * 0.72)} 0 C${n(w * 0.85)} 0 ${n(w)} ${n(h * 0.1)} ${n(w)} ${n(h * 0.28)} C${n(w)} ${n(h * 0.45)} ${n(w * 0.9)} ${n(h * 0.7)} ${n(w / 2)} ${n(h)}Z`;
        return `<path d="${d}" ${common}/>`;
      }
      case 'arrow':
        return `<polygon points="${polygonPoints([[0, h * 0.3], [w * 0.62, h * 0.3], [w * 0.62, 0], [w, h / 2], [w * 0.62, h], [w * 0.62, h * 0.7], [0, h * 0.7]])}" ${common}/>`;
      case 'speech': {
        const r = Math.min(w, h) * 0.12, bh = h * 0.78;
        const d = `M${n(r)} 0 H${n(w - r)} Q${n(w)} 0 ${n(w)} ${n(r)} V${n(bh - r)} Q${n(w)} ${n(bh)} ${n(w - r)} ${n(bh)} H${n(w * 0.38)} L${n(w * 0.2)} ${n(h)} L${n(w * 0.24)} ${n(bh)} H${n(r)} Q0 ${n(bh)} 0 ${n(bh - r)} V${n(r)} Q0 0 ${n(r)} 0Z`;
        return `<path d="${d}" ${common}/>`;
      }
      case 'octagon':
        return `<polygon points="${polygonPoints(regular(w, h, 8, 22.5))}" ${common}/>`;
      case 'burst':
        return `<polygon points="${polygonPoints(star(w, h, Math.max(8, el.points || 16), 0.8))}" ${common}/>`;
      case 'cloud': {
        const d = `M${n(w * 0.25)} ${n(h * 0.85)} C${n(w * 0.05)} ${n(h * 0.85)} 0 ${n(h * 0.6)} ${n(w * 0.12)} ${n(h * 0.5)} C${n(w * 0.06)} ${n(h * 0.25)} ${n(w * 0.3)} ${n(h * 0.12)} ${n(w * 0.42)} ${n(h * 0.25)} C${n(w * 0.5)} 0 ${n(w * 0.85)} ${n(h * 0.05)} ${n(w * 0.8)} ${n(h * 0.35)} C${n(w)} ${n(h * 0.38)} ${n(w)} ${n(h * 0.85)} ${n(w * 0.78)} ${n(h * 0.85)}Z`;
        return `<path d="${d}" ${common}/>`;
      }
      case 'arch':
        return `<path d="M0 ${n(h)} V${n(Math.min(w / 2, h))} A${n(w / 2)} ${n(Math.min(w / 2, h))} 0 0 1 ${n(w)} ${n(Math.min(w / 2, h))} V${n(h)}Z" ${common}/>`;
      case 'semicircle':
        return `<path d="M0 ${n(h)} A${n(w / 2)} ${n(h)} 0 0 1 ${n(w)} ${n(h)}Z" ${common}/>`;
      case 'pill':
        return `<rect width="${n(w)}" height="${n(h)}" rx="${n(Math.min(w, h) / 2)}" ${common}/>`;
      case 'parallelogram':
        return `<polygon points="${polygonPoints([[w * 0.25, 0], [w, 0], [w * 0.75, h], [0, h]])}" ${common}/>`;
      case 'trapezoid':
        return `<polygon points="${polygonPoints([[w * 0.2, 0], [w * 0.8, 0], [w, h], [0, h]])}" ${common}/>`;
      case 'cross':
        return `<polygon points="${polygonPoints([[w / 3, 0], [w * 2 / 3, 0], [w * 2 / 3, h / 3], [w, h / 3], [w, h * 2 / 3], [w * 2 / 3, h * 2 / 3], [w * 2 / 3, h], [w / 3, h], [w / 3, h * 2 / 3], [0, h * 2 / 3], [0, h / 3], [w / 3, h / 3]])}" ${common}/>`;
      case 'chevron':
        return `<polygon points="${polygonPoints([[0, 0], [w * 0.7, 0], [w, h / 2], [w * 0.7, h], [0, h], [w * 0.3, h / 2]])}" ${common}/>`;
      case 'blob': {
        const d = `M${n(w * 0.5)} ${n(h * 0.02)} C${n(w * 0.78)} ${n(h * 0.0)} ${n(w * 1.0)} ${n(h * 0.22)} ${n(w * 0.97)} ${n(h * 0.5)} C${n(w * 0.95)} ${n(h * 0.8)} ${n(w * 0.72)} ${n(h * 1.0)} ${n(w * 0.45)} ${n(h * 0.97)} C${n(w * 0.18)} ${n(h * 0.95)} ${n(w * 0.0)} ${n(h * 0.75)} ${n(w * 0.04)} ${n(h * 0.47)} C${n(w * 0.08)} ${n(h * 0.2)} ${n(w * 0.25)} ${n(h * 0.04)} ${n(w * 0.5)} ${n(h * 0.02)}Z`;
        return `<path d="${d}" ${common}/>`;
      }
      case 'ring': {
        const t = Math.min(w, h) * 0.18;
        const d = `M0 ${n(h / 2)} A${n(w / 2)} ${n(h / 2)} 0 1 0 ${n(w)} ${n(h / 2)} A${n(w / 2)} ${n(h / 2)} 0 1 0 0 ${n(h / 2)}Z M${n(t)} ${n(h / 2)} A${n(w / 2 - t)} ${n(h / 2 - t)} 0 1 1 ${n(w - t)} ${n(h / 2)} A${n(w / 2 - t)} ${n(h / 2 - t)} 0 1 1 ${n(t)} ${n(h / 2)}Z`;
        return `<path d="${d}" fill-rule="evenodd" ${common}/>`;
      }
      default: {
        const r = Math.min(+el.radius || 0, w / 2, h / 2);
        return `<rect x="0" y="0" width="${n(w)}" height="${n(h)}"${r ? ` rx="${n(r)}"` : ''} ${common}/>`;
      }
    }
  }

  function gradientDef(id, c1, c2, angle) {
    const a = parseColor(c1), b = parseColor(c2);
    return `<linearGradient id="${id}" gradientTransform="rotate(${n((angle || 0) - 90)} 0.5 0.5)">` +
      `<stop offset="0" stop-color="${esc(a.hex)}"${a.alpha < 1 ? ` stop-opacity="${a.alpha}"` : ''}/>` +
      `<stop offset="1" stop-color="${esc(b.hex)}"${b.alpha < 1 ? ` stop-opacity="${b.alpha}"` : ''}/></linearGradient>`;
  }

  function shadowFilter(id, sh) {
    const c = parseColor(sh.color || '#00000055');
    return `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">` +
      `<feDropShadow dx="${n(sh.x)}" dy="${n(sh.y)}" stdDeviation="${n((sh.blur || 0) / 2)}" flood-color="${esc(c.hex)}" flood-opacity="${c.alpha}"/></filter>`;
  }

  function imageFilter(id, f) {
    const parts = [];
    const b = (f.brightness == null ? 100 : f.brightness) / 100;
    const c = (f.contrast == null ? 100 : f.contrast) / 100;
    const s = f.grayscale ? 0 : (f.saturation == null ? 100 : f.saturation) / 100;
    if (b !== 1) parts.push(`<feComponentTransfer><feFuncR type="linear" slope="${b}"/><feFuncG type="linear" slope="${b}"/><feFuncB type="linear" slope="${b}"/></feComponentTransfer>`);
    if (c !== 1) { const i = n(0.5 - 0.5 * c); parts.push(`<feComponentTransfer><feFuncR type="linear" slope="${c}" intercept="${i}"/><feFuncG type="linear" slope="${c}" intercept="${i}"/><feFuncB type="linear" slope="${c}" intercept="${i}"/></feComponentTransfer>`); }
    if (s !== 1) parts.push(`<feColorMatrix type="saturate" values="${s}"/>`);
    if (f.sepia) parts.push('<feColorMatrix type="matrix" values="0.393 0.769 0.189 0 0 0.349 0.686 0.168 0 0 0.272 0.534 0.131 0 0 0 0 0 1 0"/>');
    if (f.blur > 0) parts.push(`<feGaussianBlur stdDeviation="${n(f.blur)}"/>`);
    if (!parts.length) return null;
    return `<filter id="${id}" color-interpolation-filters="sRGB">${parts.join('')}</filter>`;
  }

  // Graphics carry their own SVG markup. Strip anything active, so a crafted project file can't run code.
  function sanitizeMarkup(m) {
    return String(m)
      .replace(/<\s*(script|foreignObject|iframe|object|embed|style)[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
      .replace(/<\s*(script|foreignObject|iframe|object|embed|style)[^>]*\/?>/gi, '')
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/(href|xlink:href)\s*=\s*("|')\s*(javascript|https?|file|data:text):[^"']*\2/gi, '');
  }

  // ----- elements -----
  function elementMarkup(el, ctx) {
    const id = sid(el.id);
    const defs = ctx.defs;
    let body = '';
    let h = el.h;

    if (el.type === 'shape') {
      let fill;
      if (el.fillType === 'none') fill = 'fill="none"';
      else if (el.fillType === 'gradient') { defs.push(gradientDef(id + '-g', el.fill, el.fill2, el.gradientAngle)); fill = `fill="url(#${id}-g)"`; }
      else fill = paintAttrs('fill', el.fill);
      body = shapeMarkup(el, fill);
    } else if (el.type === 'line') {
      h = 0;
      const sw = +el.strokeWidth || 1;
      const cap = el.strokeDash === 'dotted' ? '' : ' stroke-linecap="round"';
      const head = Math.max(sw * 3, 8);
      let x1 = 0, x2 = el.w;
      let extras = '';
      const cc = paintAttrs('fill', el.stroke);
      if (el.startCap === 'arrow') { x1 = head * 0.8; extras += `<polygon points="${polygonPoints([[0, 0], [head, -head * 0.6], [head, head * 0.6]])}" ${cc}/>`; }
      if (el.startCap === 'circle') extras += `<circle cx="0" cy="0" r="${n(sw * 1.5)}" ${cc}/>`;
      if (el.endCap === 'arrow') { x2 = el.w - head * 0.8; extras += `<polygon points="${polygonPoints([[el.w, 0], [el.w - head, -head * 0.6], [el.w - head, head * 0.6]])}" ${cc}/>`; }
      if (el.endCap === 'circle') extras += `<circle cx="${n(el.w)}" cy="0" r="${n(sw * 1.5)}" ${cc}/>`;
      const stroke = `${paintAttrs('stroke', el.stroke)} stroke-width="${n(sw)}"${cap}${strokeDash(el.strokeDash, sw)} fill="none" stroke-linejoin="round"`;
      if (el.lineStyle === 'wavy' || el.lineStyle === 'zigzag') {
        const amp = Math.max(sw * 1.5, 4), wl = Math.max(sw * 6, 16);
        let d = `M${n(x1)} 0`;
        let i = 0;
        for (let x = x1; x < x2 - 0.01; x += wl / 2, i++) {
          const nx = Math.min(x + wl / 2, x2), y = i % 2 ? amp : -amp;
          d += el.lineStyle === 'wavy' ? ` Q${n((x + nx) / 2)} ${n(y * 2)} ${n(nx)} 0` : ` L${n((x + nx) / 2)} ${n(y)} L${n(nx)} 0`;
        }
        body = `<path d="${d}" ${stroke}/>${extras}`;
      } else if (el.lineStyle === 'double') {
        body = `<line x1="${n(x1)}" y1="${n(-sw)}" x2="${n(x2)}" y2="${n(-sw)}" ${stroke}/><line x1="${n(x1)}" y1="${n(sw)}" x2="${n(x2)}" y2="${n(sw)}" ${stroke}/>${extras}`;
      } else {
        body = `<line x1="${n(x1)}" y1="0" x2="${n(x2)}" y2="0" ${stroke}/>${extras}`;
      }
    } else if (el.type === 'image' || el.type === 'video') {
      const fitMap = { cover: 'xMidYMid slice', contain: 'xMidYMid meet', stretch: 'none' };
      const r = Math.min(+el.radius || 0, el.w / 2, el.h / 2);
      const mask = el.mask && el.mask !== 'none' ? el.mask : null;
      // photo frames: polaroid keeps a white card around the picture, other frames clip to a shape
      let ix = 0, iy = 0, iw = el.w, ih = el.h;
      let frameBg = '';
      if (mask === 'polaroid') {
        const pad = Math.min(el.w, el.h) * 0.06;
        ix = pad; iy = pad; iw = el.w - 2 * pad; ih = el.h - pad - Math.min(el.w, el.h) * 0.2;
        frameBg = `<rect width="${n(el.w)}" height="${n(el.h)}" rx="${n(Math.min(el.w, el.h) * 0.01)}" ${paintAttrs('fill', el.frameColor || '#ffffff')}/>`;
      }
      const clipShape = mask && mask !== 'polaroid'
        ? shapeMarkup({ shape: mask, w: el.w, h: el.h, radius: mask === 'rect' ? Math.min(el.w, el.h) * 0.12 : 0, points: 5, strokeWidth: 0 }, '')
        : `<rect x="${n(ix)}" y="${n(iy)}" width="${n(iw)}" height="${n(ih)}"${r && !mask ? ` rx="${n(r)}"` : ''}/>`;
      defs.push(`<clipPath id="${id}-c">${clipShape}</clipPath>`);
      const flt = imageFilter(id + '-f', el.filters || {});
      if (flt) defs.push(flt);
      const raw = el.type === 'video' ? el.poster : el.src;
      const href = ctx.resolveSrc ? ctx.resolveSrc(raw) : raw;
      if (!href && el.type === 'image') {
        // empty frame placeholder
        const k = Math.min(iw, ih) * 0.22;
        body = `${frameBg}<g clip-path="url(#${id}-c)"><rect x="${n(ix)}" y="${n(iy)}" width="${n(iw)}" height="${n(ih)}" fill="#dfe3ec"/>` +
          `<g transform="translate(${n(ix + iw / 2 - k / 2)} ${n(iy + ih / 2 - k / 2)}) scale(${n(k / 24 * 1000) / 1000})" fill="none" stroke="#9aa3b5" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></g></g>`;
      } else {
        body = `${frameBg}<g clip-path="url(#${id}-c)"><image x="${n(ix)}" y="${n(iy)}" width="${n(iw)}" height="${n(ih)}" preserveAspectRatio="${fitMap[el.fit] || fitMap.cover}" xlink:href="${esc(href)}"${flt ? ` filter="url(#${id}-f)"` : ''}/></g>`;
      }
      if (el.strokeWidth > 0) {
        if (mask && mask !== 'polaroid') body += shapeMarkup({ shape: mask, w: el.w, h: el.h, radius: mask === 'rect' ? Math.min(el.w, el.h) * 0.12 : 0, points: 5, strokeWidth: el.strokeWidth, stroke: el.stroke }, 'fill="none"');
        else body += `<rect width="${n(el.w)}" height="${n(el.h)}"${r ? ` rx="${n(r)}"` : ''} fill="none" ${paintAttrs('stroke', el.stroke)} stroke-width="${n(el.strokeWidth)}"/>`;
      }
      if (el.type === 'video' && !href) body = `<rect width="${n(el.w)}" height="${n(el.h)}" fill="#1f2333"/>` + body;
      if (el.type === 'video' && ctx.editor) {
        // play badge so videos are recognisable on the canvas (never exported)
        const b = Math.max(18, Math.min(el.w, el.h) * 0.14);
        body += `<g transform="translate(${n(el.w / 2 - b / 2)} ${n(el.h / 2 - b / 2)})" opacity="0.9"><circle cx="${n(b / 2)}" cy="${n(b / 2)}" r="${n(b / 2)}" fill="#000000" fill-opacity="0.55"/><polygon points="${n(b * 0.4)},${n(b * 0.28)} ${n(b * 0.74)},${n(b / 2)} ${n(b * 0.4)},${n(b * 0.72)}" fill="#ffffff"/></g>`;
      }
    } else if (el.type === 'graphic') {
      const vb = /^[\d.\s-]+$/.test(el.viewBox || '') ? el.viewBox : '0 0 100 100';
      const c1 = parseColor(el.color1 || '#6366f1').hex, c2 = parseColor(el.color2 || '#f59e0b').hex, c3 = parseColor(el.color3 || '#ffffff').hex;
      const markup = sanitizeMarkup(el.markup || '').replace(/\{c1\}/g, esc(c1)).replace(/\{c2\}/g, esc(c2)).replace(/\{c3\}/g, esc(c3));
      body = `<svg x="0" y="0" width="${n(el.w)}" height="${n(el.h)}" viewBox="${vb}" preserveAspectRatio="${el.keepRatio === false ? 'none' : 'xMidYMid meet'}" overflow="visible">${markup}</svg>`;
    } else if (el.type === 'text') {
      const lay = layoutText(el, ctx.measure);
      h = lay.height;
      const rtl = isRtl(el);
      let anchor = 'start', x = 0;
      if (el.align === 'center') { anchor = 'middle'; x = el.w / 2; }
      else if (el.align === 'right') { anchor = rtl ? 'start' : 'end'; x = el.w; }
      else { anchor = rtl ? 'end' : 'start'; x = 0; }
      const fam = String(el.fontFamily || 'Segoe UI').replace(/['"]/g, '');
      const attrs = [
        `font-family="'${esc(fam)}', sans-serif"`,
        `font-size="${n(el.fontSize)}"`,
        `font-weight="${el.fontWeight || 400}"`,
        el.italic ? 'font-style="italic"' : '',
        el.underline ? 'text-decoration="underline"' : '',
        el.letterSpacing ? `letter-spacing="${n(el.letterSpacing)}"` : '',
        `text-anchor="${anchor}"`,
        rtl ? 'direction="rtl" unicode-bidi="embed"' : '',
        paintAttrs('fill', el.color),
        el.outline && el.outline.on ? `${paintAttrs('stroke', el.outline.color)} stroke-width="${n(el.outline.width * 2)}" stroke-linejoin="round" paint-order="stroke"` : '',
        'xml:space="preserve"'
      ].filter(Boolean).join(' ');
      const tspans = lay.lines.map((line, i) => {
        const y = i * lay.lineH + lay.lineH / 2 + el.fontSize * 0.35;
        return `<tspan x="${n(x)}" y="${n(y)}">${esc(line) || ' '}</tspan>`;
      }).join('');
      let bg = '';
      if (el.background && el.background.on) {
        const p = +el.background.padding || 0;
        bg = `<rect x="${n(-p)}" y="${n(-p)}" width="${n(el.w + 2 * p)}" height="${n(h + 2 * p)}" rx="${n(el.background.radius || 0)}" ${paintAttrs('fill', el.background.color)}/>`;
      }
      body = `${bg}<text ${attrs}>${tspans}</text>`;
    }

    const cx = el.x + el.w / 2, cy = el.y + h / 2;
    const sx = el.flipX ? -1 : 1, sy = el.flipY ? -1 : 1;
    const transform = `translate(${n(cx)} ${n(cy)})${el.rotation ? ` rotate(${n(el.rotation)})` : ''}${sx !== 1 || sy !== 1 ? ` scale(${sx} ${sy})` : ''} translate(${n(-el.w / 2)} ${n(-h / 2)})`;
    const op = el.opacity != null && el.opacity < 1 ? ` opacity="${n(el.opacity)}"` : '';
    let inner = `<g transform="${transform}"${op}>${body}</g>`;
    if (el.shadow && el.shadow.on) {
      defs.push(shadowFilter(id + '-s', el.shadow));
      inner = `<g filter="url(#${id}-s)">${inner}</g>`;
    }
    const dataAttr = ctx.editor ? ` data-id="${esc(el.id)}"` : '';
    return { markup: `<g${dataAttr}>${inner}</g>`, height: h };
  }

  function backgroundMarkup(page, ctx, x, y, w, h) {
    const bg = page.background || { type: 'solid', color: '#ffffff' };
    if (ctx.transparent) return '';
    if (bg.type === 'gradient') {
      ctx.defs.push(gradientDef('page-bg-g', bg.color, bg.color2 || '#000000', bg.angle));
      return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="url(#page-bg-g)"/>`;
    }
    let out = `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" ${paintAttrs('fill', bg.color || '#ffffff')}/>`;
    if (bg.type === 'image' && bg.src) {
      const href = ctx.resolveSrc ? ctx.resolveSrc(bg.src) : bg.src;
      out += `<image x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" preserveAspectRatio="xMidYMid slice" xlink:href="${esc(href)}"${bg.imageOpacity != null && bg.imageOpacity < 1 ? ` opacity="${bg.imageOpacity}"` : ''}/>`;
    }
    return out;
  }

  // options: measure (required), editor (adds data-id), transparent, bleed (bool),
  //          outW/outH (output pixel size; defaults to page size),
  //          resolveSrc(src) -> URL (maps 'asset:<id>' references to real image data)
  function renderPage(page, format, options) {
    const o = options || {};
    const size = formats.canvasSize(format);
    const b = o.bleed ? formats.bleedPx(format) : 0;
    const vx = -b, vy = -b, vw = size.w + 2 * b, vh = size.h + 2 * b;
    const ctx = { defs: [], measure: o.measure, editor: !!o.editor, transparent: !!o.transparent, heights: {}, resolveSrc: o.resolveSrc || null };
    const bg = backgroundMarkup(page, ctx, vx, vy, vw, vh);
    const parts = [];
    for (const el of page.elements) {
      if (el.hidden) continue;
      const r = elementMarkup(el, ctx);
      ctx.heights[el.id] = r.height;
      parts.push(r.markup);
    }
    const outW = o.outW || vw, outH = o.outH || vh;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${n(outW)}" height="${n(outH)}" viewBox="${n(vx)} ${n(vy)} ${n(vw)} ${n(vh)}">` +
      (ctx.defs.length ? `<defs>${ctx.defs.join('')}</defs>` : '') +
      bg + parts.join('') + '</svg>';
    return { svg, heights: ctx.heights, viewBox: { x: vx, y: vy, w: vw, h: vh } };
  }

  const api = { esc, parseColor, fontCss, isRtl, layoutText, renderPage, elementMarkup, sanitizeMarkup, SHAPES, ICONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.DS = root.DS || {}).render = api;
})(typeof self !== 'undefined' ? self : this);
