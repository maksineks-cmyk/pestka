// Model danych aplikacji.
import type { BuiltinSectionKey } from './keywords';

export interface Section {
  id: string;
  name: string;
  emoji: string;
  color: string; // kolor HEX akcentu sekcji
  order: number;
  /** Klucz wbudowanego słownika słów kluczowych (Praca/Dom/Zdrowie/Inne) — działa też po zmianie nazwy. */
  builtin?: BuiltinSectionKey;
  /** Własne słowa kluczowe użytkownika do automatycznego przypisywania zadań. */
  keywords?: string[];
}

/** Słowo zapamiętane z ręcznego przeniesienia zadania do innej sekcji. */
export interface LearnedWord {
  word: string; // znormalizowany rdzeń słowa
  sectionId: string;
  updatedAt: number;
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
  /** Godzina w planie dnia "GG:MM" (zadania z godziną są na osi czasu). */
  time?: string;
  /** Koniec przedziału "GG:MM" (opcjonalnie). */
  endTime?: string;
  /** Godzina przybliżona („rano”, „wieczorem”). */
  timeApprox?: boolean;
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
  /** Godzina w planie dnia kopiowana do wystąpień. */
  time?: string;
  endTime?: string;
  timeApprox?: boolean;
}

export interface BackupFile {
  app: 'pestka-planer';
  /** 1 = pierwsza wersja (bez godzin i nauki), 2 = z nauczonymi słowami. */
  version: 1 | 2;
  exportedAt: string;
  sections: Section[];
  tasks: Task[];
  series: Series[];
  learned?: LearnedWord[];
}
