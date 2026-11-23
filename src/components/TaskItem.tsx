// Pojedyncze zadanie na liście: pole wyboru, tytuł, ikonki (dzwonek, powtarzanie) i uchwyt do przeciągania.
import { useState } from 'react';
import type { Task } from '../lib/types';
import { IconBell, IconCheck, IconGrip, IconRepeat } from './Icons';
import type { HandleProps } from './SortableList';
import { XP_PER_TASK } from '../lib/stats';

export function TaskItem({
  task,
  color,
  handle,
  dragging,
  onToggle,
  onEdit,
  onBell,
  big,
}: {
  task: Task;
  color: string;
  /** Uchwyt do przeciągania (brak = zadanie bez przeciągania, np. na osi czasu). */
  handle?: HandleProps;
  dragging?: boolean;
  onToggle: (t: Task) => void;
  onEdit: (t: Task) => void;
  /** Jedno stuknięcie = przypomnienie .ics (tylko zadania z konkretną godziną). */
  onBell?: (t: Task) => void;
  /** Duży wiersz (oś czasu „Plan dnia”). */
  big?: boolean;
}) {
  // Licznik "+10 XP" — każda zmiana klucza odpala animację od nowa.
  const [xpPop, setXpPop] = useState(0);

  const toggle = () => {
    if (!task.done) setXpPop((n) => n + 1);
    onToggle(task);
  };

  return (
    <div className={`task ${task.done ? 'is-done' : ''} ${dragging ? 'is-dragging' : ''} ${big ? 'is-big' : ''}`} style={{ ['--sec' as string]: color }}>
      <button className="check" onClick={toggle} aria-pressed={task.done} aria-label={task.done ? 'Oznacz jako niezrobione' : 'Oznacz jako zrobione'}>
        <span className="check-box">{task.done && <IconCheck size={20} />}</span>
        {xpPop > 0 && <span key={xpPop} className="xp-pop">+{XP_PER_TASK} XP</span>}
      </button>
      <button className="task-main" onClick={() => onEdit(task)}>
        <span className="task-title">{task.title}</span>
        {(task.reminder || task.seriesId || task.note) && (
          <span className="task-meta">
            {task.reminder && (
              <span className="meta-pill"><IconBell size={13} /> {task.reminder.time}</span>
            )}
            {task.seriesId && (
              <span className="meta-pill"><IconRepeat size={13} /></span>
            )}
            {task.note && <span className="meta-note">{task.note}</span>}
          </span>
        )}
      </button>
      {onBell && task.time && !task.timeApprox && !task.done && (
        <button
          className={`task-bell ${task.reminder ? 'is-set' : ''}`}
          onClick={() => onBell(task)}
          aria-label={task.reminder ? `Przypomnienie ustawione na ${task.reminder.time} — dodaj ponownie do kalendarza` : 'Dodaj przypomnienie do kalendarza'}
        >
          <IconBell size={19} />
        </button>
      )}
      {handle && (
        <span className="grip" {...handle} aria-label="Przeciągnij, aby zmienić kolejność">
          <IconGrip size={20} />
        </span>
      )}
    </div>
  );
}
