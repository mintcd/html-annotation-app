'use client';

import { useState } from 'react';
import { PasteHtml } from '../app/icons';
import { Button } from './design-system/button';
import promptBoxStyles from './styles/PromptBox.styles';
import pasteHtmlStyles from './styles/PasteHTML.styles';

type Props = {
  error?: string;
  siteId: string;
  /** path without leading slash, e.g. "article/10.1007/s11098-025-02457-y" */
  path: string;
  /** search string with leading "?", scoped to the source page, not the iframe cache */
  search: string;
  onSuccess: () => void;
  onClose: () => void;
};

export default function PasteHtmlDialog({ error, siteId, path, search, onSuccess, onClose }: Props) {
  const [html, setHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  async function handleSubmit() {
    const trimmed = html.trim();
    if (!trimmed) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/webpages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site: siteId, path, search, html: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null) as { error?: string } | null;
        setSaveError(data?.error ?? `HTTP ${res.status}`);
        return;
      }
      onSuccess();
    } catch (e) {
      setSaveError(String(e));
    } finally {
      setSaving(false);
    }
  }

  const instructions = [
    'Open the page in your browser.',
    'Open “View Page Source” from the browser menu or page context menu.',
    'Select all of the source and copy it.',
    'Paste the full HTML below.',
  ];

  return (
    <div style={promptBoxStyles.backdrop}>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close HTML recovery dialog"
        style={promptBoxStyles.overlay}
        onClick={onClose}
        disabled={saving}
      />
      <div role="dialog" aria-modal="true" aria-labelledby="paste-html-title" style={pasteHtmlStyles.modal}>
        <form
          style={pasteHtmlStyles.content}
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
          onKeyDown={(event) => {
            if (saving && event.key === 'Escape') event.preventDefault();
          }}
        >
          <div style={pasteHtmlStyles.header}>
            <span style={pasteHtmlStyles.icon} aria-hidden="true"><PasteHtml size={20} /></span>
            <div>
              <h2 id="paste-html-title" style={pasteHtmlStyles.title}>Load page from HTML</h2>
              <p style={pasteHtmlStyles.subtitle}>Use the page source when automatic fetching is blocked.</p>
            </div>
          </div>

          {error && <div style={pasteHtmlStyles.fetchError}>{error}</div>}

          <ol style={pasteHtmlStyles.instructions}>
            {instructions.map((instruction, index) => (
              <li key={instruction} style={pasteHtmlStyles.instruction}>
                <span style={pasteHtmlStyles.stepNumber}>{index + 1}</span>
                <span>{instruction}</span>
              </li>
            ))}
          </ol>

          <label style={pasteHtmlStyles.field}>
            <span style={pasteHtmlStyles.fieldHeader}>
              <span>Page source</span>
              <span style={pasteHtmlStyles.characterCount}>{html.length.toLocaleString()} characters</span>
            </span>
            <textarea
              autoFocus
              value={html}
              onChange={(event) => setHtml(event.target.value)}
              placeholder="<!doctype html>…"
              rows={11}
              style={pasteHtmlStyles.textarea}
            />
          </label>

          {saveError && <div role="alert" style={pasteHtmlStyles.saveError}>{saveError}</div>}

          <div style={pasteHtmlStyles.actions}>
            <Button type="button" variant="ghost" size="small" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" size="small" loading={saving} disabled={!html.trim()}>
              Save and load page
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
