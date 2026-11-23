// Główny komponent: przełącza ekrany według dolnego paska zakładek.
import { useState } from 'react';
import { TabBar, type Tab } from './components/TabBar';
import { DialogHost } from './components/Dialogs';
import { CalendarScreen } from './screens/CalendarScreen';
import { DayScreen } from './screens/DayScreen';
import { StatsScreen } from './screens/StatsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { useAllTasks, useGameStats, useSections, useToday } from './hooks';

export default function App() {
  const today = useToday();
  const tasks = useAllTasks();
  const sections = useSections();
  const { map, streak, xp } = useGameStats(tasks, today);

  // Aplikacja startuje od razu w widoku dnia z szybkim wpisem.
  const [tab, setTab] = useState<Tab>('today');
  // Dzień otwarty z kalendarza (null = widać siatkę miesiąca).
  const [calendarDay, setCalendarDay] = useState<string | null>(null);
  // Dzień pokazywany w zakładce "Dzisiaj" (można przewijać strzałkami).
  const [todayTabDay, setTodayTabDay] = useState(today);

  const changeTab = (t: Tab) => {
    if (t === 'calendar' && tab === 'calendar') setCalendarDay(null); // drugie stuknięcie = powrót do miesiąca
    if (t === 'today') setTodayTabDay(today);
    setTab(t);
    window.scrollTo({ top: 0 });
  };

  let screen;
  if (tab === 'calendar' && calendarDay) {
    screen = <DayScreen date={calendarDay} today={today} sections={sections} onChangeDate={setCalendarDay} onBack={() => setCalendarDay(null)} />;
  } else if (tab === 'calendar') {
    screen = <CalendarScreen today={today} map={map} streak={streak} xp={xp} onOpenDay={setCalendarDay} />;
  } else if (tab === 'today') {
    screen = <DayScreen date={todayTabDay} today={today} sections={sections} onChangeDate={setTodayTabDay} />;
  } else if (tab === 'stats') {
    screen = <StatsScreen today={today} map={map} streak={streak} xp={xp} />;
  } else {
    screen = <SettingsScreen sections={sections} />;
  }

  return (
    <div className="app">
      <main key={`${tab}-${tab === 'calendar' ? !!calendarDay : ''}`} className="screen-anim">
        {screen}
      </main>
      <TabBar active={tab} onChange={changeTab} />
      <DialogHost />
    </div>
  );
}
