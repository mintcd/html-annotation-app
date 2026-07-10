"use client";

import React, { useEffect } from 'react';
import { Button, type ButtonVariant } from '../design-system/button';
import promptBoxStyles from '../styles/PromptBox.styles';

type Action = {
  label: string;
  action: () => void;
  variant?: 'primary' | 'secondary' | 'destructive' | 'neutral';
};

type Props = {
  message: React.ReactNode;
  actions: Action[]; // usually up to 3
  onClose?: () => void;
};

export default function PromptBox({ message, actions, onClose }: Props) {
  useEffect(() => {
    if (!onClose) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const neutralIndex = actions.findIndex((action) => action.variant === 'neutral');
  const secondaryIndex = actions.findIndex((action) => action.variant === 'secondary');
  const safeActionIndex = neutralIndex >= 0
    ? neutralIndex
    : secondaryIndex >= 0
      ? secondaryIndex
      : 0;

  const buttonVariant = (variant: Action['variant']): ButtonVariant => {
    if (variant === 'destructive') return 'danger';
    if (variant === 'secondary') return 'secondary';
    if (variant === 'neutral') return 'ghost';
    return 'primary';
  };

  return (
    <div style={promptBoxStyles.backdrop}>
      <button type="button" tabIndex={-1} aria-label="Close dialog" style={promptBoxStyles.overlay} onClick={onClose} />
      <div
        role="alertdialog"
        aria-modal="true"
        style={promptBoxStyles.modal}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={promptBoxStyles.content}>
          <div style={promptBoxStyles.message}>{message}</div>

          <div style={promptBoxStyles.actions}>
            {actions.map((a, i) => (
              <Button
                key={`${a.label}-${i}`}
                variant={buttonVariant(a.variant)}
                size="small"
                autoFocus={i === safeActionIndex}
                onClick={a.action}
              >
                {a.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
