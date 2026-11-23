// Lokalny (offline) klasyfikator zadań do sekcji na podstawie polskich słów kluczowych.
// Czysty moduł TypeScript — bez bazy danych i bez Reacta, dzięki czemu łatwo go testować.
//
// Jak to działa:
// 1. Tekst jest normalizowany (małe litery, bez polskich znaków) i dzielony na słowa.
// 2. Słowa kluczowe traktujemy jak RDZENIE: „zakup” pasuje do „zakupy”, „zakupów”;
//    obsługujemy też przedrostki czasowników („sprząt” → „posprzątać”).
// 3. Każda sekcja dostaje punkty za dopasowania. Słowa nauczone (z ręcznych przeniesień)
//    i słowa wpisane przez użytkownika ważą dużo więcej niż wbudowany słownik.
// 4. Brak dopasowań → sekcja „Inne” (lub ostatnia sekcja).
import { BUILTIN_BY_NAME, BUILTIN_KEYWORDS, STOPWORDS, type BuiltinSectionKey } from './keywords';

export interface ClassifierSection {
  id: string;
  name: string;
  builtin?: BuiltinSectionKey;
  /** Słowa kluczowe dodane przez użytkownika w Ustawieniach. */
  keywords?: string[];
}

/** Nauczone słowa: rdzeń słowa → id sekcji. */
export type LearnedMap = Record<string, string>;

export type ClassifySource = 'hashtag' | 'learned' | 'custom' | 'builtin' | 'fallback';

export interface ClassifyResult {
  sectionId: string;
  source: ClassifySource;
}

const DIACRITICS: Record<string, string> = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' };

/** Małe litery i brak polskich znaków: „Sprzątać” → „sprzatac”. */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/[ąćęłńóśźż]/g, (c) => DIACRITICS[c] ?? c);
}

/** Dzieli tekst na znormalizowane słowa (litery i cyfry). */
export function tokenize(s: string): string[] {
  return normalize(s).split(/[^a-z0-9]+/).filter(Boolean);
}

// Typowe końcówki fleksyjne (po normalizacji), od najdłuższych.
const ENDINGS = ['owania', 'owanie', 'owac', 'ami', 'ach', 'iem', 'ow', 'om', 'em', 'ie', 'ac', 'ic', 'yc', 'ec', 'y', 'i', 'a', 'e', 'o', 'u'];

/** Bardzo prosty „stemmer”: obcina jedną typową końcówkę, zostawiając min. 4 litery. */
export function lightStem(word: string): string {
  for (const e of ENDINGS) {
    if (word.endsWith(e) && word.length - e.length >= 4) return word.slice(0, -e.length);
  }
  return word;
}

// Przedrostki czasowników (po normalizacji), od najdłuższych.
const PREFIXES = ['przy', 'prze', 'roz', 'pod', 'nad', 'ode', 'od', 'po', 'wy', 'za', 'na', 'do', 'u', 's', 'z', 'w'];

/**
 * Czy słowo pasuje do rdzenia? Zwraca „siłę” dopasowania (0 = brak).
 * Dłuższe rdzenie = bardziej konkretne dopasowanie = więcej punktów.
 */
export function tokenMatches(token: string, stem: string): number {
  if (!stem) return 0;
  if (token === stem) return stem.length + 1;
  if (stem.length >= 3 && token.startsWith(stem)) return stem.length;
  if (stem.length >= 4) {
    for (const p of PREFIXES) {
      if (token.length > p.length && token.startsWith(p) && token.slice(p.length).startsWith(stem)) return stem.length - 0.5;
    }
  }
  return 0;
}

/** Słowo kluczowe → lista słów, każde z wariantami rdzenia. */
function keywordVariants(keyword: string): string[][] {
  return tokenize(keyword).map((w) => {
    const st = lightStem(w);
    return st !== w ? [w, st] : [w];
  });
}

/** Punkty za dopasowanie słowa kluczowego (także wielowyrazowego) w tekście. */
export function matchKeyword(tokens: string[], keyword: string): number {
  const words = keywordVariants(keyword);
  if (!words.length) return 0;
  let best = 0;
  for (let i = 0; i + words.length <= tokens.length; i++) {
    let sum = 0;
    for (let j = 0; j < words.length; j++) {
      const s = Math.max(...words[j].map((v) => tokenMatches(tokens[i + j], v)));
      if (!s) {
        sum = 0;
        break;
      }
      sum += s;
    }
    best = Math.max(best, sum);
  }
  return best;
}

/** Klucz wbudowanego słownika dla sekcji (po polu `builtin` albo po nazwie). */
export function builtinKeyOf(s: ClassifierSection): BuiltinSectionKey | undefined {
  return s.builtin ?? BUILTIN_BY_NAME[normalize(s.name.trim())];
}

