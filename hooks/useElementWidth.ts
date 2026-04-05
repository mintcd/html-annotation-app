import { useLayoutEffect, useState } from "react";


export function useElementWidth(ref: React.RefObject<HTMLElement | null>, trigger?: unknown) {
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    if (ref.current) {
      setWidth(ref.current.offsetWidth);
    }
  }, [ref, trigger]);

  return width;
}