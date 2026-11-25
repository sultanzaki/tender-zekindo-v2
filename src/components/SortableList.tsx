"use client";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import styles from "./SortableList.module.css";

export interface DragHandleProps {
  /** Spread onto the drag handle button. */
  handle: HTMLAttributes<HTMLButtonElement>;
  isDragging: boolean;
}

/** Moves `activeId` to the position of `overId` within `ids`. Keys that are not
 * in `ids` are ignored, so a stale drop never corrupts the order. */
export function moveId(ids: string[], activeId: string, overId: string) {
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);
  if (from === -1 || to === -1 || from === to) return ids;
  return arrayMove(ids, from, to);
}

/** A vertical list reordered by dragging a handle (mouse, touch or keyboard:
 * focus the handle, Space to pick up, arrows to move, Space to drop).
 * Touch needs a short press, so dragging never fights page scrolling. */
export function SortableList<T>({
  id,
  items,
  getId,
  getLabel,
  disabled = false,
  onReorder,
  children,
}: {
  /** Stable id: keeps server and client markup identical during hydration. */
  id: string;
  items: T[];
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  disabled?: boolean;
  onReorder: (ids: string[]) => void;
  children: (item: T, index: number, drag: DragHandleProps) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const ids = items.map(getId);
  const label = (itemId: string | number) => {
    const item = items.find((i) => getId(i) === String(itemId));
    return item ? getLabel(item) : "item";
  };
  const position = (itemId: string | number) => ids.indexOf(String(itemId)) + 1;

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over) return;
    const next = moveId(ids, String(active.id), String(over.id));
    if (next !== ids) onReorder(next);
  }

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Press Space to pick up this step. Use the arrow keys to move it, Space to drop it, or Escape to cancel.",
        },
        announcements: {
          onDragStart: ({ active }) =>
            `Picked up ${label(active.id)}, position ${position(active.id)} of ${ids.length}.`,
          onDragOver: ({ active, over }) =>
            over
              ? `${label(active.id)} is over position ${position(over.id)} of ${ids.length}.`
              : `${label(active.id)} is no longer over the list.`,
          onDragEnd: ({ active, over }) =>
            over
              ? `${label(active.id)} dropped at position ${position(over.id)} of ${ids.length}.`
              : `${label(active.id)} dropped.`,
          onDragCancel: ({ active }) =>
            `Moving ${label(active.id)} was cancelled.`,
        },
      }}
    >
      <SortableContext
        items={ids}
        strategy={verticalListSortingStrategy}
        disabled={disabled}
      >
        {items.map((item, index) => (
          <SortableRow key={getId(item)} id={getId(item)} label={getLabel(item)}>
            {(drag) => children(item, index, drag)}
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: (drag: DragHandleProps) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={styles.item}
      data-dragging={isDragging || undefined}
    >
      {children({
        isDragging,
        handle: {
          ...attributes,
          ...listeners,
          ref: setActivatorNodeRef,
          "aria-label": `Drag to reorder ${label}`,
          title: "Drag to reorder",
        } as HTMLAttributes<HTMLButtonElement>,
      })}
    </div>
  );
}

/** The grip button a row renders where dragging should start. */
export function DragHandle({
  handle,
  disabled,
}: {
  handle: HTMLAttributes<HTMLButtonElement>;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={styles.handle}
      disabled={disabled}
      {...handle}
    >
      <GripVertical aria-hidden="true" size={16} />
    </button>
  );
}
