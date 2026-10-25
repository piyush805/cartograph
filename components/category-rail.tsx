import type { Category } from "@/lib/map/categories";

export function CategoryRail({ categories }: { categories: Category[] }) {
  return (
    <ul className="py-1">
      {categories.map((category) => (
        <li
          key={category.name}
          className="flex h-6 items-center gap-2 px-3 text-[12px]"
        >
          <span
            aria-hidden
            className="size-2 shrink-0"
            style={{ background: category.colour }}
          />
          <span className="font-mono">{category.name}</span>
          <span className="ml-auto font-mono text-muted tabular-nums">
            {category.files}
          </span>
        </li>
      ))}
    </ul>
  );
}
