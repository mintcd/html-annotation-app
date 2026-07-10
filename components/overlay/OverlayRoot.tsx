"use client";

import {
  useCallback,
  useRef,
  useSyncExternalStore,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import styles from "./AnnotatorOverlay.module.css";

export type OverlayLayerName = "workspace" | "contextual" | "feedback" | "dialog";

export type OverlayRootProps = {
  children: ReactNode;
  container?: HTMLElement | null;
  id?: string;
  className?: string;
};

/**
 * Creates one portal host for every annotator overlay. The host is appended
 * after hydration so server rendering and Vinext's RSC pass never touch the DOM.
 */
export function OverlayRoot({
  children,
  container,
  id = "annotator-overlay-root",
  className,
}: OverlayRootProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const ownsHostRef = useRef(false);

  const subscribe = useCallback((onStoreChange: () => void) => {
    const parent = container ?? document.body;
    const existingHost = document.getElementById(id);
    const nextHost = existingHost instanceof HTMLDivElement
      ? existingHost
      : document.createElement("div");

    if (!existingHost) {
      nextHost.id = id;
      parent.appendChild(nextHost);
      ownsHostRef.current = true;
    }

    nextHost.dataset.annotatorOverlayRoot = "";
    hostRef.current = nextHost;
    onStoreChange();

    return () => {
      hostRef.current = null;
      if (ownsHostRef.current && nextHost.parentNode) {
        nextHost.parentNode.removeChild(nextHost);
      }
      ownsHostRef.current = false;
    };
  }, [container, id]);

  const getSnapshot = useCallback(() => hostRef.current, []);
  const getServerSnapshot = useCallback(() => null, []);
  const host = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!host) return null;

  return createPortal(
    <div className={[styles.root, className].filter(Boolean).join(" ")}>
      {children}
    </div>,
    host,
  );
}

export type OverlayLayerProps = HTMLAttributes<HTMLDivElement> & {
  layer: OverlayLayerName;
};

export function OverlayLayer({ layer, className, children, ...props }: OverlayLayerProps) {
  return (
    <div
      {...props}
      data-annotator-overlay-layer={layer}
      className={[styles.layer, styles[layer], className].filter(Boolean).join(" ")}
    >
      {children}
    </div>
  );
}

type NamedLayerProps = Omit<OverlayLayerProps, "layer">;

export function WorkspaceLayer(props: NamedLayerProps) {
  return <OverlayLayer {...props} layer="workspace" />;
}

export function ContextualLayer(props: NamedLayerProps) {
  return <OverlayLayer {...props} layer="contextual" />;
}

export function FeedbackLayer(props: NamedLayerProps) {
  return <OverlayLayer {...props} layer="feedback" />;
}

export function DialogLayer(props: NamedLayerProps) {
  return <OverlayLayer {...props} layer="dialog" />;
}
