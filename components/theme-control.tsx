"use client";

import { useState } from "react";
import { applyTheme, themes, type Theme } from "@/lib/theme";

export function ThemeControl({ current }: { current: Theme }) {
  const [theme, setTheme] = useState(current);

  function choose(next: Theme) {
    applyTheme(next);
    setTheme(next);
  }

  return (
    <div role="group" aria-label="Theme" className="flex border border-line">
      {themes.map((option) => {
        const selected = theme === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => choose(option)}
            className={
              selected
                ? "h-6 bg-accent px-2 text-[12px] text-white"
                : "h-6 px-2 text-[12px] text-muted hover:text-ink"
            }
          >
            {option === "system" ? "System" : option === "light" ? "Light" : "Dark"}
          </button>
        );
      })}
    </div>
  );
}
