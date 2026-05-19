import { useEffect } from "react";

// Calls `handler` when the user presses Escape, but only while `enabled`.
// Use in modal/dialog components that don't use shadcn Dialog (Radix already
// handles Escape automatically).
//
//   useEscapeKey(open, onClose);
//
// Example:
//   useEscapeKey(isOpen, () => setIsOpen(false));
export function useEscapeKey(enabled, handler) {
  useEffect(() => {
    if (!enabled || typeof handler !== "function") return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") handler(e);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled, handler]);
}

export default useEscapeKey;
