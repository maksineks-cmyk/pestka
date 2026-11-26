// „Cofnij”: przed zmianą zapamiętujemy kopię zadań (i serii), a stuknięcie „Cofnij”
// w powiadomieniu przywraca je dokładnie w takim stanie, w jakim były.
import { db } from './db';
import { toast } from './components/Dialogs';
import type { Series, Task } from './lib/types';

async function snapshot(taskIds: string[], seriesIds: string[] = []) {
  const tasks = (await db.tasks.bulkGet(taskIds)).filter(Boolean) as Task[];
  const sIds = [...new Set([...seriesIds, ...tasks.map((t) => t.seriesId).filter(Boolean) as string[]])];
  const series = (await db.series.bulkGet(sIds)).filter(Boolean) as Series[];
  return { tasks, series };
}

/**
 * Wykonuje zmianę i pokazuje powiadomienie z „Cofnij”.
 * `taskIds` — zadania, które zmiana może zmienić lub usunąć.
 */
export async function withUndo<T>(message: string | ((result: T) => string), taskIds: string[], action: () => Promise<T>): Promise<T> {
  const before = await snapshot(taskIds);
  const result = await action();
  toast(typeof message === 'function' ? message(result) : message, {
    label: 'Cofnij',
    onClick: async () => {
      await db.transaction('rw', db.tasks, db.series, async () => {
        await db.tasks.bulkPut(before.tasks);
        if (before.series.length) await db.series.bulkPut(before.series);
      });
      toast('Cofnięto ↩️');
    },
  });
  return result;
}

/** Cofnięcie dodania: usuwa świeżo dodane zadania (i serie, które z nimi powstały). */
export function offerUndoAdd(message: string, added: Task[]) {
  toast(message, {
    label: 'Cofnij',
    onClick: async () => {
      await db.transaction('rw', db.tasks, db.series, async () => {
        await db.tasks.bulkDelete(added.map((t) => t.id));
        const sIds = added.map((t) => t.seriesId).filter(Boolean) as string[];
        if (sIds.length) {
          await db.tasks.where('seriesId').anyOf(sIds).delete();
          await db.series.bulkDelete(sIds);
        }
      });
      toast('Cofnięto ↩️');
    },
  });
}
