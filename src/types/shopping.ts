/**
 * The shopping list model.
 *
 * Deliberately not a Task, and deliberately not a flag on one. A task can be
 * time-sensitive: it carries a deadline, a repeat and a course, and the whole
 * list is sorted around those. None of it means anything for a carton of milk.
 * Sharing the record would mean every shopping item hauling four fields it can
 * never use, and every deadline query — reminders, the day brief, the overdue
 * count — having to remember to exclude the groceries. Forgetting one of those
 * exclusions is a bug that reads as "why is my app reminding me about bananas".
 *
 * Two small models cost less than one model with a mode.
 */
export interface ShoppingItem {
  id: string;
  title: string;
  /** Ticked once it is in the basket. */
  done: boolean;
  /**
   * Free-form, and the reason this is not just a list of strings: "2%, not
   * skim" is the part you forget. Always a string — empty rather than
   * undefined, so the editor never distinguishes "no note" from "note cleared".
   */
  notes: string;
  createdAt: Date;
  completedAt: Date | null;
}

export function createShoppingItem(title: string): ShoppingItem {
  return {
    id: `shop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: title.trim(),
    done: false,
    notes: '',
    createdAt: new Date(),
    completedAt: null,
  };
}

/** Still to buy. */
export function openShoppingCount(items: ShoppingItem[]): number {
  return items.reduce((n, item) => n + (item.done ? 0 : 1), 0);
}

export interface ShoppingGroups {
  /** Still to buy, oldest first — the order they were added is the order they
   *  were thought of, and nothing here has a better claim to sort by. */
  open: ShoppingItem[];
  /** In the basket, most recently ticked first, so the last thing you picked
   *  up is the one you can see to undo. */
  got: ShoppingItem[];
}

export function groupShopping(items: ShoppingItem[]): ShoppingGroups {
  const open = items.filter((item) => !item.done);
  const got = items
    .filter((item) => item.done)
    .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));

  return { open, got };
}