/** Sekcja „na wszystko inne”: Inne → ostatnia sekcja. */
export function fallbackSectionId(sections: ClassifierSection[]): string {
  const inne = sections.find((s) => builtinKeyOf(s) === 'inne');
  return (inne ?? sections[sections.length - 1])?.id ?? '';
}

const WEIGHT = { learned: 10, custom: 5, builtin: 1 } as const;

/** Przypisuje tekst zadania do najlepiej pasującej sekcji. */
export function classify(text: string, sections: ClassifierSection[], learned: LearnedMap = {}): ClassifyResult {
  const tokens = tokenize(text);
  const valid = new Set(sections.map((s) => s.id));
  const scores = new Map<string, { score: number; source: ClassifySource }>();
  const add = (id: string, pts: number, source: ClassifySource) => {
    if (!pts || !valid.has(id)) return;
    const cur = scores.get(id) ?? { score: 0, source };
    // Źródło o najwyższej wadze „wygrywa” jako opis dopasowania.
    if (WEIGHT[source as keyof typeof WEIGHT] > WEIGHT[cur.source as keyof typeof WEIGHT]) cur.source = source;
    cur.score += pts;
    scores.set(id, cur);
  };

  // 1. Słowa nauczone z ręcznych przeniesień.
  for (const [stem, sectionId] of Object.entries(learned)) {
    const pts = Math.max(0, ...tokens.map((t) => tokenMatches(t, stem)));
    add(sectionId, pts * WEIGHT.learned, 'learned');
  }

  for (const s of sections) {
    // 2. Słowa kluczowe wpisane przez użytkownika.
    for (const kw of s.keywords ?? []) add(s.id, matchKeyword(tokens, kw) * WEIGHT.custom, 'custom');
    // 3. Wbudowany słownik.
    const key = builtinKeyOf(s);
    if (key) for (const kw of BUILTIN_KEYWORDS[key]) add(s.id, matchKeyword(tokens, kw) * WEIGHT.builtin, 'builtin');
  }

  let best: { id: string; score: number; source: ClassifySource } | null = null;
  for (const s of sections) {
    const sc = scores.get(s.id);
    if (sc && (!best || sc.score > best.score)) best = { id: s.id, ...sc };
  }
  return best ? { sectionId: best.id, source: best.source } : { sectionId: fallbackSectionId(sections), source: 'fallback' };
}

// ---------------------------------------------------------------------------
// Hashtagi: „#dom odkurzyć” albo „odkurzyć #dom” wymusza sekcję.
// ---------------------------------------------------------------------------

const HASHTAG = /(^|\s)#([\p{L}\p{N}_-]+)/gu;

export function findSectionByTag(tag: string, sections: ClassifierSection[]): string | undefined {
  const t = normalize(tag).replace(/[^a-z0-9]/g, '');
  if (!t) return undefined;
  const plain = (s: ClassifierSection) => normalize(s.name).replace(/[^a-z0-9]/g, '');
  return (
    sections.find((s) => plain(s) === t || builtinKeyOf(s) === t) ??
    (t.length >= 2 ? sections.find((s) => plain(s).startsWith(t)) : undefined)
  )?.id;
}

/** Usuwa z tekstu hashtag pasujący do sekcji i zwraca wymuszoną sekcję. Nieznane hashtagi zostają w tekście. */
export function extractHashtag(text: string, sections: ClassifierSection[]): { text: string; sectionId?: string } {
  let sectionId: string | undefined;
  const out = text.replace(HASHTAG, (m, pre: string, tag: string) => {
    const id = findSectionByTag(tag, sections);
    if (!id) return m;
    sectionId ??= id;
    return pre;
  });
  return { text: out.replace(/\s{2,}/g, ' ').trim(), sectionId };
}

// ---------------------------------------------------------------------------
// Nauka z ręcznych przeniesień.
// ---------------------------------------------------------------------------

const STOP = new Set(STOPWORDS.map(normalize));

/** Słowa z tytułu, które warto zapamiętać (rdzenie, bez słów ogólnych i liczb). */
export function learnableStems(title: string): string[] {
  const out = new Set<string>();
  for (const t of tokenize(title)) {
    if (t.length < 3 || STOP.has(t) || /^\d+$/.test(t)) continue;
    out.add(lightStem(t));
  }
  return [...out];
}

/** Zwraca nową mapę z zapamiętanymi słowami zadania dla podanej sekcji. */
export function learn(map: LearnedMap, title: string, sectionId: string): LearnedMap {
  const next = { ...map };
  for (const stem of learnableStems(title)) next[stem] = sectionId;
  return next;
}
