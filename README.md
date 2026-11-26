# 🌱 Pestka – Planer dnia

Osobisty, wesoły planer dnia na iPhone'a w formie aplikacji PWA (Progressive Web App).
Bez konta, bez logowania i bez serwera — wszystkie dane zostają na Twoim telefonie i aplikacja działa offline.

## Co potrafi

- **Szybki wpis „Co dziś masz do zrobienia?”** — wpisz wszystko w jedno pole (np. „fryzjer o 15, siłownia - zakupy w biedronce - mail do szefa, odkurzyć pokój 18:30, wyjść z psem”), stuknij **Zaplanuj dzień**, a Pestka sama podzieli tekst na zadania, przypisze sekcje i wykryje godziny. Przed zapisaniem zobaczysz podgląd, w którym poprawisz nazwę, sekcję (stuknij emoji) i godzinę.
  - Separatory: przecinek, średnik, nowa linia, „ - ”, „– ”, „— ”, „• ”. Słowa z łącznikiem („e-mail”) i zakresy godzin („15-16”) nie są dzielone.
  - Godziny: „15:00”, „15.00”, „o 15”, „na 9”, „15-16”, „15:00-16:30”, „rano”, „w południe”, „po południu”, „wieczorem”.
  - **#dom odkurzyć** albo **odkurzyć #dom** — wymusza sekcję.
  - Pestka **uczy się**: gdy ręcznie przeniesiesz zadanie do innej sekcji, zapamięta jego słowa. Własne słowa kluczowe ustawisz w **Ustawienia → sekcja**.
- **Plan dnia** — oś czasu zadań z godziną z czerwoną linią „teraz”; przypomnienie `.ics` jednym stuknięciem w dzwonek.
- **Widok „🕒 Godziny”** (domyślny): cały dzień jako jedna lista od rana do wieczora, zadania bez godziny w grupie „Kiedykolwiek”. Przełącznik **🗂️ Sekcje** pokazuje dawny podział na sekcje.
- **Cofnij**: po odhaczeniu, przeniesieniu, zmianie godziny, edycji czy usunięciu na górze na 5 s pojawia się przycisk „↩️ Cofnij”.
- Po zaplanowaniu dnia pole wpisu się chowa — wraca po stuknięciu **„✍️ Dopisz zadania”**.
- W widoku „Godziny” zadania na osi czasu można przestawiać — zamieniają się godzinami.
- **Przeciąganie kafelków**: przytrzymaj zadanie i przesuń je do innej sekcji (Pestka zapamięta to na przyszłość) albo na „Plan dnia”, aby nadać mu godzinę.
- **Szybka godzina**: stuknij zegar przy zadaniu (albo godzinę na osi czasu) → „Rano / Południe / Po południu / Wieczorem” jednym stuknięciem lub siatka godzin i minut.
- **Kalendarz** miesięczny z pierścieniem postępu przy każdym dniu (przesuń palcem w lewo/prawo, aby zmienić miesiąc).
- **Lista zadań na dzień** podzielona na **sekcje** (Praca, Dom, Zdrowie, Na komputerze, Inne… — możesz je dodawać, zmieniać, usuwać, przestawiać, nadawać kolor i emoji).
- Odhaczanie zadań z animacją, **+10 XP** za każde zadanie i **konfetti**, gdy skończysz cały dzień (+50 XP bonusu).
- **Seria 🔥** – liczba kolejnych dni, w których zrobiłeś wszystkie zadania. Dni bez zadań nie przerywają serii, a niedokończony „dziś” liczy się dopiero o północy.
- Przeciąganie zadań (za uchwyt ⋮⋮), **„Przenieś niezrobione na jutro”**.
- **Zadania powtarzane**: codziennie, w wybrane dni tygodnia, co tydzień, co miesiąc.
- **Przypomnienia** przez Kalendarz iPhone'a (plik `.ics` z alarmem) — szczegóły niżej.
- **Statystyki**: seria, najdłuższa seria, XP i poziom, wykres tego tygodnia i ostatnich 8 tygodni.
- **Kopia zapasowa**: eksport/import wszystkich danych do pliku JSON, reset danych.
- Jasny i ciemny motyw (zgodnie z ustawieniem telefonu).

