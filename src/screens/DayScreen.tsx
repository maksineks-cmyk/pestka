// Widok dnia: szybki wpis „Co dziś masz do zrobienia?”, pasek postępu, „Plan dnia” (oś czasu
// zadań z godziną), zadania bez godziny pogrupowane w zwijane sekcje, odhaczanie, przeciąganie
// oraz „Przenieś niezrobione na jutro”.
import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ensureSeriesForRange, getLearnedMap, moveUnfinishedToTomorrow, reorderTasks, setTaskReminder, toggleTask } from '../db';
import { addDays, formatLong, friendlyDay } from '../lib/dates';
import type { Section, Task } from '../lib/types';
import { useNowMinutes, useSwipe } from '../hooks';
import { SortableList } from '../components/SortableList';
import { TaskItem } from '../components/TaskItem';
import { TaskEditor, type EditorTarget } from '../components/TaskEditor';
import { PlanPreview } from '../components/PlanPreview';
import { Mascot, moodFor } from '../components/Mascot';
import { IconArrowNext, IconLeft, IconPlus, IconRight } from '../components/Icons';
import { confirmBox, toast } from '../components/Dialogs';
import { fireConfetti } from '../components/confetti';
import { haptic } from '../lib/haptics';
import { downloadIcs } from '../lib/ics';
import { parseBrainDump, type ParsedTask } from '../lib/parser';
import { XP_PER_TASK, XP_PERFECT_DAY } from '../lib/stats';

interface Props {
  date: string;
  today: string;
  sections: Section[];
  onChangeDate: (d: string) => void;
  onBack?: () => void;
}

const EMPTY: Task[] = [];
/** Ile ms świeżo odhaczone zadanie zostaje na swoim miejscu, zanim zjedzie na dół grupy. */
const SINK_DELAY = 900;
const COLLAPSED_KEY = 'pestka-collapsed-sections';

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const fmtMin = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

