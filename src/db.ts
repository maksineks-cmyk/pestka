// Lokalna baza danych (IndexedDB przez Dexie) oraz wszystkie operacje na danych.
// Nic nie jest wysyłane do internetu — dane zostają na telefonie.
import Dexie, { type EntityTable } from 'dexie';
import type { BackupFile, LearnedWord, Recurrence, Reminder, Section, Series, Task } from './lib/types';
import { BUILTIN_BY_NAME } from './lib/keywords';
import { classify, learnableStems, normalize, type LearnedMap } from './lib/classifier';
import { addDays, rangeKeys } from './lib/dates';
import { occursOn } from './lib/recurrence';

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);

/** Paleta kolorów do wyboru dla sekcji. */
export const SECTION_COLORS = ['#58cc02', '#1cb0f6', '#ff9600', '#ff4b4b', '#ce82ff', '#ffc800', '#00cd9c', '#ff86d0', '#8e6cef', '#a0785a'];

const komputerSection = (order: number): Section => ({
  id: uid(),
  name: 'Na komputerze',
  emoji: '💻',
  color: '#8e6cef',
  order,
  builtin: 'komputer',
  keywords: [],
});

const defaultSections = (): Section[] => [
  { id: uid(), name: 'Praca', emoji: '💼', color: '#1cb0f6', order: 0, builtin: 'praca', keywords: [] },
  { id: uid(), name: 'Dom', emoji: '🏠', color: '#ff9600', order: 1, builtin: 'dom', keywords: [] },
  { id: uid(), name: 'Zdrowie', emoji: '💪', color: '#ff4b4b', order: 2, builtin: 'zdrowie', keywords: [] },
  komputerSection(3),
  { id: uid(), name: 'Inne', emoji: '✨', color: '#ce82ff', order: 4, builtin: 'inne', keywords: [] },
];

class PlannerDB extends Dexie {
  tasks!: EntityTable<Task, 'id'>;
  sections!: EntityTable<Section, 'id'>;
  series!: EntityTable<Series, 'id'>;
  learned!: EntityTable<LearnedWord, 'word'>;

