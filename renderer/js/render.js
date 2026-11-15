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
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><line x1="15.5" y1="15.5" x2="21" y2="21"/>'
  };

  const SHAPES = ['rect', 'ellipse', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'heart', 'arrow', 'speech'];

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
      body = `<line x1="${n(x1)}" y1="0" x2="${n(x2)}" y2="0" ${paintAttrs('stroke', el.stroke)} stroke-width="${n(sw)}"${cap}${strokeDash(el.strokeDash, sw)}/>${extras}`;
    } else if (el.type === 'image' || el.type === 'video') {
      const fitMap = { cover: 'xMidYMid slice', contain: 'xMidYMid meet', stretch: 'none' };
      const r = Math.min(+el.radius || 0, el.w / 2, el.h / 2);
      defs.push(`<clipPath id="${id}-c"><rect width="${n(el.w)}" height="${n(el.h)}"${r ? ` rx="${n(r)}"` : ''}/></clipPath>`);
      const flt = imageFilter(id + '-f', el.filters || {});
      if (flt) defs.push(flt);
      const raw = el.type === 'video' ? el.poster : el.src;
      const href = ctx.resolveSrc ? ctx.resolveSrc(raw) : raw;
      body = `<g clip-path="url(#${id}-c)"><image width="${n(el.w)}" height="${n(el.h)}" preserveAspectRatio="${fitMap[el.fit] || fitMap.cover}" xlink:href="${esc(href)}"${flt ? ` filter="url(#${id}-f)"` : ''}/></g>`;
      if (el.strokeWidth > 0) body += `<rect width="${n(el.w)}" height="${n(el.h)}"${r ? ` rx="${n(r)}"` : ''} fill="none" ${paintAttrs('stroke', el.stroke)} stroke-width="${n(el.strokeWidth)}"/>`;
      if (el.type === 'video' && !href) body = `<rect width="${n(el.w)}" height="${n(el.h)}" fill="#1f2333"/>` + body;
      if (el.type === 'video' && ctx.editor) {
        // play badge so videos are recognisable on the canvas (never exported)
        const b = Math.max(18, Math.min(el.w, el.h) * 0.14);
        body += `<g transform="translate(${n(el.w / 2 - b / 2)} ${n(el.h / 2 - b / 2)})" opacity="0.9"><circle cx="${n(b / 2)}" cy="${n(b / 2)}" r="${n(b / 2)}" fill="#000000" fill-opacity="0.55"/><polygon points="${n(b * 0.4)},${n(b * 0.28)} ${n(b * 0.74)},${n(b / 2)} ${n(b * 0.4)},${n(b * 0.72)}" fill="#ffffff"/></g>`;
      }
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

  const api = { esc, parseColor, fontCss, isRtl, layoutText, renderPage, elementMarkup, SHAPES, ICONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.DS = root.DS || {}).render = api;
})(typeof self !== 'undefined' ? self : this);
