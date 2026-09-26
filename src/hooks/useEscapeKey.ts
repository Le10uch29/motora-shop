"use client";

import { useEffect } from "react";

/**
 * Runs `onEscape` when Escape is pressed — the keyboard half of "click outside
 * to close", which every modal and the burger menu already do with a mouse.
 *
 * Listens on the document rather than on the panel, so it works no matter
 * where the focus is: a modal opened by a button leaves focus on that button,
 * outside the panel, and a listener on the panel would never hear the key.
 *
 * `active` exists for a panel that stays mounted while closed (the burger
 * menu); a modal that only exists while open can leave it out.
 */
export function useEscapeKey(onEscape: () => void, active = true) {
  useEffect(() => {
    if (!active) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onEscape();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onEscape, active]);
}
