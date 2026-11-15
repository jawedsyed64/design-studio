// Video features: importing clips, the playback compositor, the preview player and MP4 export.
// A design plays as a video: each page is a scene lasting page.duration seconds,
// video elements play inside their frames, and audio tracks play along the timeline.
(function (root) {
  'use strict';
  const { formats, doc: D, render, ui } = root.DS;
  const { h } = ui;

  const FPS = 30;

  function fmtTime(s) {
    s = Math.max(0, s || 0);
    const m = Math.floor(s / 60);
    const sec = s - m * 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec.toFixed(1)}`;
  }

  function mediaUrl(ref) {
    return window.api.mediaUrl(ref);
  }

  function once(el, okEvents, errEvents, ms) {
    return new Promise((resolve, reject) => {
      const clean = () => { okEvents.concat(errEvents).forEach((e) => el.removeEventListener(e, handler)); clearTimeout(timer); };
      const handler = (ev) => { clean(); if (errEvents.includes(ev.type)) reject(new Error('media error')); else resolve(ev); };
      okEvents.concat(errEvents).forEach((e) => el.addEventListener(e, handler));
      const timer = setTimeout(() => { clean(); reject(new Error('timeout')); }, ms || 20000);
    });
  }

  // Reads duration, size and a poster frame of an imported clip.
  async function probe(ref, kind) {
    const el = document.createElement(kind === 'video' ? 'video' : 'audio');
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    el.muted = true;
    el.src = mediaUrl(ref);
    try {
      await once(el, ['loadedmetadata'], ['error']);
      let duration = el.duration;
      if (!Number.isFinite(duration)) {
        // some recordings do not store their length; seeking far ahead reveals it
        el.currentTime = 1e7;
        await once(el, ['durationchange', 'seeked'], ['error'], 8000).catch(() => {});
        duration = Number.isFinite(el.duration) ? el.duration : 0;
        el.currentTime = 0;
      }
      if (kind === 'audio') return { duration };
      const w = el.videoWidth, hh = el.videoHeight;
      if (!w || !hh) throw new Error('no video picture');
      el.currentTime = Math.min(1, duration * 0.25 || 0);
      await once(el, ['seeked'], ['error'], 10000).catch(() => {});
      if (el.readyState < 2) await once(el, ['loadeddata', 'canplay'], ['error'], 8000).catch(() => {});
      const k = Math.min(1, 640 / Math.max(w, hh));
      const c = document.createElement('canvas');
      c.width = Math.round(w * k); c.height = Math.round(hh * k);
      c.getContext('2d').drawImage(el, 0, 0, c.width, c.height);
      return { duration, w, h: hh, poster: c.toDataURL('image/jpeg', 0.82) };
    } finally {
      el.removeAttribute('src');
      el.load();
    }
  }

  // Imports clips (from the file dialog or dropped files) into the design's media list.
  // Unplayable formats are converted to MP4 once with ffmpeg.
  async function importClips(doc, imported) {
    const added = [];
    for (const item of imported) {
      let ref = item.ref;
      let info;
      const busy = root.DS.exporter.showBusy(`Preparing ${item.name}…`);
      try {
        try {
          info = await probe(ref, item.kind);
        } catch {
          busy.update && busy.update(`Converting ${item.name} to a supported format…`);
          ref = (await window.api.convertMedia(ref)).ref;
          info = await probe(ref, item.kind);
        }
        const entry = {
          ref, name: item.name.replace(/\.[^.]+$/, ''), kind: item.kind,
          duration: Math.round((info.duration || 0) * 100) / 100,
          w: info.w || 0, h: info.h || 0,
          poster: info.poster ? D.addAsset(doc, info.poster) : ''
        };
        doc.media.push(entry);
        added.push(entry);
      } catch (err) {
        ui.toast(`Could not use ${item.name}: ${err.message}`, 'error');
      } finally {
        busy();
      }
    }
    return added;
  }

  // ---------------------------------------------------------------- compositor
  class Compositor {
    // opts: scale, output 'speakers' | 'stream', timer 'raf' | 'interval'
    constructor(doc, canvas, opts) {
      this.doc = doc;
      this.canvas = canvas;
      this.o = Object.assign({ scale: 1, output: 'speakers', timer: 'raf' }, opts || {});
      this.size = formats.canvasSize(doc.format);
      this.tl = D.timeline(doc);
      this.videos = new Map(); // element id -> { el, video, gain }
      this.audios = new Map(); // track id -> { track, audio, gain }
      this.playing = false;
      this.curScene = -1;
      this.onTime = null;
      this.onEnd = null;
    }

    async prepare() {
      const s = this.size, k = this.o.scale;
      this.canvas.width = Math.max(2, Math.round(s.w * k / 2) * 2);
      this.canvas.height = Math.max(2, Math.round(s.h * k / 2) * 2);
      this.ctx = this.canvas.getContext('2d');
      this.ac = new AudioContext();
      this.dest = this.o.output === 'stream' ? this.ac.createMediaStreamDestination() : this.ac.destination;

      this.sceneLayers = [];
      for (const page of this.doc.pages) this.sceneLayers.push(await this.buildLayers(page));

      const waits = [];
      const connect = (mediaEl) => {
        const src = this.ac.createMediaElementSource(mediaEl);
        const gain = this.ac.createGain();
        src.connect(gain).connect(this.dest);
        return gain;
      };
      for (const page of this.doc.pages) {
        for (const el of page.elements) {
          if (el.type !== 'video' || el.hidden || !el.src) continue;
          const v = document.createElement('video');
          v.crossOrigin = 'anonymous';
          v.preload = 'auto';
          v.playsInline = true;
          v.src = mediaUrl(el.src);
          v.currentTime = el.trimStart || 0;
          waits.push(once(v, ['canplay'], ['error'], 30000).catch(() => {}));
          this.videos.set(el.id, { el, video: v, gain: connect(v) });
        }
      }
      for (const t of this.doc.audio || []) {
        if (!t.src) continue;
        const a = document.createElement('audio');
        a.crossOrigin = 'anonymous';
        a.preload = 'auto';
        a.src = mediaUrl(t.src);
        waits.push(once(a, ['canplay'], ['error'], 30000).catch(() => {}));
        this.audios.set(t.id, { track: t, audio: a, gain: connect(a) });
      }
      await Promise.all(waits);
    }

    // A page becomes alternating layers: still images (everything that is not video) and live videos.
    async buildLayers(page) {
      const s = this.size;
      const layers = [];
      let statics = [];
      let first = true;
      const flush = async () => {
        if (!statics.length && !first) return;
        const pg = { background: page.background, elements: statics };
        const svg = render.renderPage(pg, this.doc.format, {
          measure: ui.measure, transparent: !first,
          resolveSrc: (src) => D.resolveAsset(this.doc, src),
          outW: this.canvas.width, outH: this.canvas.height
        }).svg;
        const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
        const img = new Image();
        img.src = url;
        await img.decode().catch(() => {});
        URL.revokeObjectURL(url);
        layers.push({ kind: 'still', img });
        statics = [];
        first = false;
      };
      for (const el of page.elements) {
        if (el.hidden) continue;
        if (el.type === 'video' && el.src) {
          await flush();
          layers.push({ kind: 'video', id: el.id });
        } else statics.push(el);
      }
      await flush();
      return layers;
    }

    sceneAt(t) {
      const sc = this.tl.scenes;
      for (let i = sc.length - 1; i >= 0; i--) if (t >= sc[i].start) return sc[i];
      return sc[0];
    }

    static targetTime(item, local) {
      const len = D.clipLength(item);
      const ts = item.trimStart || 0;
      if (len <= 0) return ts;
      if (item.loop) return ts + (local % len);
      return ts + Math.min(local, Math.max(0, len - 0.05));
    }

    draw(sceneIndex) {
      const ctx = this.ctx, s = this.size;
      const kx = this.canvas.width / s.w, ky = this.canvas.height / s.h;
      ctx.setTransform(kx, 0, 0, ky, 0, 0);
      ctx.clearRect(0, 0, s.w, s.h);
      for (const layer of this.sceneLayers[sceneIndex] || []) {
        if (layer.kind === 'still') ctx.drawImage(layer.img, 0, 0, s.w, s.h);
        else {
          const v = this.videos.get(layer.id);
          if (v) drawVideo(ctx, v.el, v.video);
        }
      }
    }

    // Keeps every clip at the right position for time t.
    sync(t, playing) {
      const scene = this.sceneAt(t);
      const local = t - scene.start;
      if (scene.index !== this.curScene) {
        for (const v of this.videos.values()) v.video.pause();
        this.curScene = scene.index;
      }
      const pageEls = new Set(this.doc.pages[scene.index].elements.map((e) => e.id));
      for (const [id, v] of this.videos) {
        if (!pageEls.has(id)) continue;
        const el = v.el;
        v.gain.gain.value = el.muted ? 0 : el.volume;
        const len = D.clipLength(el);
        const finished = !el.loop && len > 0 && local >= len;
        const target = Compositor.targetTime(el, local);
        if (!playing || finished) {
          if (!v.video.paused) v.video.pause();
          if (!playing && Math.abs(v.video.currentTime - target) > 0.04) v.video.currentTime = target;
          continue;
        }
        if (Math.abs(v.video.currentTime - target) > 0.3) v.video.currentTime = target;
        if (v.video.paused) v.video.play().catch(() => {});
      }
      for (const a of this.audios.values()) {
        const tr = a.track;
        const len = D.clipLength(tr);
        const span = tr.loop ? this.tl.total - tr.start : len;
        const tl = t - tr.start;
        const active = playing && len > 0 && tl >= 0 && tl < span;
        if (!active) { if (!a.audio.paused) a.audio.pause(); continue; }
        let g = tr.volume;
        if (tr.fadeIn > 0) g *= Math.min(1, tl / tr.fadeIn);
        if (tr.fadeOut > 0) g *= Math.max(0, Math.min(1, (span - tl) / tr.fadeOut));
        a.gain.gain.value = g;
        const target = Compositor.targetTime(tr, tl);
        if (Math.abs(a.audio.currentTime - target) > 0.3) a.audio.currentTime = target;
        if (a.audio.paused) a.audio.play().catch(() => {});
      }
      return scene;
    }

    play(from) {
      if (this.playing) return;
      this.ac.resume();
      const start = Math.max(0, Math.min(from || 0, this.tl.total - 0.01));
      this.t0 = performance.now() - start * 1000;
      this.playing = true;
      const tick = () => {
        if (!this.playing) return;
        const t = (performance.now() - this.t0) / 1000;
        if (t >= this.tl.total) {
          this.time = this.tl.total;
          this.draw(this.tl.scenes.length - 1);
          this.stop();
          if (this.onTime) this.onTime(this.tl.total);
          if (this.onEnd) this.onEnd();
          return;
        }
        this.time = t;
        const scene = this.sync(t, true);
        this.draw(scene.index);
        if (this.onTime) this.onTime(t);
        if (this.o.timer === 'raf') this.raf = requestAnimationFrame(tick);
      };
      if (this.o.timer === 'interval') this.iv = setInterval(tick, 1000 / FPS);
      tick();
    }

    stop() {
      this.playing = false;
      cancelAnimationFrame(this.raf);
      clearInterval(this.iv);
      for (const v of this.videos.values()) v.video.pause();
      for (const a of this.audios.values()) a.audio.pause();
    }

    // Shows the frame at time t (paused).
    async seek(t) {
      this.stop();
      this.time = t;
      const scene = this.sync(t, false);
      const pageEls = new Set(this.doc.pages[scene.index].elements.map((e) => e.id));
      const waits = [];
      for (const [id, v] of this.videos) if (pageEls.has(id) && v.video.seeking) waits.push(once(v.video, ['seeked'], ['error'], 3000).catch(() => {}));
      await Promise.all(waits);
      this.draw(scene.index);
    }

    destroy() {
      this.stop();
      for (const v of this.videos.values()) { v.video.removeAttribute('src'); v.video.load(); }
      for (const a of this.audios.values()) { a.audio.removeAttribute('src'); a.audio.load(); }
      if (this.ac) this.ac.close().catch(() => {});
    }
  }

  function roundRectPath(ctx, w, hh, r) {
    ctx.beginPath();
    if (r > 0 && ctx.roundRect) ctx.roundRect(0, 0, w, hh, Math.min(r, w / 2, hh / 2));
    else ctx.rect(0, 0, w, hh);
  }

  function drawVideo(ctx, el, v) {
    ctx.save();
    ctx.translate(el.x + el.w / 2, el.y + el.h / 2);
    if (el.rotation) ctx.rotate(el.rotation * Math.PI / 180);
    ctx.scale(el.flipX ? -1 : 1, el.flipY ? -1 : 1);
    ctx.translate(-el.w / 2, -el.h / 2);
    ctx.globalAlpha = el.opacity == null ? 1 : el.opacity;
    roundRectPath(ctx, el.w, el.h, +el.radius || 0);
    ctx.save();
    ctx.clip();
    const vw = v.videoWidth, vh = v.videoHeight;
    if (vw && vh && v.readyState >= 2) {
      const f = el.filters || {};
      const parts = [];
      if (f.brightness != null && f.brightness !== 100) parts.push(`brightness(${f.brightness}%)`);
      if (f.contrast != null && f.contrast !== 100) parts.push(`contrast(${f.contrast}%)`);
      if (f.grayscale) parts.push('grayscale(1)');
      else if (f.saturation != null && f.saturation !== 100) parts.push(`saturate(${f.saturation}%)`);
      if (f.sepia) parts.push('sepia(1)');
      if (f.blur > 0) parts.push(`blur(${f.blur}px)`);
      ctx.filter = parts.length ? parts.join(' ') : 'none';
      let dw = el.w, dh = el.h, dx = 0, dy = 0;
      if (el.fit !== 'stretch') {
        const k = el.fit === 'contain' ? Math.min(el.w / vw, el.h / vh) : Math.max(el.w / vw, el.h / vh);
        dw = vw * k; dh = vh * k; dx = (el.w - dw) / 2; dy = (el.h - dh) / 2;
      }
      ctx.drawImage(v, dx, dy, dw, dh);
      ctx.filter = 'none';
    } else {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, el.w, el.h);
    }
    ctx.restore();
    if (el.strokeWidth > 0) {
      const c = render.parseColor(el.stroke);
      ctx.globalAlpha *= c.alpha;
      ctx.strokeStyle = c.hex;
      ctx.lineWidth = el.strokeWidth;
      roundRectPath(ctx, el.w, el.h, +el.radius || 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- preview player
  async function preview(doc, fromTime) {
    const canvas = h('canvas.player-canvas');
    const playBtn = h('button.player-btn', { title: 'Play / pause (Space)' }, '▶');
    const timeLbl = h('span.player-time', null, '0:00.0');
    const scrub = h('input.player-scrub', { type: 'range', min: 0, max: 1000, value: 0 });
    const closeBtn = h('button.player-btn.close', { title: 'Close (Esc)', html: ui.icon('close') });
    const stage = h('div.player-stage', null, canvas);
    const wrap = h('div.player', null,
      h('div.player-top', null, h('strong', null, 'Preview'), h('span.muted', null, doc.name), closeBtn),
      stage,
      h('div.player-controls', null, playBtn, scrub, timeLbl));
    document.body.appendChild(wrap);
    const busy = root.DS.exporter.showBusy('Loading preview…');
    const k = Math.min(1, 1280 / Math.max(formats.canvasSize(doc.format).w, formats.canvasSize(doc.format).h));
    const comp = new Compositor(doc, canvas, { scale: k });
    try {
      await comp.prepare();
    } finally {
      busy();
    }
    const total = comp.tl.total;
    const show = (t) => {
      timeLbl.textContent = `${fmtTime(t)} / ${fmtTime(total)}`;
      if (document.activeElement !== scrub) scrub.value = Math.round((t / total) * 1000);
    };
    comp.onTime = show;
    comp.onEnd = () => { playBtn.textContent = '▶'; };
    const fit = () => {
      const r = stage.getBoundingClientRect();
      const s = Math.min((r.width - 20) / canvas.width, (r.height - 20) / canvas.height);
      canvas.style.width = canvas.width * s + 'px';
      canvas.style.height = canvas.height * s + 'px';
    };
    fit();
    const toggle = () => {
      if (comp.playing) { comp.stop(); playBtn.textContent = '▶'; }
      else { comp.play((comp.time || 0) >= total - 0.05 ? 0 : comp.time || 0); playBtn.textContent = '❚❚'; }
    };
    playBtn.addEventListener('click', toggle);
    scrub.addEventListener('input', () => { playBtn.textContent = '▶'; const t = (scrub.value / 1000) * total; show(t); comp.seek(t); });
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      if (e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggle(); }
    };
    const close = () => {
      comp.destroy();
      wrap.remove();
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', fit);
    };
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', fit);
    await comp.seek(fromTime || 0);
    show(fromTime || 0);
    comp.play(fromTime || 0);
    playBtn.textContent = '❚❚';
    return { close, comp };
  }

  // ---------------------------------------------------------------- MP4 export
  async function exportMp4(doc, settings) {
    const total = D.timeline(doc).total;
    const begin = await window.api.exportStreamBegin({ defaultName: doc.name || 'video', ext: 'mp4' });
    if (!begin) return null;
    const token = begin.token;

    let cancelled = false;
    const label = h('div', null, 'Preparing…');
    const bar = h('div.progress-bar', null, h('div.progress-fill'));
    const cancelBtn = h('button.btn', null, 'Cancel');
    const overlay = h('div.busy', null, h('div.spinner'), label, bar,
      h('div.muted.small', null, 'The video is recorded in real time — please keep this window open.'), cancelBtn);
    document.body.appendChild(overlay);
    const setProgress = (text, p) => { label.textContent = text; bar.firstChild.style.width = Math.round(Math.max(0, Math.min(1, p)) * 100) + '%'; };

    const canvas = document.createElement('canvas');
    const comp = new Compositor(doc, canvas, { scale: settings.scale || 1, output: 'stream', timer: 'interval' });
    let offProgress = null;
    try {
      await comp.prepare();
      const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
      const vstream = canvas.captureStream(FPS);
      const stream = new MediaStream([...vstream.getVideoTracks(), ...comp.dest.stream.getAudioTracks()]);
      const bps = Math.max(4e6, Math.min(25e6, canvas.width * canvas.height * FPS * 0.15));
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bps, audioBitsPerSecond: 192000 });
      let chain = Promise.resolve();
      let writeError = null;
      rec.ondataavailable = (e) => {
        if (!e.data || !e.data.size) return;
        chain = chain.then(async () => {
          if (cancelled || writeError) return;
          await window.api.exportStreamWrite(token, new Uint8Array(await e.data.arrayBuffer()));
        }).catch((err) => { writeError = err; });
      };
      const stopped = new Promise((r) => { rec.onstop = r; });
      const ended = new Promise((r) => { comp.onEnd = r; cancelBtn.onclick = () => { cancelled = true; comp.stop(); r(); }; });
      comp.onTime = (t) => setProgress(`Recording video… ${fmtTime(t)} / ${fmtTime(total)}`, t / total * 0.8);
      await comp.seek(0);
      rec.start(1000);
      comp.play(0);
      await ended;
      // let the last frame reach the recorder
      await new Promise((r) => setTimeout(r, 300));
      rec.stop();
      await stopped;
      await chain;
      if (cancelled) { await window.api.exportStreamAbort(token); ui.toast('Video export cancelled'); return null; }
      if (writeError) throw writeError;
      cancelBtn.disabled = true;
      setProgress('Converting to MP4…', 0.8);
      offProgress = window.api.onExportProgress((p) => setProgress(`Converting to MP4… ${Math.round(p * 100)}%`, 0.8 + p * 0.2));
      const res = await window.api.exportStreamEnd(token, { duration: total });
      return res;
    } catch (err) {
      window.api.exportStreamAbort(token).catch(() => {});
      throw err;
    } finally {
      if (offProgress) offProgress();
      comp.destroy();
      overlay.remove();
    }
  }

  root.DS.video = { fmtTime, probe, importClips, Compositor, preview, exportMp4, drawVideo };
})(self);
