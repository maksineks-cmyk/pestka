import { describe, expect, it } from 'vitest';
import { extractTime, parseBrainDump, splitTasks } from './parser';
import type { ClassifierSection } from './classifier';

const SECTIONS: ClassifierSection[] = [
  { id: 'praca', name: 'Praca', builtin: 'praca' },
  { id: 'dom', name: 'Dom', builtin: 'dom' },
  { id: 'zdrowie', name: 'Zdrowie', builtin: 'zdrowie' },
  { id: 'inne', name: 'Inne', builtin: 'inne' },
];

describe('splitTasks', () => {
  it('dzieli przykład z przecinkami i myślnikami na 6 zadań', () => {
    const r = splitTasks('fryzjer o 15, siłownia - zakupy w biedronce - mail do szefa, odkurzyć pokój 18:30, wyjść z psem');
    expect(r).toEqual(['Fryzjer o 15', 'Siłownia', 'Zakupy w biedronce', 'Mail do szefa', 'Odkurzyć pokój 18:30', 'Wyjść z psem']);
  });

  it('dzieli po nowych liniach, średnikach i punktorach', () => {
    expect(splitTasks('pranie\nobiad; lekarz\n\n• apteka • basen')).toEqual(['Pranie', 'Obiad', 'Lekarz', 'Apteka', 'Basen']);
  });

  it('obsługuje linie zaczynające się od myślnika i półpauzy', () => {
    expect(splitTasks('- pranie\n- odkurzyć\n– zakupy\n— raport')).toEqual(['Pranie', 'Odkurzyć', 'Zakupy', 'Raport']);
  });

  it('dzieli po „– ” i „— ” bez spacji przed', () => {
    expect(splitTasks('siłownia– zakupy— raport')).toEqual(['Siłownia', 'Zakupy', 'Raport']);
  });

  it('nie dzieli łączników w słowach', () => {
    expect(splitTasks('wysłać e-mail do Kowalski-Nowak')).toEqual(['Wysłać e-mail do Kowalski-Nowak']);
  });

  it('nie dzieli zakresów godzin', () => {
    expect(splitTasks('spotkanie 15-16, call 15:00-16:00, basen 7 - 8')).toEqual(['Spotkanie 15-16', 'Call 15:00-16:00', 'Basen 7 - 8']);
  });

  it('usuwa puste elementy i białe znaki, wielka litera na początku', () => {
    expect(splitTasks('  ,, ;  zakupy  ,  ,\n  \n -  ')).toEqual(['Zakupy']);
  });

  it('nie dzieli liczby dziesiętnej z przecinkiem', () => {
    expect(splitTasks('kupić 1,5 kg mąki, pranie')).toEqual(['Kupić 1,5 kg mąki', 'Pranie']);
  });
});

describe('extractTime', () => {
  it.each([
    ['fryzjer o 15', 'Fryzjer', '15:00'],
    ['fryzjer o 15:30', 'Fryzjer', '15:30'],
    ['call 15:00', 'Call', '15:00'],
    ['call 15.00', 'Call', '15.00'.replace('.', ':')],
    ['basen na 9', 'Basen', '09:00'],
    ['odkurzyć pokój 18:30', 'Odkurzyć pokój', '18:30'],
    ['o 8:05 tabletki', 'Tabletki', '08:05'],
    ['dentysta o godz. 11', 'Dentysta', '11:00'],
    ['kolacja o 7 wieczorem', 'Kolacja', '19:00'],
    ['spacer 5 po południu', 'Spacer', '17:00'],
  ])('„%s” → %s @ %s', (input, title, time) => {
    const r = extractTime(input);
    expect(r.title).toBe(title);
    expect(r.time).toBe(time);
    expect(r.approx).toBeUndefined();
  });

  it.each([
    ['spotkanie 15-16', 'Spotkanie', '15:00', '16:00'],
    ['spotkanie 15:00-16:30', 'Spotkanie', '15:00', '16:30'],
    ['warsztaty od 9 do 12:30', 'Warsztaty', '09:00', '12:30'],
    ['zebranie o 15 - 16', 'Zebranie', '15:00', '16:00'],
  ])('zakres „%s”', (input, title, time, endTime) => {
    expect(extractTime(input)).toEqual({ title, time, endTime });
  });

  it.each([
    ['bieganie rano', 'Bieganie', '08:00'],
    ['lunch w południe', 'Lunch', '12:00'],
    ['pranie po południu', 'Pranie', '15:00'],
    ['film wieczorem', 'Film', '19:00'],
  ])('pora dnia „%s”', (input, title, time) => {
    expect(extractTime(input)).toEqual({ title, time, approx: true });
  });

  it('nie traktuje liczb jako godzin', () => {
    expect(extractTime('kupić 15 jajek').time).toBeUndefined();
    expect(extractTime('kupić 2-3 jabłka').time).toBeUndefined();
    expect(extractTime('bilety na 2 osoby').time).toBeUndefined();
    expect(extractTime('wysłać e-mail').time).toBeUndefined();
  });

  it('zostawia tekst, gdy cały wpis to godzina', () => {
    expect(extractTime('o 15').title).toBe('O 15');
  });
});

describe('parseBrainDump', () => {
  it('przykład użytkownika: 6 zadań z sekcjami i godzinami', () => {
    const r = parseBrainDump('fryzjer o 15, siłownia - zakupy w biedronce - mail do szefa, odkurzyć pokój 18:30, wyjść z psem', SECTIONS);
    expect(r.map((t) => [t.title, t.sectionId, t.time])).toEqual([
      ['Fryzjer', 'zdrowie', '15:00'],
      ['Siłownia', 'zdrowie', undefined],
      ['Zakupy w biedronce', 'dom', undefined],
      ['Mail do szefa', 'praca', undefined],
      ['Odkurzyć pokój', 'dom', '18:30'],
      ['Wyjść z psem', 'dom', undefined],
    ]);
  });

  it('hashtag wymusza sekcję i znika z nazwy', () => {
    const [a, b] = parseBrainDump('#praca odkurzyć\nodkurzyć biuro #zdrowie o 9:00', SECTIONS);
    expect(a).toMatchObject({ title: 'Odkurzyć', sectionId: 'praca', source: 'hashtag' });
    expect(b).toMatchObject({ title: 'Odkurzyć biuro', sectionId: 'zdrowie', source: 'hashtag', time: '09:00' });
  });

  it('uwzględnia nauczone słowa', () => {
    const [t] = parseBrainDump('kurs hiszpańskiego', SECTIONS, { hiszpansk: 'praca' });
    expect(t.sectionId).toBe('praca');
  });
});
