/* Jugendgottesdienste Niederamt – Termine und Bewegung */
(() => {
  'use strict';

  /* ---------- Termine berechnen ----------
     Regel: letzter Sonntag im Monat, 19 Uhr.
     Ausnahmen: im Dezember kein Gottesdienst; im Monat des Palmsonntags
     (eine Woche vor Ostern) findet er am Palmsonntag als Kreuzweg statt. */
  const HOUR = 19;
  const COUNT = 6;

  // Die Website geht erst 2027 online: frühere Termine nie anzeigen
  const FIRST = new Date(2027, 0, 1);

  // Osterdatum (gregorianisch, Algorithmus von Meeus/Jones/Butcher)
  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, month, day);
  }

  function lastSunday(y, m) {
    const d = new Date(y, m + 1, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }

  function serviceFor(y, m) {
    if (m === 11) return null;
    const palm = easter(y);
    palm.setDate(palm.getDate() - 7);
    const isPalm = palm.getMonth() === m;
    const date = isPalm ? palm : lastSunday(y, m);
    date.setHours(HOUR, 0, 0, 0);
    return { date, palm: isPalm };
  }

  function upcoming(today, count) {
    const now = today < FIRST ? FIRST : today;
    const list = [];
    let y = now.getFullYear(), m = now.getMonth();
    while (list.length < count) {
      const s = serviceFor(y, m);
      // bis zum Ende des Abends (ca. 21 Uhr) gilt ein Termin als aktuell
      if (s && s.date.getTime() + 2 * 3600e3 > now.getTime()) list.push(s);
      if (++m > 11) { m = 0; y++; }
    }
    return list;
  }

  const fmtDay = new Intl.DateTimeFormat('de-CH', { weekday: 'long', day: 'numeric', month: 'long' });
  const fmtShort = new Intl.DateTimeFormat('de-CH', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtYear = new Intl.DateTimeFormat('de-CH', { year: 'numeric' });

  function relative(date, now) {
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const day = new Date(date); day.setHours(0, 0, 0, 0);
    const days = Math.round((day - start) / 864e5);
    if (days <= 0) return 'heute Abend';
    if (days === 1) return 'morgen';
    if (days < 14) return `in ${days} Tagen`;
    return `in ${Math.round(days / 7)} Wochen`;
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function renderDates() {
    const now = new Date();
    const list = upcoming(now, COUNT);
    const next = list[0];
    const thisYear = now.getFullYear();

    const el = (sel) => document.querySelector(sel);
    el('[data-next-date]').textContent = capitalize(fmtDay.format(next.date));
    el('[data-next-rel]').textContent = relative(next.date, now);
    el('[data-next-meta]').textContent = next.palm
      ? '19 Uhr · Kreuzweg am Palmsonntag'
      : '19 Uhr · Katholische Kirche Schönenwerd';
    el('[data-dock-date]').textContent = fmtShort.format(next.date).replace(/\.$/, '') + ', 19 Uhr';

    // Kalenderdateien liegen fertig im Ordner kalender/ (erzeugt mit tools/kalender.js).
    // Als echte Datei verlinkt öffnet das iPhone direkt «Zum Kalender hinzufügen».
    const pad = (n) => String(n).padStart(2, '0');
    const day = `${next.date.getFullYear()}-${pad(next.date.getMonth() + 1)}-${pad(next.date.getDate())}`;
    const cal = el('[data-ics]');
    cal.href = `kalender/${day}.ics`;
    // Android: der Google-Kalender kann .ics-Dateien nicht direkt öffnen, darum dort den Termin direkt anlegen
    if (/android/i.test(navigator.userAgent)) {
      const d = day.replace(/-/g, '');
      const q = new URLSearchParams({
        action: 'TEMPLATE',
        text: next.palm ? 'Jugendgottesdienst: Kreuzweg am Palmsonntag' : 'Jugendgottesdienst Niederamt',
        dates: `${d}T190000/${d}T203000`,
        ctz: 'Europe/Zurich',
        location: 'Röm.-kath. Kirche Schönenwerd',
        details: 'Jugendgottesdienst in Schönenwerd, danach gemütliches Beisammensein. https://jugendgottesdienste-niederamt.ch',
      });
      cal.href = 'https://calendar.google.com/calendar/render?' + q;
      cal.target = '_blank';
      cal.rel = 'noopener';
    }
    cal.hidden = false;

    // Abo: der Kalender holt neue Termine selbst nach
    const sub = el('[data-ics-all]');
    if (location.protocol.startsWith('http')) {
      sub.href = `webcal://${location.host}${location.pathname.replace(/[^/]*$/, '')}kalender/alle-termine.ics`;
      // Android: Abo über den Google-Kalender anbieten
      if (/android/i.test(navigator.userAgent)) sub.href = 'https://calendar.google.com/calendar/r?cid=' + encodeURIComponent(sub.href);
    }

    const ol = el('[data-dates]');
    ol.innerHTML = '';
    list.forEach((s, i) => {
      const li = document.createElement('li');
      li.className = 'candles__item' + (i === 0 ? ' is-next' : '');
      const year = s.date.getFullYear() !== thisYear ? ' ' + fmtYear.format(s.date) : '';
      const label = i === 0 ? '<strong>Nächster Termin</strong> · ' : '';
      const what = s.palm ? 'Kreuzweg am Palmsonntag' : 'Katholische Kirche Schönenwerd';
      li.innerHTML =
        '<div class="candle" aria-hidden="true"><i class="glow"></i><i class="flame"></i><i class="wick"></i><i class="wax"></i></div>' +
        `<div><p class="candles__date"><time datetime="${s.date.toISOString()}">${capitalize(fmtDay.format(s.date))}${year}</time></p>` +
        `<p class="candles__meta">${label}19 Uhr · ${what}</p></div>`;
      ol.appendChild(li);
    });
  }

  try { renderDates(); } catch (e) { /* statischer Text bleibt stehen */ }

  /* ---------- Bewegung ---------- */
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!('IntersectionObserver' in window)) return;
  root.classList.add('motion');

  // Hero-Eröffnung, sobald die Schrift bereit ist (max. 600 ms warten)
  // Der Startzustand (Bahnen eingerollt, Titel versteckt) muss erst einmal gezeichnet sein,
  // sonst springt der Browser direkt ans Ende – das passierte auf dem Handy, wenn die Schrift schon im Cache lag.
  void root.offsetHeight;
  let opened = false;
  const open = () => {
    if (opened) return;
    opened = true;
    root.classList.add('is-ready');
  };
  const openAfterPaint = () => {
    requestAnimationFrame(() => requestAnimationFrame(open));
    setTimeout(open, 400); // falls der Tab im Hintergrund geöffnet wurde
  };
  Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 600))]).then(openAfterPaint);

  // Auftritte beim Scrollen
  const reveal = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      reveal.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
  document.querySelectorAll('[data-reveal="mask"]').forEach((h) => {
    const inner = document.createElement('span');
    inner.className = 'mask';
    inner.append(...h.childNodes);
    h.append(inner);
  });
  document.querySelectorAll('[data-reveal]').forEach((node) => {
    const siblings = [...node.parentElement.children].filter((c) => c.hasAttribute('data-reveal'));
    const idx = siblings.indexOf(node);
    if (idx > 0) node.style.setProperty('--d', Math.min(idx * 0.12, 0.48) + 's');
    reveal.observe(node);
  });

  // Jede Kerze geht erst an, wenn sie im oberen Drittel bis zur Mitte des Bildschirms angekommen ist
  const light = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      light.unobserve(entry.target);
      setTimeout(() => entry.target.classList.add('is-lit'), reduced ? 0 : 350);
    });
  }, { rootMargin: '0px 0px -42% 0px', threshold: 1 });
  document.querySelectorAll('[data-dates] .candle').forEach((c) => light.observe(c));

  // Dock auf dem Handy: nach dem Hero einblenden, beim Ort und am Schluss ausblenden
  const dock = document.querySelector('[data-dock]');
  let pastHero = false, atJoin = false, atPlace = false;
  const setDock = () => {
    const show = pastHero && !atJoin && !atPlace;
    dock.classList.toggle('is-visible', show);
    dock.setAttribute('aria-hidden', String(!show));
    dock.querySelector('a').tabIndex = show ? 0 : -1;
  };
  new IntersectionObserver(([e]) => { pastHero = !e.isIntersecting; setDock(); }, { threshold: 0 })
    .observe(document.querySelector('.hero .actions'));
  new IntersectionObserver(([e]) => { atJoin = e.isIntersecting; setDock(); }, { threshold: 0 })
    .observe(document.querySelector('.join'));
  new IntersectionObserver(([e]) => { atPlace = e.isIntersecting; setDock(); }, { threshold: 0.35 })
    .observe(document.querySelector('.place__card'));

  if (reduced) return;

  // Stoffbahnen und Fotos folgen sanft dem Scroll
  const hero = document.querySelector('.hero');
  const photos = [...document.querySelectorAll('.photo')];
  // Das Luftbild fliegt beim Scrollen langsam auf die Kirche zu
  const map = document.querySelector('[data-map]');

  // Das Zeichen zeichnet sich Strich für Strich, während man nach unten wischt
  const sign = document.querySelector('[data-sign]');
  const strokes = sign ? [...sign.querySelectorAll('path')] : [];
  const weights = [0.66, 0.1, 0.24]; // Stamm mit Herz und Welle (ein Zug), Querbalken, untere Welle

  // Positionen nur bei Grössenänderung messen, nicht in jedem Frame
  const clamp = (v) => Math.min(1, Math.max(0, v));
  let vh = 0, heroH = 1, photoTops = [], photoHeights = [], signTop = 0, mapTop = 0, mapH = 1;
  const measure = () => {
    vh = window.innerHeight;
    heroH = hero.offsetHeight || 1;
    const y = window.scrollY;
    photoTops = photos.map((ph) => ph.getBoundingClientRect().top + y);
    photoHeights = photos.map((ph) => ph.offsetHeight);
    if (sign) signTop = sign.getBoundingClientRect().top + y;
    if (map) { mapTop = map.getBoundingClientRect().top + y; mapH = map.offsetHeight || 1; }
  };

  // Werte gleiten weich zum Ziel, damit auch Mausrad-Sprünge am Laptop ruhig wirken
  const current = { hero: 0, sign: 0, map: 0, photos: photos.map(() => 0) };
  let running = false;
  const ease = (from, to) => (Math.abs(to - from) < 0.0005 ? to : from + (to - from) * 0.14);
  const frame = () => {
    const y = window.scrollY;
    const target = {
      hero: clamp(y / heroH),
      sign: clamp((y + vh * 0.92 - signTop) / (vh * 0.5)),
      map: clamp((y + vh - mapTop) / (vh + mapH)),
      photos: photos.map((_, i) => ((photoTops[i] - y + photoHeights[i] / 2 - vh / 2) / vh) * (i ? -34 : -18)),
    };
    current.hero = ease(current.hero, target.hero);
    current.sign = ease(current.sign, target.sign);
    current.map = ease(current.map, target.map);
    current.photos = current.photos.map((v, i) => (Math.abs(target.photos[i] - v) < 0.05 ? target.photos[i] : v + (target.photos[i] - v) * 0.14));

    hero.style.setProperty('--hero-progress', current.hero.toFixed(4));
    if (map) { const m = current.map; map.style.setProperty('--zoom', (1 + 0.42 * m * m * (3 - 2 * m)).toFixed(4)); }
    photos.forEach((ph, i) => ph.style.setProperty('--px', current.photos[i].toFixed(2)));
    let start = 0;
    strokes.forEach((path, i) => {
      path.style.setProperty('--draw', (1 - clamp((current.sign - start) / weights[i])).toFixed(4));
      start += weights[i];
    });

    const settled = current.hero === target.hero && current.sign === target.sign && current.map === target.map &&
      current.photos.every((v, i) => v === target.photos[i]);
    if (settled) { running = false; return; }
    requestAnimationFrame(frame);
  };
  const kick = () => { if (!running) { running = true; requestAnimationFrame(frame); } };

  measure();
  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('resize', () => { measure(); kick(); });
  window.addEventListener('load', () => { measure(); kick(); });
  if (document.fonts) document.fonts.ready.then(() => { measure(); kick(); });
  if ('ResizeObserver' in window) new ResizeObserver(() => { measure(); kick(); }).observe(document.body);
  kick();
})();
