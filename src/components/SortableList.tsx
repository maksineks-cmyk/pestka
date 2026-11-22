// Uniwersalna lista z przeciąganiem (drag & drop) oparta o @dnd-kit.
// Przeciąga się za uchwyt (⋮⋮), dzięki czemu przewijanie palcem dalej działa normalnie.
import { useEffect, useState, type HTMLAttributes, type ReactNode } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type Modifier } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { haptic } from '../lib/haptics';

export type HandleProps = HTMLAttributes<HTMLElement>;

/** Blokuje ruch w poziomie — elementy przesuwają się tylko w górę i w dół. */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

function Row({ id, children }: { id: string; children: (handle: HandleProps, dragging: boolean) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`sortable-row ${isDragging ? 'is-dragging' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      {children({ ...attributes, ...listeners } as HandleProps, isDragging)}
    </div>
  );
}

export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  render,
}: {
  items: T[];
  onReorder: (ids: string[]) => void;
  render: (item: T, handle: HandleProps, dragging: boolean) => ReactNode;
}) {
  // Lokalna kolejność — zmienia się od razu po upuszczeniu, zanim baza danych odpowie.
  const [order, setOrder] = useState(items.map((i) => i.id));
  const key = items.map((i) => i.id).join('|');
  useEffect(() => setOrder(key ? key.split('|') : []), [key]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byId = new Map(items.map((i) => [i.id, i]));
  const sorted = order.map((id) => byId.get(id)).filter(Boolean) as T[];

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const next = arrayMove(order, order.indexOf(String(e.active.id)), order.indexOf(String(e.over.id)));
    setOrder(next);
    onReorder(next);
    haptic();
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[verticalOnly]} onDragStart={haptic} onDragEnd={onDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        {sorted.map((item) => (
          <Row key={item.id} id={item.id}>
            {(handle, dragging) => render(item, handle, dragging)}
          </Row>
        ))}
      </SortableContext>
    </DndContext>
  );
}
