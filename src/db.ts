// Lokalna baza danych (IndexedDB przez Dexie) oraz wszystkie operacje na danych.
// Nic nie jest wysyłane do internetu — dane zostają na telefonie.
import Dexie, { type EntityTable } from 'dexie';
import type { BackupFile, Recurrence, Reminder, Section, Series, Task } from './lib/types';
import { addDays, rangeKeys } from './lib/dates';
import { occursOn } from './lib/recurrence';

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);

/** Paleta kolorów do wyboru dla sekcji. */
export const SECTION_COLORS = ['#58cc02', '#1cb0f6', '#ff9600', '#ff4b4b', '#ce82ff', '#ffc800', '#00cd9c', '#ff86d0', '#8e6cef', '#a0785a'];

const defaultSections = (): Section[] => [
  { id: uid(), name: 'Praca', emoji: '💼', color: '#1cb0f6', order: 0 },
  { id: uid(), name: 'Dom', emoji: '🏠', color: '#ff9600', order: 1 },
  { id: uid(), name: 'Zdrowie', emoji: '💪', color: '#ff4b4b', order: 2 },
  { id: uid(), name: 'Inne', emoji: '✨', color: '#ce82ff', order: 3 },
];

class PlannerDB extends Dexie {
  tasks!: EntityTable<Task, 'id'>;
  sections!: EntityTable<Section, 'id'>;
  series!: EntityTable<Series, 'id'>;

  constructor() {
    super('pestka-planer');
    this.version(1).stores({
      tasks: 'id, date, sectionId, seriesId, [seriesId+seriesDate]',
      sections: 'id, order',
      series: 'id',
    });
    // Przy pierwszym uruchomieniu tworzymy domyślne sekcje.
    this.on('populate', (tx) => {
      tx.table('sections').bulkAdd(defaultSections());
    });
  }
}

export const db = new PlannerDB();

// ---------------------------------------------------------------------------
// Zadania
// ---------------------------------------------------------------------------

export interface TaskInput {
  title: string;
  note?: string;
  date: string;
  sectionId: string;
  reminder?: Reminder;
  recurrence?: Recurrence; // undefined = bez powtarzania
}

/** Kolejny numer porządkowy na końcu listy w danej sekcji i dniu. */
async function nextOrder(date: string, sectionId: string) {
  const list = await db.tasks.where('date').equals(date).filter((t) => t.sectionId === sectionId).toArray();
  return list.reduce((m, t) => Math.max(m, t.order + 1), 0);
}

function seriesFrom(input: TaskInput, recurrence: Recurrence): Series {
  return {
    id: uid(),
    title: input.title,
    note: input.note,
    sectionId: input.sectionId,
    recurrence,
    startDate: input.date,
    excluded: [],
    reminderTime: input.reminder?.time,
    reminderAlert: input.reminder?.alert,
  };
}

export async function addTask(input: TaskInput): Promise<Task> {
  return db.transaction('rw', db.tasks, db.series, async () => {
    let seriesId: string | undefined;
    if (input.recurrence) {
      const s = seriesFrom(input, input.recurrence);
      await db.series.add(s);
      seriesId = s.id;
    }
    const task: Task = {
      id: uid(),
      title: input.title,
      note: input.note,
      date: input.date,
      sectionId: input.sectionId,
      reminder: input.reminder,
      done: false,
      order: await nextOrder(input.date, input.sectionId),
      createdAt: Date.now(),
      seriesId,
      seriesDate: seriesId ? input.date : undefined,
    };
    await db.tasks.add(task);
    return task;
  });
}

/** Kończy serię przed podanym dniem i usuwa jej przyszłe, niezrobione wystąpienia. */
async function endSeriesBefore(seriesId: string, date: string, keepTaskId?: string) {
  const s = await db.series.get(seriesId);
  if (!s) return;
  const endDate = addDays(date, -1);
  const future = await db.tasks.where('seriesId').equals(seriesId).filter((t) => (t.seriesDate ?? t.date) >= date && !t.done && t.id !== keepTaskId).toArray();
  await db.tasks.bulkDelete(future.map((t) => t.id));
  if (endDate < s.startDate) {
    // Seria nie ma już żadnych dni — odpinamy wszystkie zadania i usuwamy szablon.
    await db.tasks.where('seriesId').equals(seriesId).modify({ seriesId: undefined, seriesDate: undefined });
    await db.series.delete(seriesId);
  } else {
    await db.series.update(seriesId, { endDate });
  }
}

