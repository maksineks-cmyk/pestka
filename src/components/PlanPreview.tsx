// Podgląd „Zaplanuj dzień”: rozpoznane zadania jako karty z sekcją (emoji) i godziną.
// Każde zadanie można poprawić: nazwa, sekcja (stuknij emoji), godzina, usunięcie.
// „Dodaj wszystko” dopisuje zadania do dnia (nigdy nie nadpisuje istniejących).
import { useEffect, useState } from 'react';
import type { Section } from '../lib/types';
import type { ParsedTask } from '../lib/parser';
import { Sheet } from './Sheet';
import { TimePicker } from './TimePicker';
import { addTasks, learnSection } from '../db';
import { downloadIcs } from '../lib/ics';
import { toast } from './Dialogs';
import { IconBell } from './Icons';
import { haptic } from '../lib/haptics';

interface Draft extends ParsedTask {
  key: string;
  /** Sekcja wybrana automatycznie — jeśli użytkownik ją zmieni, klasyfikator się uczy. */
  autoSectionId: string;
  reminder: boolean;
  picker: boolean;
}

const REMINDER_ALERT = 10 as const;

export function PlanPreview({
  items,
  date,
  sections,
  onClose,
  onSaved,
}: {
  items: ParsedTask[] | null;
  date: string;
  sections: Section[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [list, setList] = useState<Draft[]>([]);
  const [saving, setSaving] = useState(false);
  const [timeKey, setTimeKey] = useState<string | null>(null);
  const timeDraft = list.find((d) => d.key === timeKey);

  useEffect(() => {
    if (!items) return;
    setList(items.map((t, i) => ({ ...t, key: `${i}-${t.title}`, autoSectionId: t.sectionId, reminder: false, picker: false })));
  }, [items]);

  const byId = new Map(sections.map((s) => [s.id, s]));
  const fallback = sections[sections.length - 1];
  const patch = (key: string, p: Partial<Draft>) => setList((l) => l.map((d) => (d.key === key ? { ...d, ...p } : d)));
  const remove = (key: string) => setList((l) => l.filter((d) => d.key !== key));

  const bell = (d: Draft) => {
    if (!d.time) return;
    downloadIcs({ uid: `${date}-${d.key}-${Date.now()}`, title: d.title.trim() || 'Zadanie', date, time: d.time, alert: REMINDER_ALERT });
    patch(d.key, { reminder: true });
  };

  const save = async () => {
    const ready = list.filter((d) => d.title.trim());
    if (!ready.length) return toast('Brak zadań do dodania ✏️');
    setSaving(true);
    try {
      await addTasks(
        ready.map((d) => ({
          title: d.title.trim(),
          date,
          sectionId: byId.has(d.sectionId) ? d.sectionId : (fallback?.id ?? d.sectionId),
          time: d.time,
          endTime: d.endTime,
          timeApprox: d.approx,
          reminder: d.reminder && d.time ? { date, time: d.time, alert: REMINDER_ALERT } : undefined,
        })),
      );
      // Nauka: zapamiętujemy słowa z zadań, którym użytkownik ręcznie zmienił sekcję.
      for (const d of ready) if (d.sectionId !== d.autoSectionId) await learnSection(d.title, d.sectionId);
      haptic();
      toast(ready.length === 1 ? 'Dodano 1 zadanie 🌱' : `Dodano zadania: ${ready.length} 🌱`);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Sheet open={!!items} onClose={onClose} title="Twój plan dnia">
      <div className="pv">
        <p className="hint">Stuknij emoji, aby zmienić sekcję. Nazwę i godzinę możesz poprawić od razu.</p>
        {list.map((d) => {
          const s = byId.get(d.sectionId) ?? fallback;
          return (
            <div key={d.key} className="pv-card" style={{ ['--sec' as string]: s?.color ?? '#ce82ff' }}>
              <div className="pv-row">
                <button
                  type="button"
                  className={`pv-badge ${d.picker ? 'is-open' : ''}`}
                  onClick={() => patch(d.key, { picker: !d.picker })}
                  aria-label={`Sekcja: ${s?.name ?? ''}. Stuknij, aby zmienić`}
                >
                  {s?.emoji ?? '✨'}
                </button>
                <div className="pv-main">
                  <input
                    className="pv-title"
                    value={d.title}
                    maxLength={120}
                    onChange={(e) => patch(d.key, { title: e.target.value })}
                    aria-label="Nazwa zadania"
                    enterKeyHint="done"
                  />
                  <div className="pv-meta">
                    <span className="pv-sec-name">{s?.name}</span>
                    <button type="button" className={`pv-time ${d.time ? 'is-set' : ''}`} onClick={() => setTimeKey(d.key)} aria-label="Ustaw godzinę">
                      🕒 {d.time ? `${d.approx ? '~' : ''}${d.time}${d.endTime ? `–${d.endTime}` : ''}` : 'godzina'}
                    </button>
                    {d.time && (
                      <button type="button" className="pv-clear" onClick={() => patch(d.key, { time: undefined, endTime: undefined, approx: undefined, reminder: false })} aria-label="Usuń godzinę">
                        ×
                      </button>
                    )}
                    {d.time && !d.approx && (
                      <button type="button" className={`pv-bell ${d.reminder ? 'is-set' : ''}`} onClick={() => bell(d)} aria-label="Dodaj przypomnienie do kalendarza">
                        <IconBell size={15} /> {d.reminder ? 'Dodano' : 'Przypomnij'}
                      </button>
                    )}
                  </div>
                </div>
                <button type="button" className="pv-del" onClick={() => remove(d.key)} aria-label="Usuń z planu">
                  ×
                </button>
              </div>
              {d.picker && (
                <div className="chips pv-picker">
                  {sections.map((sec) => (
                    <button
                      type="button"
                      key={sec.id}
                      className={`chip ${d.sectionId === sec.id ? 'is-on' : ''}`}
                      style={{ ['--chip' as string]: sec.color }}
                      onClick={() => patch(d.key, { sectionId: sec.id, picker: false })}
                    >
                      {sec.emoji} {sec.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {!list.length && <p className="empty">Lista jest pusta — wróć i wpisz coś do zrobienia.</p>}
        <button type="button" className="btn btn-primary btn-block btn-lg" onClick={save} disabled={saving || !list.length}>
          Dodaj wszystko{list.length ? ` (${list.length})` : ''}
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>Wróć do edycji</button>
      </div>
    </Sheet>
    <TimePicker
      open={!!timeDraft}
      value={timeDraft?.time}
      title={timeDraft ? `O której: ${timeDraft.title}?` : undefined}
      onPick={(time) => timeDraft && patch(timeDraft.key, { time, endTime: undefined, approx: undefined, reminder: false })}
      onClose={() => setTimeKey(null)}
    />
    </>
  );
}
