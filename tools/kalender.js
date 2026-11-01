/* Erzeugt die Kalenderdateien im Ordner kalender/:
   - kalender/JJJJ-MM-TT.ics  je ein Termin, für «Im Kalender eintragen» (die nächsten 2 Jahre)
   - kalender/abo.ics         die nächsten 6 Termine, für «Termine abonnieren» (wie auf der Website)

   Läuft jede Woche automatisch über GitHub Actions (.github/workflows/kalender.yml).
   Von Hand im Projektordner:  node tools/kalender.js
   Zum Testen mit anderem Datum:  KALENDER_HEUTE=2027-05-31 node tools/kalender.js

   Die Terminregel muss mit assets/js/main.js übereinstimmen:
   letzter Sonntag im Monat, 19 Uhr; kein Gottesdienst im Dezember;
   im Monat des Palmsonntags (eine Woche vor Ostern) am Palmsonntag als Kreuzweg. */
'use strict';
const fs = require('fs');
const path = require('path');

const FIRST = new Date(Date.UTC(2027, 0, 1)); // die Website startet 2027
const ABO_COUNT = 6;                           // so viele Termine zeigt auch die Website
const MONTHS_AHEAD = 24;                       // Einzeldateien für die nächsten 2 Jahre
const OUT = path.join(__dirname, '..', 'kalender');
const SITE = 'https://jugendgottesdienste-niederamt.ch';
const LOCATION = 'Röm.-kath. Kirche Schönenwerd';
// Fester Zeitstempel, damit sich die Dateien nur ändern, wenn sich wirklich ein Termin ändert
const DTSTAMP = '20261101T000000Z';

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

function serviceFor(y, m) {
  if (m === 11) return null;
  const palm = easter(y);
  palm.setUTCDate(palm.getUTCDate() - 7);
  const isPalm = palm.getUTCMonth() === m;
  return { date: isPalm ? palm : lastSunday(y, m), palm: isPalm };
}

// Alle Termine ab heute (der heutige Sonntag zählt noch mit) für die nächsten Monate
function upcoming(from, months) {
  const list = [];
  let y = from.getUTCFullYear(), m = from.getUTCMonth();
  for (let i = 0; i <= months; i++) {
    const s = serviceFor(y, m);
    if (s && s.date >= from) list.push(s);
    if (++m > 11) { m = 0; y++; }
  }
  return list;
}

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

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
    `DTSTAMP:${DTSTAMP}`,
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
    ...(name ? [`X-WR-CALNAME:${name}`, 'X-WR-TIMEZONE:Europe/Zurich', 'REFRESH-INTERVAL;VALUE=DURATION:P1D', 'X-PUBLISHED-TTL:P1D'] : []),
    ...VTIMEZONE, ...events.flat(), 'END:VCALENDAR', '',
  ].join('\r\n');
}

const today = process.env.KALENDER_HEUTE ? new Date(`${process.env.KALENDER_HEUTE}T00:00:00Z`) : new Date();
const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
const from = todayUTC < FIRST ? FIRST : todayUTC;
const list = upcoming(from, MONTHS_AHEAD);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const s of list) fs.writeFileSync(path.join(OUT, `${iso(s.date)}.ics`), calendar([event(s)]));
const abo = list.slice(0, ABO_COUNT);
fs.writeFileSync(path.join(OUT, 'abo.ics'), calendar(abo.map(event), 'Jugendgottesdienste Niederamt'));
console.log(`Abo: ${abo.map((s) => iso(s.date)).join(', ')}`);
console.log(`${list.length} Einzeltermine bis ${iso(list[list.length - 1].date)} in kalender/ geschrieben.`);
