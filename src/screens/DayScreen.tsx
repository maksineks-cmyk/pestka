// Widok dnia: pasek postępu, zadania pogrupowane w sekcje, dodawanie, odhaczanie,
// przeciąganie oraz "Przenieś niezrobione na jutro".
import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ensureSeriesForRange, moveUnfinishedToTomorrow, reorderTasks, toggleTask } from '../db';
import { addDays, formatLong, friendlyDay } from '../lib/dates';
import type { Section, Task } from '../lib/types';
import { useSwipe } from '../hooks';
import { SortableList } from '../components/SortableList';
import { TaskItem } from '../components/TaskItem';
import { TaskEditor, type EditorTarget } from '../components/TaskEditor';
import { Mascot, moodFor } from '../components/Mascot';
import { IconArrowNext, IconLeft, IconPlus, IconRight } from '../components/Icons';
import { confirmBox, toast } from '../components/Dialogs';
import { fireConfetti } from '../components/confetti';
import { haptic } from '../lib/haptics';
import { XP_PER_TASK, XP_PERFECT_DAY } from '../lib/stats';

interface Props {
  date: string;
  today: string;
  sections: Section[];
  onChangeDate: (d: string) => void;
  onBack?: () => void;
}

const EMPTY: Task[] = [];

export function DayScreen({ date, today, sections, onChangeDate, onBack }: Props) {
  const tasks = useLiveQuery(() => db.tasks.where('date').equals(date).toArray(), [date], EMPTY);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [dir, setDir] = useState<'next' | 'prev' | 'none'>('none');

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
  };

  const moveUndone = async () => {
    const n = total - done;
    const ok = await confirmBox('Przenieść na jutro?', `${n} ${n === 1 ? 'niezrobione zadanie trafi' : 'niezrobionych zadań trafi'} na ${friendlyDay(addDays(date, 1)).toLowerCase()}.`, 'Przenieś');
    if (!ok) return;
    const moved = await moveUnfinishedToTomorrow(date);
    toast(`Przeniesiono: ${moved} ➡️`);
  };

  const sectionIds = new Set(sections.map((s) => s.id));
  // Zadania z nieistniejącej sekcji (np. po imporcie) pokazujemy w pierwszej sekcji.
  const tasksIn = (s: Section, idx: number) =>
    tasks.filter((t) => t.sectionId === s.id || (idx === 0 && !sectionIds.has(t.sectionId))).sort((a, b) => a.order - b.order);

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
            <p>Stuknij zielony plus, aby dodać pierwsze!</p>
          </div>
        )}

        {sections.map((s, idx) => {
          const list = tasksIn(s, idx);
          return (
            <section key={s.id} className="section" style={{ ['--sec' as string]: s.color }}>
              <div className="section-head">
                <span className="section-emoji">{s.emoji}</span>
                <h2>{s.name}</h2>
                {list.length > 0 && <span className="section-count">{list.filter((t) => t.done).length}/{list.length}</span>}
                <button className="section-add" onClick={() => setEditor({ date, sectionId: s.id })} aria-label={`Dodaj zadanie do sekcji ${s.name}`}>
                  <IconPlus size={18} />
                </button>
              </div>
              {list.length > 0 ? (
                <SortableList
                  items={list}
                  onReorder={reorderTasks}
                  render={(t, handle, dragging) => (
                    <TaskItem task={t} color={s.color} handle={handle} dragging={dragging} onToggle={onToggle} onEdit={(task) => setEditor({ task, date, sectionId: task.sectionId })} />
                  )}
                />
              ) : (
                <button className="add-row" onClick={() => setEditor({ date, sectionId: s.id })}>+ Dodaj zadanie</button>
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

      <button className="fab" onClick={() => setEditor({ date, sectionId: sections[0]?.id ?? '' })} aria-label="Dodaj zadanie">
        <IconPlus size={30} />
      </button>

      <TaskEditor target={editor} sections={sections} onClose={() => setEditor(null)} />

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
