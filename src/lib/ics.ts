// Generowanie pliku kalendarza .ics z alarmem (VALARM).
// PWA na iOS nie może samodzielnie wysyłać powiadomień bez serwera, więc tworzymy
// wydarzenie, które użytkownik dodaje do aplikacji Kalendarz — iOS sam pokaże powiadomienie.
import { fromKey } from './dates';
import type { AlertOffset, Recurrence } from './types';
import { toRRule } from './recurrence';
import { saveFile } from './files';

export const ALERT_OPTIONS: { value: AlertOffset; label: string }[] = [
  { value: 0, label: 'W chwili wydarzenia' },
  { value: 10, label: '10 min przed' },
  { value: 30, label: '30 min przed' },
  { value: 60, label: '1 godz. przed' },
  { value: 1440, label: '1 dzień przed' },
];

const pad = (n: number) => String(n).padStart(2, '0');

/** Data w formacie UTC dla iCalendar, np. 20261127T140000Z */
function icsUtc(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}

/** Escapowanie znaków specjalnych w tekście iCalendar. */
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export interface IcsInput {
  uid: string;
  title: string;
  note?: string;
  date: string;
  time: string;
  alert: AlertOffset;
  recurrence?: Recurrence;
}

export function buildIcs(e: IcsInput): string {
  const [h, m] = e.time.split(':').map(Number);
  const start = fromKey(e.date);
  start.setHours(h, m, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000); // wydarzenie trwa 30 min
  const trigger = e.alert === 0 ? 'PT0M' : e.alert === 1440 ? 'P1D' : `PT${e.alert}M`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pestka Planer//PL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.uid}@pestka-planer`,
    `DTSTAMP:${icsUtc(new Date())}`,
    `DTSTART:${icsUtc(start)}`,
    `DTEND:${icsUtc(end)}`,
    `SUMMARY:${esc(e.title)}`,
    ...(e.note ? [`DESCRIPTION:${esc(e.note)}`] : []),
    ...(e.recurrence ? [toRRule(e.recurrence)] : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(e.title)}`,
    `TRIGGER:-${trigger}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  // Specyfikacja iCalendar wymaga końców linii CRLF.
  return lines.join('\r\n') + '\r\n';
}

export function icsFilename(title: string) {
  const safe = title.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 40) || 'przypomnienie';
  return `${safe}.ics`;
}

/** Tworzy plik .ics i otwiera go — Safari na iPhonie pokaże okno "Dodaj do kalendarza". */
export function downloadIcs(e: IcsInput) {
  const blob = new Blob([buildIcs(e)], { type: 'text/calendar;charset=utf-8' });
  return saveFile(blob, icsFilename(e.title), false);
}
