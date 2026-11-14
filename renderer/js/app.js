// App shell: home dashboard, design creation, projects, settings and roadmap pages.
(function (root) {
  'use strict';
  const { formats, doc: D, templates, ui, editor, render } = root.DS;
  const { h, icon } = ui;
  const $ = (id) => document.getElementById(id);

  const NAV = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'templates', label: 'Design Templates', icon: 'templates' },
    { id: 'social', label: 'Social Media', icon: 'social', group: 'social' },
    { id: 'docs', label: 'Presentations & Documents', icon: 'slides', group: 'docs' },
    { id: 'print', label: 'Print & Marketing', icon: 'print', group: 'print' },
    { id: 'merch', label: 'Merchandise', icon: 'shirt', group: 'merch' },
    { id: 'video', label: 'Video Studio', icon: 'video', group: 'video' },
    { sep: true },
    { id: 'ai-image', label: 'AI Image Generator', icon: 'image', soon: 'Phase 2' },
    { id: 'ai-write', label: 'AI Writing Assistant', icon: 'write', soon: 'Phase 2' },
    { id: 'website', label: 'Website Builder', icon: 'web', soon: 'Phase 3' },
    { id: 'brand', label: 'Brand Kit', icon: 'brand', soon: 'Phase 4' },
    { sep: true },
    { id: 'projects', label: 'Projects', icon: 'folder' },
    { id: 'settings', label: 'Settings', icon: 'settings' }
  ];

  const ROADMAP = {
    'ai-image': {
      title: 'AI Image Generator', phase: 'Phase 2',
      text: 'Type a description and get original images to place in your design: text-to-image and image-to-image, several styles, backgrounds and illustrations.',
      needs: 'Needs an image-generation API key. Planned providers: OpenAI (gpt-image), Stability AI and Replicate — you choose one in Settings and paste your own key. The key is stored encrypted with Windows protection.'
    },
    'ai-write': {
      title: 'AI Writing Assistant (Magic Write)', phase: 'Phase 2',
      text: 'Headlines, captions, slogans, presentation content, rewriting in another tone, and grammar correction — directly inside text boxes.',
      needs: 'Uses the Claude API with your own Anthropic API key.'
    },
    website: {
      title: 'Website & Link-in-Bio Builder', phase: 'Phase 3',
      text: 'Drag-and-drop sections, buttons, social links and contact details, with desktop and mobile preview. Export as a website folder you can upload to any host.',
      needs: 'Works offline; publishing uses a hosting service you choose.'
    },
    brand: {
      title: 'Brand Kit', phase: 'Phase 4',
      text: 'Save your logos, brand colours, fonts and text styles once, then apply them to any design with one click.',
      needs: 'Works offline.'
    }
  };

  const QUICK = ['presentation', 'ig-post', 'ig-story', 'yt-thumbnail', 'fb-post', 'poster', 'flyer', 'business-card', 'resume', 'invitation'];

  let currentView = 'home';
  let projectsCache = [];
  let projectFolderFilter = '';

  // ---------------------------------------------------------------- nav
  function renderNav() {
    const list = $('home-nav-list');
    list.innerHTML = '';
    for (const item of NAV) {
      if (item.sep) { list.appendChild(h('div.nav-sep')); continue; }
      list.appendChild(h('button.nav-item' + (currentView === item.id ? '.active' : ''), { on: { click: () => show(item.id) } },
        h('span.ic', { html: icon(item.icon) }), h('span.nav-label', null, item.label), item.soon ? h('span.tag', null, item.soon) : null));
    }
  }

  function show(view) {
    currentView = view;
    renderNav();
    const main = $('home-main');
    main.innerHTML = '';
    main.scrollTop = 0;
    const item = NAV.find((n) => n.id === view) || {};
    if (view === 'home') viewHome(main);
    else if (view === 'templates') viewTemplates(main);
    else if (view === 'projects') viewProjects(main);
    else if (view === 'settings') viewSettings(main);
    else if (item.group) viewGroup(main, item);
    else if (ROADMAP[view]) viewRoadmap(main, ROADMAP[view]);
  }

  // ---------------------------------------------------------------- creating designs
  function createDesign(format, template) {
    const d = D.newDocument(format, template ? template.name : 'Untitled design');
    if (template) {
      const s = formats.canvasSize(format);
      const out = template.build(s.w, s.h);
      d.pages[0].background = out.background;
      d.pages[0].elements = out.elements;
    }
    editor.open(d, null, () => show(currentView === 'home' || currentView === 'projects' ? currentView : 'home'));
  }

  async function openProject(path) {
    try {
      const d = await window.api.loadProject(path);
      editor.open(d, path, () => show(currentView));
    } catch (err) {
      ui.toast('Could not open: ' + err.message, 'error');
    }
  }

  async function openFromDisk() {
    try {
      const res = await window.api.openProjectDialog();
      if (res) {
        if (editor.isOpen()) await editor.exit();
        editor.open(res.doc, res.path, () => show('home'));
      }
    } catch (err) {
      ui.toast('Could not open: ' + err.message, 'error');
    }
  }

  function formatThumb(f) {
    const s = formats.canvasSize(f);
    const max = 64;
    const k = max / Math.max(s.w, s.h);
    return h('div.fmt-shape' + (f.shape === 'circle' ? '.circle' : ''), { style: { width: Math.max(14, s.w * k) + 'px', height: Math.max(14, s.h * k) + 'px' } });
  }

  function formatCard(f) {
    return h('button.fmt-card', { title: `${f.name} (${formats.label(f)})`, on: { click: () => createDesign(f) } },
      h('div.fmt-thumb', null, formatThumb(f)),
      h('div.fmt-name', null, f.name),
      h('div.fmt-size', null, formats.label(f), f.kind === 'video' ? ' · video' : ''));
  }

  async function openFormatPicker() {
    const search = h('input.input', { placeholder: 'Search sizes — e.g. story, A4, thumbnail, card' });
    const list = h('div.picker-list');
    const cw = h('input.input.num', { type: 'number', value: 1080, min: 1 });
    const chh = h('input.input.num', { type: 'number', value: 1080, min: 1 });
    const cu = h('select.input', null, h('option', { value: 'px' }, 'px'), h('option', { value: 'mm' }, 'mm'), h('option', { value: 'in' }, 'in'));
    let close;
    const fill = () => {
      const q = search.value.trim().toLowerCase();
      list.innerHTML = '';
      for (const g of formats.GROUPS) {
        const fs = formats.FORMATS.filter((f) => f.group === g.id && (!q || (f.name + ' ' + formats.label(f) + ' ' + g.name).toLowerCase().includes(q)));
        if (!fs.length) continue;
        list.appendChild(h('div.picker-group', null, g.name));
        for (const f of fs) {
          list.appendChild(h('button.picker-item', { on: { click: () => { close(null); createDesign(f); } } },
            h('span.picker-thumb', null, formatThumb(f)), h('span', null, f.name), h('span.muted', null, formats.label(f))));
        }
      }
      if (!list.children.length) list.appendChild(h('p.muted', null, 'No matching size. Use a custom size below.'));
    };
    search.addEventListener('input', fill);
    fill();
    await ui.modal({
      title: 'Create a design',
      wide: true,
      body: h('div', null, search, list,
        h('div.custom-size', null, h('strong', null, 'Custom size'), cw, h('span', null, '×'), chh, cu,
          h('button.btn.primary', {
            on: {
              click: () => {
                const w = parseFloat(cw.value), hh = parseFloat(chh.value);
                if (!(w > 0 && hh > 0)) { ui.toast('Enter a width and height', 'error'); return; }
                const px = formats.toPx(Math.max(w, hh), cu.value);
                if (px > 20000) { ui.toast('That size is too large. Maximum is about 20,000 px.', 'error'); return; }
                close(null);
                createDesign(formats.custom(w, hh, cu.value));
              }
            }
          }, 'Create'))),
      actions: [],
      onMount: (_box, c) => { close = c; }
    });
  }

  async function pickFormatForTemplate(t) {
    const options = formats.FORMATS.filter((f) => templates.fitScore(t, f) > 0);
    const rest = formats.FORMATS.filter((f) => templates.fitScore(t, f) === 0);
    const sel = h('select.input');
    sel.appendChild(h('optgroup', { label: 'Recommended' }, ...options.map((f) => h('option', { value: f.id }, `${f.name} — ${formats.label(f)}`))));
    sel.appendChild(h('optgroup', { label: 'Other sizes' }, ...rest.map((f) => h('option', { value: f.id }, `${f.name} — ${formats.label(f)}`))));
    const ok = await ui.modal({
      title: `Use “${t.name}”`,
      body: h('label.field', null, h('span', null, 'Choose a size'), sel),
      enterValue: true,
      actions: [{ label: 'Cancel', value: false }, { label: 'Create design', value: true, primary: true }]
    });
    if (ok) createDesign(formats.byId(sel.value), t);
  }

  function templateCard(t, format) {
    const f = format || formats.FORMATS.find((x) => templates.fitScore(t, x) === 2) || formats.byId('ig-post');
    const s = formats.canvasSize(f);
    const out = t.build(s.w, s.h);
    const pg = Object.assign(D.newPage(out.background), { elements: out.elements });
    const tw = 200, th = Math.round(tw * s.h / s.w);
    const svg = render.renderPage(pg, f, { measure: ui.measure, outW: tw, outH: th }).svg;
    return h('button.tpl-card', { title: t.name, on: { click: () => (format ? createDesign(format, t) : pickFormatForTemplate(t)) } },
      h('div.tpl-img', null, h('img', { src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), draggable: false })),
      h('div.tpl-name', null, t.name),
      h('div.fmt-size', null, f.name));
  }

  // ---------------------------------------------------------------- views
  function viewHome(main) {
    const search = h('input.hero-search', { placeholder: 'What will you design today? Try “story”, “A4”, “thumbnail”…' });
    const results = h('div.fmt-grid');
    const quickRow = h('div.fmt-grid');
    QUICK.map(formats.byId).forEach((f) => quickRow.appendChild(formatCard(f)));
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      results.innerHTML = '';
      if (!q) { results.style.display = 'none'; quickRow.style.display = ''; return; }
      const found = formats.FORMATS.filter((f) => (f.name + ' ' + formats.label(f)).toLowerCase().includes(q));
      found.forEach((f) => results.appendChild(formatCard(f)));
      if (!found.length) results.appendChild(h('p.muted', null, 'No matching size — try “Create a design” for a custom size.'));
      results.style.display = ''; quickRow.style.display = 'none';
    });
    results.style.display = 'none';
    main.appendChild(h('div.hero', null,
      h('h1', null, 'What will you design today?'),
      h('p', null, 'Start from a ready-made size or template. Everything is saved automatically on your PC.'),
      search));
    main.appendChild(h('div.section-head', null, h('h2', null, 'Popular sizes'), h('button.link', { on: { click: openFormatPicker } }, 'All sizes & custom size →')));
    main.appendChild(results);
    main.appendChild(quickRow);
    main.appendChild(h('div.section-head', null, h('h2', null, 'Start with a template'), h('button.link', { on: { click: () => show('templates') } }, 'See all →')));
    const tg = h('div.tpl-row');
    templates.TEMPLATES.slice(0, 6).forEach((t) => tg.appendChild(templateCard(t)));
    main.appendChild(tg);
    main.appendChild(h('div.section-head', null, h('h2', null, 'Recent designs'), h('button.link', { on: { click: () => show('projects') } }, 'All projects →')));
    const recent = h('div.proj-grid');
    main.appendChild(recent);
    loadProjects().then((items) => {
      recent.innerHTML = '';
      if (!items.length) { recent.appendChild(h('div.empty', null, 'Your designs will appear here. Create your first one above!')); return; }
      items.slice(0, 8).forEach((p) => recent.appendChild(projectCard(p)));
    });
  }

  function viewTemplates(main) {
    main.appendChild(h('h1.page-h', null, 'Design templates'));
    main.appendChild(h('p.muted', null, 'Every template adapts to the size you pick. Click one, choose a size, then edit anything.'));
    const g = h('div.tpl-row.wrap');
    templates.TEMPLATES.forEach((t) => g.appendChild(templateCard(t)));
    main.appendChild(g);
    main.appendChild(h('p.muted.small', null, 'More templates arrive with the asset library in Phase 4.'));
  }

  function viewGroup(main, item) {
    const g = formats.GROUPS.find((x) => x.id === item.group);
    main.appendChild(h('h1.page-h', null, item.label));
    if (item.group === 'video') {
      main.appendChild(h('div.notice', null, h('strong', null, 'Video Studio — Phase 3. '),
        'You can already design video frames, thumbnails and covers at the correct sizes and export them as images. Timeline editing, music, transitions, captions and MP4 export are being added in Phase 3.'));
    }
    main.appendChild(h('div.section-head', null, h('h2', null, 'Sizes')));
    const grid = h('div.fmt-grid');
    formats.FORMATS.filter((f) => f.group === g.id).forEach((f) => grid.appendChild(formatCard(f)));
    main.appendChild(grid);
    const ts = templates.TEMPLATES.filter((t) => t.fits.includes(g.id) || formats.FORMATS.some((f) => f.group === g.id && t.fits.includes(f.id)));
    if (ts.length) {
      main.appendChild(h('div.section-head', null, h('h2', null, 'Templates')));
      const tg = h('div.tpl-row.wrap');
      ts.forEach((t) => {
        const f = formats.FORMATS.find((x) => x.group === g.id && t.fits.includes(x.id)) || formats.FORMATS.find((x) => x.group === g.id);
        tg.appendChild(templateCard(t, f));
      });
      main.appendChild(tg);
    }
  }

  function viewRoadmap(main, r) {
    main.appendChild(h('h1.page-h', null, r.title, ' ', h('span.tag.big', null, r.phase)));
    main.appendChild(h('div.notice', null, h('strong', null, 'Not available yet. '), 'This module is part of ', r.phase, ' of the build plan. It is shown here so you can see what is coming. The app does not produce fake results.'));
    main.appendChild(h('p', null, r.text));
    main.appendChild(h('p.muted', null, r.needs));
  }

  async function loadProjects() {
    try {
      projectsCache = await window.api.listProjects();
    } catch (err) {
      ui.toast('Could not read projects: ' + err.message, 'error');
      projectsCache = [];
    }
    return projectsCache;
  }

  function projectCard(p) {
    const s = formats.canvasSize(p.format);
    const menuBtn = h('button.icon-btn.card-menu', { title: 'More', html: icon('more') });
    menuBtn.addEventListener('click', (e) => { e.stopPropagation(); projectMenu(p, menuBtn); });
    return h('div.proj-card', { on: { click: () => openProject(p.path), contextmenu: (e) => { e.preventDefault(); projectMenu(p, menuBtn); } } },
      h('div.proj-thumb', null, p.thumbnail ? h('img', { src: p.thumbnail, draggable: false, style: { aspectRatio: `${s.w} / ${s.h}` } }) : h('div.muted', null, 'No preview')),
      h('div.proj-info', null,
        h('div.proj-name', null, p.name),
        h('div.fmt-size', null, `${p.format.name} · ${p.pageCount} page${p.pageCount > 1 ? 's' : ''} · ${ui.timeAgo(p.updatedAt)}`)),
      menuBtn);
  }

  function projectMenu(p, anchor) {
    document.querySelectorAll('.popup-menu').forEach((m) => m.remove());
    const item = (label, fn, danger) => h('button.menu-item' + (danger ? '.danger' : ''), { on: { click: (e) => { e.stopPropagation(); menu.remove(); fn(); } } }, label);
    const menu = h('div.popup-menu', null,
      item('Open', () => openProject(p.path)),
      item('Rename…', async () => {
        const n = await ui.promptDialog('Rename design', 'Name', p.name);
        if (n && n.trim()) { await window.api.renameProject(p.path, n.trim()); show(currentView); }
      }),
      item('Duplicate', async () => { await window.api.duplicateProject(p.path); ui.toast('Design duplicated', 'success'); show(currentView); }),
      item('Move to folder…', async () => {
        const n = await ui.promptDialog('Move to folder', 'Folder name (leave empty for none)', p.folder);
        if (n !== null) { await window.api.setProjectFolder(p.path, n.trim()); show(currentView); }
      }),
      item('Show file in Explorer', () => window.api.showItemInFolder(p.path)),
      item('Delete', async () => {
        if (await ui.confirmDialog('Delete design', `Move “${p.name}” to the Recycle Bin?`, 'Delete', true)) {
          await window.api.deleteProject(p.path);
          ui.toast('Moved to the Recycle Bin');
          show(currentView);
        }
      }, true));
    document.body.appendChild(menu);
    const r = anchor.getBoundingClientRect();
    menu.style.left = Math.min(window.innerWidth - 200, r.left) + 'px';
    menu.style.top = Math.min(window.innerHeight - 260, r.bottom + 4) + 'px';
    setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
  }

  function viewProjects(main) {
    main.appendChild(h('div.section-head', null, h('h1.page-h', null, 'Projects'),
      h('div.btn-row', null,
        h('button.btn', { on: { click: openFromDisk } }, h('span.ic', { html: icon('open') }), ' Open file…'),
        h('button.btn', { on: { click: () => window.api.openProjectsFolder() } }, h('span.ic', { html: icon('folder') }), ' Projects folder'))));
    const search = h('input.input.search', { placeholder: 'Search your designs' });
    const folders = h('div.chips');
    const grid = h('div.proj-grid');
    main.appendChild(h('div.proj-tools', null, search, folders));
    main.appendChild(grid);
    const fill = () => {
      const q = search.value.trim().toLowerCase();
      const all = projectsCache;
      const fset = Array.from(new Set(all.map((p) => p.folder).filter(Boolean))).sort();
      folders.innerHTML = '';
      if (fset.length) {
        folders.appendChild(h('button.chip' + (!projectFolderFilter ? '.on' : ''), { on: { click: () => { projectFolderFilter = ''; fill(); } } }, 'All'));
        fset.forEach((f) => folders.appendChild(h('button.chip' + (projectFolderFilter === f ? '.on' : ''), { on: { click: () => { projectFolderFilter = f; fill(); } } }, h('span.ic', { html: icon('folder') }), f)));
      }
      grid.innerHTML = '';
      const items = all.filter((p) => (!projectFolderFilter || p.folder === projectFolderFilter) && (!q || p.name.toLowerCase().includes(q)));
      if (!items.length) grid.appendChild(h('div.empty', null, all.length ? 'No designs match.' : 'No designs yet. Click “Create a design” to begin.'));
      items.forEach((p) => grid.appendChild(projectCard(p)));
    };
    search.addEventListener('input', fill);
    loadProjects().then(fill);
  }

  async function viewSettings(main) {
    const info = await window.api.appInfo();
    main.appendChild(h('h1.page-h', null, 'Settings'));
    main.appendChild(h('div.card', null,
      h('h3', null, 'Projects'),
      h('p', null, 'Your designs are saved automatically as .dstudio files in:'),
      h('code.path', null, info.projectsDir),
      h('div.btn-row', null, h('button.btn', { on: { click: () => window.api.openProjectsFolder() } }, 'Open folder'))));
    main.appendChild(h('div.card', null,
      h('h3', null, 'AI services'),
      h('p.muted', null, 'API keys for the AI image generator (OpenAI / Stability AI / Replicate) and Magic Write (Claude) will be entered here in Phase 2. Keys will be encrypted with Windows data protection and never written into project files.')));
    const rows = [
      ['Design editor (text, shapes, icons, images, layers, groups, undo/redo, snapping, zoom)', 'Ready'],
      ['42 design sizes with correct dimensions, print bleed and safe area', 'Ready'],
      ['Starter templates (12, adapt to any size)', 'Ready'],
      ['Multi-page designs (presentations, documents)', 'Ready'],
      ['Export PNG / JPEG / SVG / PDF (incl. 300 DPI and bleed)', 'Ready'],
      ['Projects: autosave, folders, rename, duplicate, delete', 'Ready'],
      ['Urdu / right-to-left text', 'Ready'],
      ['AI image generation', 'Phase 2 · needs API key'],
      ['Magic Write, Magic Design, AI assistant', 'Phase 2 · needs API key'],
      ['Background remover (on-device)', 'Phase 2'],
      ['Magic Resize (smart re-layout)', 'Phase 2 · manual resize works now'],
      ['Presentation mode, slide transitions, PPTX export', 'Phase 3'],
      ['Video timeline editor, MP4 export', 'Phase 3'],
      ['Website & Link-in-Bio builder', 'Phase 3'],
      ['Brand Kit, asset library, version history', 'Phase 4']
    ];
    main.appendChild(h('div.card', null, h('h3', null, 'Feature status'),
      h('table.status', null, ...rows.map(([a, b]) => h('tr', null, h('td', null, a), h('td', null, h('span.tag' + (b === 'Ready' ? '.ok' : ''), null, b)))))));
    main.appendChild(h('p.muted.small', null, `Design Studio ${info.version}`));
  }

  // ---------------------------------------------------------------- startup
  async function init() {
    ui.hydrateIcons(document);
    $('btn-create').addEventListener('click', openFormatPicker);
    renderNav();
    show('home');
    try { const info = await window.api.appInfo(); $('app-version').textContent = 'Version ' + info.version; } catch {}

    window.api.onMenu(async (c) => {
      if (document.querySelector('.modal-back')) return;
      if (c === 'home') { if (editor.isOpen()) editor.exit(); }
      if (c === 'open') openFromDisk();
      if (c === 'save' && editor.isOpen()) editor.save();
      if (c === 'saveAs' && editor.isOpen()) editor.saveCopyAs();
      if (c === 'export' && editor.isOpen()) editor.exportDialog();
      if (c === 'pending-open') checkPendingOpen();
    });
    window.api.onBeforeClose(async () => {
      try { if (editor.isOpen()) await editor.exit(); } finally { window.api.confirmClose(); }
    });
    checkPendingOpen();
  }

  async function checkPendingOpen() {
    const res = await window.api.takePendingOpen();
    if (!res) return;
    if (res.error) { ui.toast(res.error, 'error'); return; }
    if (editor.isOpen()) await editor.exit();
    editor.open(res.doc, res.path, () => show('home'));
  }

  root.DS.app = { show, createDesign, openFormatPicker };
  init();
})(self);
