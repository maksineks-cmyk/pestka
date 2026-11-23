// =============================================================================
// SŁOWNIKI SŁÓW KLUCZOWYCH — jedyne miejsce, które trzeba edytować, aby nauczyć
// Pestkę nowych słów dla wbudowanych sekcji.
//
// Wskazówki:
// - Wpisuj RDZENIE słów, np. „zakup” zamiast „zakupy” — wtedy pasuje też „zakupów”,
//   „zakupami”. Wielkość liter i polskie znaki nie mają znaczenia („sprzat” = „sprząt”).
// - Przedrostki czasowników są obsługiwane automatycznie: „sprząt” pasuje też do
//   „posprzątać”, „odkurz” do „poodkurzać”, „gotow” do „ugotować”.
// - Można wpisać całą frazę (kilka słów), np. „zadzwonić do klienta”.
// - Kluczem jest identyfikator wbudowanej sekcji (zapisany w sekcji jako `builtin`),
//   dzięki czemu zmiana nazwy sekcji w Ustawieniach nie psuje rozpoznawania.
// =============================================================================

export type BuiltinSectionKey = 'praca' | 'dom' | 'zdrowie' | 'inne';

export const BUILTIN_KEYWORDS: Record<BuiltinSectionKey, string[]> = {
  praca: [
    'prac', 'mail', 'e-mail', 'email', 'maila', 'spotkani', 'meeting', 'call', 'calla', 'raport', 'szef',
    'klient', 'projekt', 'prezentacj', 'faktur', 'deadline', 'zadzwonić do klienta', 'zadzwonić do szefa',
    'biuro', 'biurze', 'zespoł', 'zespół', 'podpisać umowę', 'kontrakt', 'oferta', 'ofert', 'excel', 'tabelk', 'dokument',
    'zoom', 'teams', 'slack', 'kod', 'review', 'wdrożeni', 'sprint', 'tasków', 'jira', 'notatk ze spotkania',
    'kontrahent', 'przelew dla firmy', 'delegacj', 'konferencj', 'szkoleni', 'rekrutacj', 'cv', 'urlop',
  ],
  dom: [
    'zakup', 'sklep', 'biedron', 'lidl', 'żabk', 'zabk', 'auchan', 'carrefour', 'kaufland', 'rossmann',
    'sprząt', 'odkurz', 'pranie', 'prać', 'wyprać', 'pralk', 'zmywark', 'zmywać', 'naczyni', 'gotow',
    'obiad', 'kolacj', 'śniadani', 'śmieci', 'smieci', 'rachun', 'opłat', 'czynsz', 'napraw', 'prasow',
    'okna', 'okien', 'podłog', 'łazienk', 'kuchni', 'kuchnia', 'pokój', 'pokoj', 'mieszkani', 'dom',
    'pies', 'psem', 'psa', 'kot', 'kuwet', 'kwiat', 'podlać', 'podlewa', 'mleko', 'chleb', 'pieczyw',
    'paczk', 'paczkomat', 'poczt', 'pościel', 'ogród', 'ogrod', 'garaż', 'samochód', 'przegląd auta', 'mechanik', 'tankowa',
    'prąd', 'za gaz', 'internet', 'opony', 'opon',
  ],
  zdrowie: [
    'siłowni', 'silowni', 'trening', 'bieg', 'pobiegać', 'spacer', 'lekarz', 'dentyst', 'aptek',
    'leki', 'leków', 'lekarstw', 'tabletk', 'witamin', 'jog', 'rower', 'basen', 'pływa', 'fryzjer',
    'kosmetyczk', 'manicure', 'masaż', 'fizjo', 'rehabilit', 'badani', 'krew', 'szczepieni', 'wizyta u',
    'ćwicz', 'ćwiczeni', 'stretching', 'rozciąg', 'medytacj', 'fitness', 'crossfit', 'tenis', 'squash',
    'dieta', 'drzemk', 'psycholog', 'terapi', 'okulist', 'ginekolog', 'przychodni',
  ],
  inne: [],
};

/** Nazwy domyślnych sekcji → klucz wbudowanego słownika (używane przy migracji danych). */
export const BUILTIN_BY_NAME: Record<string, BuiltinSectionKey> = {
  praca: 'praca',
  dom: 'dom',
  zdrowie: 'zdrowie',
  inne: 'inne',
};

/** Słowa, których nie zapamiętujemy przy nauce (zbyt ogólne). */
export const STOPWORDS = [
  'i', 'a', 'o', 'w', 'we', 'z', 'ze', 'na', 'do', 'od', 'po', 'za', 'u', 'dla', 'oraz', 'albo', 'lub',
  'się', 'sie', 'to', 'ten', 'ta', 'te', 'jak', 'co', 'czy', 'nie', 'tak', 'mój', 'moj', 'moja', 'moje',
  'mojej', 'jego', 'jej', 'ich', 'przed', 'przy', 'pod', 'nad', 'bo', 'że', 'ze', 'jutro', 'dziś',
  'dzis', 'dzisiaj', 'potem', 'jeszcze', 'trzeba', 'muszę', 'musze', 'zrobić', 'zrobic', 'iść', 'isc',
  'pójść', 'pojsc', 'coś', 'cos', 'kilka', 'parę', 'pare', 'wyjść', 'wyjsc', 'jechać', 'jechac', 'pojechać',
  'pojechac', 'zrobic',
];
