import type { CategoryNode } from "@/lib/categories";
import type { Locale } from "@/i18n/locales";

export type CategoryOption = { id: string; parentId: string | null; label: string };

export type CategoryPickerNode = {
  id: string;
  label: string;
  children: { id: string; label: string; isDefault: boolean }[];
};

/** The tree as a client component can hold it: plain strings only, so a form
 * can render a category select and a subcategory select from it without
 * importing the server-only category module. */
export function categoryPicker(tree: CategoryNode[], locale: Locale): CategoryPickerNode[] {
  return tree.map((root) => ({
    id: root.id,
    label: root.name[locale] || root.name.ru,
    children: root.children.map((child) => ({
      id: child.id,
      label: child.name[locale] || child.name.ru,
      isDefault: child.isDefault,
    })),
  }));
}

/**
 * The whole tree flattened into picker options, subcategories shown under the
 * category they belong to ("Ходовая часть → Рычаги").
 *
 * Used wherever one category has to be chosen out of all of them: moving a
 * product, re-filing the products of a category being deleted, or setting a
 * product's category from the product form.
 */
export function categoryOptions(tree: CategoryNode[], locale: Locale): CategoryOption[] {
  const options: CategoryOption[] = [];
  for (const root of tree) {
    const rootLabel = root.name[locale] || root.name.ru;
    options.push({ id: root.id, parentId: null, label: rootLabel });
    for (const child of root.children) {
      options.push({
        id: child.id,
        parentId: root.id,
        label: `${rootLabel} → ${child.name[locale] || child.name.ru}`,
      });
    }
  }
  return options;
}
