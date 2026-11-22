// Grywalizacja: seria dni 🔥, punkty XP i poziomy. Wszystko liczone na bieżąco z zadań,
// więc po imporcie kopii zapasowej statystyki od razu się zgadzają.
import { addDays } from './dates';
import type { Task } from './types';

export const XP_PER_TASK = 10;
export const XP_PERFECT_DAY = 50;
export const XP_PER_LEVEL = 250;

export interface DayStat {
  total: number;
  done: number;
}

export function groupByDay(tasks: Task[]): Map<string, DayStat> {
  const map = new Map<string, DayStat>();
  for (const t of tasks) {
    const s = map.get(t.date) ?? { total: 0, done: 0 };
    s.total++;
    if (t.done) s.done++;
    map.set(t.date, s);
  }
  return map;
}

const isPerfect = (s?: DayStat) => !!s && s.total > 0 && s.done === s.total;

/**
 * Aktualna seria: kolejne dni (wstecz od dziś), w których wszystkie zadania są zrobione.
 * Dni bez zadań nie przerywają serii (ale też jej nie zwiększają).
 * Niedokończony dzisiejszy dzień nie przerywa serii — masz czas do północy!
 */
export function currentStreak(map: Map<string, DayStat>, today: string): number {
  const dates = [...map.keys()].sort();
  if (!dates.length) return 0;
  const first = dates[0];
  let streak = isPerfect(map.get(today)) ? 1 : 0;
  for (let k = addDays(today, -1); k >= first; k = addDays(k, -1)) {
    const s = map.get(k);
    if (!s || s.total === 0) continue;
    if (isPerfect(s)) streak++;
    else break;
  }
  return streak;
}

/** Najdłuższa seria w historii (do dziś włącznie). */
export function bestStreak(map: Map<string, DayStat>, today: string): number {
  const dates = [...map.keys()].filter((d) => d <= today && map.get(d)!.total > 0).sort();
  let best = 0;
  let cur = 0;
  for (const d of dates) {
    if (isPerfect(map.get(d))) best = Math.max(best, ++cur);
    else if (d !== today) cur = 0;
  }
  return best;
}

export function totalXp(map: Map<string, DayStat>): number {
  let xp = 0;
  for (const s of map.values()) {
    xp += s.done * XP_PER_TASK;
    if (isPerfect(s)) xp += XP_PERFECT_DAY;
  }
  return xp;
}

export function levelInfo(xp: number) {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const into = xp % XP_PER_LEVEL;
  return { level, into, progress: into / XP_PER_LEVEL };
}

export function perfectDays(map: Map<string, DayStat>): number {
  let n = 0;
  for (const s of map.values()) if (isPerfect(s)) n++;
  return n;
}