/**
 * Zapisuje zmiany w zadaniu. Jeśli zadanie należy do serii, zmiany treści
 * obejmują także przyszłe (niezrobione) powtórzenia.
 */
export async function updateTask(task: Task, input: TaskInput) {
  await db.transaction('rw', db.tasks, db.series, async () => {
    const recurrenceChanged = JSON.stringify((await currentRecurrence(task)) ?? null) !== JSON.stringify(input.recurrence ?? null);
    const sectionChanged = task.sectionId !== input.sectionId;
    const base: Partial<Task> = {
      title: input.title,
      note: input.note,
      date: input.date,
      sectionId: input.sectionId,
      reminder: input.reminder,
      order: sectionChanged || task.date !== input.date ? await nextOrder(input.date, input.sectionId) : task.order,
    };

    if (task.seriesId && !recurrenceChanged) {
      // Ta sama reguła → aktualizujemy szablon i przyszłe wystąpienia.
      const from = task.seriesDate ?? task.date;
      await db.series.update(task.seriesId, {
        title: input.title,
        note: input.note,
        sectionId: input.sectionId,
        reminderTime: input.reminder?.time,
        reminderAlert: input.reminder?.alert,
      });
      const others = await db.tasks.where('seriesId').equals(task.seriesId).filter((t) => t.id !== task.id && !t.done && (t.seriesDate ?? t.date) > from).toArray();
      for (const o of others) {
        await db.tasks.update(o.id, {
          title: input.title,
          note: input.note,
          sectionId: input.sectionId,
          reminder: input.reminder ? { ...input.reminder, date: o.date } : undefined,
        });
      }
      await db.tasks.update(task.id, base);
      return;
    }

    if (task.seriesId && recurrenceChanged) {
      // Reguła się zmieniła → stara seria kończy się przed tym dniem.
      await endSeriesBefore(task.seriesId, task.seriesDate ?? task.date, task.id);
      base.seriesId = undefined;
      base.seriesDate = undefined;
    }

    if (input.recurrence && (recurrenceChanged || !task.seriesId)) {
      const s = seriesFrom(input, input.recurrence);
      await db.series.add(s);
      base.seriesId = s.id;
      base.seriesDate = input.date;
    }
    await db.tasks.update(task.id, base);
  });
}

export async function currentRecurrence(task: Task): Promise<Recurrence | undefined> {
  if (!task.seriesId) return undefined;
  return (await db.series.get(task.seriesId))?.recurrence;
}

/** Przełącza "zrobione". Zwraca nowy stan. */
export async function toggleTask(id: string): Promise<boolean> {
  const t = await db.tasks.get(id);
  if (!t) return false;
  const done = !t.done;
  await db.tasks.update(id, { done, doneAt: done ? Date.now() : undefined });
  return done;
}

/** Usuwa zadanie. scope 'series' usuwa też wszystkie kolejne powtórzenia. */
export async function deleteTask(task: Task, scope: 'one' | 'series' = 'one') {
  await db.transaction('rw', db.tasks, db.series, async () => {
    await db.tasks.delete(task.id);
    if (!task.seriesId) return;
    const sd = task.seriesDate ?? task.date;
    if (scope === 'series') {
      await endSeriesBefore(task.seriesId, sd);
    } else {
      const s = await db.series.get(task.seriesId);
      if (s) await db.series.update(s.id, { excluded: [...s.excluded, sd] });
    }
  });
}

/** Zapisuje nową kolejność zadań (po przeciągnięciu). */
export async function reorderTasks(ids: string[]) {
  await db.transaction('rw', db.tasks, async () => {
    await Promise.all(ids.map((id, i) => db.tasks.update(id, { order: i })));
  });
}

/**
 * "Przenieś niezrobione na jutro". Zadania powtarzane, które i tak wystąpią jutro,
 * nie są dublowane — dzisiejsze wystąpienie jest po prostu pomijane.
 */
export async function moveUnfinishedToTomorrow(date: string): Promise<number> {
  const tomorrow = addDays(date, 1);
  await ensureSeriesForRange(tomorrow, tomorrow);
  return db.transaction('rw', db.tasks, db.series, async () => {
    const undone = await db.tasks.where('date').equals(date).filter((t) => !t.done).toArray();
    let moved = 0;
    for (const t of undone) {
      const s = t.seriesId ? await db.series.get(t.seriesId) : undefined;
      if (s && occursOn(s, tomorrow)) {
        await db.tasks.delete(t.id);
        await db.series.update(s.id, { excluded: [...s.excluded, t.seriesDate ?? t.date] });
      } else {
        await db.tasks.update(t.id, {
          date: tomorrow,
          order: (await nextOrder(tomorrow, t.sectionId)) + moved,
          reminder: t.reminder && t.reminder.date === date ? { ...t.reminder, date: tomorrow } : t.reminder,
        });
      }
      moved++;
    }
    return moved;
  });
}

