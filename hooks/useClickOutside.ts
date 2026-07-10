import { useEffect } from "react";

export function useClickOutside(
  ref: React.RefObject<HTMLElement>,
  handleOnClickOutside: (event: MouseEvent | TouchEvent) => void
) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      // Ignore synthetic events forwarded from the iframe (e.g. via dispatchEvent).
      // Those are not trusted user events and should not dismiss the sidebar.
      if (!event.isTrusted) return;
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handleOnClickOutside(event);
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handleOnClickOutside]);
}