## Jak działają przypomnienia 🔔

Aplikacja internetowa na iPhonie bez własnego serwera nie może niezawodnie wysyłać powiadomień.
Dlatego Pestka tworzy **wydarzenie kalendarza z alarmem**:

1. Edytuj zadanie → włącz **Przypomnienie** → wybierz dzień, godzinę i kiedy ma być alert.
2. Stuknij **„Dodaj przypomnienie do kalendarza”**.
3. iPhone pokaże okno z wydarzeniem — stuknij **„Dodaj”** (wybierz kalendarz).
4. Gotowe! Powiadomienie wyśle już sam iPhone, nawet gdy Pestka jest zamknięta.

> Jeśli w trybie aplikacji (z ekranu początkowego) okno się nie pojawi, otwórz Pestkę w Safari i spróbuj tam — Safari zawsze obsługuje pliki `.ics`.
> Zmiana godziny w Pestce **nie** zmienia już dodanego wydarzenia — dodaj nowe i usuń stare w Kalendarzu.

---

## 🚀 Publikacja w internecie (za darmo, GitHub Pages) — krok po kroku

Nie musisz nic instalować poza przeglądarką. Projekt ma już gotowy plik `.github/workflows/deploy.yml`,
który sam zbuduje i opublikuje aplikację przy każdej zmianie.

### 1. Załóż konto na GitHubie
Wejdź na <https://github.com> → **Sign up** i załóż darmowe konto (zapamiętaj swój login, np. `jankowalski`).

### 2. Utwórz nowe repozytorium
1. Po zalogowaniu kliknij **+** (prawy górny róg) → **New repository**.
2. **Repository name**: np. `pestka` (to będzie część adresu aplikacji).
3. Zaznacz **Public** (GitHub Pages za darmo działa dla publicznych repozytoriów — Twoje *dane* i tak są tylko w telefonie, publiczny jest wyłącznie kod).
4. Kliknij **Create repository**.

### 3. Wgraj pliki projektu
**Najprościej przez przeglądarkę:**
1. Na stronie nowego repozytorium kliknij link **„uploading an existing file”**.
2. Otwórz folder `planer` na komputerze, zaznacz **całą jego zawartość OPRÓCZ folderów `node_modules` i `dist`**, i przeciągnij do okna przeglądarki.
   - Uwaga: folder `.github` jest ukryty. W Windowsie włącz w Eksploratorze: *Widok → Pokaż → Ukryte elementy*. Musi zostać wgrany!
3. Na dole kliknij **Commit changes**.

**Albo przez terminal** (jeśli masz zainstalowany Git), w folderze `planer`:
```powershell
git init
git add .
git commit -m "Pierwsza wersja"
git branch -M main
git remote add origin https://github.com/TWOJ-LOGIN/pestka.git
git push -u origin main
```

### 4. Włącz GitHub Pages
1. W repozytorium wejdź w **Settings** → w menu po lewej **Pages**.
2. W sekcji **Build and deployment → Source** wybierz **GitHub Actions**.
3. Przejdź do zakładki **Actions** — zobaczysz uruchomione zadanie „Deploy na GitHub Pages”. Poczekaj ok. 1–2 minuty, aż pojawi się zielony ✓.
   (Jeśli nic się nie uruchomiło: kliknij workflow po lewej → **Run workflow**.)

### 5. Otwórz aplikację
Adres to: **`https://TWOJ-LOGIN.github.io/pestka/`** (z Twoim loginem i nazwą repozytorium).
Znajdziesz go też w **Settings → Pages**.

### Aktualizacje
Każda zmiana wgrana do gałęzi `main` automatycznie opublikuje nową wersję. Aplikacja na telefonie pobierze ją sama przy następnym uruchomieniu (czasem trzeba ją zamknąć i otworzyć dwa razy).

---

## 📱 Dodanie do ekranu początkowego iPhone'a

