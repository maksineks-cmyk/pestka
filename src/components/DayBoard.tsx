// Zadania dnia: oś czasu „Plan dnia” + sekcje. Kafelki można przeciągać (przytrzymaj i przesuń):
// - w obrębie sekcji → zmiana kolejności,
// - do innej sekcji → przeniesienie (Pestka uczy się z tego przy następnych wpisach),
// - na „Plan dnia” → wybór godziny.
// Podczas przeciągania na dole pojawia się pasek z sekcjami (i „Ustaw godzinę” / „Bez godziny”),
// więc lista pod palcem nic się nie przesuwa.
//
// Płynność:
// - po upuszczeniu kolejność zmienia się od razu (stan „optymistyczny”), zanim zapisze się baza,
// - wszystkie zmiany miejsca kafelków są animowane (technika FLIP), także zjeżdżanie zrobionych zadań,
// - odhaczenie widać natychmiast.
import { useEffect, useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
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
import { moveTaskToSection, reorderDay, reorderTasks, setTaskTime, setTimes } from '../db';
import { withUndo } from '../undo';

const PLAN = 'plan';
/** Zadania bez godziny w widoku „Godziny”. */
const ANYTIME = 'anytime';

export type DayView = 'time' | 'sections';
const ZONE = 'zone:';
const DOCK = 'dock:';
const isZoneId = (id: string | number) => String(id).startsWith(ZONE) || String(id).startsWith(DOCK);

/** Blokuje ruch w poziomie — kafelki przesuwają się tylko w górę i w dół. */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

/** Ostatnie położenie palca/kursora na ekranie (współrzędne okna). */
const pointer = { x: -1, y: -1 };
const trackPointer = (e: PointerEvent | TouchEvent) => {
  const p = 'touches' in e ? e.touches[0] : e;
  if (p) {
    pointer.x = p.clientX;
    pointer.y = p.clientY;
  }
};

/**
 * Najpierw pasek na dole (sprawdzany bezpośrednio na ekranie — jest „przyklejony”, więc
 * zwykłe pomiary dnd-kit po przewinięciu strony by się myliły), potem kafelek pod palcem,
 * potem sekcja pod palcem, a w ostateczności najbliższy element.
 */
const collide: CollisionDetection = (args) => {
  for (const el of document.querySelectorAll<HTMLElement>('[data-dock]')) {
    const r = el.getBoundingClientRect();
    if (pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom) {
      return [{ id: DOCK + el.dataset.dock }];
    }
  }
  const within = pointerWithin(args).filter((c) => !String(c.id).startsWith(DOCK));
  const tasks = within.filter((c) => !isZoneId(c.id));
  if (tasks.length) return tasks;
  if (within.length) return within;
  return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => !String(c.id).startsWith(DOCK)) });
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

function DockTarget({ id, label, emoji, color }: { id: string; label: string; emoji: string; color?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: DOCK + id });
  return (
    <div ref={setNodeRef} data-dock={id} className={`dock-target ${isOver ? 'is-over' : ''}`} style={{ ['--sec' as string]: color ?? 'var(--blue)' }}>
      <span className="dock-emoji">{emoji}</span>
      <span className="dock-label">{label}</span>
    </div>
  );
}

type Pos = { top: number; left: number };

/**
 * Animacje FLIP: po każdej zmianie mierzymy położenie kafelków ([data-flip]) i płynnie
 * przesuwamy je z poprzedniego miejsca na nowe.
 */
function useFlip(dragging: boolean) {
  const prev = useRef(new Map<string, Pos>());
  const from = useRef<Map<string, Pos> | null>(null);
  const wasDragging = useRef(false);
  const measure = () => {
    const m = new Map<string, Pos>();
    document.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => {
      const r = el.getBoundingClientRect();
      m.set(el.dataset.flip!, { top: r.top + window.scrollY, left: r.left + window.scrollX });
    });
    return m;
  };
  useLayoutEffect(() => {
    const start = from.current ?? (dragging || wasDragging.current ? null : prev.current);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const now = new Map<string, Pos>();
    document.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => {
      const id = el.dataset.flip!;
      const r = el.getBoundingClientRect();
      const pos = { top: r.top + window.scrollY, left: r.left + window.scrollX };
      now.set(id, pos);
      const p = start?.get(id);
      if (reduce) return;
      // Nowy kafelek (np. po „Dodaj wszystko”) wskakuje z delikatnym „pop”.
      if (!p && !prev.current.has(id) && prev.current.size) {
        el.animate([{ opacity: 0, transform: 'scale(0.9)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.3)' });
        return;
      }
      if (!p) return;
      const dy = p.top - pos.top;
      const dx = p.left - pos.left;
      if (Math.abs(dy) < 1 && Math.abs(dx) < 1) return;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(0.2, 0.9, 0.25, 1)' });
    });
    prev.current = now;
    from.current = null;
    wasDragging.current = dragging;
  });
  /** Zapamiętuje obecne położenie (np. w chwili upuszczenia) jako punkt startu animacji. */
  const capture = (override?: [string, Pos]) => {
    const m = measure();
    if (override) m.set(override[0], override[1]);
    from.current = m;
  };
  return capture;
}

