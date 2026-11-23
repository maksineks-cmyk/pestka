// Parser „szybkiego wpisu”: dzieli tekst na zadania, wykrywa godziny i przypisuje sekcje.
// Czysty moduł TypeScript (bez Reacta i bazy danych) — pokryty testami w parser.test.ts.
import { classify, extractHashtag, type ClassifierSection, type ClassifySource, type LearnedMap } from './classifier';

export interface ParsedTask {
  title: string;
  sectionId: string;
  source: ClassifySource;
  /** Godzina "GG:MM" (jeśli wykryto). */
  time?: string;
  /** Koniec przedziału "GG:MM" (np. „15-16”). */
  endTime?: string;
  /** true = godzina przybliżona ze słowa („rano”, „wieczorem”…), a nie konkretna. */
  approx?: boolean;
}

// ---------------------------------------------------------------------------
// Dzielenie tekstu na zadania
// ---------------------------------------------------------------------------

const DASHES = '-–—';
const isSpace = (c: string | undefined) => c === undefined || c === '' || /\s/.test(c);
const isDigit = (c: string | undefined) => !!c && /\d/.test(c);

/** Pierwsza litera wielka: „fryzjer” → „Fryzjer”. */
export function capitalize(s: string): string {
  return s ? s.charAt(0).toLocaleUpperCase('pl') + s.slice(1) : s;
}

/** Czyści fragment: spacje i znaki interpunkcyjne na brzegach. */
function cleanPiece(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/^[\s.,;:!?\-–—•*·]+/, '')
    .replace(/[\s,;:\-–—•*·]+$/, '')
    .trim();
}

/** Najbliższy znak (nie spacja) przed / po pozycji i. */
function neighbour(line: string, i: number, step: -1 | 1): string | undefined {
  for (let j = i + step; j >= 0 && j < line.length; j += step) if (!/\s/.test(line[j])) return line[j];
  return undefined;
}

/**
 * Dzieli wpis na osobne zadania: nowe linie, przecinki, średniki, punktory (•)
 * oraz myślniki użyte jako separator („ - ”, „– ”, „— ”, linia zaczynająca się od „-”).
 * NIE dzieli łączników w słowach („e-mail”, „Kowalski-Nowak”) ani zakresów godzin („15-16”, „15:00-16:00”).
 */
export function splitTasks(text: string): string[] {
  const out: string[] = [];
  const push = (s: string) => {
    const t = cleanPiece(s);
    if (/[\p{L}\p{N}]/u.test(t)) out.push(capitalize(t));
  };

  for (const rawLine of text.split(/\r?\n/)) {
    // Punktory i numeracja na początku linii: „- ”, „• ”, „* ”, „1. ”, „2) ”.
    const line = rawLine.replace(/^\s*(?:[-–—•*·▪►✓✔]+|\d{1,2}[.)](?=\s))\s*/, '');
    let cur = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === ';' || c === '•' || c === '·') {
        push(cur);
        cur = '';
      } else if (c === ',') {
        // „15,30” to liczba, nie separator.
        if (isDigit(line[i - 1]) && isDigit(line[i + 1])) cur += c;
        else {
          push(cur);
          cur = '';
        }
      } else if (DASHES.includes(c)) {
        const spaced = isSpace(line[i - 1]) || isSpace(line[i + 1]);
        const range = isDigit(neighbour(line, i, -1)) && isDigit(neighbour(line, i, 1));
        if (spaced && !range) {
          push(cur);
          cur = '';
        } else cur += c;
      } else cur += c;
    }
    push(cur);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Wykrywanie godzin
// ---------------------------------------------------------------------------

export interface TimeResult {
  /** Tytuł bez frazy z godziną. */
  title: string;
  time?: string;
  endTime?: string;
  approx?: boolean;
}

const H = '([01]?\\d|2[0-3])';
const M = '([0-5]\\d)';
const START = '(^|[\\s(])';
const END = '(?=$|[\\s,.;:!?)])';
// „o”, „na”, „od”, „godz.”, „o godz.”, „o godzinie”, „około”, „ok.”
const PREFIX = '(o\\s+godz(?:inie|\\.)?|godz(?:inie|\\.)?|około|okolo|ok\\.|od|na|o)\\s+';
// Pora dnia doprecyzowująca godzinę: „o 7 wieczorem”, „5 po południu”.
const DAYPART = '(?:\\s+(rano|z\\s+rana|wieczorem|po\\s+po[lł]udniu|popo[lł]udniu|w\\s+nocy))?';

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (h: number, m: number) => `${pad(h)}:${pad(m)}`;

/** Przesuwa godzinę na popołudnie / wieczór, gdy pora dnia na to wskazuje. */
function adjust(h: number, part?: string): number {
  if (!part) return h;
  const p = part.toLowerCase();
  if (/wiecz|po\s*po[lł]udn|popo[lł]udn/.test(p) && h < 12) return h + 12;
  if (/nocy/.test(p) && h >= 6 && h < 12) return h + 12;
  return h;
}

interface Rule {
  re: RegExp;
  build: (m: RegExpExecArray, rest: string) => Omit<TimeResult, 'title'> | null;
}

