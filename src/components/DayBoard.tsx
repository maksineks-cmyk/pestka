// Zadania dnia: oś czasu „Plan dnia” + sekcje. Kafelki można przeciągać (przytrzymaj i przesuń):
// - w obrębie sekcji → zmiana kolejności,
// - do innej sekcji → przeniesienie (Pestka uczy się z tego przy następnych wpisach),
// - na „Plan dnia” → wybór godziny.
// Podczas przeciągania widać też puste sekcje, żeby można było do nich upuścić zadanie.
import { useState, type HTMLAttributes, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Modifier,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Section, Task } from '../lib/types';
import { TaskItem } from './TaskItem';
import { IconClock, IconPlus, IconRight } from './Icons';
import { haptic } from '../lib/haptics';
import { moveTaskToSection, reorderTasks, setTaskTime, setTimes } from '../db';
import { withUndo } from '../undo';

const PLAN = 'plan';
/** Zadania bez godziny w widoku „Godziny”. */
const ANYTIME = 'anytime';

export type DayView = 'time' | 'sections';
const ZONE = 'zone:';

/** Blokuje ruch w poziomie — kafelki przesuwają się tylko w górę i w dół. */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

/** Najpierw kafelek pod palcem, potem sekcja pod palcem, a w ostateczności najbliższy element. */
const collide: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  const tasks = within.filter((c) => !String(c.id).startsWith(ZONE));
  if (tasks.length) return tasks;
  if (within.length) return within;
  return closestCenter(args);
};

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const fmtMin = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

function Zone({ id, className, style, children }: { id: string; className: string; style?: React.CSSProperties; children: ReactNode }) {
  const { setNodeRef } = useDroppable({ id: ZONE + id });
  return (
    <section ref={setNodeRef} className={className} style={style}>
      {children}
    </section>
  );
}