  constructor() {
    super('pestka-planer');
    this.version(1).stores({
      tasks: 'id, date, sectionId, seriesId, [seriesId+seriesDate]',
      sections: 'id, order',
      series: 'id',
    });
    // Wersja 2: godziny w zadaniach (pola opcjonalne — stare zadania działają bez zmian),
    // słowa kluczowe sekcji i tabela nauczonych słów. Migracja nie usuwa żadnych danych.
    this.version(2)
      .stores({
        tasks: 'id, date, sectionId, seriesId, [seriesId+seriesDate]',
        sections: 'id, order',
        series: 'id',
        learned: 'word, sectionId',
      })
      .upgrade(async (tx) => {
        await tx.table('sections').toCollection().modify((s: Section) => {
          if (!Array.isArray(s.keywords)) s.keywords = [];
          // Domyślne sekcje dostają klucz słownika, żeby rozpoznawanie działało po zmianie nazwy.
          if (!s.builtin) {
            const key = BUILTIN_BY_NAME[normalize(s.name.trim())];
            if (key) s.builtin = key;
          }
        });
      });
    // Wersja 3: nowa wbudowana sekcja „💻 Na komputerze” (gry, beaty, montaż…).
    // Dodajemy ją przed „Inne” i przenosimy do niej pasujące, niezrobione zadania z „Inne”.
    this.version(3)
      .stores({
        tasks: 'id, date, sectionId, seriesId, [seriesId+seriesDate]',
        sections: 'id, order',
        series: 'id',
        learned: 'word, sectionId',
      })
      .upgrade(async (tx) => {
        const sections = (await tx.table('sections').toArray()) as Section[];
        const isPc = (s: Section) => s.builtin === 'komputer' || ['na komputerze', 'komputer'].includes(normalize(s.name.trim()));
        if (sections.some(isPc)) return;
        const inne = sections.find((s) => s.builtin === 'inne');
        const pc = komputerSection(inne ? inne.order : sections.length);
        if (inne) await tx.table('sections').where('order').aboveOrEqual(inne.order).modify((s: Section) => void (s.order += 1));
        await tx.table('sections').add(pc);
        if (!inne) return;
        const all = [...sections, pc];
        await tx
          .table('tasks')
          .where('sectionId')
          .equals(inne.id)
          .modify((t: Task) => {
            if (!t.done && classify(t.title, all).sectionId === pc.id) t.sectionId = pc.id;
          });
        await tx
          .table('series')
          .filter((s: Series) => s.sectionId === inne.id && classify(s.title, all).sectionId === pc.id)
          .modify((s: Series) => void (s.sectionId = pc.id));
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
  time?: string;
  endTime?: string;
  timeApprox?: boolean;
}

/** Pola godziny z formularza (undefined = brak godziny). */
const timeFields = (input: TaskInput) => ({
  time: input.time || undefined,
  endTime: input.time ? input.endTime || undefined : undefined,
  timeApprox: input.time && input.timeApprox ? true : undefined,
});

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
    ...timeFields(input),
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
      ...timeFields(input),
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

/** Dodaje wiele zadań naraz (z szybkiego wpisu). Nigdy nie nadpisuje istniejących zadań dnia. */
export async function addTasks(inputs: TaskInput[]) {
  await db.transaction('rw', db.tasks, db.series, async () => {
    for (const input of inputs) await addTask(input);
  });
}

/** Zapisuje przypomnienie w zadaniu (np. po dodaniu .ics jednym stuknięciem). */
export async function setTaskReminder(id: string, reminder: Reminder | undefined) {
  await db.tasks.update(id, { reminder });
}

/** Ustawia (lub usuwa) godzinę zadania w planie dnia. */
export async function setTaskTime(id: string, time: string | undefined) {
  const t = await db.tasks.get(id);
  if (!t) return;
  await db.tasks.update(id, {
    time,
    endTime: time && t.endTime && t.endTime > time ? t.endTime : undefined,
    timeApprox: undefined,
  });
}

/**
 * Przenosi zadanie (przeciągnięte) do innej sekcji. `orderedIds` = nowa kolejność zadań
 * w sekcji docelowej (z przeniesionym zadaniem). Klasyfikator uczy się z przeniesienia.
 */
export async function moveTaskToSection(id: string, sectionId: string, orderedIds?: string[]) {
  const t = await db.tasks.get(id);
  if (!t || t.sectionId === sectionId) return;
  await learnSection(t.title, sectionId);
  await db.transaction('rw', db.tasks, async () => {
    await db.tasks.update(id, { sectionId, order: await nextOrder(t.date, sectionId) });
    if (orderedIds) await Promise.all(orderedIds.map((tid, i) => db.tasks.update(tid, { order: i })));
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
  // Ręczne przeniesienie do innej sekcji = lekcja dla klasyfikatora.
  if (task.sectionId !== input.sectionId) await learnSection(input.title, input.sectionId);
  await db.transaction('rw', db.tasks, db.series, async () => {
    const recurrenceChanged = JSON.stringify((await currentRecurrence(task)) ?? null) !== JSON.stringify(input.recurrence ?? null);
    const sectionChanged = task.sectionId !== input.sectionId;
    const base: Partial<Task> = {
      title: input.title,
      note: input.note,
      date: input.date,
      sectionId: input.sectionId,
      reminder: input.reminder,
      ...timeFields(input),
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
        ...timeFields(input),
      });
      const others = await db.tasks.where('seriesId').equals(task.seriesId).filter((t) => t.id !== task.id && !t.done && (t.seriesDate ?? t.date) > from).toArray();
      for (const o of others) {
        await db.tasks.update(o.id, {
          title: input.title,
          note: input.note,
          sectionId: input.sectionId,
          reminder: input.reminder ? { ...input.reminder, date: o.date } : undefined,
          ...timeFields(input),
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
          time: s.time,
          endTime: s.endTime,
          timeApprox: s.timeApprox,
        });
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Nauka klasyfikatora
// ---------------------------------------------------------------------------

/** Nauczone słowa jako mapa rdzeń → sekcja (dla klasyfikatora). */
export async function getLearnedMap(): Promise<LearnedMap> {
  const rows = await db.learned.toArray();
  return Object.fromEntries(rows.map((r) => [r.word, r.sectionId]));
}

/** Zapamiętuje słowa z tytułu zadania dla wskazanej sekcji (nadpisuje wcześniejsze skojarzenia). */
export async function learnSection(title: string, sectionId: string) {
  const now = Date.now();
  const rows = learnableStems(title).map((word) => ({ word, sectionId, updatedAt: now }));
  if (rows.length) await db.learned.bulkPut(rows);
}

export async function forgetLearned(word: string) {
  await db.learned.delete(word);
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
  await db.learned.where('sectionId').equals(id).delete();
}

// ---------------------------------------------------------------------------
// Kopia zapasowa
// ---------------------------------------------------------------------------

export async function exportData(): Promise<BackupFile> {
  return {
    app: 'pestka-planer',
    version: 2,
    exportedAt: new Date().toISOString(),
    sections: await db.sections.toArray(),
    tasks: await db.tasks.toArray(),
    series: await db.series.toArray(),
    learned: await db.learned.toArray(),
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
  // Kopie z wersji 1 nie mają nauczonych słów ani słów kluczowych — uzupełniamy domyślnie.
  const sections = data.sections.map((s) => {
    const builtin = s.builtin ?? BUILTIN_BY_NAME[normalize(String(s.name ?? '').trim())];
    return { ...s, keywords: Array.isArray(s.keywords) ? s.keywords : [], ...(builtin ? { builtin } : {}) };
  });
  return { ...data, sections, series: data.series ?? [], learned: Array.isArray(data.learned) ? data.learned : [] } as BackupFile;
}

/** Zastępuje wszystkie dane zawartością (sprawdzonej) kopii zapasowej. */
export async function importData(data: BackupFile) {
  await db.transaction('rw', [db.tasks, db.series, db.sections, db.learned], async () => {
    await Promise.all([db.tasks.clear(), db.series.clear(), db.sections.clear(), db.learned.clear()]);
    await db.sections.bulkAdd(data.sections);
    await db.tasks.bulkAdd(data.tasks);
    await db.series.bulkAdd(data.series.map((s) => ({ ...s, excluded: s.excluded ?? [] })));
    if (data.learned?.length) await db.learned.bulkPut(data.learned);
  });
}

/** Usuwa wszystkie dane i przywraca domyślne sekcje. */
export async function resetAll() {
  await db.transaction('rw', [db.tasks, db.series, db.sections, db.learned], async () => {
    await Promise.all([db.tasks.clear(), db.series.clear(), db.sections.clear(), db.learned.clear()]);
    await db.sections.bulkAdd(defaultSections());
  });
}
