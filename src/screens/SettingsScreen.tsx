// Ustawienia: zarządzanie sekcjami, kopia zapasowa (eksport/import) i reset danych.
import { useRef, useState } from 'react';
import type { Section } from '../lib/types';
import { SECTION_COLORS, addSection, deleteSection, exportData, forgetLearned, importData, reorderSections, resetAll, updateSection, validateBackup } from '../db';
import { useLearned } from '../hooks';
import { builtinKeyOf } from '../lib/classifier';
import { BUILTIN_KEYWORDS, type BuiltinSectionKey } from '../lib/keywords';
import { SortableList } from '../components/SortableList';
import { Sheet } from '../components/Sheet';
import { IconGrip, IconRight } from '../components/Icons';
import { ask, confirmBox, toast } from '../components/Dialogs';
import { saveFile } from '../lib/files';
import { todayKey } from '../lib/dates';

const EMOJI_SUGGESTIONS = ['💼', '🏠', '💪', '✨', '📚', '🛒', '🧹', '🍎', '🧘', '🐶', '💰', '🎨', '🎮', '✈️', '❤️', '🌱', '🎓', '🚗', '☕', '🎵'];

interface Draft {
  id?: string;
  name: string;
  emoji: string;
  color: string;
  keywords?: string[];
  builtin?: BuiltinSectionKey;
}

/** Dzieli wpis „a, b; c” na pojedyncze słowa kluczowe. */
const splitKeywords = (v: string) => v.split(/[,;\n]/).map((k) => k.trim().toLowerCase()).filter(Boolean);

function SectionEditor({ draft, sections, onClose }: { draft: Draft | null; sections: Section[]; onClose: () => void }) {
  const [d, setD] = useState<Draft>({ name: '', emoji: '✨', color: SECTION_COLORS[0] });
  const [lastDraft, setLastDraft] = useState<Draft | null>(null);
  const [kwInput, setKwInput] = useState('');
  const learned = useLearned();
  // Przy otwarciu nowego szkicu kopiujemy go do stanu formularza.
  if (draft !== lastDraft) {
    setLastDraft(draft);
    if (draft) setD(draft);
    setKwInput('');
  }

  const keywords = d.keywords ?? [];
  const addKeywords = () => {
    const add = splitKeywords(kwInput).filter((k) => !keywords.includes(k));
    if (add.length) setD({ ...d, keywords: [...keywords, ...add] });
    setKwInput('');
  };
  const builtinKey = builtinKeyOf({ id: d.id ?? '', name: d.name, builtin: d.builtin });
  const builtinWords = builtinKey ? BUILTIN_KEYWORDS[builtinKey] : [];
  const learnedHere = d.id ? learned.filter((l) => l.sectionId === d.id) : [];

  const save = async () => {
    const name = d.name.trim();
    if (!name) return toast('Podaj nazwę sekcji');
    const emoji = [...d.emoji.trim()].slice(0, 2).join('') || '✨';
    // Słowa wpisane w polu, ale niezatwierdzone przyciskiem, też zapisujemy.
    const kw = [...new Set([...keywords, ...splitKeywords(kwInput)])];
    if (d.id) await updateSection(d.id, { name, emoji, color: d.color, keywords: kw });
    else await addSection({ name, emoji, color: d.color, keywords: kw });
    toast(d.id ? 'Zapisano sekcję' : 'Dodano sekcję 🎉');
    onClose();
  };

  const remove = async () => {
    if (!d.id) return;
    const others = sections.filter((s) => s.id !== d.id);
    if (!others.length) return toast('Musi zostać przynajmniej jedna sekcja');
    const target = await ask(
      `Usunąć sekcję „${d.name}”?`,
      'Zadania z tej sekcji zostaną przeniesione do:',
      others.map((s) => ({ label: `${s.emoji} ${s.name}`, value: s.id, variant: 'ghost' as const })),
    );
    if (!target) return;
    await deleteSection(d.id, target);
    toast('Usunięto sekcję');
    onClose();
  };

  return (
    <Sheet open={!!draft} onClose={onClose} title={d.id ? 'Edytuj sekcję' : 'Nowa sekcja'}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="section-preview" style={{ ['--sec' as string]: d.color }}>
          <span className="section-emoji">{d.emoji || '✨'}</span>
          <b>{d.name || 'Nazwa sekcji'}</b>
        </div>
        <label className="field-label">Nazwa</label>
        <input className="input" value={d.name} maxLength={30} placeholder="np. Szkoła" onChange={(e) => setD({ ...d, name: e.target.value })} />
        <label className="field-label">Emoji</label>
        <div className="emoji-grid">
          {EMOJI_SUGGESTIONS.map((e) => (
            <button type="button" key={e} className={`emoji-btn ${d.emoji === e ? 'is-on' : ''}`} onClick={() => setD({ ...d, emoji: e })}>{e}</button>
          ))}
        </div>
        <input className="input" value={d.emoji} placeholder="…lub wpisz własne emoji" onChange={(e) => setD({ ...d, emoji: e.target.value })} />
        <label className="field-label">Kolor</label>
        <div className="color-grid">
          {SECTION_COLORS.map((c) => (
            <button type="button" key={c} className={`color-btn ${d.color === c ? 'is-on' : ''}`} style={{ background: c }} onClick={() => setD({ ...d, color: c })} aria-label={`Kolor ${c}`} />
          ))}
        </div>
        <label className="field-label">Słowa kluczowe</label>
        <p className="hint">Zadania z tymi słowami trafią do tej sekcji automatycznie. Wystarczy rdzeń — „zakup” pasuje też do „zakupy” i „zakupów”.</p>
        {keywords.length > 0 && (
          <div className="chips">
            {keywords.map((k) => (
              <button type="button" key={k} className="chip is-on kw-chip" style={{ ['--chip' as string]: d.color }} onClick={() => setD({ ...d, keywords: keywords.filter((x) => x !== k) })} aria-label={`Usuń słowo ${k}`}>
                {k} ×
              </button>
            ))}
          </div>
        )}
        <div className="row2">
          <input
            className="input"
            value={kwInput}
            placeholder="np. sprawdzian, matematyka"
            onChange={(e) => setKwInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addKeywords();
              }
            }}
            enterKeyHint="done"
          />
          <button type="button" className="btn btn-secondary" onClick={addKeywords}>Dodaj</button>
        </div>
        {learnedHere.length > 0 && (
          <>
            <label className="field-label">Nauczone z Twoich przeniesień</label>
            <div className="chips">
              {learnedHere.map((l) => (
                <button type="button" key={l.word} className="chip kw-chip" onClick={() => forgetLearned(l.word)} aria-label={`Zapomnij słowo ${l.word}`}>
                  {l.word} ×
                </button>
              ))}
            </div>
          </>
        )}
        {builtinWords.length > 0 && (
          <details className="builtin-kw">
            <summary>Wbudowane słowa ({builtinWords.length})</summary>
            <p className="hint">{builtinWords.join(', ')}</p>
          </details>
        )}

        <button type="submit" className="btn btn-primary btn-block btn-lg">Zapisz</button>
        {d.id && <button type="button" className="btn btn-ghost-danger btn-block" onClick={remove}>Usuń sekcję</button>}
      </form>
    </Sheet>
  );
}

