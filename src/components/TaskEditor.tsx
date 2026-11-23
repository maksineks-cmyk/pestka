// Panel dodawania / edycji zadania: tytuł, sekcja, dzień, przypomnienie, powtarzanie i notatka.
import { useEffect, useMemo, useState } from 'react';
import type { AlertOffset, Recurrence, RecurrenceType, Section, Task } from '../lib/types';
import { Sheet } from './Sheet';
import { addTask, currentRecurrence, deleteTask, updateTask, type TaskInput } from '../db';
import { ALERT_OPTIONS, downloadIcs } from '../lib/ics';
import { WEEKDAYS_SHORT, weekdayMon } from '../lib/dates';
import { describeRecurrence } from '../lib/recurrence';
import { ask, toast } from './Dialogs';
import { IconBell, IconTrash } from './Icons';
import { useLearned } from '../hooks';
import { classify, fallbackSectionId } from '../lib/classifier';

export interface EditorTarget {
  task?: Task; // brak = nowe zadanie
  date: string;
  /** Pusty = sekcja dobierana automatycznie z nazwy zadania. */
  sectionId: string;
}

const REPEAT_CHOICES: { value: RecurrenceType | 'none'; label: string }[] = [
  { value: 'none', label: 'Nie' },
  { value: 'daily', label: 'Codziennie' },
  { value: 'weekdays', label: 'Wybrane dni' },
  { value: 'weekly', label: 'Co tydzień' },
  { value: 'monthly', label: 'Co miesiąc' },
];

/** Domyślna godzina przypomnienia: najbliższa pełna godzina. */
const nextHour = () => `${String(Math.min(23, new Date().getHours() + 1)).padStart(2, '0')}:00`;

