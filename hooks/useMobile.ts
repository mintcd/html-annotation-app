"use client";

import { useCallback, useEffect, useState } from "react";

type UseMobileReturn = {
  isMobile: boolean;
  isIOS: boolean;
  viewportInfo: {
    layoutWidth: number;
    layoutHeight: number;
    visualWidth: number;
    visualHeight: number;
    offsetTop: number;
    offsetLeft: number;
    scale: number;
  };
  updateViewportInfo: () => void;
};

type UseCoarsePointerReturn = {
  isCoarsePointer: boolean;
  isResolved: boolean;
};

/** True when the device's primary pointing input is coarse and has no hover. */
export function useCoarsePointer(): UseCoarsePointerReturn {
  const [state, setState] = useState<UseCoarsePointerReturn>({
    isCoarsePointer: false,
    isResolved: false,
  });

  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse) and (hover: none)');
    const update = () => setState({
      isCoarsePointer: media.matches,
      isResolved: true,
    });
    update();
    if (media.addEventListener) media.addEventListener('change', update);
    else media.addListener(update);
    return () => {
      if (media.removeEventListener) media.removeEventListener('change', update);
      else media.removeListener(update);
    };
  }, []);

  return state;
}

export function useMobile(): UseMobileReturn {
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [viewportInfo, setViewportInfo] = useState<{ layoutWidth: number; layoutHeight: number; visualWidth: number; visualHeight: number; offsetTop: number; offsetLeft: number; scale: number }>({ layoutWidth: 0, layoutHeight: 0, visualWidth: 0, visualHeight: 0, offsetTop: 0, offsetLeft: 0, scale: 1 });

  useEffect(() => {
    const checkTouch = () => {
      setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
      setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
    };
    checkTouch();
  }, []);

  const updateViewportInfo = useCallback(() => {
    if (window.visualViewport) {
      setViewportInfo({
        layoutWidth: window.innerWidth,
        layoutHeight: window.innerHeight,
        visualWidth: window.visualViewport.width,
        visualHeight: window.visualViewport.height,
        offsetTop: window.visualViewport.offsetTop,
        offsetLeft: window.visualViewport.offsetLeft,
        scale: window.visualViewport.scale,
      });
    }
  }, []);

  useEffect(() => {
    if (!isMobile) return;

    const initialFrame = window.requestAnimationFrame(updateViewportInfo);

    // Listen to visualViewport events for mobile-specific changes
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewportInfo);
      window.visualViewport.addEventListener('scroll', updateViewportInfo);
    }

    return () => {
      window.cancelAnimationFrame(initialFrame);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateViewportInfo);
        window.visualViewport.removeEventListener('scroll', updateViewportInfo);
      }
    }
  }, [isMobile, updateViewportInfo])


  return { isMobile, isIOS, viewportInfo, updateViewportInfo };
}
