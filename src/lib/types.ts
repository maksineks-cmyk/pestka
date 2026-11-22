// Model danych aplikacji.

export interface Section {
  id: string;
  name: string;
  emoji: string;
  color: string; // kolor HEX akcentu sekcji
  order: number;
}

/** Minuty przed wydarzeniem, kiedy iPhone ma pokazać alert (0 = w chwili wydarzenia). */
export type AlertOffset = 0 | 10 | 30 | 60 | 1440;

export interface Reminder {
  date: string; // RRRR-MM-DD
  time: string; // GG:MM
  alert: AlertOffset;
}

export type RecurrenceType = 'daily' | 'weekdays' | 'weekly' | 'monthly';

export interface Recurrence {
  type: RecurrenceType;
  /** Tylko dla 'weekdays': dni tygodnia (0 = poniedziałek … 6 = niedziela). */
  weekdays?: number[];
}

export interface Task {
  id: string;
  title: string;
  note?: string;
  date: string; // dzień, na który zadanie jest zaplanowane
  sectionId: string;
  done: boolean;
  doneAt?: number;
  order: number;
  createdAt: number;
  reminder?: Reminder;
  /** Jeśli zadanie powstało z serii powtarzanej — id serii i jej oryginalna data. */
  seriesId?: string;
  seriesDate?: string;
}

/** Szablon zadania powtarzanego. Z niego tworzone są zwykłe zadania na konkretne dni. */
export interface Series {
  id: string;
  title: string;
  note?: string;
  sectionId: string;
  recurrence: Recurrence;
  startDate: string;
  endDate?: string;
  /** Dni, w których użytkownik usunął (lub przeniósł) pojedyncze wystąpienie. */
  excluded: string[];
  /** Godzina przypomnienia kopiowana do wystąpień (data = dzień wystąpienia). */
  reminderTime?: string;
  reminderAlert?: AlertOffset;
}

export interface BackupFile {
  app: 'pestka-planer';
  version: 1;
  exportedAt: string;
  sections: Section[];
  tasks: Task[];
  series: Series[];
}