const RULES: Rule[] = [
  // „od 15 do 16:30”
  {
    re: new RegExp(`${START}od\\s+${H}(?:[:.]${M})?\\s+do\\s+${H}(?:[:.]${M})?${DAYPART}${END}`, 'iu'),
    build: (m) => range(m[2], m[3], m[4], m[5], m[6]),
  },
  // „15-16”, „15:00-16:30”, „o 15-16”
  {
    re: new RegExp(`${START}(?:${PREFIX})?${H}(?:[:.]${M})?\\s*[-–—]\\s*${H}(?:[:.]${M})?${DAYPART}${END}`, 'iu'),
    build: (m) => {
      // „kupić 2-3 jabłka” to nie godzina: bez przyimka, minut i pory dnia wymagamy godziny ≥ 6.
      if (!m[2] && !m[4] && !m[6] && !m[7] && +m[3] < 6) return null;
      return range(m[3], m[4], m[5], m[6], m[7]);
    },
  },
  // „15:00”, „15.00”, „o 15:30”, „18:30”
  {
    re: new RegExp(`${START}(?:${PREFIX})?${H}[:.]${M}${DAYPART}${END}`, 'iu'),
    build: (m) => ({ time: fmt(adjust(+m[3], m[5]), +m[4]) }),
  },
  // „o 15”, „na 9”, „godz. 8”, „o 7 wieczorem”
  {
    re: new RegExp(`${START}${PREFIX}${H}${DAYPART}${END}`, 'iu'),
    build: (m, rest) => {
      // „na 2 osoby” to nie godzina — „na 9” tylko na końcu albo z porą dnia.
      if (m[2].toLowerCase() === 'na' && !m[4] && /^\s*[\p{L}\p{N}]/u.test(rest)) return null;
      return { time: fmt(adjust(+m[3], m[4]), 0) };
    },
  },
  // „7 rano”, „8 wieczorem” (bez przyimka)
  {
    re: new RegExp(`${START}${H}\\s+(rano|z\\s+rana|wieczorem|po\\s+po[lł]udniu|popo[lł]udniu|w\\s+nocy)${END}`, 'iu'),
    build: (m) => ({ time: fmt(adjust(+m[2], m[3]), 0) }),
  },
];

function range(h1: string, m1: string | undefined, h2: string, m2: string | undefined, part?: string) {
  const a = adjust(+h1, part) * 60 + +(m1 ?? 0);
  let b = adjust(+h2, part) * 60 + +(m2 ?? 0);
  if (b <= a && part === undefined && +h2 < 12 && +h2 + 12 > +h1) b += 12 * 60; // „11-1” → 11:00–13:00
  if (b <= a || b >= 24 * 60) return null;
  return { time: fmt(Math.floor(a / 60), a % 60), endTime: fmt(Math.floor(b / 60), b % 60) };
}

// Pory dnia bez konkretnej godziny → godzina przybliżona.
const DAYPARTS: [RegExp, string][] = [
  [new RegExp(`${START}(?:przed\\s+po[lł]udniem)${END}`, 'iu'), '10:00'],
  [new RegExp(`${START}(?:po\\s+po[lł]udniu|popo[lł]udniu)${END}`, 'iu'), '15:00'],
  [new RegExp(`${START}(?:w\\s+(?:samo\\s+)?po[lł]udnie|oko[lł]o\\s+po[lł]udnia|na\\s+po[lł]udnie)${END}`, 'iu'), '12:00'],
  [new RegExp(`${START}(?:z\\s+rana|rankiem|(?:na\\s+|z\\s+)?rano)${END}`, 'iu'), '08:00'],
  [new RegExp(`${START}(?:wieczorem|(?:na\\s+)?wiecz[oó]r)${END}`, 'iu'), '19:00'],
  [new RegExp(`${START}(?:w\\s+nocy)${END}`, 'iu'), '22:00'],
];

/** Usuwa wycięty fragment i porządkuje tytuł (spacje, wiszące przyimki, interpunkcja). */
function tidy(s: string): string {
  return cleanPiece(s.replace(/\s+/g, ' ').replace(/(\s+(o|na|od|do|ok\.?|około|godz\.?))+\s*$/iu, ''));
}

/**
 * Wykrywa godzinę w tekście zadania i usuwa ją z tytułu.
 * „fryzjer o 15” → { title: „Fryzjer”, time: „15:00” }.
 */
export function extractTime(text: string): TimeResult {
  for (const rule of RULES) {
    const m = rule.re.exec(text);
    if (!m) continue;
    const rest = text.slice(m.index + m[0].length);
    const r = rule.build(m, rest);
    if (!r) continue;
    const title = tidy(text.slice(0, m.index) + m[1] + ' ' + rest);
    return { ...r, title: capitalize(title || cleanPiece(text)) };
  }
  for (const [re, time] of DAYPARTS) {
    const m = re.exec(text);
    if (!m) continue;
    const title = tidy(text.slice(0, m.index) + m[1] + ' ' + text.slice(m.index + m[0].length));
    return { title: capitalize(title || cleanPiece(text)), time, approx: true };
  }
  return { title: capitalize(cleanPiece(text)) };
}

// ---------------------------------------------------------------------------
// Całość: tekst → lista zadań z sekcją i godziną
// ---------------------------------------------------------------------------

export function parseTaskLine(line: string, sections: ClassifierSection[], learned: LearnedMap = {}): ParsedTask {
  const tag = extractHashtag(line, sections);
  const t = extractTime(tag.text);
  const cls = tag.sectionId ? { sectionId: tag.sectionId, source: 'hashtag' as const } : classify(t.title, sections, learned);
  return {
    title: t.title,
    sectionId: cls.sectionId,
    source: cls.source,
    ...(t.time ? { time: t.time } : {}),
    ...(t.endTime ? { endTime: t.endTime } : {}),
    ...(t.approx ? { approx: true } : {}),
  };
}

/** Zamienia „zrzut myśli” na listę zadań gotowych do podglądu. */
export function parseBrainDump(text: string, sections: ClassifierSection[], learned: LearnedMap = {}): ParsedTask[] {
  return splitTasks(text)
    .map((line) => parseTaskLine(line, sections, learned))
    .filter((t) => t.title.length > 0);
}
