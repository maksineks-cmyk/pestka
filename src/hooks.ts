// Wspólne hooki: dane "na żywo" z bazy (odświeżają się automatycznie po każdej zmianie),
// dzisiejsza data oraz obsługa przesunięć palcem.
import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { todayKey } from './lib/dates';
import { currentStreak, groupByDay, totalXp } from './lib/stats';
import type { LearnedWord, Section, Task } from './lib/types';

const EMPTY_TASKS: Task[] = [];
const EMPTY_SECTIONS: Section[] = [];

export const useAllTasks = () => useLiveQuery(() => db.tasks.toArray(), [], EMPTY_TASKS);
export const useSections = () => useLiveQuery(() => db.sections.orderBy('order').toArray(), [], EMPTY_SECTIONS);

/** Dzisiejsza data, aktualizowana po północy i po powrocie do aplikacji. */
export function useToday() {
  const [today, setToday] = useState(todayKey);
  useEffect(() => {
    const check = () => setToday(todayKey());
    const id = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return today;
}

/** Seria i XP liczone ze wszystkich zadań. */
export function useGameStats(tasks: Task[], today: string) {
  return useMemo(() => {
    const map = groupByDay(tasks);
    return { map, streak: currentStreak(map, today), xp: totalXp(map) };
  }, [tasks, today]);
}

/** Wykrywa przesunięcie palcem w lewo/prawo (np. zmiana miesiąca). */
export function useSwipe(onLeft: () => void, onRight: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: TouchEvent) => {
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    },
    onTouchEnd: (e: TouchEvent) => {
      if (!start.current) return;
      const dx = e.changedTouches[0].clientX - start.current.x;
      const dy = e.changedTouches[0].clientY - start.current.y;
      start.current = null;
      // Tylko wyraźnie poziomy ruch, żeby nie kolidować z przewijaniem.
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? onLeft : onRight)();
    },
  };
}

const EMPTY_LEARNED: LearnedWord[] = [];
export const useLearned = () => useLiveQuery(() => db.learned.toArray(), [], EMPTY_LEARNED);

/** Aktualna godzina w minutach od północy (odświeżana co 30 s) — do linii „teraz”. */
export function useNowMinutes() {
  const calc = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };
  const [now, setNow] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setNow(calc()), 30_000);
    const vis = () => setNow(calc());
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);
  return now;
}
