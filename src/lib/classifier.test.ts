import { describe, expect, it } from 'vitest';
import { classify, extractHashtag, learn, learnableStems, normalize, tokenMatches, type ClassifierSection } from './classifier';

const SECTIONS: ClassifierSection[] = [
  { id: 'p', name: 'Praca', builtin: 'praca' },
  { id: 'd', name: 'Dom', builtin: 'dom' },
  { id: 'z', name: 'Zdrowie', builtin: 'zdrowie' },
  { id: 'k', name: 'Na komputerze', builtin: 'komputer' },
  { id: 'i', name: 'Inne', builtin: 'inne' },
];
const sec = (text: string, sections = SECTIONS, learned = {}) => classify(text, sections, learned).sectionId;

describe('normalizacja i rdzenie', () => {
  it('usuwa polskie znaki', () => {
    expect(normalize('Sprzątać ŻÓŁW')).toBe('sprzatac zolw');
  });
  it('dopasowuje rdzeń z przedrostkiem czasownika', () => {
    expect(tokenMatches('posprzatac', 'sprzat')).toBeGreaterThan(0);
    expect(tokenMatches('zakupow', 'zakup')).toBeGreaterThan(0);
    expect(tokenMatches('kot', 'kotlet')).toBe(0);
  });
});

describe('classify — odmiana', () => {
  it.each([
    ['zakupy', 'd'],
    ['lista zakupów', 'd'],
    ['zrobić zakupami', 'd'],
    ['sprzątać kuchnię', 'd'],
    ['posprzątać', 'd'],
    ['odkurzanie', 'd'],
    ['wynieść śmieci', 'd'],
    ['w biedronce', 'd'],
    ['zapłacić rachunki', 'd'],
    ['mail do szefa', 'p'],
    ['wysłać e-mail', 'p'],
    ['spotkanie z klientem', 'p'],
    ['przygotować prezentację', 'p'],
    ['wystawić fakturę', 'p'],
    ['siłownia', 'z'],
    ['na siłowni', 'z'],
    ['wizyta u dentysty', 'z'],
    ['iść do lekarza', 'z'],
    ['joga', 'z'],
    ['fryzjer', 'z'],
    ['basen', 'z'],
    // Pisane bez polskich znaków (z prawdziwego użycia):
    ['Kupic pyzy', 'd'],
    ['Zrobic 5 razy deske po 30 sekund', 'z'],
    ['30 pompek', 'z'],
    ['Wykapac sie i uzyc kremu', 'z'],
    ['Zrobic sobie obiad', 'd'],
    ['spakowac sie i przyszykowac ciuchy', 'd'],
    // Na komputerze
    ['Pograc w gta', 'k'],
    ['pograć w fifę', 'k'],
    ['zagrać w minecrafta', 'k'],
    ['porobić beaty', 'k'],
    ['zrobić bit w FL Studio', 'k'],
    ['nagrać wokal', 'k'],
    ['zmontować filmik na YouTube', 'k'],
  ])('„%s” → %s', (text, expected) => {
    expect(sec(text)).toBe(expected);
  });

  it('nieznane zadanie trafia do Inne', () => {
    expect(classify('urodziny babci', SECTIONS)).toEqual({ sectionId: 'i', source: 'fallback' });
  });

  it('działa po zmianie nazwy sekcji (klucz builtin)', () => {
    const renamed = SECTIONS.map((s) => (s.id === 'd' ? { ...s, name: 'Mieszkanie' } : s));
    expect(sec('odkurzyć', renamed)).toBe('d');
  });

  it('rozpoznaje sekcje wbudowane po nazwie, gdy brak pola builtin', () => {
    const plain = SECTIONS.map(({ builtin: _b, ...s }) => s);
    expect(sec('zakupy', plain)).toBe('d');
    expect(sec('coś dziwnego', plain)).toBe('i');
  });
});

describe('własne sekcje i słowa kluczowe', () => {
  const withSchool: ClassifierSection[] = [...SECTIONS, { id: 's', name: 'Szkoła', keywords: ['matematyka', 'zadanie domowe', 'sprawdzian'] }];

  it('dopasowuje słowa użytkownika z odmianą', () => {
    expect(sec('nauka do sprawdzianu', withSchool)).toBe('s');
    expect(sec('powtórzyć matematykę', withSchool)).toBe('s');
    expect(sec('odrobić zadanie domowe', withSchool)).toBe('s');
  });

  it('słowa użytkownika mają pierwszeństwo przed wbudowanymi', () => {
    const custom = [...SECTIONS, { id: 'pies', name: 'Pies', keywords: ['spacer'] }];
    expect(sec('spacer', custom)).toBe('pies');
  });
});

describe('nauka', () => {
  it('wybiera istotne rdzenie słów', () => {
    expect(learnableStems('Odebrać garnitur z pralni')).toEqual(['odebr', 'garnitur', 'praln']);
  });

  it('zapamiętane słowa wygrywają ze słownikiem i działają z odmianą', () => {
    // Użytkownik przeniósł „Spacer z Burkiem” do Dom.
    const learned = learn({}, 'Spacer z Burkiem', 'd');
    expect(sec('spacer', SECTIONS, learned)).toBe('d');
    expect(sec('spacerek z burkiem', SECTIONS, learned)).toBe('d');
    expect(classify('wyjść z Burkiem', SECTIONS, learned).source).toBe('learned');
  });

  it('ponowne przeniesienie nadpisuje naukę', () => {
    let learned = learn({}, 'kurs angielskiego', 'p');
    learned = learn(learned, 'kurs angielskiego', 'i');
    expect(sec('kurs angielskiego', SECTIONS, learned)).toBe('i');
  });

  it('ignoruje nauczone sekcje, które już nie istnieją', () => {
    expect(sec('zakupy', SECTIONS, { zakup: 'usunieta' })).toBe('d');
  });
});

describe('hashtagi', () => {
  it('usuwa rozpoznany hashtag (początek i koniec)', () => {
    expect(extractHashtag('#dom odkurzyć', SECTIONS)).toEqual({ text: 'odkurzyć', sectionId: 'd' });
    expect(extractHashtag('odkurzyć #Dom', SECTIONS)).toEqual({ text: 'odkurzyć', sectionId: 'd' });
  });
  it('akceptuje skrót i brak polskich znaków', () => {
    expect(extractHashtag('#zdr spacer', SECTIONS).sectionId).toBe('z');
    expect(extractHashtag('nauka #szkola', [...SECTIONS, { id: 's', name: 'Szkoła' }]).sectionId).toBe('s');
  });
  it('zostawia nieznany hashtag w tekście', () => {
    expect(extractHashtag('kupić #prezent', SECTIONS)).toEqual({ text: 'kupić #prezent', sectionId: undefined });
  });
});