export function TaskEditor({ target, sections, onClose }: { target: EditorTarget | null; sections: Section[]; onClose: () => void }) {
  const task = target?.task;
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [hasReminder, setHasReminder] = useState(false);
  const [remDate, setRemDate] = useState('');
  const [remTime, setRemTime] = useState('09:00');
  const [alert, setAlert] = useState<AlertOffset>(10);
  const [repeat, setRepeat] = useState<RecurrenceType | 'none'>('none');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [time, setTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [timeApprox, setTimeApprox] = useState(false);
  // Czy użytkownik sam wybrał sekcję? Jeśli nie (nowe zadanie), dobieramy ją z nazwy.
  const [sectionTouched, setSectionTouched] = useState(true);
  const learnedRows = useLearned();
  const learned = useMemo(() => Object.fromEntries(learnedRows.map((r) => [r.word, r.sectionId])), [learnedRows]);

  // Wypełnij formularz przy każdym otwarciu.
  useEffect(() => {
    if (!target) return;
    const t = target.task;
    setTitle(t?.title ?? '');
    setNote(t?.note ?? '');
    setDate(t?.date ?? target.date);
    setSectionId(t?.sectionId ?? (target.sectionId || fallbackSectionId(sections)));
    setSectionTouched(!!t || !!target.sectionId);
    setTime(t?.time ?? '');
    setEndTime(t?.endTime ?? '');
    setTimeApprox(!!t?.timeApprox);
    setHasReminder(!!t?.reminder);
    setRemDate(t?.reminder?.date ?? t?.date ?? target.date);
    setRemTime(t?.reminder?.time ?? t?.time ?? nextHour());
    setAlert(t?.reminder?.alert ?? 10);
    setRepeat('none');
    setWeekdays([weekdayMon(t?.date ?? target.date)]);
    if (t?.seriesId) {
      currentRecurrence(t).then((r) => {
        if (!r) return;
        setRepeat(r.type);
        if (r.weekdays) setWeekdays(r.weekdays);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const onTitle = (v: string) => {
    setTitle(v);
    if (!sectionTouched && v.trim()) setSectionId(classify(v, sections, learned).sectionId);
  };

  const recurrence: Recurrence | undefined =
    repeat === 'none' ? undefined : repeat === 'weekdays' ? { type: 'weekdays', weekdays: [...weekdays].sort() } : { type: repeat };

  const buildInput = (): TaskInput => ({
    title: title.trim(),
    note: note.trim() || undefined,
    date,
    sectionId,
    // W zadaniach powtarzanych przypomnienie zawsze dotyczy dnia wystąpienia.
    reminder: hasReminder ? { date: recurrence ? date : remDate, time: remTime, alert } : undefined,
    recurrence,
    time: time || undefined,
    endTime: time && endTime > time ? endTime : undefined,
    timeApprox: time ? timeApprox : undefined,
  });

  const save = async () => {
    if (!title.trim()) {
      toast('Wpisz nazwę zadania ✏️');
      return;
    }
    if (repeat === 'weekdays' && !weekdays.length) {
      toast('Wybierz przynajmniej jeden dzień tygodnia');
      return;
    }
    const input = buildInput();
    if (task) await updateTask(task, input);
    else await addTask(input);
    onClose();
    toast(task ? 'Zapisano zmiany ✅' : 'Dodano zadanie 🌱');
  };

  const addToCalendar = () => {
    if (!title.trim()) {
      toast('Najpierw wpisz nazwę zadania');
      return;
    }
    const input = buildInput();
    downloadIcs({
      uid: task?.seriesId ?? task?.id ?? `${Date.now()}`,
      title: input.title,
      note: input.note,
      date: input.reminder!.date,
      time: input.reminder!.time,
      alert,
      recurrence,
    });
  };

  const remove = async () => {
    if (!task) return;
    const choice = task.seriesId
      ? await ask('Usunąć zadanie?', 'To zadanie się powtarza.', [
          { label: 'Tylko to', value: 'one' as const, variant: 'danger' },
          { label: 'To i wszystkie następne', value: 'series' as const, variant: 'danger' },
        ])
      : await ask('Usunąć zadanie?', `„${task.title}” zniknie na zawsze.`, [{ label: 'Usuń', value: 'one' as const, variant: 'danger' }]);
    if (!choice) return;
    await deleteTask(task, choice);
    onClose();
    toast('Usunięto zadanie 🗑️');
  };

  const toggleWeekday = (i: number) => setWeekdays((w) => (w.includes(i) ? w.filter((x) => x !== i) : [...w, i]));

  return (
    <Sheet open={!!target} onClose={onClose} title={task ? 'Edytuj zadanie' : 'Nowe zadanie'}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input className="input input-big" placeholder="Co do zrobienia? np. Fryzjer" value={title} onChange={(e) => onTitle(e.target.value)} maxLength={120} enterKeyHint="done" />

        <label className="field-label">Sekcja</label>
        <div className="chips">
          {sections.map((s) => (
            <button type="button" key={s.id} className={`chip ${sectionId === s.id ? 'is-on' : ''}`} style={{ ['--chip' as string]: s.color }} onClick={() => {
                setSectionId(s.id);
                setSectionTouched(true);
              }}>
              {s.emoji} {s.name}
            </button>
          ))}
        </div>

        <label className="field-label">Dzień</label>
        <input className="input" type="date" value={date} onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            if (remDate === date) setRemDate(v); // przypomnienie "podąża" za dniem zadania
            setDate(v);
          }} />

        <label className="field-label">Godzina w planie dnia</label>
        <div className="row2 time-row">
          <input className="input" type="time" value={time} aria-label="Godzina" onChange={(e) => {
              setTime(e.target.value);
              setTimeApprox(false);
              if (e.target.value && !hasReminder) setRemTime(e.target.value);
            }} />
          {time && <input className="input" type="time" value={endTime} aria-label="Do godziny (opcjonalnie)" onChange={(e) => setEndTime(e.target.value)} />}
          {time && (
            <button type="button" className="btn btn-small btn-secondary" onClick={() => { setTime(''); setEndTime(''); setTimeApprox(false); }}>
              Bez godziny
            </button>
          )}
        </div>
        {!time && <p className="hint">Bez godziny zadanie trafi do swojej sekcji. Z godziną — na oś „Plan dnia”.</p>}
        {time && <p className="hint">{timeApprox ? 'Godzina przybliżona. ' : ''}Drugie pole to (opcjonalny) koniec, np. 15:00–16:30.</p>}

        <label className="field-label">Powtarzaj</label>
        <div className="chips">
          {REPEAT_CHOICES.map((c) => (
            <button type="button" key={c.value} className={`chip ${repeat === c.value ? 'is-on' : ''}`} onClick={() => setRepeat(c.value)}>
              {c.label}
            </button>
          ))}
        </div>
        {repeat === 'weekdays' && (
          <div className="weekday-picker">
            {WEEKDAYS_SHORT.map((d, i) => (
              <button type="button" key={d} className={`wd ${weekdays.includes(i) ? 'is-on' : ''}`} onClick={() => toggleWeekday(i)}>
                {d}
              </button>
            ))}
          </div>
        )}
        {recurrence && <p className="hint">🔁 {describeRecurrence(recurrence, date)}</p>}

        <label className="switch-row">
          <span><IconBell size={18} /> Przypomnienie</span>
          <input type="checkbox" className="toggle" checked={hasReminder} onChange={(e) => {
              setHasReminder(e.target.checked);
              if (e.target.checked && time) setRemTime(time);
            }} />
        </label>
        {hasReminder && (
          <div className="reminder-box">
            <div className="row2">
              {!recurrence && <input className="input" type="date" value={remDate} onChange={(e) => e.target.value && setRemDate(e.target.value)} />}
              <input className="input" type="time" value={remTime} onChange={(e) => e.target.value && setRemTime(e.target.value)} />
            </div>
            <label className="field-label">Alert</label>
            <div className="chips">
              {ALERT_OPTIONS.map((o) => (
                <button type="button" key={o.value} className={`chip ${alert === o.value ? 'is-on' : ''}`} onClick={() => setAlert(o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-blue btn-block" onClick={addToCalendar}>
              📅 Dodaj przypomnienie do kalendarza
            </button>
            <p className="hint">iPhone otworzy wydarzenie — stuknij „Dodaj”, a Kalendarz sam przypomni Ci o zadaniu.</p>
          </div>
        )}

        <label className="field-label">Notatka</label>
        <textarea className="input" rows={2} placeholder="Opcjonalnie…" value={note} onChange={(e) => setNote(e.target.value)} />

        <button type="submit" className="btn btn-primary btn-block btn-lg">{task ? 'Zapisz' : 'Dodaj zadanie'}</button>
        {task && (
          <button type="button" className="btn btn-ghost-danger btn-block" onClick={remove}>
            <IconTrash size={18} /> Usuń zadanie
          </button>
        )}
      </form>
    </Sheet>
  );
}
