// Dolny pasek zakładek.
import { IconCalendar, IconChart, IconGear, IconSun } from './Icons';

export type Tab = 'calendar' | 'today' | 'stats' | 'settings';

const TABS: { id: Tab; label: string; Icon: typeof IconSun; color: string }[] = [
  { id: 'calendar', label: 'Kalendarz', Icon: IconCalendar, color: 'var(--blue)' },
  { id: 'today', label: 'Dzisiaj', Icon: IconSun, color: 'var(--green)' },
  { id: 'stats', label: 'Statystyki', Icon: IconChart, color: 'var(--orange)' },
  { id: 'settings', label: 'Ustawienia', Icon: IconGear, color: 'var(--purple)' },
];

export function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="tabbar">
      {TABS.map(({ id, label, Icon, color }) => (
        <button
          key={id}
          className={`tab ${active === id ? 'is-active' : ''}`}
          style={{ ['--tab-color' as string]: color }}
          onClick={() => onChange(id)}
          aria-current={active === id ? 'page' : undefined}
        >
          <span className="tab-icon"><Icon size={24} /></span>
          <span className="tab-label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