function readCollapsed(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function inputTitle(date: string, today: string) {
  if (date === today) return 'Co dziś masz do zrobienia?';
  if (date === addDays(today, 1)) return 'Co jutro masz do zrobienia?';
  return `Co masz do zrobienia ${friendlyDay(date).toLowerCase()}?`;
}

export function DayScreen({ date, today, sections, onChangeDate, onBack }: Props) {
  const tasks = useLiveQuery(() => db.tasks.where('date').equals(date).toArray(), [date], EMPTY);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [dir, setDir] = useState<'next' | 'prev' | 'none'>('none');
  const [dump, setDump] = useState('');
  const [preview, setPreview] = useState<ParsedTask[] | null>(null);
  const [collapsed, setCollapsed] = useState<string[]>(readCollapsed);
  const [, setTick] = useState(0);
  const nowMin = useNowMinutes();

  useEffect(() => {
    ensureSeriesForRange(date, date);
  }, [date]);

  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const progress = total ? done / total : 0;

  // Świętowanie tylko gdy użytkownik SAM domknął dzień (a nie przy otwarciu ukończonego dnia).
  const justToggled = useRef(false);
  useEffect(() => {
    if (justToggled.current && total > 0 && done === total) {
      setCelebrate(true);
      fireConfetti();
      haptic();
    }
    justToggled.current = false;
  }, [done, total]);

  const go = (delta: number) => {
    setDir(delta > 0 ? 'next' : 'prev');
    onChangeDate(addDays(date, delta));
  };
  const swipe = useSwipe(() => go(1), () => go(-1));

  const onToggle = async (t: Task) => {
    justToggled.current = true;
    haptic();
    await toggleTask(t.id);
    // Po chwili odświeżamy listę, żeby zrobione zadanie zjechało na dół grupy.
    setTimeout(() => setTick((n) => n + 1), SINK_DELAY + 50);
  };

  const onBell = async (t: Task) => {
    if (!t.time) return;
    const reminder = { date: t.date, time: t.time, alert: t.reminder?.alert ?? 10 } as const;
    await downloadIcs({ uid: t.seriesId ?? t.id, title: t.title, note: t.note, date: reminder.date, time: reminder.time, alert: reminder.alert });
    await setTaskReminder(t.id, reminder);
  };

  const plan = async () => {
    if (!dump.trim()) return toast('Wpisz, co masz do zrobienia ✏️');
    const items = parseBrainDump(dump, sections, await getLearnedMap());
    if (!items.length) return toast('Nie znalazłem żadnych zadań 🤔');
    setPreview(items);
  };

  const moveUndone = async () => {
    const n = total - done;
    const ok = await confirmBox('Przenieść na jutro?', `${n} ${n === 1 ? 'niezrobione zadanie trafi' : 'niezrobionych zadań trafi'} na ${friendlyDay(addDays(date, 1)).toLowerCase()}.`, 'Przenieś');
    if (!ok) return;
    const moved = await moveUnfinishedToTomorrow(date);
    toast(`Przeniesiono: ${moved} ➡️`);
  };

  const toggleCollapsed = (id: string) => {
    const next = collapsed.includes(id) ? collapsed.filter((x) => x !== id) : [...collapsed, id];
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
    } catch {
      /* brak dostępu do pamięci — zwijanie działa do zamknięcia aplikacji */
    }
  };

  // Zrobione zadania zjeżdżają na dół (z małym opóźnieniem, żeby było widać odhaczenie).
  const now = Date.now();
  const sunk = (t: Task) => (t.done && now - (t.doneAt ?? 0) > SINK_DELAY ? 1 : 0);

  const sectionById = new Map(sections.map((s) => [s.id, s]));
  const sectionOf = (t: Task) => sectionById.get(t.sectionId) ?? sections[0];

  // „Plan dnia”: zadania z godziną, chronologicznie.
  const timed = tasks.filter((t) => t.time).sort((a, b) => a.time!.localeCompare(b.time!) || a.order - b.order);
  const timedDone = timed.filter((t) => t.done).length;
  const isToday = date === today;
  const nowIndex = isToday ? timed.findIndex((t) => toMin(t.time!) > nowMin) : -1;
  const nowAt = nowIndex === -1 ? timed.length : nowIndex;

  // Zadania bez godziny w sekcjach. Zadania z nieistniejącej sekcji (np. po imporcie) trafiają do pierwszej.
  const untimed = tasks.filter((t) => !t.time);
  const tasksIn = (s: Section) =>
    untimed.filter((t) => sectionOf(t)?.id === s.id).sort((a, b) => sunk(a) - sunk(b) || a.order - b.order);

  const nowLine = (
    <div className="tl-now" key="now" aria-label={`Teraz ${fmtMin(nowMin)}`}>
      <span className="tl-now-label">teraz {fmtMin(nowMin)}</span>
    </div>
  );

  return (
    <div className="screen day-screen">
      <header className="day-header">
        {onBack ? (
          <button className="icon-btn" onClick={onBack} aria-label="Wróć do kalendarza"><IconLeft /></button>
        ) : (
          <span className="icon-btn-spacer" />
        )}
        <div className="day-title" {...swipe}>
          <h1>{friendlyDay(date)}</h1>
          <p>{formatLong(date)}</p>
        </div>
        <div className="day-nav">
          <button className="icon-btn" onClick={() => go(-1)} aria-label="Poprzedni dzień"><IconLeft size={20} /></button>
          <button className="icon-btn" onClick={() => go(1)} aria-label="Następny dzień"><IconRight size={20} /></button>
        </div>
      </header>

      <form
        className={`quick card ${total ? 'has-tasks' : ''}`}
        onSubmit={(e) => {
          e.preventDefault();
          plan();
        }}
      >
        <label className="quick-title" htmlFor="quick-input">{inputTitle(date, today)}</label>
        <textarea
          id="quick-input"
          className="input quick-input"
          rows={total ? 2 : 4}
          value={dump}
          onChange={(e) => setDump(e.target.value)}
          placeholder="np. fryzjer o 15, siłownia, zakupy w biedronce, mail do szefa, odkurzyć pokój 18:30…"
          enterKeyHint="enter"
        />
        <button type="submit" className="btn btn-primary btn-block btn-lg quick-btn" disabled={!dump.trim()}>
          ✨ Zaplanuj dzień
        </button>
        <p className="hint">Oddzielaj przecinkami, myślnikami lub nowymi liniami. Godziny („o 15”, „18:30”, „rano”) wykryję sam, a <b>#dom</b> wymusza sekcję.</p>
      </form>

      <div className="progress-card card">
        <Mascot mood={moodFor(done, total)} size={56} />
        <div className="progress-wrap">
          <div className="progress-label">
            <span>{total ? (done === total ? 'Wszystko zrobione! 🎉' : 'Postęp dnia') : 'Pusty dzień'}</span>
            <b>{done}/{total}</b>
          </div>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress * 100}%` }} /></div>
        </div>
        {date !== today && (
          <button className="btn btn-small btn-secondary" onClick={() => onChangeDate(today)}>Dziś</button>
        )}
      </div>

      <div key={date} className={`day-body slide-${dir}`} {...swipe}>
        {total === 0 && (
          <div className="empty">
            <p className="empty-title">Brak zadań na ten dzień 🌱</p>
            <p>Wpisz wszystko powyżej i stuknij „Zaplanuj dzień”.</p>
          </div>
        )}

        {timed.length > 0 && (
          <section className="section plan" style={{ ['--sec' as string]: 'var(--blue)' }}>
            <div className="section-head">
              <span className="section-emoji">🗓️</span>
              <h2>Plan dnia</h2>
              <span className="section-count">{timedDone}/{timed.length}</span>
            </div>
            <div className="timeline">
              {timed.map((t, i) => {
                const s = sectionOf(t);
                return [
                  isToday && i === nowAt ? nowLine : null,
                  <div key={t.id} className={`tl-row ${t.done ? 'is-done' : ''} ${isToday && toMin(t.time!) <= nowMin && !t.done ? 'is-past' : ''}`} style={{ ['--sec' as string]: s?.color }}>
                    <div className="tl-time">
                      <b>{t.timeApprox ? '~' : ''}{t.time}</b>
                      {t.endTime && <small>{t.endTime}</small>}
                    </div>
                    <div className="tl-dot" aria-hidden="true">{s?.emoji}</div>
                    <div className="tl-task">
                      <TaskItem task={t} color={s?.color ?? '#ce82ff'} big onToggle={onToggle} onEdit={(task) => setEditor({ task, date, sectionId: task.sectionId })} onBell={onBell} />
                    </div>
                  </div>,
                ];
              })}
              {isToday && nowAt === timed.length && nowLine}
            </div>
          </section>
        )}

        {sections.map((s) => {
          const list = tasksIn(s);
          if (!list.length) return null; // puste sekcje ukrywamy
          const isCollapsed = collapsed.includes(s.id);
          const doneCount = list.filter((t) => t.done).length;
          return (
            <section key={s.id} className={`section ${isCollapsed ? 'is-collapsed' : ''}`} style={{ ['--sec' as string]: s.color }}>
              <div className="section-head">
                <button className="section-toggle" onClick={() => toggleCollapsed(s.id)} aria-expanded={!isCollapsed}>
                  <span className="section-emoji">{s.emoji}</span>
                  <h2>{s.name}</h2>
                  <span className="section-count">{doneCount}/{list.length}</span>
                </button>
                <button className="section-add" onClick={() => setEditor({ date, sectionId: s.id })} aria-label={`Dodaj zadanie do sekcji ${s.name}`}>
                  <IconPlus size={16} />
                </button>
                <button className="section-chevron" onClick={() => toggleCollapsed(s.id)} aria-label={isCollapsed ? `Rozwiń sekcję ${s.name}` : `Zwiń sekcję ${s.name}`}>
                  <IconRight size={20} />
                </button>
              </div>
              {!isCollapsed && (
                <SortableList
                  items={list}
                  onReorder={reorderTasks}
                  render={(t, handle, dragging) => (
                    <TaskItem task={t} color={s.color} handle={handle} dragging={dragging} onToggle={onToggle} onEdit={(task) => setEditor({ task, date, sectionId: task.sectionId })} />
                  )}
                />
              )}
            </section>
          );
        })}

        {total - done > 0 && (
          <button className="btn btn-secondary btn-block move-btn" onClick={moveUndone}>
            Przenieś niezrobione na jutro <IconArrowNext size={18} />
          </button>
        )}
      </div>

      <button className="fab" onClick={() => setEditor({ date, sectionId: '' })} aria-label="Dodaj pojedyncze zadanie">
        <IconPlus size={30} />
      </button>

      <TaskEditor target={editor} sections={sections} onClose={() => setEditor(null)} />
      <PlanPreview
        items={preview}
        date={date}
        sections={sections}
        onClose={() => setPreview(null)}
        onSaved={() => {
          setPreview(null);
          setDump('');
        }}
      />

      {celebrate && (
        <div className="celebrate" onClick={() => setCelebrate(false)}>
          <div className="celebrate-card" onClick={(e) => e.stopPropagation()}>
            <Mascot mood="party" size={130} />
            <h2>Dzień ukończony!</h2>
            <p>Wszystkie zadania odhaczone. Jesteś niesamowity! 💪</p>
            <div className="celebrate-xp">+{done * XP_PER_TASK + XP_PERFECT_DAY} XP</div>
            <button className="btn btn-primary btn-block btn-lg" onClick={() => setCelebrate(false)}>Super!</button>
          </div>
        </div>
      )}
    </div>
  );
}
