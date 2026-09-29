export const CATEGORY_IDS = ['food', 'travel', 'groceries', 'shopping', 'bills', 'health', 'fun', 'other'] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const CATEGORY_NAMES: Record<CategoryId, string> = {
  food: 'Food & Drinks',
  travel: 'Travel',
  groceries: 'Groceries',
  shopping: 'Shopping',
  bills: 'Bills & Home',
  health: 'Health',
  fun: 'Fun',
  other: 'Other',
};

export const isCategory = (v: unknown): v is CategoryId =>
  typeof v === 'string' && (CATEGORY_IDS as readonly string[]).includes(v);

export const categoryName = (id: string) => CATEGORY_NAMES[isCategory(id) ? id : 'other'];
