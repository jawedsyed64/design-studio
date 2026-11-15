// Built-in creative asset library (works offline): decorative graphics, stickers,
// photo frames, line styles and animation presets. Graphics are original vector
// drawings with up to three recolourable colours ({c1}, {c2}, {c3}).
(function (root) {
  'use strict';

  // ---------------------------------------------------------------- graphics
  // [id, name, keywords, markup, viewBox?, default colours?]
  const G = [
    ['blob-1', 'Soft blob', 'blob abstract organic shape', '<path fill="{c1}" d="M52 6c18 0 36 10 40 28s-4 34-16 46-34 16-50 8S2 62 6 44 34 6 52 6z"/>'],
    ['blob-2', 'Wavy blob', 'blob abstract organic', '<path fill="{c1}" d="M30 8c14-6 26 6 38 4s26 8 26 24-10 22-8 34-12 26-30 22-24-12-38-14S2 66 6 50s10-20 8-30S16 14 30 8z"/>'],
    ['blob-duo', 'Blob pair', 'blob abstract two colour', '<path fill="{c2}" d="M64 10c16 0 30 14 28 30s-18 22-30 20-24-12-22-28 8-22 24-22z"/><path fill="{c1}" d="M30 38c16-2 30 10 30 26S46 92 30 92 4 80 6 64s8-24 24-26z"/>'],
    ['wave-bottom', 'Wave (bottom)', 'wave border footer water', '<path fill="{c1}" d="M0 40 C20 25 35 25 50 38 S80 52 100 36 V100 H0Z"/><path fill="{c2}" opacity=".7" d="M0 60 C25 45 40 50 55 60 S85 70 100 55 V100 H0Z"/>', '0 0 100 100', { keepRatio: false }],
    ['wave-top', 'Wave (top)', 'wave border header', '<path fill="{c1}" d="M0 0H100V55 C80 70 65 60 50 52 S20 40 0 58Z"/>', '0 0 100 100', { keepRatio: false }],
    ['circles', 'Circle cluster', 'circles dots abstract bubbles', '<circle cx="35" cy="40" r="28" fill="{c1}"/><circle cx="70" cy="62" r="20" fill="{c2}"/><circle cx="72" cy="22" r="9" fill="{c1}" opacity=".6"/><circle cx="22" cy="80" r="7" fill="{c2}" opacity=".7"/>'],
    ['dots-grid', 'Dot pattern', 'dots pattern grid halftone texture', (() => { let m = ''; for (let y = 10; y <= 90; y += 16) for (let x = 10; x <= 90; x += 16) m += `<circle cx="${x}" cy="${y}" r="3.2" fill="{c1}"/>`; return m; })()],
    ['lines-pattern', 'Diagonal lines', 'stripes lines pattern texture', (() => { let m = ''; for (let i = -96; i < 100; i += 12) { const x1 = Math.max(i, 0), x2 = Math.min(i + 100, 100); m += `<line x1="${x1}" y1="${100 - (x1 - i)}" x2="${x2}" y2="${100 - (x2 - i)}" stroke="{c1}" stroke-width="3" stroke-linecap="round"/>`; } return m; })()],
    ['confetti', 'Confetti', 'confetti party celebration birthday', '<rect x="10" y="12" width="8" height="3" rx="1" fill="{c1}" transform="rotate(30 14 13)"/><rect x="70" y="10" width="9" height="3" rx="1" fill="{c2}" transform="rotate(-25 74 11)"/><circle cx="40" cy="20" r="3" fill="{c2}"/><rect x="85" y="40" width="8" height="3" rx="1" fill="{c1}" transform="rotate(60 89 41)"/><circle cx="20" cy="55" r="2.5" fill="{c1}"/><rect x="45" y="50" width="9" height="3" rx="1" fill="{c2}" transform="rotate(-40 49 51)"/><circle cx="75" cy="72" r="3" fill="{c1}"/><rect x="15" y="85" width="9" height="3" rx="1" fill="{c2}" transform="rotate(15 19 86)"/><rect x="55" y="88" width="8" height="3" rx="1" fill="{c1}" transform="rotate(-70 59 89)"/><circle cx="92" cy="90" r="2.5" fill="{c2}"/><path d="M28 32q4-4 8 0t8 0" stroke="{c1}" stroke-width="2" fill="none"/><path d="M60 30q4-4 8 0t8 0" stroke="{c2}" stroke-width="2" fill="none"/>'],
    ['sparkles', 'Sparkles', 'sparkle shine stars magic glitter', '<path fill="{c1}" d="M40 10l6 20 20 6-20 6-6 20-6-20-20-6 20-6z"/><path fill="{c2}" d="M76 52l4 12 12 4-12 4-4 12-4-12-12-4 12-4z"/><path fill="{c1}" d="M24 66l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/>'],
    ['starburst', 'Sale burst', 'sale badge burst price offer starburst', (() => { const p = []; for (let i = 0; i < 40; i++) { const r = i % 2 ? 40 : 48, a = (i / 40) * Math.PI * 2; p.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`); } return `<polygon fill="{c1}" points="${p.join(' ')}"/><circle cx="50" cy="50" r="34" fill="none" stroke="{c3}" stroke-width="1.5" stroke-dasharray="3 3"/>`; })()],
    ['seal', 'Quality seal', 'badge seal award certificate', (() => { const p = []; for (let i = 0; i < 48; i++) { const r = i % 2 ? 42 : 46, a = (i / 48) * Math.PI * 2; p.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(42 + r * Math.sin(a) * 0.9).toFixed(1)}`); } return `<path fill="{c2}" d="M32 70l-8 28 14-8 8 10 4-26zM68 70l8 28-14-8-8 10-4-26z"/><polygon fill="{c1}" points="${p.join(' ')}"/><circle cx="50" cy="42" r="30" fill="none" stroke="{c3}" stroke-width="2"/>`; })()],
    ['ribbon', 'Ribbon banner', 'ribbon banner title label', '<path fill="{c2}" d="M2 30h16v30H2l8-15z"/><path fill="{c2}" d="M98 30H82v30h16l-8-15z"/><path fill="{c1}" d="M12 22h76v34H12z"/><path fill="{c2}" opacity=".6" d="M12 56l6 6V56zM88 56l-6 6V56z"/>', '0 0 100 70'],
    ['label-tag', 'Price tag', 'tag price label sale', '<path fill="{c1}" d="M8 20h60l24 30-24 30H8z"/><circle cx="66" cy="50" r="5" fill="{c3}"/>', '0 0 100 100'],
    ['speech-round', 'Speech bubble', 'speech bubble chat talk comic', '<path fill="{c1}" d="M50 8C26 8 8 22 8 40c0 10 6 19 15 25l-5 19 20-13c4 1 8 1 12 1 24 0 42-14 42-32S74 8 50 8z"/>'],
    ['thought', 'Thought bubble', 'thought bubble think idea comic', '<ellipse cx="54" cy="38" rx="40" ry="28" fill="{c1}"/><circle cx="24" cy="76" r="8" fill="{c1}"/><circle cx="12" cy="92" r="5" fill="{c1}"/>'],
    ['sun', 'Sun', 'sun summer sunny weather', (() => { let m = '<circle cx="50" cy="50" r="22" fill="{c1}"/>'; for (let i = 0; i < 12; i++) { const a = i * 30; m += `<rect x="47" y="6" width="6" height="16" rx="3" fill="{c2}" transform="rotate(${a} 50 50)"/>`; } return m; })()],
    ['cloud', 'Cloud', 'cloud sky weather', '<path fill="{c1}" d="M26 74a18 18 0 0 1-2-36 24 24 0 0 1 46-6 18 18 0 0 1 6 42z"/>'],
    ['rainbow', 'Rainbow', 'rainbow kids colourful sky', '<path d="M10 80a40 40 0 0 1 80 0" fill="none" stroke="#ef4444" stroke-width="8"/><path d="M18 80a32 32 0 0 1 64 0" fill="none" stroke="#f59e0b" stroke-width="8"/><path d="M26 80a24 24 0 0 1 48 0" fill="none" stroke="#22c55e" stroke-width="8"/><path d="M34 80a16 16 0 0 1 32 0" fill="none" stroke="#3b82f6" stroke-width="8"/>'],
    ['leaf', 'Leaf', 'leaf nature plant eco green', '<path fill="{c1}" d="M14 86C14 40 44 14 90 12c0 46-28 74-76 74z"/><path d="M18 82C40 58 58 40 80 22" stroke="{c3}" stroke-width="2.5" fill="none"/>'],
    ['leaves-branch', 'Leafy branch', 'branch leaves botanical nature wedding', '<path d="M50 96C50 60 50 30 50 4" stroke="{c2}" stroke-width="2.5" fill="none"/>' + [20, 40, 60, 80].map((y, i) => `<path fill="{c1}" d="M50 ${y + 8}c-14-2-24-10-26-20 12 0 22 8 26 20z"/><path fill="{c1}" d="M50 ${y}c14-2 24-10 26-20-12 0-22 8-26 20z"/>`).join(''), '0 0 100 100'],
    ['flower', 'Flower', 'flower floral spring nature', (() => { let m = ''; for (let i = 0; i < 6; i++) m += `<ellipse cx="50" cy="26" rx="12" ry="22" fill="{c1}" transform="rotate(${i * 60} 50 50)"/>`; return m + '<circle cx="50" cy="50" r="12" fill="{c2}"/>'; })()],
    ['heart-cluster', 'Hearts', 'hearts love valentine romance', '<path fill="{c1}" d="M40 80S10 62 10 42c0-10 8-18 17-18 6 0 10 3 13 8 3-5 7-8 13-8 9 0 17 8 17 18 0 20-30 38-30 38z"/><path fill="{c2}" d="M78 40s-14-9-14-18c0-5 4-8 8-8 3 0 5 1 6 4 1-3 3-4 6-4 4 0 8 3 8 8 0 9-14 18-14 18z"/>'],
    ['balloons', 'Balloons', 'balloons birthday party celebration', '<path d="M34 62q4 14-2 34M64 58q-4 16 2 38" stroke="#64748b" stroke-width="1.2" fill="none"/><ellipse cx="34" cy="38" rx="18" ry="22" fill="{c1}"/><ellipse cx="64" cy="34" rx="18" ry="22" fill="{c2}"/><path fill="{c1}" d="M31 60h6l-3 4z"/><path fill="{c2}" d="M61 56h6l-3 4z"/>'],
    ['gift-box', 'Gift box', 'gift present birthday eid', '<rect x="16" y="40" width="68" height="50" rx="3" fill="{c1}"/><rect x="12" y="28" width="76" height="16" rx="3" fill="{c1}"/><rect x="45" y="28" width="10" height="62" fill="{c2}"/><path d="M50 28c-6-16-26-16-20-2 4 6 20 2 20 2zM50 28c6-16 26-16 20-2-4 6-20 2-20 2z" fill="{c2}"/>'],
    ['crescent-star', 'Crescent & star', 'crescent moon star eid ramadan islamic', '<path fill="{c1}" d="M58 10a40 40 0 1 0 30 58A32 32 0 1 1 58 10z"/><path fill="{c2}" d="M76 22l3 9 10 0-8 6 3 9-8-6-8 6 3-9-8-6 10 0z"/>'],
    ['eight-star', 'Islamic star', 'islamic geometric star pattern rub el hizb', '<rect x="20" y="20" width="60" height="60" fill="{c1}"/><rect x="20" y="20" width="60" height="60" fill="{c1}" transform="rotate(45 50 50)"/><circle cx="50" cy="50" r="18" fill="none" stroke="{c2}" stroke-width="3"/>'],
    ['lantern', 'Lantern', 'lantern fanous ramadan eid light', '<path d="M50 2v10" stroke="{c2}" stroke-width="2"/><path fill="{c2}" d="M38 12h24l-4 8H42z"/><path fill="{c1}" d="M36 20h28l6 50H30z"/><path fill="{c3}" opacity=".85" d="M44 28h12l3 34H41z"/><path fill="{c2}" d="M30 70h40l-6 10H36zM44 80h12l-2 8h-8z"/>'],
    ['mosque', 'Mosque silhouette', 'mosque masjid islamic eid ramadan silhouette', '<path fill="{c1}" d="M30 90V60c0-12 9-20 20-26 11 6 20 14 20 26v30z"/><path fill="{c1}" d="M48 34c0-6 4-8 2-14 2 4 6 8 2 14z"/><rect x="12" y="40" width="7" height="50" fill="{c1}"/><path fill="{c1}" d="M15.5 28l4 12h-8z"/><rect x="81" y="40" width="7" height="50" fill="{c1}"/><path fill="{c1}" d="M84.5 28l4 12h-8z"/><path fill="{c3}" d="M44 90V76a6 6 0 0 1 12 0v14z"/><rect x="6" y="88" width="88" height="4" fill="{c1}"/>'],
    ['arch-frame', 'Arch window', 'arch window islamic doorway frame', '<path d="M18 96V44a32 32 0 0 1 64 0v52" fill="none" stroke="{c1}" stroke-width="5"/><path d="M28 96V46a22 22 0 0 1 44 0v50" fill="none" stroke="{c2}" stroke-width="2"/>'],
    ['corner-ornament', 'Corner ornament', 'corner ornament decorative vintage border', '<path d="M4 96V30C4 14 14 4 30 4h66" fill="none" stroke="{c1}" stroke-width="3"/><path d="M14 96V36c0-12 10-22 22-22h60" fill="none" stroke="{c1}" stroke-width="1.5"/><circle cx="24" cy="24" r="6" fill="{c2}"/><path d="M40 24c10 0 10-10 20-10M24 40c0 10-10 10-10 20" stroke="{c2}" stroke-width="2" fill="none"/>'],
    ['divider-ornament', 'Ornamental divider', 'divider ornament separator elegant wedding', '<path d="M4 25h36M60 25h36" stroke="{c1}" stroke-width="2"/><path fill="{c1}" d="M50 13l6 12-6 12-6-12z"/><circle cx="40" cy="25" r="2.5" fill="{c1}"/><circle cx="60" cy="25" r="2.5" fill="{c1}"/>', '0 0 100 50'],
    ['brush-stroke', 'Brush stroke', 'brush stroke paint highlight marker', '<path fill="{c1}" d="M6 30c10-8 30-12 50-12s34 2 40 6c2 2 0 6-4 6-6 1-4 4 0 6 4 3 0 7-6 8-20 3-52 4-74 0-6-1-8-5-4-8 3-2 2-4-2-6z"/>', '0 0 100 60', { keepRatio: false }],
    ['underline-scribble', 'Scribble underline', 'underline scribble hand drawn highlight', '<path d="M4 20c20-8 40-10 60-8s24 4 32 2M10 30c24-6 50-6 80-2" stroke="{c1}" stroke-width="4" fill="none" stroke-linecap="round"/>', '0 0 100 40', { keepRatio: false }],
    ['arrow-curved', 'Curved arrow', 'arrow curved hand drawn pointer', '<path d="M10 80C20 30 60 18 84 30" stroke="{c1}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M70 18l16 12-18 8" stroke="{c1}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'],
    ['arrow-loop', 'Loop arrow', 'arrow loop hand drawn doodle', '<path d="M8 70c14-4 24-14 22-26-1-10-14-10-14 0 0 16 30 22 64 8" stroke="{c1}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M70 44l12 8-12 10" stroke="{c1}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'],
    ['circle-scribble', 'Hand-drawn circle', 'circle highlight hand drawn doodle ring', '<path d="M60 12C30 6 8 24 10 50s28 40 52 38 32-22 28-44C86 22 62 10 38 16" stroke="{c1}" stroke-width="3.5" fill="none" stroke-linecap="round"/>'],
    ['geo-triangles', 'Geometric triangles', 'geometric triangles abstract modern', '<polygon fill="{c1}" points="10,90 40,30 70,90"/><polygon fill="{c2}" opacity=".85" points="40,90 70,40 95,90"/><polygon fill="{c1}" opacity=".5" points="55,30 70,6 85,30"/>'],
    ['memphis', 'Memphis shapes', 'memphis retro 90s shapes playful', '<circle cx="22" cy="24" r="12" fill="{c1}"/><path d="M50 14l8 14H42z" fill="{c2}"/><path d="M70 20q5-8 10 0t10 0" stroke="{c1}" stroke-width="3" fill="none"/><rect x="62" y="58" width="22" height="22" fill="none" stroke="{c2}" stroke-width="3" transform="rotate(15 73 69)"/><path d="M14 66l6 6 6-6 6 6 6-6" stroke="{c2}" stroke-width="3" fill="none"/><circle cx="46" cy="84" r="4" fill="{c1}"/>'],
    ['sticky-note', 'Sticky note', 'sticky note paper memo reminder', '<path fill="{c1}" d="M8 8h84v64L72 92H8z"/><path fill="{c2}" opacity=".5" d="M72 92V72h20z"/>'],
    ['phone-frame', 'Phone mockup', 'phone mockup mobile smartphone device', '<rect x="22" y="2" width="56" height="96" rx="9" fill="{c1}"/><rect x="26" y="9" width="48" height="82" rx="3" fill="{c3}"/><rect x="42" y="4.5" width="16" height="2.5" rx="1.2" fill="{c2}"/>'],
    ['laptop-frame', 'Laptop mockup', 'laptop computer mockup device screen', '<rect x="14" y="14" width="72" height="48" rx="3" fill="{c1}"/><rect x="18" y="18" width="64" height="40" fill="{c3}"/><path fill="{c1}" d="M4 64h92l-6 8H10z"/>', '0 0 100 80'],
    ['browser-frame', 'Browser window', 'browser window website mockup', '<rect x="4" y="10" width="92" height="70" rx="4" fill="{c3}" stroke="{c1}" stroke-width="2"/><path d="M4 14a4 4 0 0 1 4-4h84a4 4 0 0 1 4 4v8H4z" fill="{c1}"/><circle cx="11" cy="16" r="2" fill="#ef4444"/><circle cx="18" cy="16" r="2" fill="#f59e0b"/><circle cx="25" cy="16" r="2" fill="#22c55e"/>', '0 0 100 90'],
    ['quote-marks', 'Quote marks', 'quote quotation testimonial', '<path fill="{c1}" d="M12 60c0-22 10-36 28-40l3 8c-10 4-14 10-14 18h12v24H12zM54 60c0-22 10-36 28-40l3 8c-10 4-14 10-14 18h12v24H54z"/>'],
    ['location-pin', 'Map pin', 'location pin map place address', '<path fill="{c1}" d="M50 96S18 60 18 38a32 32 0 0 1 64 0c0 22-32 58-32 58z"/><circle cx="50" cy="38" r="12" fill="{c3}"/>'],
    ['play-button', 'Play button', 'play button video youtube media', '<circle cx="50" cy="50" r="44" fill="{c1}"/><polygon fill="{c3}" points="40,30 72,50 40,70"/>'],
    ['crown', 'Crown', 'crown king queen royal premium', '<path fill="{c1}" d="M10 30l20 18 20-32 20 32 20-18-8 50H18z"/><rect x="18" y="82" width="64" height="8" rx="2" fill="{c2}"/><circle cx="50" cy="56" r="5" fill="{c2}"/>'],
    ['trophy', 'Trophy', 'trophy award winner prize', '<path fill="{c1}" d="M30 10h40v24a20 20 0 0 1-40 0z"/><path d="M30 18H16a12 12 0 0 0 16 16M70 18h14a12 12 0 0 1-16 16" stroke="{c1}" stroke-width="4" fill="none"/><rect x="46" y="54" width="8" height="18" fill="{c1}"/><rect x="30" y="72" width="40" height="10" rx="2" fill="{c2}"/>'],
    ['coffee-cup', 'Coffee cup', 'coffee cafe drink cup', '<path fill="{c1}" d="M18 34h52v30a20 20 0 0 1-20 20H38a20 20 0 0 1-20-20z"/><path d="M70 42h6a10 10 0 0 1 0 20h-6" stroke="{c1}" stroke-width="5" fill="none"/><path d="M34 12c-4 6 4 10 0 16M46 12c-4 6 4 10 0 16" stroke="{c2}" stroke-width="3" fill="none" stroke-linecap="round"/>'],
    ['shopping-bag', 'Shopping bag', 'shopping bag sale store', '<path fill="{c1}" d="M16 30h68l-6 62H22z"/><path d="M36 38V24a14 14 0 0 1 28 0v14" stroke="{c2}" stroke-width="5" fill="none"/>'],
    ['open-sign', 'Open sign', 'open shop store sign', '<path d="M30 6l20 20 20-20" stroke="{c2}" stroke-width="2" fill="none"/><rect x="6" y="26" width="88" height="40" rx="6" fill="{c1}"/><text x="50" y="54" font-family="Arial Black, sans-serif" font-size="22" text-anchor="middle" fill="{c3}">OPEN</text>', '0 0 100 72'],
    ['new-badge', 'NEW badge', 'new badge label sticker', '<circle cx="50" cy="50" r="44" fill="{c1}"/><circle cx="50" cy="50" r="38" fill="none" stroke="{c3}" stroke-width="2"/><text x="50" y="58" font-family="Arial Black, sans-serif" font-size="24" text-anchor="middle" fill="{c3}">NEW</text>'],
    ['sale-badge', 'SALE badge', 'sale discount offer percent badge', '<rect x="8" y="22" width="84" height="56" rx="10" fill="{c1}" transform="rotate(-8 50 50)"/><text x="50" y="60" font-family="Arial Black, sans-serif" font-size="26" text-anchor="middle" fill="{c3}" transform="rotate(-8 50 50)">SALE</text>']
  ];

  const GRAPHICS = G.map(([id, name, kw, markup, viewBox, extra]) => Object.assign({ id, name, keywords: kw, markup, viewBox: viewBox || '0 0 100 100' }, extra || {}));

  // Fixed default colours per graphic look nicer than one global colour.
  const PALETTE = [['#7c3aed', '#f59e0b'], ['#ec4899', '#8b5cf6'], ['#0ea5e9', '#22c55e'], ['#f97316', '#facc15'], ['#14b8a6', '#0f766e'], ['#ef4444', '#f59e0b']];
  const SPECIAL_COLOURS = {
    'crescent-star': ['#fbbf24', '#fde68a', '#ffffff'], 'eight-star': ['#047857', '#fbbf24'], lantern: ['#b45309', '#78350f', '#fde68a'],
    mosque: ['#065f46', '#047857', '#ecfdf5'], leaf: ['#16a34a', '#15803d', '#dcfce7'], 'leaves-branch': ['#16a34a', '#78350f'],
    sun: ['#facc15', '#f59e0b'], cloud: ['#e0f2fe', '#bae6fd'], 'coffee-cup': ['#78350f', '#a16207'], 'sticky-note': ['#fde047', '#ca8a04'],
    'phone-frame': ['#111827', '#374151', '#f8fafc'], 'laptop-frame': ['#374151', '#111827', '#f8fafc'], 'browser-frame': ['#e5e7eb', '#9ca3af', '#ffffff'],
    'new-badge': ['#ef4444', '#ef4444', '#ffffff'], 'sale-badge': ['#111827', '#111827', '#facc15'], 'open-sign': ['#16a34a', '#334155', '#ffffff'],
    starburst: ['#ef4444', '#ef4444', '#ffffff'], seal: ['#b45309', '#92400e', '#fde68a'], 'location-pin': ['#ef4444', '#ef4444', '#ffffff'],
    'play-button': ['#ef4444', '#ef4444', '#ffffff'], crown: ['#f59e0b', '#b45309'], trophy: ['#f59e0b', '#92400e'], 'label-tag': ['#ef4444', '#ef4444', '#ffffff']
  };
  GRAPHICS.forEach((g, i) => {
    const c = SPECIAL_COLOURS[g.id] || PALETTE[i % PALETTE.length];
    g.color1 = c[0]; g.color2 = c[1]; g.color3 = c[2] || '#ffffff';
  });

  // ---------------------------------------------------------------- stickers (emoji)
  const STICKER_GROUPS = [
    ['Smileys', '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 😉 😍 🥰 😘 😎 🤩 🥳 😋 🤔 🤗 🤫 😴 😮 😢 😭 😡 🤯 🥺 🙏'],
    ['Hearts & hands', '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💖 💕 💯 👍 👎 👏 🙌 👋 ✌️ 🤞 👌 💪 🤝 ✍️ 👉 👈 ☝️'],
    ['Celebration', '🎉 🎊 🎈 🎁 🎂 🥂 🍾 🏆 🥇 🎖️ 🎀 ✨ 🌟 ⭐ 💫 🔥 🎶 🎵 🎤 🎧 🎬 📸'],
    ['Eid & Ramadan', '🌙 ☪️ 🕌 🤲 📿 🕋 🌟 🏮 🍲 🥘 🫖 🍬'],
    ['Nature', '🌸 🌺 🌻 🌹 🌷 🌼 🍀 🌿 🍃 🌴 🌵 🌈 ☀️ 🌤️ ⛅ 🌧️ ❄️ 🌊 🦋 🐝 🐱 🐶 🐦 🦁'],
    ['Food & drink', '☕ 🍵 🧋 🍕 🍔 🍟 🌮 🍰 🧁 🍩 🍪 🍫 🍦 🍓 🍎 🍉 🍋 🥭 🍌 🥗 🍛 🍗'],
    ['Objects', '💡 📌 📍 📎 📅 ⏰ 📱 💻 🖥️ 📷 🎨 🖌️ 📚 ✏️ 📝 💼 🛍️ 🛒 💰 💳 🏠 🚗 ✈️ 🚀 🎯 🔔 🔑 📢'],
    ['Symbols', '✅ ❌ ⚠️ ❗ ❓ 💬 ➡️ ⬅️ ⬆️ ⬇️ 🔝 🆕 🆓 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🔶 🔷']
  ];
  const STICKERS = STICKER_GROUPS.map(([name, list]) => ({ name, items: list.split(' ').filter(Boolean) }));

  // ---------------------------------------------------------------- frames, lines, animations
  const FRAMES = [
    ['rect', 'Rounded'], ['ellipse', 'Circle'], ['polaroid', 'Polaroid'], ['arch', 'Arch'], ['heart', 'Heart'], ['star', 'Star'],
    ['hexagon', 'Hexagon'], ['blob', 'Blob'], ['pill', 'Pill'], ['cloud', 'Cloud'], ['diamond', 'Diamond'], ['triangle', 'Triangle'],
    ['octagon', 'Octagon'], ['burst', 'Burst'], ['semicircle', 'Half circle'], ['none', 'Square']
  ].map(([mask, name]) => ({ mask, name }));

  const LINES = [
    { name: 'Line', props: {} },
    { name: 'Dashed', props: { strokeDash: 'dashed' } },
    { name: 'Dotted', props: { strokeDash: 'dotted', strokeWidth: 8 } },
    { name: 'Arrow', props: { endCap: 'arrow' } },
    { name: 'Double arrow', props: { startCap: 'arrow', endCap: 'arrow' } },
    { name: 'Dot ends', props: { startCap: 'circle', endCap: 'circle' } },
    { name: 'Wavy', props: { lineStyle: 'wavy', strokeWidth: 4 } },
    { name: 'Zigzag', props: { lineStyle: 'zigzag', strokeWidth: 4 } },
    { name: 'Double', props: { lineStyle: 'double', strokeWidth: 3 } }
  ];

  const ANIMATIONS_IN = [
    ['none', 'None'], ['fade', 'Fade in'], ['rise', 'Rise'], ['drop', 'Drop'], ['slide-left', 'Slide from right'],
    ['slide-right', 'Slide from left'], ['pop', 'Pop'], ['zoom', 'Zoom out'], ['wipe', 'Wipe'], ['bounce', 'Bounce'],
    ['spin', 'Spin in'], ['blur', 'Blur in'], ['typewriter', 'Typewriter (reveal)']
  ];
  const ANIMATIONS_LOOP = [['none', 'None'], ['pulse', 'Pulse'], ['float', 'Float'], ['wiggle', 'Wiggle'], ['rotate', 'Rotate'], ['blink', 'Blink']];
  const TRANSITIONS = [['none', 'Cut (none)'], ['fade', 'Fade'], ['slide-left', 'Slide left'], ['slide-up', 'Slide up'], ['wipe', 'Wipe'], ['zoom', 'Zoom'], ['circle', 'Circle reveal']];

  // ---------------------------------------------------------------- search
  function searchBuiltIn(query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return { graphics: GRAPHICS, icons: Object.keys(root.DS.render.ICONS), shapes: root.DS.render.SHAPES };
    const words = q.split(/\s+/);
    const match = (text) => words.every((w) => text.toLowerCase().includes(w));
    return {
      graphics: GRAPHICS.filter((g) => match(g.name + ' ' + g.keywords)),
      icons: Object.keys(root.DS.render.ICONS).filter((k) => match(k.replace(/([A-Z])/g, ' $1'))),
      shapes: root.DS.render.SHAPES.filter((s) => match(s))
    };
  }

  root.DS = root.DS || {};
  root.DS.assets = { GRAPHICS, STICKERS, FRAMES, LINES, ANIMATIONS_IN, ANIMATIONS_LOOP, TRANSITIONS, searchBuiltIn };
})(self);
