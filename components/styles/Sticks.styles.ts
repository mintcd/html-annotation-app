const KNOB_SIZE = 8;
const HIT_TARGET_SIZE = 24;
const HIT_TARGET_PADDING = 8;

const sticksStyles = {
  mobileActions: {
    position: 'fixed',
    left: '50%',
    bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    maxWidth: 'calc(100vw - 2rem)',
    padding: 8,
    border: '1px solid rgba(15, 23, 42, 0.12)',
    borderRadius: 14,
    color: 'var(--ds-color-text)',
    background: 'rgba(255, 255, 255, 0.96)',
    boxShadow: 'var(--ds-shadow-lg, 0 12px 32px rgba(15, 23, 42, 0.18))',
    backdropFilter: 'blur(16px)',
    zIndex: 10002,
  } satisfies React.CSSProperties,

  mobileHint: {
    maxWidth: 150,
    fontSize: 12,
    lineHeight: 1.25,
    color: 'var(--ds-color-text-secondary, #475569)',
  } satisfies React.CSSProperties,

  stick: (top: number, x: number, height: number): React.CSSProperties => ({
    position: 'fixed',
    top: top - HIT_TARGET_PADDING,
    left: x - HIT_TARGET_SIZE / 2,
    width: HIT_TARGET_SIZE,
    height: Math.max(HIT_TARGET_SIZE, height + HIT_TARGET_PADDING * 2),
    cursor: 'ew-resize',
    touchAction: 'none',
    userSelect: 'none',
    zIndex: 10000,
  }),

  line: (height: number, width: number = 1.5): React.CSSProperties => ({
    position: 'absolute',
    top: HIT_TARGET_PADDING,
    left: `calc(50% - ${width / 2}px)`,
    width,
    height: Math.max(1, height),
    borderRadius: width,
    backgroundColor: '#0b63b3',
    boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.72)',
    pointerEvents: 'none',
  }),

  knob: (position: 'top' | 'bottom', height: number): React.CSSProperties => ({
    position: 'absolute',
    top: position === 'top'
      ? HIT_TARGET_PADDING - KNOB_SIZE / 2
      : HIT_TARGET_PADDING + height - KNOB_SIZE / 2,
    left: `calc(50% - ${KNOB_SIZE / 2}px)`,
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: '50%',
    backgroundColor: '#0b63b3',
    boxShadow: '0 2px 4px rgba(11, 99, 179, 0.28)',
    pointerEvents: 'none',
  }),
};

export default sticksStyles;
