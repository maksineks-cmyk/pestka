// Szybki wybór godziny: pory dnia jednym stuknięciem albo siatka godzin + minuty.
import { useEffect, useState } from 'react';
import { Sheet } from './Sheet';

const QUICK: { label: string; time: string }[] = [
  { label: '🌅 Rano', time: '08:00' },
  { label: '☀️ Południe', time: '12:00' },
  { label: '🌤️ Po południu', time: '15:00' },
  { label: '🌙 Wieczorem', time: '19:00' },
];
const DAY_HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6–23
const NIGHT_HOURS = [0, 1, 2, 3, 4, 5];
const MINUTES = [0, 15, 30, 45];
const pad = (n: number) => String(n).padStart(2, '0');

export function TimePicker({
  open,
  value,
  title = 'O której?',
  onPick,
  onClose,
}: {
  open: boolean;
  value?: string;
  title?: string;
  /** Wybrana godzina "GG:MM" albo undefined = bez godziny. */
  onPick: (time: string | undefined) => void;
  onClose: () => void;
}) {
  const [hour, setHour] = useState<number | null>(null);
  const [minute, setMinute] = useState(0);
  const [night, setNight] = useState(false);

  useEffect(() => {
    if (!open) return;
    const [h, m] = (value ?? '').split(':').map(Number);
    const has = !!value && !Number.isNaN(h);
    setHour(has ? h : null);
    setMinute(has ? m : 0);
    setNight(has && h < 6);
  }, [open, value]);

  const pick = (t: string | undefined) => {
    onPick(t);
    onClose();
  };
  const chosen = hour !== null ? `${pad(hour)}:${pad(minute)}` : null;
  const hours = night ? NIGHT_HOURS : DAY_HOURS;

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="tp">
        <div className="tp-quick">
          {QUICK.map((q) => (
            <button type="button" key={q.time} className={`tp-quick-btn ${value === q.time ? 'is-on' : ''}`} onClick={() => pick(q.time)}>
              <span>{q.label}</span>
              <b>{q.time}</b>
            </button>
          ))}
        </div>

        <div className="tp-label-row">
          <span className="field-label">Godzina</span>
          <button type="button" className="tp-night" onClick={() => setNight((n) => !n)}>
            {night ? '☀️ dzień 6–23' : '🌙 noc 0–5'}
          </button>
        </div>
        <div className="tp-hours">
          {hours.map((h) => (
            <button type="button" key={h} className={`tp-hour ${hour === h ? 'is-on' : ''}`} onClick={() => setHour(h)}>
              {h}
            </button>
          ))}
        </div>

        <span className="field-label">Minuty</span>
        <div className="tp-mins">
          {MINUTES.map((m) => (
            <button type="button" key={m} className={`tp-min ${minute === m ? 'is-on' : ''}`} onClick={() => setMinute(m)}>
              :{pad(m)}
            </button>
          ))}
        </div>

        <button type="button" className="btn btn-primary btn-block btn-lg" disabled={!chosen} onClick={() => chosen && pick(chosen)}>
          {chosen ? `Ustaw ${chosen}` : 'Wybierz godzinę'}
        </button>

        <label className="tp-exact">
          <span>Inna dokładna godzina:</span>
          {/* Zapis po zamknięciu zegara (blur) — iOS zmienia wartość już podczas kręcenia kółkiem. */}
          <input
            className="input"
            type="time"
            defaultValue={value}
            key={`${open}-${value}`}
            onBlur={(e) => e.target.value && e.target.value !== value && pick(e.target.value)}
            aria-label="Dokładna godzina"
          />
        </label>

        {value && (
          <button type="button" className="btn btn-ghost-danger btn-block" onClick={() => pick(undefined)}>
            Bez godziny
          </button>
        )}
      </div>
    </Sheet>
  );
}