1. Otwórz adres aplikacji w **Safari** (to ważne — musi być Safari).
2. Stuknij przycisk **Udostępnij** (kwadrat ze strzałką w górę, na dole ekranu).
3. Przewiń w dół i wybierz **„Do ekranu początkowego”**.
4. Nazwa „Pestka” jest już wpisana — stuknij **Dodaj**.
5. Na ekranie początkowym pojawi się ikonka z żółtą pestką. Uruchamiaj aplikację stamtąd — otworzy się na pełnym ekranie, jak zwykła aplikacja, i będzie działać bez internetu.

> **Ważne o danych:** dane są zapisane w pamięci aplikacji na telefonie. Usunięcie ikonki z ekranu początkowego usuwa też dane!
> Regularnie rób kopię: **Ustawienia → Eksportuj dane** i zapisz plik w aplikacji Pliki / iCloud Drive.

---

## 💻 Dla programistów

Wymagany Node.js 20+.

```powershell
npm install        # instalacja zależności
npm run dev        # serwer deweloperski (http://localhost:5173)
npm run build      # wersja produkcyjna do folderu dist/
npm run preview    # podgląd wersji produkcyjnej
npm run icons      # ponowne wygenerowanie ikon z SVG (scripts/gen-icons.mjs)
npm test           # testy jednostkowe (Vitest) parsera i klasyfikatora
```

### Technologie
- **Vite + React + TypeScript**
- **Dexie** (IndexedDB) – lokalna baza danych, `dexie-react-hooks` do odświeżania widoków na żywo
- **vite-plugin-pwa** (Workbox) – manifest i service worker (tryb offline)
- **@dnd-kit** – przeciąganie zadań i sekcji
- **Nunito** (@fontsource) – zaokrąglona czcionka, wbudowana w aplikację (działa offline)

### Struktura plików
```
planer/
├─ .github/workflows/deploy.yml   # automatyczna publikacja na GitHub Pages
├─ public/                        # ikony (apple-touch-icon, 192, 512, maskable), favicon
├─ scripts/gen-icons.mjs          # generator ikon z maskotki SVG
├─ index.html                     # meta tagi iOS (standalone, safe-area, kolor paska)
├─ vite.config.ts                 # konfiguracja PWA i manifestu
└─ src/
   ├─ main.tsx                    # start aplikacji + rejestracja service workera
   ├─ App.tsx                     # nawigacja między zakładkami
   ├─ db.ts                       # baza danych i wszystkie operacje (zadania, sekcje, serie, kopia)
   ├─ hooks.ts                    # dane na żywo, dzisiejsza data, gest przesunięcia
   ├─ styles.css                  # cały wygląd (motyw jasny/ciemny, animacje)
   ├─ lib/
   │  ├─ parser.ts                # szybki wpis: dzielenie tekstu, wykrywanie godzin (+ parser.test.ts)
   │  ├─ classifier.ts            # przypisywanie sekcji po słowach kluczowych, nauka (+ classifier.test.ts)
   │  ├─ keywords.ts              # SŁOWNIKI słów kluczowych — tu dopisujesz nowe słowa
   │  ├─ dates.ts                 # daty po polsku
   │  ├─ recurrence.ts            # reguły powtarzania
   │  ├─ ics.ts                   # pliki kalendarza z alarmem
   │  ├─ stats.ts                 # seria, XP, poziomy
   │  ├─ files.ts                 # zapisywanie / udostępnianie plików
   │  ├─ haptics.ts               # delikatne "stuknięcie" przy odhaczaniu
   │  └─ types.ts                 # typy danych
   ├─ components/                 # maskotka, pasek zakładek, panel, dialogi, zadanie, edytor…
   └─ screens/                    # Kalendarz, Dzień, Statystyki, Ustawienia
```

### Jak działają zadania powtarzane
Zadanie powtarzane to **seria** (szablon z regułą). Gdy oglądasz dany miesiąc lub dzień, aplikacja tworzy z serii
zwykłe zadania na te dni (jeśli jeszcze nie istnieją). Dzięki temu każde wystąpienie można osobno odhaczyć,
przenieść czy usunąć. Edycja treści wystąpienia zmienia też przyszłe wystąpienia; zmiana reguły kończy starą serię
i zaczyna nową od tego dnia.
