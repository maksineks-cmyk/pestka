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
}: {
  task: Task;
  color: string;
  handle: HandleProps;
  dragging: boolean;
  onToggle: (t: Task) => void;
  onEdit: (t: Task) => void;
}) {
  // Licznik "+10 XP" — każda zmiana klucza odpala animację od nowa.
  const [xpPop, setXpPop] = useState(0);

  const toggle = () => {
    if (!task.done) setXpPop((n) => n + 1);
    onToggle(task);
  };

  return (
    <div className={`task ${task.done ? 'is-done' : ''} ${dragging ? 'is-dragging' : ''}`} style={{ ['--sec' as string]: color }}>
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
      <span className="grip" {...handle} aria-label="Przeciągnij, aby zmienić kolejność">
        <IconGrip size={20} />
      </span>
    </div>
  );
}
