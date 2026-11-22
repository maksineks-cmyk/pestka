// Duże "pigułki" z serią dni 🔥 i punktami XP ⭐ (na ekranie głównym).
import { levelInfo } from '../lib/stats';

export function StatPills({ streak, xp }: { streak: number; xp: number }) {
  const { level } = levelInfo(xp);
  return (
    <div className="stat-pills">
      <div className={`pill pill-streak ${streak > 0 ? 'is-hot' : ''}`}>
        <span className="pill-emoji">🔥</span>
        <span className="pill-value">{streak}</span>
        <span className="pill-label">{streak === 1 ? 'dzień' : 'dni'} z rzędu</span>
      </div>
      <div className="pill pill-xp">
        <span className="pill-emoji">⭐</span>
        <span className="pill-value">{xp}</span>
        <span className="pill-label">XP · poz. {level}</span>
      </div>
    </div>
  );
}
