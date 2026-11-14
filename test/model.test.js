const test = require('node:test');
const assert = require('node:assert');
const formats = require('../renderer/js/formats.js');
const D = require('../renderer/js/document.js');
const R = require('../renderer/js/render.js');
const T = require('../renderer/js/templates.js');

// crude but deterministic: every character is 0.55em wide
const measure = (text, font) => {
  const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)[1]);
  return [...text].length * size * 0.55;
};

test('formats: print sizes convert mm/in to 96-dpi pixels', () => {
  const a4 = formats.canvasSize(formats.byId('flyer'));
  assert.ok(Math.abs(a4.w - 793.7) < 0.1 && Math.abs(a4.h - 1122.52) < 0.1);
  const card = formats.canvasSize(formats.byId('business-card'));
  assert.deepStrictEqual(card, { w: 336, h: 192 });
  assert.deepStrictEqual(formats.canvasSize(formats.byId('ig-story')), { w: 1080, h: 1920 });
  const banner = formats.sizeInInches(formats.byId('banner'));
  assert.ok(Math.abs(banner.w - 1000 / 25.4) < 0.01);
});

test('formats: every format in the spec exists with a valid group and size', () => {
  const groups = new Set(formats.GROUPS.map((g) => g.id));
  for (const f of formats.FORMATS) {
    assert.ok(groups.has(f.group), f.id);
    assert.ok(f.width > 0 && f.height > 0, f.id);
  }
  const ids = formats.FORMATS.map((f) => f.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'format ids are unique');
  for (const id of ['presentation', 'ig-post', 'ig-story', 'fb-cover', 'yt-thumbnail', 'yt-shorts', 'poster', 'business-card', 'brochure', 'sticker-circle', 'postcard', 'banner', 'tshirt', 'mug']) {
    assert.ok(formats.byId(id), id);
  }
});

test('document: create, group, duplicate keeps groups separate, reorder', () => {
  const doc = D.newDocument(formats.byId('ig-post'));
  const p = doc.pages[0];
  const a = D.createElement('shape', { x: 0, y: 0 });
  const b = D.createElement('text', { x: 10, y: 10 });
  const c = D.createElement('line', { x: 20, y: 20 });
  p.elements.push(a, b, c);
  const gid = D.group(p, [a.id, b.id]);
  assert.ok(gid);
  assert.deepStrictEqual(D.expandGroups(p, [a.id]).sort(), [a.id, b.id].sort());
  const copies = D.duplicate(p, [a.id, b.id]);
  assert.strictEqual(p.elements.length, 5);
  const cg = p.elements.find((e) => e.id === copies[0]).groupId;
  assert.ok(cg && cg !== gid, 'copy gets a new group id');
  D.reorder(p, [c.id], 'front');
  assert.strictEqual(p.elements[p.elements.length - 1].id, c.id);
  D.reorder(p, [c.id], 'back');
  assert.strictEqual(p.elements[0].id, c.id);
  D.remove(p, [c.id]);
  assert.strictEqual(p.elements.length, 4);
});

test('document: align and distribute', () => {
  const p = D.newPage();
  const els = [0, 1, 2].map((i) => D.createElement('shape', { x: i * 100 + (i === 1 ? 37 : 0), y: i * 10, w: 50, h: 50 }));
  p.elements.push(...els);
  D.distribute(p, els.map((e) => e.id), 'h');
  assert.strictEqual(els[1].x, 100);
  D.align(p, els.map((e) => e.id), 'top', 1000, 1000);
  assert.ok(els.every((e) => e.y === 0));
  D.align(p, [els[0].id], 'center', 1000, 1000);
  assert.strictEqual(els[0].x, 475);
});

test('document: history undo/redo', () => {
  const h = new D.History(10);
  h.reset({ v: 1 });
  h.push({ v: 2 });
  h.push({ v: 3 });
  assert.deepStrictEqual(h.undo(), { v: 2 });
  assert.deepStrictEqual(h.undo(), { v: 1 });
  assert.strictEqual(h.undo(), null);
  assert.deepStrictEqual(h.redo(), { v: 2 });
  h.push({ v: 9 });
  assert.strictEqual(h.canRedo(), false);
});

test('document: resize scales content into the new format', () => {
  const doc = D.newDocument(formats.byId('ig-post'));
  const t = D.createElement('text', { x: 0, y: 0, w: 1080, fontSize: 100 });
  doc.pages[0].elements.push(t);
  D.resizeDocument(doc, formats.byId('ig-story'), true);
  assert.strictEqual(doc.format.id, 'ig-story');
  assert.strictEqual(t.fontSize, 100);
  assert.strictEqual(t.y, 420); // centred vertically
  D.resizeDocument(doc, formats.byId('ig-post-portrait'), true);
  assert.ok(t.fontSize < 100);
});

test('render: text wraps and reports height', () => {
  const el = D.createElement('text', { text: 'one two three four five six', w: 200, fontSize: 20, lineHeight: 1.5 });
  const lay = R.layoutText(el, measure);
  assert.ok(lay.lines.length > 1);
  for (const l of lay.lines) assert.ok(measure(l, '20px x') <= 200 || !l.includes(' '));
  assert.strictEqual(lay.height, lay.lines.length * 30);
  const long = D.createElement('text', { text: 'supercalifragilisticexpialidocious', w: 100, fontSize: 20 });
  assert.ok(R.layoutText(long, measure).lines.length > 1, 'long words are broken');
  const nl = D.createElement('text', { text: 'a\n\nb', w: 500, fontSize: 20 });
  assert.strictEqual(R.layoutText(nl, measure).lines.length, 3);
});

test('render: RTL detection for Urdu', () => {
  assert.strictEqual(R.isRtl({ text: 'عید مبارک', rtl: 'auto' }), true);
  assert.strictEqual(R.isRtl({ text: 'Hello', rtl: 'auto' }), false);
});

test('render: colors with alpha become separate opacity attributes', () => {
  assert.deepStrictEqual(R.parseColor('#ff000080'), { hex: '#ff0000', alpha: 0.502 });
  assert.deepStrictEqual(R.parseColor('#abc'), { hex: '#aabbcc', alpha: 1 });
});

test('render: escapes user text so SVG stays valid', () => {
  const p = D.newPage();
  p.elements.push(D.createElement('text', { text: '<script>&"\'' }));
  const { svg } = R.renderPage(p, formats.byId('ig-post'), { measure });
  assert.ok(!svg.includes('<script>'));
  assert.ok(svg.includes('&lt;script&gt;&amp;&quot;&#39;'));
});

test('templates: every template builds valid elements for every format', () => {
  for (const f of formats.FORMATS) {
    const size = formats.canvasSize(f);
    for (const t of T.TEMPLATES) {
      const out = t.build(size.w, size.h);
      assert.ok(out.background && Array.isArray(out.elements) && out.elements.length, `${t.id}/${f.id}`);
      for (const e of out.elements) {
        for (const k of ['x', 'y', 'w', 'h']) assert.ok(Number.isFinite(e[k]), `${t.id}/${f.id} ${e.type}.${k}`);
      }
      const page = Object.assign(D.newPage(out.background), { elements: out.elements });
      const { svg } = R.renderPage(page, f, { measure });
      assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
    }
  }
});

test('templates: best matches come first', () => {
  assert.strictEqual(T.forFormat(formats.byId('resume'))[0].id, 'modern-resume');
  assert.strictEqual(T.forFormat(formats.byId('yt-thumbnail'))[0].id, 'yt-pop');
});