function DragRow({ id, className, style, children }: { id: string; className?: string; style?: React.CSSProperties; children: (dragging: boolean) => ReactNode }) {
  // Bez wbudowanej animacji dnd-kit po upuszczeniu — tym zajmuje się FLIP.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, animateLayoutChanges: () => false });
  // Bez klawiatury: Enter/spacja na przyciskach w kafelku nie może uruchamiać przeciągania.
  const { tabIndex: _t, role: _r, ...attrs } = attributes;
  return (
    <div
      ref={setNodeRef}
      {...(attrs as HTMLAttributes<HTMLDivElement>)}
      {...listeners}
      className={`sortable-row ${isDragging ? 'is-placeholder' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      {/* Wewnętrzna warstwa: układ wiersza + animacje FLIP (zewnętrzną przesuwa dnd-kit). */}
      <div className={`flip ${className ?? ''}`} style={style} data-flip={id}>
        {children(isDragging)}
      </div>
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
  onToggle: (t: Task) => void | Promise<void>;
  onEdit: (t: Task) => void;
  onBell: (t: Task) => void;
  onTime: (t: Task) => void;
  onAdd: (sectionId: string) => void;
}

export function DayBoard({ view, tasks: dbTasks, sections, isToday, nowMin, collapsed, sinkDelay, onToggleCollapsed, onToggle, onEdit, onBell, onTime, onAdd }: Props) {
  const [active, setActive] = useState<Task | null>(null);
  const [overZone, setOverZone] = useState<string | null>(null);
  const [overDock, setOverDock] = useState(false);
  const capture = useFlip(!!active);

  // Stan „optymistyczny”: zmiany widać od razu, a baza zapisuje się w tle.
  const [pending, setPending] = useState<Map<string, Partial<Task>>>(() => new Map());
  const settled = useRef(true);
  useEffect(() => {
    // Baza odświeżyła dane po zapisie → nasze tymczasowe zmiany nie są już potrzebne.
    if (settled.current && pending.size) setPending(new Map());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbTasks]);
  const tasks = pending.size ? dbTasks.map((t) => (pending.has(t.id) ? { ...t, ...pending.get(t.id) } : t)) : dbTasks;

  /** Pokazuje zmianę od razu i zapisuje ją w tle. */
  const optimistic = async (patches: [string, Partial<Task>][], write: () => Promise<unknown>) => {
    settled.current = false;
    setPending((p) => {
      const next = new Map(p);
      for (const [id, ch] of patches) next.set(id, { ...next.get(id), ...ch });
      return next;
    });
    try {
      await write();
    } finally {
      settled.current = true;
    }
  };

  // Przytrzymanie palcem (0,2 s) zaczyna przeciąganie; zwykłe przewijanie działa jak dawniej.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const toggle = (t: Task) => {
    capture();
    return optimistic([[t.id, { done: !t.done, doneAt: t.done ? undefined : Date.now() }]], async () => onToggle(t));
  };

  const sectionById = new Map(sections.map((s) => [s.id, s]));
  const sectionOf = (t: Task) => sectionById.get(t.sectionId) ?? sections[0];
  const byId = new Map(tasks.map((t) => [t.id, t]));

  // Zrobione zadania zjeżdżają na dół (z małym opóźnieniem, żeby było widać odhaczenie).
  const now = Date.now();
  const sunk = (t: Task) => (t.done && now - (t.doneAt ?? 0) > sinkDelay ? 1 : 0);

  const timed = tasks.filter((t) => t.time).sort((a, b) => a.time!.localeCompare(b.time!) || (a.dayOrder ?? a.order) - (b.dayOrder ?? b.order));
  const untimed = tasks.filter((t) => !t.time);
  // Widok „Godziny”: zadania bez godziny w jednej grupie „Kiedykolwiek”, w kolejności sekcji.
  const sectionRank = new Map(sections.map((s, i) => [s.id, i]));
  // Kolejność ustawiona przeciąganiem (dayOrder) ma pierwszeństwo; nowe zadania lądują na końcu, pogrupowane wg sekcji.
  const anyKey = (t: Task) => t.dayOrder ?? 100_000 + (sectionRank.get(sectionOf(t)?.id ?? '') ?? 0) * 1000 + t.order;
  const anytime = [...untimed].sort((a, b) => sunk(a) - sunk(b) || anyKey(a) - anyKey(b));
  const listOf = (sid: string) => untimed.filter((t) => sectionOf(t)?.id === sid).sort((a, b) => sunk(a) - sunk(b) || a.order - b.order);

  const zoneOf = (id: string | number | undefined): string | null => {
    if (id === undefined) return null;
    const s = String(id);
    if (s.startsWith(ZONE)) return s.slice(ZONE.length);
    if (s.startsWith(DOCK)) return s.slice(DOCK.length);
    const t = byId.get(s);
    if (!t) return null;
    return t.time ? PLAN : view === 'time' ? ANYTIME : (sectionOf(t)?.id ?? null);
  };

  useEffect(() => {
    window.addEventListener('pointermove', trackPointer, { passive: true });
    window.addEventListener('touchmove', trackPointer, { passive: true });
    window.addEventListener('touchstart', trackPointer, { passive: true });
    return () => {
      window.removeEventListener('pointermove', trackPointer);
      window.removeEventListener('touchmove', trackPointer);
      window.removeEventListener('touchstart', trackPointer);
    };
  }, []);

  const onDragStart = (e: DragStartEvent) => {
    setActive(byId.get(String(e.active.id)) ?? null);
    haptic();
  };
  const onDragOver = (e: DragOverEvent) => {
    setOverZone(zoneOf(e.over?.id));
    setOverDock(!!e.over && String(e.over.id).startsWith(DOCK));
  };
  const reset = () => {
    setActive(null);
    setOverZone(null);
    setOverDock(false);
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const t = byId.get(String(e.active.id));
    const target = zoneOf(e.over?.id);
    const fromDock = !!e.over && String(e.over.id).startsWith(DOCK);
    // Punkt startu animacji: aktualne miejsca kafelków + kafelek „w palcach” tam, gdzie go puszczono.
    const r = e.active.rect.current.translated;
    capture(r ? [String(e.active.id), { top: r.top + window.scrollY, left: r.left + window.scrollX }] : undefined);
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
      // dayOrder rozstrzyga kolejność zadań o tej samej godzinie.
      haptic();
      await optimistic(
        [...order.map((id, k): [string, Partial<Task>] => [id, { dayOrder: k }]), ...updates.map((u): [string, Partial<Task>] => [u.id, { time: u.time, endTime: u.endTime, timeApprox: u.timeApprox }])],
        () =>
          withUndo(moved ? `🕒 ${t.title} → ${moved.time}` : 'Zmieniono kolejność', ids, async () => {
            await setTimes(updates);
            await reorderDay(order);
          }),
      );
      return;
    }
    if (target === ANYTIME) {
      if (from === PLAN) {
        // Zadanie wyciągnięte z osi czasu → bez godziny, w miejscu upuszczenia.
        const ids = anytime.map((x) => x.id);
        const overIdx = ids.indexOf(String(e.over?.id));
        ids.splice(overIdx >= 0 ? overIdx : ids.length, 0, t.id);
        haptic();
        await optimistic(
          [[t.id, { time: undefined, endTime: undefined, timeApprox: undefined }], ...ids.map((id, k): [string, Partial<Task>] => [id, { dayOrder: k }])],
          () =>
            withUndo('Usunięto godzinę', ids, async () => {
              await setTaskTime(t.id, undefined);
              await reorderDay(ids);
            }),
        );
        return;
      }
      const ids = anytime.map((x) => x.id);
      const a = ids.indexOf(t.id);
      const b = ids.indexOf(String(e.over?.id));
      if (a >= 0 && b >= 0 && a !== b) {
        const order = arrayMove(ids, a, b);
        haptic();
        await optimistic(order.map((id, k) => [id, { dayOrder: k }]), () => withUndo('Zmieniono kolejność', ids, () => reorderDay(order)));
      }
      return;
    }
    if (target === from) {
      // Zmiana kolejności w tej samej sekcji.
      const ids = listOf(target).map((x) => x.id);
      const a = ids.indexOf(t.id);
      const b = ids.indexOf(String(e.over?.id));
      if (a >= 0 && b >= 0 && a !== b) {
        const order = arrayMove(ids, a, b);
        haptic();
        await optimistic(order.map((id, k) => [id, { order: k }]), () => withUndo('Zmieniono kolejność', ids, () => reorderTasks(order)));
      }
      return;
    }
    if (target === t.sectionId) return; // już jest w tej sekcji

    // Przeniesienie do innej sekcji — w miejsce kafelka, nad którym upuszczono (albo na koniec).
    // Z paska na dole albo w widoku „Godziny” zmienia się tylko sekcja (zadanie zostaje na swoim miejscu listy).
    const keepPlace = !!t.time || fromDock || view === 'time';
    const ids = listOf(target).map((x) => x.id);
    const overIdx = ids.indexOf(String(e.over?.id));
    if (!keepPlace) ids.splice(overIdx >= 0 ? overIdx : ids.length, 0, t.id);
    else ids.push(t.id);
    const s = sectionById.get(target);
    haptic();
    await optimistic(
      [[t.id, { sectionId: target }], ...ids.map((id, k): [string, Partial<Task>] => [id, { order: k }])],
      () => withUndo(s ? `Przeniesiono do ${s.emoji} ${s.name}` : 'Przeniesiono', ids, () => moveTaskToSection(t.id, target, ids)),
    );
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
    <DndContext
      sensors={sensors}
      collisionDetection={collide}
      modifiers={[verticalOnly]}
            autoScroll={{ enabled: !overDock, threshold: { x: 0, y: 0.2 } }}
      onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={reset}>
      {timed.length > 0 && (
        <Zone id={PLAN} className={`section plan ${dragging ? 'is-drop-target' : ''} ${overZone === PLAN ? 'is-over' : ''}`} style={{ ['--sec' as string]: 'var(--blue)' }}>
          <div className="section-head">
            <span className="section-emoji">🗓️</span>
            <h2>Plan dnia</h2>
            {timed.length > 0 && <span className="section-count">{timedDone}/{timed.length}</span>}
          </div>
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
                            <TaskItem task={t} color={s?.color ?? '#ce82ff'} big dragging={isDragging} onToggle={toggle} onEdit={onEdit} onBell={onBell} />
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

      {view === 'time' && anytime.length > 0 && (
        <Zone id={ANYTIME} className={`section plan anytime ${dragging ? 'is-drop-target' : ''} ${overZone === ANYTIME ? 'is-over' : ''}`} style={{ ['--sec' as string]: 'var(--purple)' }}>
          <div className="section-head">
            <span className="section-emoji">🌈</span>
            <h2>Kiedykolwiek</h2>
            {anytime.length > 0 && <span className="section-count">{anytime.filter((t) => t.done).length}/{anytime.length}</span>}
          </div>
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
                            <TaskItem task={t} color={s?.color ?? '#ce82ff'} big dragging={isDragging} onToggle={toggle} onEdit={onEdit} />
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
        if (!list.length) return null; // puste sekcje ukrywamy (do nich upuszczasz na pasku na dole)
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
            {!isCollapsed && list.length > 0 && (
              <SortableContext items={list.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                {list.map((t) => (
                  <DragRow key={t.id} id={t.id}>
                    {(isDragging) => <TaskItem task={t} color={s.color} handle={{}} dragging={isDragging} onToggle={toggle} onEdit={onEdit} onTime={onTime} />}
                  </DragRow>
                ))}
              </SortableContext>
            )}
          </Zone>
        );
      })}
      {/* Kafelek „w palcach” — wygląda tak samo jak wiersz, z którego go podniesiono. */}
      <DragOverlay modifiers={[verticalOnly]} dropAnimation={null}>
        {active ? (
          active.time || view === 'time' ? (
            <div className={`drag-overlay tl-row ${overDock ? 'is-over-dock' : ''}`} style={{ ['--sec' as string]: sectionOf(active)?.color }}>
              <div className="tl-time">{active.time ? <b>{active.timeApprox ? '~' : ''}{active.time}</b> : <IconClock size={20} />}</div>
              <div className="tl-dot" aria-hidden="true">{sectionOf(active)?.emoji}</div>
              <div className="tl-task">
                <TaskItem task={active} color={sectionOf(active)?.color ?? '#ce82ff'} big dragging onToggle={() => {}} onEdit={() => {}} />
              </div>
            </div>
          ) : (
            <div className={`drag-overlay ${overDock ? 'is-over-dock' : ''}`}>
              <TaskItem task={active} color={sectionOf(active)?.color ?? '#ce82ff'} handle={{}} dragging onToggle={() => {}} onEdit={() => {}} />
            </div>
          )
        ) : null}
      </DragOverlay>

      {/* Pasek na dole podczas przeciągania: przenieś do sekcji / ustaw godzinę / usuń godzinę. */}
      {active && (
        <div className="drag-dock" role="group" aria-label="Upuść, aby przenieść">
          <div className="drag-dock-grid">
            {!active.time && <DockTarget id={PLAN} emoji="🕒" label="Ustaw godzinę" />}
            {active.time && view === 'time' && <DockTarget id={ANYTIME} emoji="🌈" label="Bez godziny" color="var(--purple)" />}
            {sections
              .filter((s) => s.id !== active.sectionId)
              .map((s) => (
                <DockTarget key={s.id} id={s.id} emoji={s.emoji} label={s.name} color={s.color} />
              ))}
          </div>
        </div>
      )}
    </DndContext>
  );
}
