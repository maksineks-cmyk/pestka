// Statystyki: seria, XP i poziom, liczba ukończonych zadań oraz wykresy tygodniowe.
import { addDays, fromKey, MONTHS_GEN, startOfWeek, WEEKDAYS_SHORT } from '../lib/dates';
import { bestStreak, levelInfo, perfectDays, XP_PER_LEVEL, type DayStat } from '../lib/stats';
import { Mascot } from '../components/Mascot';

interface Props {
  today: string;
  map: Map<string, DayStat>;
  streak: number;
  xp: number;
}

/** Prosty wykres słupkowy w SVG (bez bibliotek). */
function BarChart({ bars, color }: { bars: { label: string; value: number; highlight?: boolean }[]; color: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="bars">
      {bars.map((b, i) => (
        <div key={i} className={`bar-col ${b.highlight ? 'is-hl' : ''}`}>
          <span className="bar-value">{b.value || ''}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ height: `${(b.value / max) * 100}%`, background: color, animationDelay: `${i * 40}ms` }} />
          </div>
          <span className="bar-label">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

export function StatsScreen({ today, map, streak, xp }: Props) {
  const { level, into, progress } = levelInfo(xp);
  let doneTotal = 0;
  for (const [d, s] of map) if (d <= today) doneTotal += s.done;
  const best = Math.max(bestStreak(map, today), streak);

  // Bieżący tydzień (pon–nd).
  const mon = startOfWeek(today);
  const week = WEEKDAYS_SHORT.map((label, i) => {
    const k = addDays(mon, i);
    return { label, value: map.get(k)?.done ?? 0, highlight: k === today };
  });

  // Ostatnie 8 tygodni.
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = addDays(mon, -7 * (7 - i));
    let v = 0;
    for (let d = 0; d < 7; d++) v += map.get(addDays(start, d))?.done ?? 0;
    const sd = fromKey(start);
    return { label: `${sd.getDate()}.${String(sd.getMonth() + 1).padStart(2, '0')}`, value: v, highlight: i === 7 };
  });
  const weekSum = week.reduce((a, b) => a + b.value, 0);

  return (
    <div className="screen stats-screen">
      <header className="screen-header">
        <h1>Statystyki</h1>
      </header>

      <div className="stats-grid">
        <div className="stat-card" style={{ ['--c' as string]: 'var(--orange)' }}>
          <span className="stat-emoji">🔥</span>
          <b>{streak}</b>
          <span>seria dni</span>
        </div>
        <div className="stat-card" style={{ ['--c' as string]: 'var(--red)' }}>
          <span className="stat-emoji">🏅</span>
          <b>{best}</b>
          <span>najdłuższa seria</span>
        </div>
        <div className="stat-card" style={{ ['--c' as string]: 'var(--green)' }}>
          <span className="stat-emoji">✅</span>
          <b>{doneTotal}</b>
          <span>zrobionych zadań</span>
        </div>
        <div className="stat-card" style={{ ['--c' as string]: 'var(--purple)' }}>
          <span className="stat-emoji">🏆</span>
          <b>{perfectDays(map)}</b>
          <span>idealnych dni</span>
        </div>
      </div>

      <div className="card level-card">
        <Mascot mood={streak > 2 ? 'party' : 'happy'} size={60} />
        <div className="progress-wrap">
          <div className="progress-label">
            <span>Poziom {level} · ⭐ {xp} XP</span>
            <b>{into}/{XP_PER_LEVEL}</b>
          </div>
          <div className="progress-bar progress-yellow"><div className="progress-fill" style={{ width: `${progress * 100}%` }} /></div>
          <p className="hint">+10 XP za zadanie, +50 XP za ukończony dzień</p>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Ten tydzień <span className="muted">· {weekSum} zadań</span></h2>
        <BarChart bars={week} color="var(--green)" />
      </div>

      <div className="card">
        <h2 className="card-title">Ostatnie 8 tygodni</h2>
        <BarChart bars={weeks} color="var(--blue)" />
        <p className="hint">Tygodnie zaczynają się w poniedziałek ({fromKey(mon).getDate()} {MONTHS_GEN[fromKey(mon).getMonth()]} — bieżący).</p>
      </div>
    </div>
  );
}
