// Design format catalog: every canvas size the app offers.
// Screen formats are defined in pixels. Print formats are defined in mm/in;
// the editor works at 96 px per inch and exports at any DPI (e.g. 300).
(function (root) {
  'use strict';

  const PX_PER_IN = 96;
  const MM_PER_IN = 25.4;

  // kind: 'screen' | 'print' | 'video'
  // group: which dashboard section the format belongs to
  function px(id, name, group, w, h, extra) {
    return Object.assign({ id, name, group, unit: 'px', width: w, height: h, kind: 'screen' }, extra || {});
  }
  function mm(id, name, group, w, h, extra) {
    return Object.assign({ id, name, group, unit: 'mm', width: w, height: h, kind: 'print', bleedMm: 3 }, extra || {});
  }
  function inch(id, name, group, w, h, extra) {
    return Object.assign({ id, name, group, unit: 'in', width: w, height: h, kind: 'print', bleedMm: 3 }, extra || {});
  }
  const video = { kind: 'video' };

  const GROUPS = [
    { id: 'docs', name: 'Presentations & Documents' },
    { id: 'social', name: 'Social Media' },
    { id: 'video', name: 'YouTube & Video' },
    { id: 'print', name: 'Marketing & Print' },
    { id: 'merch', name: 'Merchandise & Products' }
  ];

  const FORMATS = [
    // A. Presentations and documents
    px('presentation', 'Presentation (16:9)', 'docs', 1920, 1080, { multiPage: true }),
    px('pitch-deck', 'Pitch Deck', 'docs', 1920, 1080, { multiPage: true }),
    px('school-slides', 'School Slides', 'docs', 1920, 1080, { multiPage: true }),
    px('ebook', 'E-book (6 × 9 in)', 'docs', 1600, 2400, { multiPage: true }),
    mm('resume', 'Resume (A4)', 'docs', 210, 297),
    mm('letter', 'Letter (A4)', 'docs', 210, 297, { multiPage: true }),
    mm('report', 'Report (A4)', 'docs', 210, 297, { multiPage: true }),
    px('whiteboard', 'Whiteboard', 'docs', 3840, 2160),
    mm('magazine', 'Magazine (A4, Portrait)', 'docs', 210, 297, { multiPage: true }),

    // B. Social media
    px('ig-post', 'Instagram Post (Square)', 'social', 1080, 1080),
    px('ig-post-portrait', 'Instagram Post (Portrait 4:5)', 'social', 1080, 1350),
    px('ig-story', 'Instagram Story', 'social', 1080, 1920),
    px('ig-reel-cover', 'Instagram Reel Cover', 'social', 1080, 1920),
    px('ig-link-in-bio', 'Instagram Link in Bio', 'social', 1080, 1920),
    px('fb-post', 'Facebook Post (Landscape)', 'social', 1200, 630),
    px('fb-cover', 'Facebook Cover (Landscape)', 'social', 1640, 624),
    px('linkedin-post', 'LinkedIn Post', 'social', 1200, 1200),
    px('linkedin-video', 'LinkedIn Video', 'social', 1920, 1080, video),
    px('your-story', 'Your Story', 'social', 1080, 1920),
    px('social-ad', 'Social Media Ad', 'social', 1080, 1080),

    // C. YouTube and video (designed as frames now; timeline editing is Phase 3)
    px('yt-shorts', 'YouTube Shorts', 'video', 1080, 1920, video),
    px('yt-thumbnail', 'YouTube Thumbnail', 'video', 1280, 720),
    px('yt-video', 'YouTube Video', 'video', 1920, 1080, video),
    px('landscape-video', 'Landscape Video', 'video', 1920, 1080, video),
    px('ig-reels', 'Instagram Reels', 'video', 1080, 1920, video),
    px('promo-video', 'Promotional Video', 'video', 1920, 1080, video),
    px('video-ad', 'Video Ad (Square)', 'video', 1080, 1080, video),
    px('intro-outro', 'Intro / Outro Video', 'video', 1920, 1080, video),

    // D. Marketing and print
    mm('poster', 'Poster (A2, 42 × 59.4 cm)', 'print', 420, 594),
    mm('flyer', 'Flyer (A4, Portrait)', 'print', 210, 297),
    inch('invitation', 'Invitation (5 × 7 in)', 'print', 5, 7),
    inch('business-card', 'Business Card (3.5 × 2 in)', 'print', 3.5, 2),
    inch('greeting-card', 'Greeting Card (5 × 7 in)', 'print', 5, 7),
    mm('brochure', 'Brochure (Trifold, A4 Landscape)', 'print', 297, 210, { panels: 3, multiPage: true }),
    mm('sticker-circle', 'Circular Sticker (100 mm)', 'print', 100, 100, { shape: 'circle' }),
    mm('postcard', 'Postcard (A6, Landscape)', 'print', 148, 105),
    mm('banner', 'Banner (1000 × 500 mm, Landscape)', 'print', 1000, 500),

    // E. Merchandise and product design
    inch('tshirt', 'T-Shirt Design (12 × 16 in print area)', 'merch', 12, 16, { bleedMm: 0 }),
    inch('mug', 'Mug Wrap (8.5 × 3.5 in)', 'merch', 8.5, 3.5),
    inch('product-label', 'Product Label (4 × 3 in)', 'merch', 4, 3),
    inch('packaging', 'Packaging Panel (8 × 8 in)', 'merch', 8, 8),
    px('merch-graphic', 'Merchandise Graphic (Transparent)', 'merch', 3000, 3000)
  ];

  function toPx(value, unit) {
    if (unit === 'mm') return (value / MM_PER_IN) * PX_PER_IN;
    if (unit === 'in') return value * PX_PER_IN;
    return value;
  }

  // Canvas size in editor pixels (rounded to 2 decimals so mm sizes stay exact enough).
  function canvasSize(format) {
    return {
      w: Math.round(toPx(format.width, format.unit) * 100) / 100,
      h: Math.round(toPx(format.height, format.unit) * 100) / 100
    };
  }

  // Physical size in inches (used for PDF page size and DPI calculations).
  function sizeInInches(format) {
    const s = canvasSize(format);
    return { w: s.w / PX_PER_IN, h: s.h / PX_PER_IN };
  }

  function bleedPx(format) {
    return format.kind === 'print' && format.bleedMm ? toPx(format.bleedMm, 'mm') : 0;
  }

  function label(format) {
    const u = format.unit === 'px' ? 'px' : format.unit;
    return `${format.width} × ${format.height} ${u}`;
  }

  function aspectLabel(format) {
    const s = canvasSize(format);
    const r = s.w / s.h;
    const known = [[16 / 9, '16:9'], [9 / 16, '9:16'], [1, '1:1'], [4 / 5, '4:5'], [1.414, 'A-series'], [1 / 1.414, 'A-series']];
    for (const [v, n] of known) if (Math.abs(r - v) < 0.01) return n;
    return r >= 1 ? 'Landscape' : 'Portrait';
  }

  function byId(id) {
    return FORMATS.find((f) => f.id === id) || null;
  }

  function custom(w, h, unit) {
    const f = { id: 'custom', name: 'Custom size', group: 'custom', unit: unit || 'px', width: +w, height: +h };
    f.kind = f.unit === 'px' ? 'screen' : 'print';
    if (f.kind === 'print') f.bleedMm = 3;
    return f;
  }

  const api = { PX_PER_IN, MM_PER_IN, GROUPS, FORMATS, toPx, canvasSize, sizeInInches, bleedPx, label, aspectLabel, byId, custom };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.DS = root.DS || {}).formats = api;
})(typeof self !== 'undefined' ? self : this);