function DragRow({ id, className, style, children }: { id: string; className?: string; style?: React.CSSProperties; children: (dragging: boolean) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  // Bez klawiatury: Enter/spacja na przyciskach w kafelku nie może uruchamiać przeciągania.
  const { tabIndex: _t, role: _r, ...attrs } = attributes;
  return (
    <div
      ref={setNodeRef}
      {...(attrs as HTMLAttributes<HTMLDivElement>)}
      {...listeners}
      className={`sortable-row ${className ?? ''} ${isDragging ? 'is-placeholder' : ''}`}
      style={{ ...style, transform: CSS.Translate.toString(transform), transition }}
    >
      {children(isDragging)}
    </div>
  );
}

interface Props {
  /** „time” = jedna lista według godzin, „sections” = podział na sekcje. */
  view: DayView;
  tasks: Task[];
  sections: Section[];
  isToday: boolean;
  nowMin: number;
  collapsed: string[];
  sinkDelay: number;
  onToggleCollapsed: (id: string) => void;
  onToggle: (t: Task) => void;
  onEdit: (t: Task) => void;
  onBell: (t: Task) => void;
  onTime: (t: Task) => void;
  onAdd: (sectionId: string) => void;
}

export function DayBoard({ view, tasks, sections, isToday, nowMin, collapsed, sinkDelay, onToggleCollapsed, onToggle, onEdit, onBell, onTime, onAdd }: Props) {
  const [active, setActive] = useState<Task | null>(null);
  const [overZone, setOverZone] = useState<string | null>(null);

  // Przytrzymanie palcem (0,25 s) zaczyna przeciąganie; zwykłe przewijanie działa jak dawniej.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const sectionById = new Map(sections.map((s) => [s.id, s]));
  const sectionOf = (t: Task) => sectionById.get(t.sectionId) ?? sections[0];
  const byId = new Map(tasks.map((t) => [t.id, t]));

  // Zrobione zadania zjeżdżają na dół (z małym opóźnieniem, żeby było widać odhaczenie).
  const now = Date.now();
  const sunk = (t: Task) => (t.done && now - (t.doneAt ?? 0) > sinkDelay ? 1 : 0);

  const timed = tasks.filter((t) => t.time).sort((a, b) => a.time!.localeCompare(b.time!) || a.order - b.order);
  const untimed = tasks.filter((t) => !t.time);
  // Widok „Godziny”: zadania bez godziny w jednej grupie „Kiedykolwiek”, w kolejności sekcji.
  const sectionRank = new Map(sections.map((s, i) => [s.id, i]));
  const anytime = [...untimed].sort(
    (a, b) => sunk(a) - sunk(b) || (sectionRank.get(sectionOf(a)?.id ?? '') ?? 0) - (sectionRank.get(sectionOf(b)?.id ?? '') ?? 0) || a.order - b.order,
  );
  const listOf = (sid: string) => untimed.filter((t) => sectionOf(t)?.id === sid).sort((a, b) => sunk(a) - sunk(b) || a.order - b.order);

  const zoneOf = (id: string | number | undefined): string | null => {
    if (id === undefined) return null;
    const s = String(id);
    if (s.startsWith(ZONE)) return s.slice(ZONE.length);
    const t = byId.get(s);
    if (!t) return null;
    return t.time ? PLAN : view === 'time' ? ANYTIME : (sectionOf(t)?.id ?? null);
  };

  const onDragStart = (e: DragStartEvent) => {
    setActive(byId.get(String(e.active.id)) ?? null);
    haptic();
  };
  const onDragOver = (e: DragOverEvent) => setOverZone(zoneOf(e.over?.id));
  const reset = () => {
    setActive(null);
    setOverZone(null);
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const t = byId.get(String(e.active.id));
    const target = zoneOf(e.over?.id);
    reset();
    if (!t || !target) return;
    const from = zoneOf(t.id);

    if (target === PLAN) {
      if (!t.time) {
        onTime(t); // upuszczone na „Plan dnia” → wybierz godzinę
        return;
      }
      // Przestawienie na osi czasu: zadania zamieniają się godzinami, a kolejność godzin zostaje.
      const ids = timed.map((x) => x.id);
      const a = ids.indexOf(t.id);
      const b = ids.indexOf(String(e.over?.id));
      if (a < 0 || b < 0 || a === b) return;
      const order = arrayMove(ids, a, b);
      const updates = order
        .map((id, k) => {
          const task = byId.get(id)!;
          const slot = timed[k];
          if (task.time === slot.time) return null;
          // Czas trwania („15:00–16:30”) jedzie razem z zadaniem.
          const dur = task.endTime ? toMin(task.endTime) - toMin(task.time!) : 0;
          const end = dur > 0 && toMin(slot.time!) + dur < 24 * 60 ? fmtMin(toMin(slot.time!) + dur) : undefined;
          return { id, time: slot.time!, endTime: end, timeApprox: slot.timeApprox };
        })
        .filter(Boolean) as { id: string; time: string; endTime?: string; timeApprox?: boolean }[];
      const moved = updates.find((u) => u.id === t.id);
      await withUndo(moved ? `🕒 ${t.title} → ${moved.time}` : 'Zmieniono kolejność', updates.map((u) => u.id), () => setTimes(updates));
      haptic();
      return;
    }
    if (target === ANYTIME) {
      if (from === PLAN) {
        // Zadanie wyciągnięte z osi czasu → bez godziny.
        await withUndo('Usunięto godzinę', [t.id], () => setTaskTime(t.id, undefined));
        return;
      }
      const ids = anytime.map((x) => x.id);
      const a = ids.indexOf(t.id);
      const b = ids.indexOf(String(e.over?.id));
      if (a >= 0 && b >= 0 && a !== b) {
        await withUndo('Zmieniono kolejność', ids, () => reorderTasks(arrayMove(ids, a, b)));
        haptic();
      }
      return;
    }
    if (target === from) {
      // Zmiana kolejności w tej samej sekcji.
      const ids = listOf(target).map((x) => x.id);
      const a = ids.indexOf(t.id);
      const b = ids.indexOf(String(e.over?.id));
      if (a >= 0 && b >= 0 && a !== b) {
        await withUndo('Zmieniono kolejność', ids, () => reorderTasks(arrayMove(ids, a, b)));
        haptic();
      }
      return;
    }
    if (t.time && target === t.sectionId) return; // zadanie z osi czasu już jest w tej sekcji

    // Przeniesienie do innej sekcji — w miejsce kafelka, nad którym upuszczono (albo na koniec).
    const ids = listOf(target).map((x) => x.id);
    const overIdx = ids.indexOf(String(e.over?.id));
    if (!t.time) ids.splice(overIdx >= 0 ? overIdx : ids.length, 0, t.id);
    const s = sectionById.get(target);
    await withUndo(s ? `Przeniesiono do ${s.emoji} ${s.name}` : 'Przeniesiono', [...ids, t.id], () => moveTaskToSection(t.id, target, t.time ? undefined : ids));
    haptic();
  };

  const dragging = !!active;
  const timedDone = timed.filter((t) => t.done).length;
  const nowIndex = isToday ? timed.findIndex((t) => toMin(t.time!) > nowMin) : -1;
  const nowAt = nowIndex === -1 ? timed.length : nowIndex;
  const nowLine = (
    <div className="tl-now" key="now" aria-label={`Teraz ${fmtMin(nowMin)}`}>
      <span className="tl-now-label">teraz {fmtMin(nowMin)}</span>
    </div>
  );

  return (
    <DndContext sensors={sensors} collisionDetection={collide} modifiers={[verticalOnly]} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={reset}>
      {(timed.length > 0 || dragging) && (
        <Zone id={PLAN} className={`section plan ${dragging ? 'is-drop-target' : ''} ${overZone === PLAN ? 'is-over' : ''}`} style={{ ['--sec' as string]: 'var(--blue)' }}>
          <div className="section-head">
            <span className="section-emoji">🗓️</span>
            <h2>Plan dnia</h2>
            {timed.length > 0 && <span className="section-count">{timedDone}/{timed.length}</span>}
          </div>
          {timed.length === 0 && <div className="drop-hint">Upuść tutaj, aby ustawić godzinę 🕒</div>}
          {timed.length > 0 && (
            <SortableContext items={timed.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className="timeline">
                {timed.map((t, i) => {
                  const s = sectionOf(t);
                  return [
                    isToday && i === nowAt ? nowLine : null,
                    <DragRow
                      key={t.id}
                      id={t.id}
                      className={`tl-row ${t.done ? 'is-done' : ''} ${isToday && toMin(t.time!) <= nowMin && !t.done ? 'is-past' : ''}`}
                      style={{ ['--sec' as string]: s?.color }}
                    >
                      {(isDragging) => (
                        <>
                          <button className="tl-time" onClick={() => onTime(t)} aria-label={`Godzina ${t.time} — zmień`}>
                            <b>{t.timeApprox ? '~' : ''}{t.time}</b>
                            {t.endTime && <small>{t.endTime}</small>}
                          </button>
                          <div className="tl-dot" aria-hidden="true">{s?.emoji}</div>
                          <div className="tl-task">
                            <TaskItem task={t} color={s?.color ?? '#ce82ff'} big dragging={isDragging} onToggle={onToggle} onEdit={onEdit} onBell={onBell} />
                          </div>
                        </>
                      )}
                    </DragRow>,
                  ];
                })}
                {isToday && nowAt === timed.length && nowLine}
              </div>
            </SortableContext>
          )}
        </Zone>
      )}

      {view === 'time' && (anytime.length > 0 || dragging) && (
        <Zone id={ANYTIME} className={`section plan anytime ${dragging ? 'is-drop-target' : ''} ${overZone === ANYTIME ? 'is-over' : ''}`} style={{ ['--sec' as string]: 'var(--purple)' }}>
          <div className="section-head">
            <span className="section-emoji">🌈</span>
            <h2>Kiedykolwiek</h2>
            {anytime.length > 0 && <span className="section-count">{anytime.filter((t) => t.done).length}/{anytime.length}</span>}
          </div>
          {anytime.length === 0 && <div className="drop-hint">Upuść tutaj, aby usunąć godzinę</div>}
          {anytime.length > 0 && (
            <SortableContext items={anytime.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className="timeline">
                {anytime.map((t) => {
                  const s = sectionOf(t);
                  return (
                    <DragRow key={t.id} id={t.id} className={`tl-row ${t.done ? 'is-done' : ''}`} style={{ ['--sec' as string]: s?.color }}>
                      {(isDragging) => (
                        <>
                          <button className="tl-time tl-time-empty" onClick={() => onTime(t)} aria-label="Ustaw godzinę" disabled={t.done}>
                            <IconClock size={20} />
                          </button>
                          <div className="tl-dot" aria-hidden="true">{s?.emoji}</div>
                          <div className="tl-task">
                            <TaskItem task={t} color={s?.color ?? '#ce82ff'} big dragging={isDragging} onToggle={onToggle} onEdit={onEdit} />
                          </div>
                        </>
                      )}
                    </DragRow>
                  );
                })}
              </div>
            </SortableContext>
          )}
        </Zone>
      )}

      {view === 'sections' && sections.map((s) => {
        const list = listOf(s.id);
        if (!list.length && !dragging) return null; // puste sekcje ukrywamy (poza przeciąganiem)
        const isCollapsed = collapsed.includes(s.id);
        const doneCount = list.filter((t) => t.done).length;
        return (
          <Zone
            key={s.id}
            id={s.id}
            className={`section ${isCollapsed ? 'is-collapsed' : ''} ${dragging ? 'is-drop-target' : ''} ${overZone === s.id ? 'is-over' : ''}`}
            style={{ ['--sec' as string]: s.color }}
          >
            <div className="section-head">
              <button className="section-toggle" onClick={() => onToggleCollapsed(s.id)} aria-expanded={!isCollapsed}>
                <span className="section-emoji">{s.emoji}</span>
                <h2>{s.name}</h2>
                {list.length > 0 && <span className="section-count">{doneCount}/{list.length}</span>}
              </button>
              <button className="section-add" onClick={() => onAdd(s.id)} aria-label={`Dodaj zadanie do sekcji ${s.name}`}>
                <IconPlus size={16} />
              </button>
              <button className="section-chevron" onClick={() => onToggleCollapsed(s.id)} aria-label={isCollapsed ? `Rozwiń sekcję ${s.name}` : `Zwiń sekcję ${s.name}`}>
                <IconRight size={20} />
              </button>
            </div>
            {!list.length && <div className="drop-hint">Upuść tutaj</div>}
            {!isCollapsed && list.length > 0 && (
              <SortableContext items={list.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                {list.map((t) => (
                  <DragRow key={t.id} id={t.id}>
                    {(isDragging) => <TaskItem task={t} color={s.color} handle={{}} dragging={isDragging} onToggle={onToggle} onEdit={onEdit} onTime={onTime} />}
                  </DragRow>
                ))}
              </SortableContext>
            )}
          </Zone>
        );
      })}
      {/* Kafelek „w palcach” — leci nad wszystkimi sekcjami. */}
      <DragOverlay modifiers={[verticalOnly]}>
        {active ? (
          <div className="drag-overlay">
            <TaskItem task={active} color={sectionOf(active)?.color ?? '#ce82ff'} handle={{}} dragging onToggle={() => {}} onEdit={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
