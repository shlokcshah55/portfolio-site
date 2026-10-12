import { useCallback, useSyncExternalStore } from "react";

/* Width below which the site switches to its phone layouts. Kept in
   sync with the `@media (max-width: 720px)` blocks in the CSS. */
export const COMPACT_QUERY = "(max-width: 720px)";

export default function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  const getSnapshot = () => window.matchMedia(query).matches;
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
