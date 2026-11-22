// Ekran główny: kalendarz miesięczny z postępem każdego dnia oraz serią 🔥 i XP.
import { useEffect, useState } from 'react';
import { ensureSeriesForRange } from '../db';
import { MONTHS, WEEKDAYS_SHORT, daysInMonth, fromKey, toKey, weekdayMon } from '../lib/dates';
import type { DayStat } from '../lib/stats';
import { useSwipe } from '../hooks';
import { ProgressRing } from '../components/ProgressRing';
import { IconCheck, IconLeft, IconRight } from '../components/Icons';
import { Mascot, moodFor } from '../components/Mascot';
import { StatPills } from '../components/StatPills';

interface Props {
  today: string;
  map: Map<string, DayStat>;
  streak: number;
  xp: number;
  onOpenDay: (date: string) => void;
}

export function CalendarScreen({ today, map, streak, xp, onOpenDay }: Props) {
  const t = fromKey(today);
  const [ym, setYm] = useState({ y: t.getFullYear(), m: t.getMonth() });
  const [dir, setDir] = useState<'next' | 'prev' | 'none'>('none');

  const first = toKey(new Date(ym.y, ym.m, 1));
  const dim = daysInMonth(ym.y, ym.m);
  const last = toKey(new Date(ym.y, ym.m, dim));

  // Tworzymy zadania z serii powtarzanych dla widocznego miesiąca.
  useEffect(() => {
    ensureSeriesForRange(first, last);
  }, [first, last]);

  const shift = (delta: number) => {
    setDir(delta > 0 ? 'next' : 'prev');
    setYm(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };
  const goToday = () => {
    setDir('none');
    setYm({ y: t.getFullYear(), m: t.getMonth() });
  };
  const swipe = useSwipe(() => shift(1), () => shift(-1));

  // Komórki siatki: puste miejsca przed 1. dniem miesiąca + dni.
  const blanks = weekdayMon(first);
  const cells: (string | null)[] = [...Array(blanks).fill(null), ...Array.from({ length: dim }, (_, i) => toKey(new Date(ym.y, ym.m, i + 1)))];

  const todayStat = map.get(today);
  const isThisMonth = ym.y === t.getFullYear() && ym.m === t.getMonth();

  return (
    <div className="screen calendar-screen">
      <header className="hero">
        <Mascot mood={moodFor(todayStat?.done ?? 0, todayStat?.total ?? 0)} size={64} />
        <div className="hero-text">
          <h1>Cześć! 👋</h1>
          <p>{todayStat?.total ? `Dziś: ${todayStat.done} z ${todayStat.total} zadań` : 'Na dziś nie masz jeszcze zadań'}</p>
        </div>
      </header>
      <StatPills streak={streak} xp={xp} />

      <div className="card calendar-card" {...swipe}>
        <div className="month-bar">
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Poprzedni miesiąc"><IconLeft /></button>
          <h2 className="month-title">{MONTHS[ym.m]} <span>{ym.y}</span></h2>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Następny miesiąc"><IconRight /></button>
        </div>
        <div className="weekdays">
          {WEEKDAYS_SHORT.map((d) => <span key={d}>{d}</span>)}
        </div>
        <div key={`${ym.y}-${ym.m}`} className={`month-grid slide-${dir}`}>
          {cells.map((key, i) => {
            if (!key) return <span key={`b${i}`} />;
            const s = map.get(key);
            const perfect = !!s && s.total > 0 && s.done === s.total;
            return (
              <button
                key={key}
                className={`day ${key === today ? 'is-today' : ''} ${perfect ? 'is-perfect' : ''} ${key < today ? 'is-past' : ''}`}
                onClick={() => onOpenDay(key)}
                aria-label={`${fromKey(key).getDate()} ${MONTHS[ym.m]}${s ? `, ${s.done} z ${s.total} zrobione` : ''}`}
              >
                {s && s.total > 0 && !perfect && <ProgressRing value={s.done / s.total} />}
                <span className="day-num">{fromKey(key).getDate()}</span>
                {perfect && <span className="day-check"><IconCheck size={11} /></span>}
              </button>
            );
          })}
        </div>
      </div>

      {!isThisMonth && (
        <button className="btn btn-primary btn-block" onClick={goToday}>Dzisiaj</button>
      )}
      <button className="btn btn-secondary btn-block" onClick={() => onOpenDay(today)}>Otwórz dzisiejsze zadania →</button>
    </div>
  );
}
