// Logika zadań powtarzanych.
import { daysInMonth, fromKey, weekdayMon, WEEKDAYS_SHORT } from './dates';
import type { Recurrence, Series } from './types';

/** Czy seria ma wystąpienie w danym dniu? */
export function occursOn(series: Series, key: string): boolean {
  if (key < series.startDate) return false;
  if (series.endDate && key > series.endDate) return false;
  if (series.excluded.includes(key)) return false;
  const r = series.recurrence;
  switch (r.type) {
    case 'daily':
      return true;
    case 'weekdays':
      return (r.weekdays ?? []).includes(weekdayMon(key));
    case 'weekly':
      return weekdayMon(key) === weekdayMon(series.startDate);
    case 'monthly': {
      // Np. seria od 31-go: w krótszych miesiącach wypada ostatniego dnia miesiąca.
      const d = fromKey(key);
      const want = Math.min(fromKey(series.startDate).getDate(), daysInMonth(d.getFullYear(), d.getMonth()));
      return d.getDate() === want;
    }
  }
}

export function describeRecurrence(r?: Recurrence, startDate?: string): string {
  if (!r) return 'Nie powtarzaj';
  switch (r.type) {
    case 'daily':
      return 'Codziennie';
    case 'weekdays': {
      const days = [...(r.weekdays ?? [])].sort();
      return days.length ? 'W dni: ' + days.map((i) => WEEKDAYS_SHORT[i]).join(', ') : 'Wybrane dni';
    }
    case 'weekly':
      return startDate ? `Co tydzień (${WEEKDAYS_SHORT[weekdayMon(startDate)]})` : 'Co tydzień';
    case 'monthly':
      return startDate ? `Co miesiąc (${fromKey(startDate).getDate()}.)` : 'Co miesiąc';
  }
}

/** Reguła RRULE do pliku .ics, aby wydarzenie w kalendarzu iPhone'a też się powtarzało. */
export function toRRule(r: Recurrence): string {
  const ICS_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  switch (r.type) {
    case 'daily':
      return 'RRULE:FREQ=DAILY';
    case 'weekdays':
      return 'RRULE:FREQ=WEEKLY;BYDAY=' + (r.weekdays ?? []).map((i) => ICS_DAYS[i]).join(',');
    case 'weekly':
      return 'RRULE:FREQ=WEEKLY';
    case 'monthly':
      return 'RRULE:FREQ=MONTHLY';
  }
}
