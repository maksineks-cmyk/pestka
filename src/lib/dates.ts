// Pomocnicze funkcje dat. Dni zapisujemy jako klucze "RRRR-MM-DD" w czasie lokalnym,
// dzięki czemu nie ma problemów ze strefami czasowymi.

export const MONTHS = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
export const MONTHS_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
/** Dni tygodnia od poniedziałku (indeks 0 = poniedziałek). */
export const WEEKDAYS_SHORT = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
export const WEEKDAYS_LONG = ['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela'];

const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayKey = () => toKey(new Date());

export function addDays(key: string, days: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
}

/** Dzień tygodnia z poniedziałkiem jako 0. */
export function weekdayMon(key: string): number {
  return (fromKey(key).getDay() + 6) % 7;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Np. "piątek, 27 listopada". */
export function formatLong(key: string): string {
  const d = fromKey(key);
  return `${WEEKDAYS_LONG[weekdayMon(key)]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

/** Przyjazna nazwa dnia: "Dzisiaj", "Jutro", "Wczoraj" albo data. */
export function friendlyDay(key: string): string {
  const t = todayKey();
  if (key === t) return 'Dzisiaj';
  if (key === addDays(t, 1)) return 'Jutro';
  if (key === addDays(t, -1)) return 'Wczoraj';
  const d = fromKey(key);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

/** Wszystkie klucze dni z zakresu [from, to] włącznie. */
export function rangeKeys(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

/** Poniedziałek tygodnia, w którym leży dany dzień. */
export const startOfWeek = (key: string) => addDays(key, -weekdayMon(key));
