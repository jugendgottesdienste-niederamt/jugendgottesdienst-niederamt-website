/* Erzeugt die Kalenderdateien im Ordner kalender/.
   Aufruf im Projektordner:  node tools/kalender.js
   Spätestens Ende 2031 erneut ausführen, damit neue Jahre dazukommen.

   Die Terminregel muss mit assets/js/main.js übereinstimmen:
   letzter Sonntag im Monat, 19 Uhr; kein Gottesdienst im Dezember;
   im Monat des Palmsonntags (eine Woche vor Ostern) am Palmsonntag als Kreuzweg. */
'use strict';
const fs = require('fs');
const path = require('path');

const FIRST_YEAR = 2027;
const LAST_YEAR = 2031;
const OUT = path.join(__dirname, '..', 'kalender');
const SITE = 'https://jugendgottesdienste-niederamt.ch';
const LOCATION = 'Röm.-kath. Kirche Schönenwerd';

function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  return new Date(Date.UTC(y, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1));
}

function lastSunday(y, m) {
  const d = new Date(Date.UTC(y, m + 1, 0));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d;
}

function services() {
  const list = [];
  for (let y = FIRST_YEAR; y <= LAST_YEAR; y++) {
    const palm = easter(y);
    palm.setUTCDate(palm.getUTCDate() - 7);
    for (let m = 0; m < 11; m++) {
      const isPalm = palm.getUTCMonth() === m;
      list.push({ date: isPalm ? palm : lastSunday(y, m), palm: isPalm });
    }
  }
  return list;
}

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

// Zeitzone der Schweiz, damit 19 Uhr überall richtig ankommt
const VTIMEZONE = [
  'BEGIN:VTIMEZONE', 'TZID:Europe/Zurich',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST',
  'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET',
  'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
  'END:VTIMEZONE',
];

function event(s) {
  const day = ymd(s.date);
  return [
    'BEGIN:VEVENT',
    `UID:jgd-${day}@jugendgottesdienste-niederamt.ch`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=Europe/Zurich:${day}T190000`,
    `DTEND;TZID=Europe/Zurich:${day}T203000`,
    `SUMMARY:${s.palm ? 'Jugendgottesdienst: Kreuzweg am Palmsonntag' : 'Jugendgottesdienst Niederamt'}`,
    `LOCATION:${LOCATION}`,
    'DESCRIPTION:Jugendgottesdienst in Schönenwerd\\, danach gemütliches Beisammensein.',
    `URL:${SITE}`,
    'BEGIN:VALARM', 'TRIGGER:-PT3H', 'ACTION:DISPLAY', 'DESCRIPTION:Heute Abend ist Jugendgottesdienst', 'END:VALARM',
    'END:VEVENT',
  ];
}

function calendar(events, name) {
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Jugendgottesdienste Niederamt//DE', 'CALSCALE:GREGORIAN',
    ...(name ? [`X-WR-CALNAME:${name}`, 'X-WR-TIMEZONE:Europe/Zurich', 'REFRESH-INTERVAL;VALUE=DURATION:P1D'] : []),
    ...VTIMEZONE, ...events.flat(), 'END:VCALENDAR', '',
  ].join('\r\n');
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const all = services();
for (const s of all) fs.writeFileSync(path.join(OUT, `${iso(s.date)}.ics`), calendar([event(s)]));
fs.writeFileSync(path.join(OUT, 'alle-termine.ics'), calendar(all.map(event), 'Jugendgottesdienste Niederamt'));
console.log(`${all.length} Termine (${FIRST_YEAR}–${LAST_YEAR}) nach kalender/ geschrieben.`);