/**
 * Tworzy zadania z serii powtarzanych dla podanego zakresu dni (jeśli jeszcze nie istnieją).
 * Wywoływane przy wyświetlaniu kalendarza i widoku dnia.
 */
export async function ensureSeriesForRange(from: string, to: string) {
  await db.transaction('rw', db.tasks, db.series, async () => {
    const all = await db.series.toArray();
    if (!all.length) return;
    const days = rangeKeys(from, to);
    for (const s of all) {
      for (const day of days) {
        if (!occursOn(s, day)) continue;
        const exists = await db.tasks.where('[seriesId+seriesDate]').equals([s.id, day]).count();
        if (exists) continue;
        await db.tasks.add({
          id: uid(),
          title: s.title,
          note: s.note,
          date: day,
          sectionId: s.sectionId,
          done: false,
          order: await nextOrder(day, s.sectionId),
          createdAt: Date.now(),
          seriesId: s.id,
          seriesDate: day,
          reminder: s.reminderTime ? { date: day, time: s.reminderTime, alert: s.reminderAlert ?? 0 } : undefined,
        });
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Sekcje
// ---------------------------------------------------------------------------

export async function addSection(data: Omit<Section, 'id' | 'order'>) {
  const count = await db.sections.count();
  await db.sections.add({ ...data, id: uid(), order: count });
}

export async function updateSection(id: string, data: Partial<Section>) {
  await db.sections.update(id, data);
}

export async function reorderSections(ids: string[]) {
  await db.transaction('rw', db.sections, async () => {
    await Promise.all(ids.map((id, i) => db.sections.update(id, { order: i })));
  });
}

/** Usuwa sekcję; jej zadania (i serie) trafiają do sekcji `moveTo`. */
export async function deleteSection(id: string, moveTo: string) {
  await db.transaction('rw', db.tasks, db.series, db.sections, async () => {
    await db.tasks.where('sectionId').equals(id).modify({ sectionId: moveTo });
    await db.series.filter((s) => s.sectionId === id).modify({ sectionId: moveTo });
    await db.sections.delete(id);
  });
}

// ---------------------------------------------------------------------------
// Kopia zapasowa
// ---------------------------------------------------------------------------

export async function exportData(): Promise<BackupFile> {
  return {
    app: 'pestka-planer',
    version: 1,
    exportedAt: new Date().toISOString(),
    sections: await db.sections.toArray(),
    tasks: await db.tasks.toArray(),
    series: await db.series.toArray(),
  };
}

/** Sprawdza, czy plik jest poprawną kopią zapasową. Rzuca błąd z polskim opisem. */
export function validateBackup(raw: unknown): BackupFile {
  const data = raw as Partial<BackupFile>;
  if (!data || data.app !== 'pestka-planer' || !Array.isArray(data.tasks) || !Array.isArray(data.sections)) {
    throw new Error('To nie jest plik kopii zapasowej Pestki.');
  }
  if (!data.sections.length) throw new Error('Kopia nie zawiera żadnych sekcji.');
  const okTask = (t: Task) => typeof t.id === 'string' && typeof t.title === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date);
  if (!data.tasks.every(okTask)) throw new Error('Plik zawiera uszkodzone zadania.');
  return { ...data, series: data.series ?? [] } as BackupFile;
}

/** Zastępuje wszystkie dane zawartością (sprawdzonej) kopii zapasowej. */
export async function importData(data: BackupFile) {
  await db.transaction('rw', db.tasks, db.series, db.sections, async () => {
    await Promise.all([db.tasks.clear(), db.series.clear(), db.sections.clear()]);
    await db.sections.bulkAdd(data.sections);
    await db.tasks.bulkAdd(data.tasks);
    await db.series.bulkAdd(data.series.map((s) => ({ ...s, excluded: s.excluded ?? [] })));
  });
}

/** Usuwa wszystkie dane i przywraca domyślne sekcje. */
export async function resetAll() {
  await db.transaction('rw', db.tasks, db.series, db.sections, async () => {
    await Promise.all([db.tasks.clear(), db.series.clear(), db.sections.clear()]);
    await db.sections.bulkAdd(defaultSections());
  });
}