export function SettingsScreen({ sections }: { sections: Section[] }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const doExport = async () => {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    await saveFile(blob, `pestka-kopia-${todayKey()}.json`, true);
    toast('Kopia zapasowa gotowa 💾');
  };

  const doImport = async (file: File) => {
    try {
      // Najpierw sprawdzamy plik, dopiero potem pytamy o zastąpienie danych.
      const backup = validateBackup(JSON.parse(await file.text()));
      const ok = await confirmBox('Wczytać kopię?', `${backup.tasks.length} zadań i ${backup.sections.length} sekcji. Obecne dane zostaną ZASTĄPIONE.`, 'Wczytaj', true);
      if (!ok) return;
      await importData(backup);
      toast('Dane przywrócone ✅');
    } catch (err) {
      toast(err instanceof SyntaxError ? 'Plik nie jest poprawnym JSON-em' : (err as Error).message);
    }
  };

  const doReset = async () => {
    if (!(await confirmBox('Usunąć wszystkie dane?', 'Zadania, sekcje, seria i XP zostaną skasowane. Tego nie da się cofnąć!', 'Dalej', true))) return;
    if (!(await confirmBox('Na pewno?', 'Ostatnia szansa — może najpierw zrób kopię zapasową?', 'Usuń wszystko', true))) return;
    await resetAll();
    toast('Wszystko wyczyszczone 🧽');
  };

  return (
    <div className="screen settings-screen">
      <header className="screen-header"><h1>Ustawienia</h1></header>

      <h2 className="group-title">Sekcje</h2>
      <div className="card list-card">
        <SortableList
          items={sections}
          onReorder={reorderSections}
          render={(s, handle) => (
            <div className="list-row" style={{ ['--sec' as string]: s.color }}>
              <span className="grip" {...handle} aria-label="Przeciągnij, aby zmienić kolejność"><IconGrip size={20} /></span>
              <button className="list-row-main" onClick={() => setDraft({ ...s, keywords: s.keywords ?? [] })}>
                <span className="section-emoji small">{s.emoji}</span>
                <span className="list-row-title">{s.name}</span>
                <span className="color-dot" />
                <IconRight size={18} />
              </button>
            </div>
          )}
        />
      </div>
      <button className="btn btn-secondary btn-block" onClick={() => setDraft({ name: '', emoji: '✨', color: SECTION_COLORS[(sections.length + 4) % SECTION_COLORS.length] })}>
        + Dodaj sekcję
      </button>

      <h2 className="group-title">Kopia zapasowa</h2>
      <div className="card stack">
        <p className="hint">Dane są tylko na tym telefonie. Rób czasem kopię i zapisz ją np. w aplikacji Pliki lub iCloud Drive.</p>
        <button className="btn btn-blue btn-block" onClick={doExport}>💾 Eksportuj dane (JSON)</button>
        <button className="btn btn-secondary btn-block" onClick={() => fileRef.current?.click()}>📂 Importuj z pliku</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) doImport(f);
            e.target.value = '';
          }}
        />
      </div>

      <h2 className="group-title">Strefa niebezpieczna</h2>
      <div className="card stack">
        <button className="btn btn-danger btn-block" onClick={doReset}>Usuń wszystkie dane</button>
      </div>

      <p className="footer-note">Pestka · planer dnia · v1.3<br />Działa offline, bez konta i bez serwera. 🌱</p>

      <SectionEditor draft={draft} sections={sections} onClose={() => setDraft(null)} />
    </div>
  );
}
