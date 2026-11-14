// Starter templates. Each template is a small layout function that adapts to the
// canvas size (positions as fractions of width/height, sizes relative to the short side),
// so one template works across many formats. `fits` lists format groups/ids it suits best.
(function (root) {
  'use strict';

  const D = (typeof module !== 'undefined' && module.exports) ? require('./document.js') : root.DS.doc;

  function kit(w, h) {
    const s = Math.min(w, h);
    const landscape = w / h > 1.25;
    const X = (f) => f * w, Y = (f) => f * h, S = (f) => f * s;
    const text = (p) => D.createElement('text', p);
    const shape = (p) => D.createElement('shape', p);
    const line = (p) => D.createElement('line', p);
    return { w, h, s, landscape, X, Y, S, text, shape, line };
  }

  const TEMPLATES = [
    {
      id: 'bold-sale', name: 'Bold Sale', fits: ['social', 'ig-post', 'social-ad', 'ig-story', 'fb-post'],
      build(w, h) {
        const k = kit(w, h);
        const tw = k.landscape ? 0.55 : 0.84;
        return {
          background: { type: 'gradient', color: '#ff4d6d', color2: '#ff9e40', angle: 135 },
          elements: [
            k.shape({ shape: 'ellipse', x: k.X(0.62), y: -k.S(0.18), w: k.S(0.7), h: k.S(0.7), fill: '#ffffff22', name: 'Circle' }),
            k.shape({ shape: 'ellipse', x: -k.S(0.2), y: k.Y(1) - k.S(0.45), w: k.S(0.6), h: k.S(0.6), fill: '#ffffff1a', name: 'Circle' }),
            k.text({ text: 'LIMITED TIME', x: k.X(0.08), y: k.Y(0.14), w: k.X(tw), fontSize: k.S(0.045), fontWeight: 700, letterSpacing: k.S(0.008), color: '#fff3e0' }),
            k.text({ text: 'SUMMER SALE', x: k.X(0.08), y: k.Y(0.22), w: k.X(tw), fontSize: k.S(0.15), fontWeight: 900, fontFamily: 'Arial Black', lineHeight: 1.0, color: '#ffffff', shadow: { on: true, x: 0, y: k.S(0.008), blur: k.S(0.02), color: '#00000040' } }),
            k.text({ text: 'Up to 50% off on all items. This weekend only.', x: k.X(0.08), y: k.Y(0.62), w: k.X(tw * 0.85), fontSize: k.S(0.045), color: '#ffffff' }),
            k.shape({ shape: 'rect', x: k.X(0.08), y: k.Y(0.8), w: k.S(0.34), h: k.S(0.09), radius: k.S(0.045), fill: '#1f2333', name: 'Button' }),
            k.text({ text: 'Shop now', x: k.X(0.08), y: k.Y(0.8) + k.S(0.045) - k.S(0.032), w: k.S(0.34), fontSize: k.S(0.04), fontWeight: 700, align: 'center', color: '#ffffff' })
          ]
        };
      }
    },
    {
      id: 'minimal-quote', name: 'Minimal Quote', fits: ['social', 'ig-post', 'linkedin-post', 'ig-story'],
      build(w, h) {
        const k = kit(w, h);
        return {
          background: { type: 'solid', color: '#f6f1e9' },
          elements: [
            k.text({ text: '“', x: k.X(0.1), y: k.Y(0.12), w: k.S(0.3), fontSize: k.S(0.3), fontFamily: 'Georgia', color: '#c2410c', lineHeight: 1 }),
            k.text({ text: 'Design is not just what it looks like and feels like. Design is how it works.', x: k.X(0.1), y: k.Y(0.36), w: k.X(0.8), fontSize: k.S(0.065), fontFamily: 'Georgia', italic: true, color: '#2b2118', lineHeight: 1.3 }),
            k.line({ x: k.X(0.1), y: k.Y(0.8), w: k.S(0.12), stroke: '#c2410c', strokeWidth: k.S(0.006) }),
            k.text({ text: 'YOUR NAME', x: k.X(0.1), y: k.Y(0.83), w: k.X(0.6), fontSize: k.S(0.032), fontWeight: 700, letterSpacing: k.S(0.006), color: '#2b2118' })
          ]
        };
      }
    },
    {
      id: 'event-dark', name: 'Event Announcement', fits: ['social', 'print', 'poster', 'flyer', 'ig-story'],
      build(w, h) {
        const k = kit(w, h);
        return {
          background: { type: 'gradient', color: '#0f172a', color2: '#312e81', angle: 160 },
          elements: [
            k.shape({ shape: 'ellipse', x: k.X(0.55), y: k.Y(0.05), w: k.S(0.55), h: k.S(0.55), fillType: 'gradient', fill: '#f472b6', fill2: '#8b5cf6', gradientAngle: 45, opacity: 0.85, name: 'Orb' }),
            k.shape({ shape: 'ellipse', x: k.X(0.05), y: k.Y(0.5), w: k.S(0.2), h: k.S(0.2), fill: '#22d3ee', opacity: 0.6, name: 'Orb' }),
            k.text({ text: 'YOU ARE INVITED', x: k.X(0.08), y: k.Y(0.1), w: k.X(0.8), fontSize: k.S(0.035), fontWeight: 600, letterSpacing: k.S(0.01), color: '#a5b4fc' }),
            k.text({ text: 'Grand Opening Night', x: k.X(0.08), y: k.Y(0.36), w: k.X(0.84), fontSize: k.S(0.12), fontWeight: 800, color: '#ffffff', lineHeight: 1.05 }),
            k.shape({ shape: 'icon:calendar', x: k.X(0.08), y: k.Y(0.72), w: k.S(0.05), h: k.S(0.05), fill: '#f9a8d4', strokeWidth: 2 }),
            k.text({ text: 'Saturday, 12 December · 7:00 PM', x: k.X(0.08) + k.S(0.07), y: k.Y(0.72) + k.S(0.003), w: k.X(0.75), fontSize: k.S(0.036), color: '#e2e8f0' }),
            k.shape({ shape: 'icon:pin', x: k.X(0.08), y: k.Y(0.8), w: k.S(0.05), h: k.S(0.05), fill: '#f9a8d4', strokeWidth: 2 }),
            k.text({ text: '123 Main Boulevard, Your City', x: k.X(0.08) + k.S(0.07), y: k.Y(0.8) + k.S(0.003), w: k.X(0.75), fontSize: k.S(0.036), color: '#e2e8f0' })
          ]
        };
      }
    },
    {
      id: 'yt-pop', name: 'Thumbnail Pop', fits: ['yt-thumbnail', 'video', 'fb-post'],
      build(w, h) {
        const k = kit(w, h);
        return {
          background: { type: 'solid', color: '#ffd400' },
          elements: [
            k.shape({ shape: 'ellipse', x: k.X(0.6), y: k.Y(0.08), w: k.S(0.85), h: k.S(0.85), fill: '#111111', name: 'Photo spot' }),
            k.text({ text: 'Put your photo here', x: k.X(0.6), y: k.Y(0.08) + k.S(0.4), w: k.S(0.85), fontSize: k.S(0.045), align: 'center', color: '#ffd400' }),
            k.text({ text: 'HOW I DID IT', x: k.X(0.05), y: k.Y(0.14), w: k.X(0.58), fontSize: k.S(0.2), fontWeight: 900, fontFamily: 'Impact', lineHeight: 0.95, color: '#111111', outline: { on: true, width: k.S(0.008), color: '#ffffff' } }),
            k.shape({ shape: 'rect', x: k.X(0.05), y: k.Y(0.74), w: k.X(0.32), h: k.S(0.13), fill: '#e11d48', radius: k.S(0.02), rotation: -3, name: 'Badge' }),
            k.text({ text: 'IN 30 DAYS', x: k.X(0.05), y: k.Y(0.74) + k.S(0.065) - k.S(0.045), w: k.X(0.32), fontSize: k.S(0.07), fontWeight: 800, align: 'center', rotation: -3, color: '#ffffff' }),
            k.shape({ shape: 'arrow', x: k.X(0.42), y: k.Y(0.7), w: k.S(0.22), h: k.S(0.13), fill: '#e11d48', rotation: -20, name: 'Arrow' })
          ]
        };
      }
    },
    {
      id: 'title-slide', name: 'Title Slide', fits: ['docs', 'presentation', 'pitch-deck', 'school-slides', 'yt-video'],
      build(w, h) {
        const k = kit(w, h);
        return {
          background: { type: 'solid', color: '#ffffff' },
          elements: [
            k.shape({ shape: 'rect', x: 0, y: 0, w: k.X(0.38), h: k.Y(1), fill: '#1e3a8a', name: 'Side panel' }),
            k.shape({ shape: 'ellipse', x: k.X(0.25), y: k.Y(0.6), w: k.S(0.32), h: k.S(0.32), fill: '#3b82f6', opacity: 0.7, name: 'Accent' }),
            k.text({ text: 'COMPANY NAME', x: k.X(0.45), y: k.Y(0.2), w: k.X(0.5), fontSize: k.S(0.03), fontWeight: 700, letterSpacing: k.S(0.008), color: '#3b82f6' }),
            k.text({ text: 'Presentation Title Goes Here', x: k.X(0.45), y: k.Y(0.3), w: k.X(0.5), fontSize: k.S(0.085), fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }),
            k.line({ x: k.X(0.45), y: k.Y(0.66), w: k.S(0.12), stroke: '#3b82f6', strokeWidth: k.S(0.008) }),
            k.text({ text: 'A short subtitle that explains the topic', x: k.X(0.45), y: k.Y(0.7), w: k.X(0.5), fontSize: k.S(0.035), color: '#475569' })
          ]
        };
      }
    },
    {
      id: 'three-points', name: 'Three Key Points', fits: ['docs', 'presentation', 'pitch-deck', 'school-slides'],
      build(w, h) {
        const k = kit(w, h);
        const els = [
          k.text({ text: 'Our Approach', x: k.X(0.07), y: k.Y(0.1), w: k.X(0.86), fontSize: k.S(0.07), fontWeight: 800, color: '#0f172a' }),
          k.line({ x: k.X(0.07), y: k.Y(0.24), w: k.S(0.1), stroke: '#10b981', strokeWidth: k.S(0.007) })
        ];
        const icons = ['icon:search', 'icon:star', 'icon:check'];
        const titles = ['Research', 'Design', 'Deliver'];
        for (let i = 0; i < 3; i++) {
          const cx = k.X(0.07 + i * 0.3);
          els.push(k.shape({ shape: 'ellipse', x: cx, y: k.Y(0.36), w: k.S(0.12), h: k.S(0.12), fill: '#d1fae5', name: 'Icon circle' }));
          els.push(k.shape({ shape: icons[i], x: cx + k.S(0.03), y: k.Y(0.36) + k.S(0.03), w: k.S(0.06), h: k.S(0.06), fill: '#047857', strokeWidth: 2.2 }));
          els.push(k.text({ text: titles[i], x: cx, y: k.Y(0.36) + k.S(0.16), w: k.X(0.26), fontSize: k.S(0.042), fontWeight: 700, color: '#0f172a' }));
          els.push(k.text({ text: 'Describe this point in one or two short sentences.', x: cx, y: k.Y(0.36) + k.S(0.23), w: k.X(0.25), fontSize: k.S(0.028), color: '#475569', lineHeight: 1.4 }));
        }
        return { background: { type: 'solid', color: '#ffffff' }, elements: els };
      }
    },
    {
      id: 'modern-resume', name: 'Modern Resume', fits: ['resume', 'docs'],
      build(w, h) {
        const k = kit(w, h);
        const side = k.X(0.33);
        const els = [
          k.shape({ shape: 'rect', x: 0, y: 0, w: side, h: k.Y(1), fill: '#1f2937', name: 'Sidebar' }),
          k.shape({ shape: 'ellipse', x: side / 2 - k.X(0.1), y: k.Y(0.05), w: k.X(0.2), h: k.X(0.2), fill: '#4b5563', name: 'Photo spot' }),
          k.text({ text: 'CONTACT', x: k.X(0.04), y: k.Y(0.25), w: side - k.X(0.08), fontSize: k.X(0.022), fontWeight: 700, letterSpacing: 2, color: '#93c5fd' })
        ];
        const contacts = [['icon:phone', '+92 300 0000000'], ['icon:mail', 'you@email.com'], ['icon:pin', 'Karachi, Pakistan']];
        contacts.forEach(([ic, t], i) => {
          const y = k.Y(0.29 + i * 0.035);
          els.push(k.shape({ shape: ic, x: k.X(0.04), y, w: k.X(0.03), h: k.X(0.03), fill: '#e5e7eb', strokeWidth: 2 }));
          els.push(k.text({ text: t, x: k.X(0.08), y: y + k.X(0.002), w: side - k.X(0.1), fontSize: k.X(0.02), color: '#e5e7eb' }));
        });
        els.push(k.text({ text: 'SKILLS', x: k.X(0.04), y: k.Y(0.45), w: side - k.X(0.08), fontSize: k.X(0.022), fontWeight: 700, letterSpacing: 2, color: '#93c5fd' }));
        els.push(k.text({ text: 'Communication\nScheduling & planning\nMicrosoft Office\nRecord keeping\nCustomer relations', x: k.X(0.04), y: k.Y(0.49), w: side - k.X(0.08), fontSize: k.X(0.02), color: '#e5e7eb', lineHeight: 1.8 }));
        els.push(k.text({ text: 'Your Name', x: side + k.X(0.05), y: k.Y(0.06), w: k.X(0.58), fontSize: k.X(0.065), fontWeight: 800, color: '#111827' }));
        els.push(k.text({ text: 'Professional Title', x: side + k.X(0.05), y: k.Y(0.12), w: k.X(0.58), fontSize: k.X(0.03), color: '#2563eb' }));
        const sections = [
          ['PROFILE', 'Write two or three sentences about your experience, strengths and the kind of role you are looking for.'],
          ['EXPERIENCE', 'Job Title — Company Name\n2015 – Present\nDescribe your main responsibilities and achievements.\n\nJob Title — Company Name\n2008 – 2015\nDescribe your main responsibilities and achievements.'],
          ['EDUCATION', 'Degree Name — University\nYear of graduation']
        ];
        let y = k.Y(0.2);
        for (const [title, body] of sections) {
          els.push(k.text({ text: title, x: side + k.X(0.05), y, w: k.X(0.58), fontSize: k.X(0.024), fontWeight: 700, letterSpacing: 2, color: '#111827' }));
          els.push(k.line({ x: side + k.X(0.05), y: y + k.X(0.042), w: k.X(0.58), stroke: '#d1d5db', strokeWidth: 1.5 }));
          els.push(k.text({ text: body, x: side + k.X(0.05), y: y + k.X(0.055), w: k.X(0.58), fontSize: k.X(0.021), color: '#374151', lineHeight: 1.5 }));
          y += title === 'EXPERIENCE' ? k.Y(0.3) : k.Y(0.14);
        }
        return { background: { type: 'solid', color: '#ffffff' }, elements: els };
      }
    },
    {
      id: 'business-card', name: 'Clean Business Card', fits: ['business-card', 'product-label', 'postcard'],
      build(w, h) {
        const k = kit(w, h);
        return {
          background: { type: 'solid', color: '#ffffff' },
          elements: [
            k.shape({ shape: 'rect', x: 0, y: 0, w: k.X(0.06), h: k.Y(1), fill: '#0d9488', name: 'Accent bar' }),
            k.text({ text: 'Your Name', x: k.X(0.12), y: k.Y(0.18), w: k.X(0.8), fontSize: k.Y(0.13), fontWeight: 800, color: '#0f172a' }),
            k.text({ text: 'Job Title', x: k.X(0.12), y: k.Y(0.36), w: k.X(0.8), fontSize: k.Y(0.075), color: '#0d9488' }),
            k.shape({ shape: 'icon:phone', x: k.X(0.12), y: k.Y(0.58), w: k.Y(0.08), h: k.Y(0.08), fill: '#475569', strokeWidth: 2 }),
            k.text({ text: '+92 300 0000000', x: k.X(0.12) + k.Y(0.12), y: k.Y(0.58), w: k.X(0.7), fontSize: k.Y(0.065), color: '#334155' }),
            k.shape({ shape: 'icon:mail', x: k.X(0.12), y: k.Y(0.72), w: k.Y(0.08), h: k.Y(0.08), fill: '#475569', strokeWidth: 2 }),
            k.text({ text: 'you@email.com', x: k.X(0.12) + k.Y(0.12), y: k.Y(0.72), w: k.X(0.7), fontSize: k.Y(0.065), color: '#334155' })
          ]
        };
      }
    },
    {
      id: 'elegant-invite', name: 'Elegant Invitation', fits: ['invitation', 'greeting-card', 'print'],
      build(w, h) {
        const k = kit(w, h);
        const m = k.S(0.05);
        return {
          background: { type: 'solid', color: '#fbf7ef' },
          elements: [
            k.shape({ shape: 'rect', x: m, y: m, w: w - 2 * m, h: h - 2 * m, fillType: 'none', stroke: '#b08d57', strokeWidth: k.S(0.006), name: 'Border' }),
            k.shape({ shape: 'rect', x: m * 1.5, y: m * 1.5, w: w - 3 * m, h: h - 3 * m, fillType: 'none', stroke: '#b08d57', strokeWidth: k.S(0.002), name: 'Border' }),
            k.text({ text: 'You are invited to', x: k.X(0.1), y: k.Y(0.2), w: k.X(0.8), fontSize: k.S(0.06), fontFamily: 'Segoe Script', align: 'center', color: '#8a6d3b' }),
            k.text({ text: 'THE WEDDING OF', x: k.X(0.1), y: k.Y(0.33), w: k.X(0.8), fontSize: k.S(0.035), letterSpacing: k.S(0.008), align: 'center', color: '#5b4a2f' }),
            k.text({ text: 'Ayesha & Ahmed', x: k.X(0.1), y: k.Y(0.41), w: k.X(0.8), fontSize: k.S(0.1), fontFamily: 'Georgia', italic: true, align: 'center', color: '#3b2f1e' }),
            k.text({ text: 'Friday, 18 December\n8:00 PM\nPearl Banquet Hall', x: k.X(0.1), y: k.Y(0.64), w: k.X(0.8), fontSize: k.S(0.04), fontFamily: 'Georgia', align: 'center', color: '#5b4a2f', lineHeight: 1.6 })
          ]
        };
      }
    },
    {
      id: 'eid-greeting', name: 'Eid Mubarak (Urdu)', fits: ['greeting-card', 'social', 'ig-post', 'ig-story'],
      build(w, h) {
        const k = kit(w, h);
        const els = [
          k.shape({ shape: 'ellipse', x: k.X(0.5) - k.S(0.3), y: k.Y(0.12), w: k.S(0.6), h: k.S(0.6), fill: '#fde68a', opacity: 0.18, name: 'Glow' })
        ];
        [[0.15, 0.12, 0.05], [0.8, 0.18, 0.04], [0.25, 0.75, 0.03], [0.85, 0.7, 0.05], [0.6, 0.08, 0.025]].forEach(([fx, fy, fs]) => {
          els.push(k.shape({ shape: 'star', x: k.X(fx), y: k.Y(fy), w: k.S(fs), h: k.S(fs), fill: '#fcd34d', name: 'Star' }));
        });
        els.push(k.text({ text: 'عید مبارک', x: k.X(0.05), y: k.Y(0.32), w: k.X(0.9), fontSize: k.S(0.17), fontWeight: 700, align: 'center', color: '#fef3c7', rtl: 'rtl', fontFamily: 'Segoe UI' }));
        els.push(k.text({ text: 'EID MUBARAK', x: k.X(0.05), y: k.Y(0.6), w: k.X(0.9), fontSize: k.S(0.05), letterSpacing: k.S(0.015), align: 'center', color: '#fcd34d', fontWeight: 600 }));
        els.push(k.text({ text: 'Wishing you and your family joy and peace', x: k.X(0.1), y: k.Y(0.7), w: k.X(0.8), fontSize: k.S(0.032), align: 'center', color: '#d1fae5' }));
        return { background: { type: 'gradient', color: '#064e3b', color2: '#065f46', angle: 180 }, elements: els };
      }
    },
    {
      id: 'letterhead', name: 'Letterhead', fits: ['letter', 'report', 'docs'],
      build(w, h) {
        const k = kit(w, h);
        return {
          background: { type: 'solid', color: '#ffffff' },
          elements: [
            k.shape({ shape: 'rect', x: 0, y: 0, w: k.X(1), h: k.Y(0.1), fill: '#0f766e', name: 'Header band' }),
            k.text({ text: 'ORGANISATION NAME', x: k.X(0.08), y: k.Y(0.035), w: k.X(0.6), fontSize: k.X(0.035), fontWeight: 800, letterSpacing: 2, color: '#ffffff' }),
            k.text({ text: 'Date: ____________', x: k.X(0.08), y: k.Y(0.15), w: k.X(0.5), fontSize: k.X(0.022), color: '#334155' }),
            k.text({ text: 'Dear Sir / Madam,\n\nWrite the body of your letter here. Double-click any text to edit it. Press Enter for a new line.\n\nYours sincerely,\n\n\nYour Name', x: k.X(0.08), y: k.Y(0.22), w: k.X(0.84), fontSize: k.X(0.024), color: '#1e293b', lineHeight: 1.6 }),
            k.line({ x: k.X(0.08), y: k.Y(0.93), w: k.X(0.84), stroke: '#0f766e', strokeWidth: 2 }),
            k.text({ text: 'Address line · Phone · Email', x: k.X(0.08), y: k.Y(0.945), w: k.X(0.84), fontSize: k.X(0.018), align: 'center', color: '#64748b' })
          ]
        };
      }
    },
    {
      id: 'promo-flyer', name: 'Promo Flyer', fits: ['flyer', 'poster', 'print', 'banner'],
      build(w, h) {
        const k = kit(w, h);
        return {
          background: { type: 'solid', color: '#fff7ed' },
          elements: [
            k.shape({ shape: 'rect', x: 0, y: 0, w: k.X(1), h: k.Y(0.45), fill: '#ea580c', name: 'Top block' }),
            k.text({ text: 'NEW IN TOWN', x: k.X(0.08), y: k.Y(0.08), w: k.X(0.84), fontSize: k.S(0.04), fontWeight: 700, letterSpacing: k.S(0.01), color: '#ffedd5' }),
            k.text({ text: 'Fresh Bakery & Café', x: k.X(0.08), y: k.Y(0.15), w: k.X(0.84), fontSize: k.S(0.11), fontWeight: 800, color: '#ffffff', lineHeight: 1.05 }),
            k.text({ text: 'Freshly baked bread, cakes and coffee every morning.', x: k.X(0.08), y: k.Y(0.5), w: k.X(0.84), fontSize: k.S(0.045), color: '#7c2d12' }),
            k.shape({ shape: 'star', x: k.X(0.7), y: k.Y(0.36), w: k.S(0.22), h: k.S(0.22), fill: '#facc15', points: 12, name: 'Badge' }),
            k.text({ text: '20% OFF', x: k.X(0.7), y: k.Y(0.36) + k.S(0.11) - k.S(0.025), w: k.S(0.22), fontSize: k.S(0.04), fontWeight: 900, align: 'center', color: '#7c2d12' }),
            k.text({ text: 'Open daily 7 AM – 10 PM\nShop 4, Main Market', x: k.X(0.08), y: k.Y(0.78), w: k.X(0.84), fontSize: k.S(0.038), fontWeight: 600, color: '#431407', lineHeight: 1.5 })
          ]
        };
      }
    }
  ];

  function fitScore(t, format) {
    if (t.fits.includes(format.id)) return 2;
    if (t.fits.includes(format.group)) return 1;
    return 0;
  }

  // Templates sorted so the best matches for this format come first.
  function forFormat(format) {
    return TEMPLATES.slice().sort((a, b) => fitScore(b, format) - fitScore(a, format));
  }

  function byId(id) {
    return TEMPLATES.find((t) => t.id === id) || null;
  }

  const api = { TEMPLATES, forFormat, fitScore, byId };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.DS = root.DS || {}).templates = api;
})(typeof self !== 'undefined' ? self : this);
