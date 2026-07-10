"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { eq, useLiveQuery, useSyncStatus } from '@mintcd/sync-engine';
import {
  FiArrowRight,
  FiChevronDown,
  FiChevronRight,
  FiClock,
  FiExternalLink,
  FiFileText,
  FiFolder,
  FiGlobe,
  FiLayers,
  FiMenu,
  FiSearch,
  FiTrash2,
  FiX,
} from 'react-icons/fi';
import { db } from '../utils/engine';
import { useMobile } from "../hooks";
import PromptBox from './PromptBox';
import AnnotationList from './AnnotationList';
import { normalizeUrl } from '../utils/url';
import { ensurePage, getOrCreateWebsite, normalizeAnnotationRow, syncTimestamp } from '../utils/syncData';
import { deleteFrameBundle } from '../utils/frameCache';


interface AnnotationPage {
  url: string;
  filename: string;
  timestamp: string;
  title?: string;
  count: number;
  annotations: Annotation[];
  blobUrl: string;
  uploadedAt: string;
}


function toAbsoluteUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).href;
  } catch {
    try {
      return new URL(`https://${trimmed}`).href;
    } catch {
      return null;
    }
  }
}

async function navigateToPage(rawUrl: string): Promise<void> {
  const absoluteUrl = toAbsoluteUrl(rawUrl);
  if (!absoluteUrl) throw new Error('Please enter a valid URL');

  const u = new URL(absoluteUrl);
  const website = await getOrCreateWebsite(u.origin);
  window.location.href = `/${website.id}${u.pathname}${u.search}${u.hash}`;
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently updated';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function getPageLocation(rawUrl: string): { host: string; path: string } {
  try {
    const url = new URL(rawUrl);
    return {
      host: url.hostname.replace(/^www\./, ''),
      path: `${url.pathname}${url.search}` || '/',
    };
  } catch {
    return { host: 'Saved page', path: rawUrl };
  }
}

const dashboardCss = String.raw`
  .dashboard-shell {
    --dash-bg: var(--ds-color-canvas);
    --dash-panel: var(--ds-color-surface);
    --dash-ink: var(--ds-color-text);
    --dash-muted: var(--ds-color-text-secondary);
    --dash-soft: var(--ds-color-surface-subtle);
    --dash-line: var(--ds-color-border);
    --dash-primary: var(--ds-color-primary);
    --dash-primary-dark: var(--ds-color-primary-hover);
    --dash-primary-soft: var(--ds-color-primary-soft);
    --dash-danger: var(--ds-color-danger);
    --dash-danger-soft: var(--ds-color-danger-soft);
    position: relative;
    display: flex;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    color: var(--dash-ink);
    background:
      radial-gradient(circle at 82% 0%, rgba(37, 99, 235, 0.08), transparent 28rem),
      var(--dash-bg);
  }

  .dashboard-shell,
  .dashboard-shell * {
    box-sizing: border-box;
  }

  .dashboard-shell button,
  .dashboard-shell input {
    font: inherit;
  }

  .dashboard-sidebar {
    position: relative;
    z-index: 20;
    width: 22.5rem;
    flex: 0 0 22.5rem;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-right: 1px solid rgba(31, 35, 48, 0.08);
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 14px 0 40px rgba(41, 45, 66, 0.04);
    backdrop-filter: blur(18px);
  }

  .dashboard-mobile-sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 60;
    width: min(92vw, 23.5rem);
    height: 100vh;
    height: 100dvh;
    border-radius: 0 1.5rem 1.5rem 0;
    box-shadow: 24px 0 80px rgba(16, 20, 34, 0.24);
  }

  .dashboard-backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    border: 0;
    background: rgba(20, 23, 35, 0.46);
    backdrop-filter: blur(4px);
  }

  .dashboard-brand-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.35rem 1.25rem 1rem;
  }

  .dashboard-brand {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  .dashboard-brand-mark {
    position: relative;
    display: grid;
    width: 2.35rem;
    height: 2.35rem;
    flex: 0 0 auto;
    place-items: center;
    overflow: hidden;
    border-radius: 0.8rem;
    color: white;
    background: linear-gradient(145deg, var(--ds-color-blue-500), var(--ds-color-blue-700));
    box-shadow: 0 8px 20px rgba(37, 99, 235, 0.28);
  }

  .dashboard-brand-mark::after {
    content: '';
    position: absolute;
    width: 1.2rem;
    height: 1.2rem;
    top: -0.35rem;
    right: -0.25rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.28);
  }

  .dashboard-brand-mark svg {
    width: 1.05rem;
    height: 1.05rem;
  }

  .dashboard-brand-title {
    margin: 0;
    font-size: 0.98rem;
    font-weight: 760;
    letter-spacing: -0.025em;
  }

  .dashboard-brand-subtitle {
    margin: 0.12rem 0 0;
    color: var(--dash-muted);
    font-size: 0.72rem;
    font-weight: 500;
  }

  .dashboard-icon-button {
    display: inline-grid;
    width: 2.35rem;
    height: 2.35rem;
    flex: 0 0 auto;
    place-items: center;
    border: 1px solid transparent;
    border-radius: 0.75rem;
    color: #5f6678;
    background: transparent;
    cursor: pointer;
    transition: 160ms ease;
  }

  .dashboard-icon-button:hover {
    color: var(--dash-ink);
    border-color: var(--dash-line);
    background: var(--dash-soft);
  }

  .dashboard-icon-button:focus-visible,
  .dashboard-folder-button:focus-visible,
  .dashboard-page-button:focus-visible,
  .dashboard-button:focus-visible,
  .dashboard-input:focus-visible {
    outline: 3px solid rgba(37, 99, 235, 0.2);
    outline-offset: 2px;
  }

  .dashboard-sidebar-actions {
    padding: 0.25rem 1.25rem 1.15rem;
  }

  .dashboard-label {
    display: block;
    margin: 0 0 0.5rem;
    color: #3d4352;
    font-size: 0.72rem;
    font-weight: 720;
    letter-spacing: 0.015em;
  }

  .dashboard-url-form {
    display: flex;
    align-items: center;
    padding: 0.34rem;
    border: 1px solid var(--dash-line);
    border-radius: 0.9rem;
    background: #fafafe;
    box-shadow: 0 1px 2px rgba(28, 32, 46, 0.03);
    transition: 160ms ease;
  }

  .dashboard-url-form:focus-within {
    border-color: rgba(37, 99, 235, 0.52);
    background: white;
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08);
  }

  .dashboard-input {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: 0;
    color: var(--dash-ink);
    background: transparent;
  }

  .dashboard-input::placeholder {
    color: #9ba0ae;
  }

  .dashboard-url-input {
    padding: 0.55rem 0.65rem;
    font-size: 0.82rem;
  }

  .dashboard-submit-button {
    display: inline-grid;
    width: 2.25rem;
    height: 2.25rem;
    flex: 0 0 auto;
    place-items: center;
    border: 0;
    border-radius: 0.68rem;
    color: white;
    background: var(--dash-primary);
    box-shadow: 0 6px 14px rgba(37, 99, 235, 0.24);
    cursor: pointer;
    transition: 160ms ease;
  }

  .dashboard-submit-button:hover {
    background: var(--dash-primary-dark);
    transform: translateY(-1px);
  }

  .dashboard-search {
    display: flex;
    align-items: center;
    gap: 0.62rem;
    margin-top: 0.8rem;
    padding: 0 0.75rem;
    border: 1px solid transparent;
    border-radius: 0.78rem;
    color: #8b91a0;
    background: var(--dash-soft);
    transition: 160ms ease;
  }

  .dashboard-search:focus-within {
    border-color: rgba(37, 99, 235, 0.36);
    color: var(--dash-primary);
    background: white;
  }

  .dashboard-search svg {
    width: 0.98rem;
    height: 0.98rem;
    flex: 0 0 auto;
  }

  .dashboard-search .dashboard-input {
    padding: 0.68rem 0;
    font-size: 0.8rem;
  }

  .dashboard-search-shortcut {
    padding: 0.13rem 0.35rem;
    border: 1px solid #dfe1e9;
    border-radius: 0.36rem;
    color: #949aa9;
    background: rgba(255, 255, 255, 0.65);
    font-size: 0.62rem;
    font-weight: 700;
  }

  .dashboard-library-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.8rem 1.25rem 0.65rem;
    border-top: 1px solid var(--dash-line);
  }

  .dashboard-library-heading span:first-child {
    color: #8b91a0;
    font-size: 0.66rem;
    font-weight: 780;
    letter-spacing: 0.11em;
  }

  .dashboard-library-count {
    min-width: 1.55rem;
    padding: 0.17rem 0.42rem;
    border-radius: 999px;
    color: #63697a;
    background: var(--dash-soft);
    font-size: 0.66rem;
    font-weight: 730;
    text-align: center;
  }

  .dashboard-library {
    flex: 1;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 0 0.75rem 1rem;
    scrollbar-width: thin;
    scrollbar-color: #d7d9e3 transparent;
  }

  .dashboard-folder {
    margin: 0.15rem 0 0.45rem;
  }

  .dashboard-folder-button {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 0.5rem;
    padding: 0.48rem 0.55rem;
    border: 0;
    border-radius: 0.65rem;
    color: #777d8d;
    background: transparent;
    cursor: pointer;
    text-align: left;
    transition: 150ms ease;
  }

  .dashboard-folder-button:hover {
    color: #424858;
    background: #f6f6fa;
  }

  .dashboard-folder-chevron {
    width: 0.82rem;
    height: 0.82rem;
    flex: 0 0 auto;
  }

  .dashboard-folder-icon {
    width: 0.92rem;
    height: 0.92rem;
    flex: 0 0 auto;
    color: var(--ds-color-blue-500);
  }

  .dashboard-folder-name {
    min-width: 0;
    flex: 1;
    overflow: hidden;
  }

  .dashboard-folder-origin,
  .dashboard-folder-path {
    display: inline;
    font-size: 0.7rem;
    font-weight: 680;
  }

  .dashboard-folder-path {
    color: #a0a5b2;
    font-weight: 520;
  }

  .dashboard-folder-total {
    color: #a2a7b4;
    font-size: 0.64rem;
    font-weight: 680;
  }

  .dashboard-page-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    overflow: hidden;
  }

  .dashboard-page-button {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 0.7rem;
    padding: 0.65rem 0.68rem;
    border: 1px solid transparent;
    border-radius: 0.82rem;
    color: var(--dash-ink);
    background: transparent;
    cursor: pointer;
    text-align: left;
    transition: 160ms ease;
  }

  .dashboard-page-button:hover {
    border-color: #ececf2;
    background: #f8f8fb;
    transform: translateX(2px);
  }

  .dashboard-page-button.is-selected {
    border-color: rgba(37, 99, 235, 0.16);
    background: var(--dash-primary-soft);
    box-shadow: inset 3px 0 0 var(--dash-primary);
  }

  .dashboard-page-glyph {
    display: grid;
    width: 2rem;
    height: 2rem;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 0.62rem;
    color: #7a8090;
    background: #f0f1f5;
  }

  .dashboard-page-button.is-selected .dashboard-page-glyph {
    color: var(--dash-primary);
    background: white;
    box-shadow: 0 4px 10px rgba(37, 99, 235, 0.1);
  }

  .dashboard-page-glyph svg {
    width: 0.9rem;
    height: 0.9rem;
  }

  .dashboard-page-copy {
    min-width: 0;
    flex: 1;
  }

  .dashboard-page-title {
    display: block;
    overflow: hidden;
    color: #313544;
    font-size: 0.78rem;
    font-weight: 680;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dashboard-page-path {
    display: block;
    margin-top: 0.16rem;
    overflow: hidden;
    color: #959aa8;
    font-size: 0.66rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dashboard-page-count {
    display: inline-grid;
    min-width: 1.55rem;
    height: 1.55rem;
    flex: 0 0 auto;
    place-items: center;
    padding: 0 0.35rem;
    border-radius: 999px;
    color: #727889;
    background: #f0f1f5;
    font-size: 0.65rem;
    font-weight: 760;
  }

  .dashboard-page-button.is-selected .dashboard-page-count {
    color: white;
    background: var(--dash-primary);
  }

  .dashboard-sidebar-empty {
    margin: 0.75rem 0.5rem;
    padding: 1.5rem 1rem;
    border: 1px dashed #dfe1e9;
    border-radius: 0.9rem;
    color: #858b9a;
    background: #fafafe;
    font-size: 0.77rem;
    line-height: 1.5;
    text-align: center;
  }

  .dashboard-sync {
    display: flex;
    align-items: center;
    gap: 0.48rem;
    margin: 0 1.25rem 1rem;
    padding: 0.65rem 0.75rem;
    border: 1px solid #ececf2;
    border-radius: 0.75rem;
    color: #777d8d;
    background: #fafafe;
    font-size: 0.68rem;
    font-weight: 600;
  }

  .dashboard-sync-dot {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 999px;
    background: #36ad78;
    box-shadow: 0 0 0 4px rgba(54, 173, 120, 0.11);
  }

  .dashboard-sync.is-busy .dashboard-sync-dot {
    background: #f5a524;
    box-shadow: 0 0 0 4px rgba(245, 165, 36, 0.12);
    animation: dashboard-pulse 1.4s ease-in-out infinite;
  }

  .dashboard-sync.is-error .dashboard-sync-dot {
    background: var(--dash-danger);
    box-shadow: 0 0 0 4px rgba(201, 54, 79, 0.1);
  }

  .dashboard-main {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .dashboard-mobile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
    padding: 0.85rem 1rem;
    border-bottom: 1px solid rgba(31, 35, 48, 0.08);
    background: rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(18px);
  }

  .dashboard-mobile-title {
    min-width: 0;
    flex: 1;
    font-size: 0.85rem;
    font-weight: 740;
    text-align: center;
  }

  .dashboard-page-hero {
    position: relative;
    z-index: 2;
    padding: 2.3rem clamp(1.5rem, 4vw, 4rem) 1.65rem;
    border-bottom: 1px solid rgba(31, 35, 48, 0.07);
    background: rgba(255, 255, 255, 0.75);
    backdrop-filter: blur(18px);
  }

  .dashboard-page-hero-inner {
    max-width: 68rem;
    margin: 0 auto;
  }

  .dashboard-eyebrow-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .dashboard-eyebrow {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0;
    color: var(--dash-primary);
    font-size: 0.67rem;
    font-weight: 790;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .dashboard-eyebrow svg {
    width: 0.8rem;
    height: 0.8rem;
  }

  .dashboard-hero-layout {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 2rem;
  }

  .dashboard-hero-copy {
    min-width: 0;
    flex: 1;
  }

  .dashboard-hero-title {
    margin: 0;
    overflow-wrap: anywhere;
    color: #1b1e2a;
    font-size: clamp(1.65rem, 3vw, 2.4rem);
    font-weight: 770;
    letter-spacing: -0.045em;
    line-height: 1.08;
  }

  .dashboard-hero-url {
    display: flex;
    align-items: center;
    gap: 0.42rem;
    margin: 0.72rem 0 0;
    overflow: hidden;
    color: #7c8292;
    font-size: 0.76rem;
  }

  .dashboard-hero-url svg {
    width: 0.85rem;
    height: 0.85rem;
    flex: 0 0 auto;
    color: #9a9faf;
  }

  .dashboard-hero-url span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dashboard-meta-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.55rem;
    margin-top: 1.15rem;
  }

  .dashboard-meta-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.38rem;
    padding: 0.4rem 0.62rem;
    border: 1px solid #e8e9f0;
    border-radius: 999px;
    color: #6f7585;
    background: rgba(250, 250, 253, 0.86);
    font-size: 0.68rem;
    font-weight: 620;
  }

  .dashboard-meta-chip svg {
    width: 0.78rem;
    height: 0.78rem;
    color: #8d92a0;
  }

  .dashboard-hero-actions {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 0.55rem;
  }

  .dashboard-button {
    display: inline-flex;
    min-height: 2.55rem;
    align-items: center;
    justify-content: center;
    gap: 0.48rem;
    padding: 0.65rem 0.9rem;
    border: 1px solid transparent;
    border-radius: 0.78rem;
    font-size: 0.72rem;
    font-weight: 720;
    cursor: pointer;
    transition: 160ms ease;
  }

  .dashboard-button svg {
    width: 0.9rem;
    height: 0.9rem;
  }

  .dashboard-button-primary {
    color: white;
    background: var(--dash-primary);
    box-shadow: 0 8px 20px rgba(37, 99, 235, 0.22);
  }

  .dashboard-button-primary:hover {
    background: var(--dash-primary-dark);
    box-shadow: 0 10px 24px rgba(37, 99, 235, 0.28);
    transform: translateY(-1px);
  }

  .dashboard-button-danger {
    color: #9e3245;
    border-color: #f2dce0;
    background: var(--dash-danger-soft);
  }

  .dashboard-button-danger:hover:not(:disabled) {
    color: white;
    border-color: var(--dash-danger);
    background: var(--dash-danger);
  }

  .dashboard-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .dashboard-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.6rem clamp(1rem, 4vw, 4rem) 3rem;
  }

  .dashboard-content-inner {
    max-width: 68rem;
    margin: 0 auto;
  }

  .dashboard-content-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin: 0 0 1rem;
  }

  .dashboard-content-title {
    margin: 0;
    font-size: 0.93rem;
    font-weight: 740;
    letter-spacing: -0.018em;
  }

  .dashboard-content-description {
    margin: 0.2rem 0 0;
    color: #858b9a;
    font-size: 0.7rem;
  }

  .dashboard-result-count {
    padding: 0.34rem 0.55rem;
    border-radius: 999px;
    color: #686f80;
    background: #e9eaf0;
    font-size: 0.66rem;
    font-weight: 740;
  }

  .dashboard-content .annotation-list-container {
    padding: 0 !important;
    overflow: visible !important;
  }

  .dashboard-empty {
    flex: 1;
    display: grid;
    place-items: center;
    overflow-y: auto;
    padding: 2rem;
  }

  .dashboard-empty-card {
    width: min(100%, 34rem);
    padding: clamp(1.5rem, 5vw, 3rem);
    border: 1px solid rgba(37, 99, 235, 0.12);
    border-radius: 1.5rem;
    background: rgba(255, 255, 255, 0.78);
    box-shadow: 0 24px 70px rgba(45, 48, 67, 0.08);
    backdrop-filter: blur(18px);
    text-align: center;
  }

  .dashboard-empty-visual {
    position: relative;
    display: grid;
    width: 4.8rem;
    height: 4.8rem;
    margin: 0 auto 1.3rem;
    place-items: center;
    border-radius: 1.4rem;
    color: white;
    background: linear-gradient(145deg, var(--ds-color-blue-500), var(--ds-color-blue-700));
    box-shadow: 0 16px 34px rgba(37, 99, 235, 0.28);
    transform: rotate(-3deg);
  }

  .dashboard-empty-visual svg {
    width: 1.7rem;
    height: 1.7rem;
  }

  .dashboard-empty-visual::before,
  .dashboard-empty-visual::after {
    content: '';
    position: absolute;
    z-index: -1;
    width: 100%;
    height: 100%;
    border-radius: inherit;
    border: 1px solid rgba(37, 99, 235, 0.16);
    background: white;
  }

  .dashboard-empty-visual::before {
    transform: translate(0.5rem, 0.45rem) rotate(6deg);
  }

  .dashboard-empty-visual::after {
    transform: translate(-0.42rem, 0.65rem) rotate(-7deg);
  }

  .dashboard-empty-title {
    margin: 0;
    color: #242735;
    font-size: 1.4rem;
    font-weight: 760;
    letter-spacing: -0.035em;
  }

  .dashboard-empty-description {
    max-width: 26rem;
    margin: 0.65rem auto 0;
    color: #7c8292;
    font-size: 0.82rem;
    line-height: 1.65;
  }

  .dashboard-empty-form {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1.5rem;
    padding: 0.4rem;
    border: 1px solid var(--dash-line);
    border-radius: 0.95rem;
    background: #fafafe;
    transition: 160ms ease;
  }

  .dashboard-empty-form:focus-within {
    border-color: rgba(37, 99, 235, 0.48);
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08);
  }

  .dashboard-empty-form .dashboard-input {
    padding: 0.65rem 0.75rem;
    font-size: 0.8rem;
  }

  .dashboard-empty-form .dashboard-button {
    flex: 0 0 auto;
  }

  .dashboard-error {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 100;
    max-width: min(26rem, calc(100vw - 2rem));
    padding: 0.8rem 1rem;
    border: 1px solid #f1cbd2;
    border-radius: 0.85rem;
    color: #8f2f40;
    background: rgba(255, 244, 246, 0.96);
    box-shadow: 0 12px 30px rgba(84, 27, 38, 0.12);
    font-size: 0.76rem;
    line-height: 1.5;
  }

  @keyframes dashboard-pulse {
    0%, 100% { opacity: 0.55; transform: scale(0.9); }
    50% { opacity: 1; transform: scale(1.12); }
  }

  @media (max-width: 760px) {
    .dashboard-page-hero {
      padding: 1.5rem 1rem 1.25rem;
    }

    .dashboard-hero-layout {
      align-items: stretch;
      flex-direction: column;
      gap: 1.25rem;
    }

    .dashboard-hero-actions {
      width: 100%;
    }

    .dashboard-hero-actions .dashboard-button-primary {
      flex: 1;
    }

    .dashboard-hero-title {
      font-size: 1.65rem;
    }

    .dashboard-content {
      padding: 1.25rem 0.85rem 2rem;
    }

    .dashboard-empty {
      padding: 1rem;
    }

    .dashboard-empty-card {
      border-radius: 1.2rem;
    }

    .dashboard-empty-form {
      align-items: stretch;
      flex-direction: column;
      background: transparent;
      border: 0;
      padding: 0;
    }

    .dashboard-empty-form .dashboard-input {
      border: 1px solid var(--dash-line);
      border-radius: 0.8rem;
      background: #fafafe;
    }

    .dashboard-empty-form .dashboard-button {
      width: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dashboard-shell *,
    .dashboard-shell *::before,
    .dashboard-shell *::after {
      scroll-behavior: auto !important;
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isMobile } = useMobile();
  const sync = useSyncStatus();
  const pages = useLiveQuery(db.select().from('pages'));
  const annotations = useLiveQuery(db.select().from('annotations'));

  const annotationPages = useMemo<AnnotationPage[]>(() => {
    const annotationRows = (annotations.data ?? []).map((row) =>
      normalizeAnnotationRow(row as unknown as Record<string, unknown>),
    );

    return (pages.data ?? []).map((page) => {
      const pageAnnotations = annotationRows.filter((annotation) =>
        annotation.page_id === page.id || annotation.page_id === page.url,
      );
      return {
        url: page.url,
        filename: `${page.id}.json`,
        timestamp: page.created_at,
        title: page.title || undefined,
        count: pageAnnotations.length,
        annotations: pageAnnotations,
        blobUrl: '',
        uploadedAt: page.updated_at,
      };
    }).sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)));
  }, [annotations.data, pages.data]);

  const dataError = pages.error || annotations.error;

  const [deletingPages, setDeletingPages] = useState<Set<string>>(new Set());
  const [editingComment, setEditingComment] = useState<{
    pageUrl: string;
    annotationId: string;
    comment: string;
  } | null>(null);
  const [deletePagePrompt, setDeletePagePrompt] = useState<{
    pageUrl: string;
    filename: string;
  } | null>(null);
  const [deleteAnnotationPrompt, setDeleteAnnotationPrompt] = useState<{
    pageUrl: string;
    annotationId: string;
  } | null>(null);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [enterUrl, setEnterUrl] = useState('');
  const annotationsRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  const pagesByUrl = useMemo(() => {
    const map: Record<string, AnnotationPage> = {};
    annotationPages.forEach((page) => {
      map[normalizeUrl(page.url)] = page;
    });
    return map;
  }, [annotationPages]);

  const filteredPages = useMemo(() => {
    if (!searchQuery.trim()) return annotationPages;

    const query = searchQuery.toLowerCase();
    return annotationPages.filter((page) => {
      if (page.title?.toLowerCase().includes(query)) return true;
      if (page.url.toLowerCase().includes(query)) return true;

      return page.annotations.some((annotation) =>
        annotation.text?.toLowerCase().includes(query)
        || annotation.comment?.toLowerCase().includes(query),
      );
    });
  }, [annotationPages, searchQuery]);

  const groupedByFolder = useMemo(() => {
    const map: Record<string, { origin: string; dirPath: string; pages: AnnotationPage[] }> = {};

    filteredPages.forEach((page) => {
      try {
        const url = new URL(page.url);
        const pathname = url.pathname || '/';
        const trimmed = pathname.replace(/\/$/, '');
        const segments = trimmed.split('/').filter(Boolean);
        const dirPath = segments.length > 1 ? `/${segments.slice(0, -1).join('/')}/` : '/';
        const key = `${url.origin}${dirPath}`;

        if (!map[key]) map[key] = { origin: url.origin, dirPath, pages: [] };
        map[key].pages.push(page);
      } catch {
        const key = '/';
        if (!map[key]) map[key] = { origin: '', dirPath: '/', pages: [] };
        map[key].pages.push(page);
      }
    });

    const groups = Object.keys(map).map((key) => ({ key, ...map[key] }));
    groups.sort((a, b) => {
      if (a.origin !== b.origin) return a.origin.localeCompare(b.origin);
      return a.dirPath.localeCompare(b.dirPath);
    });
    groups.forEach((group) => group.pages.sort((a, b) => a.url.localeCompare(b.url)));
    return groups;
  }, [filteredPages]);

  const flattenedUrls = groupedByFolder.flatMap((group) =>
    group.pages.map((page) => normalizeUrl(page.url)),
  );
  const selectedPageIsVisible = selectedUrl ? flattenedUrls.includes(selectedUrl) : false;
  const displayedNormalizedUrl = selectedPageIsVisible ? selectedUrl : flattenedUrls[0];
  const displayedPage = displayedNormalizedUrl ? pagesByUrl[displayedNormalizedUrl] : null;
  const displayedUrl = displayedPage?.url ?? null;
  const totalAnnotations = annotationPages.reduce(
    (sum, page) => sum + page.annotations.length,
    0,
  );
  const totalUrls = annotationPages.length;
  const syncStatus = String(sync.status ?? 'ready');
  const normalizedSyncStatus = syncStatus.toLowerCase();
  const syncTone = /error|failed|offline/.test(normalizedSyncStatus)
    ? 'is-error'
    : /sync|push|pull|connect|load/.test(normalizedSyncStatus)
      ? 'is-busy'
      : '';

  function toggleFolder(key: string) {
    setOpenFolders((previous) => ({
      ...previous,
      [key]: !(previous[key] ?? true),
    }));
  }

  function deletePage(pageUrl: string, filename: string) {
    setDeletePagePrompt({ pageUrl, filename });
  }

  async function confirmDeletePage() {
    if (!deletePagePrompt) return;

    const { pageUrl } = deletePagePrompt;
    setDeletePagePrompt(null);

    const pageToDelete = annotationPages.find((page) => page.url === pageUrl);
    const pageRow = (pages.data ?? []).find((page) => page.url === pageUrl);
    if (!pageToDelete || !pageRow) return;

    if (selectedUrl === normalizeUrl(pageUrl)) setSelectedUrl(null);
    setDeletingPages((previous) => new Set(previous).add(pageUrl));

    try {
      for (const annotation of pageToDelete.annotations) {
        await db.delete().from('annotations').where(eq('id', annotation.id)).execute();
      }
      await db.delete().from('pages').where(eq('id', pageRow.id)).execute();

      try {
        const sourceUrl = new URL(pageUrl);
        const website = (
          await db
            .select('id')
            .from('websites')
            .where(eq('origin', sourceUrl.origin))
            .execute()
        )[0];
        if (website) {
          const pathname = sourceUrl.pathname === '/' ? '' : sourceUrl.pathname;
          await deleteFrameBundle(`/_frame/${website.id}${pathname}${sourceUrl.search}`);
        }
      } catch (cacheError) {
        // The synced page deletion is authoritative. A cache cleanup failure
        // should not make the user repeat it.
        console.warn('Failed to remove the saved page bundle', cacheError);
      }
    } catch (error) {
      alert(`Error deleting page: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeletingPages((previous) => {
        const next = new Set(previous);
        next.delete(pageUrl);
        return next;
      });
    }
  }

  function deleteAnnotation(pageUrl: string, annotationId: string) {
    setDeleteAnnotationPrompt({ pageUrl, annotationId });
  }

  async function confirmDeleteAnnotation() {
    if (!deleteAnnotationPrompt) return;

    const { pageUrl, annotationId } = deleteAnnotationPrompt;
    setDeleteAnnotationPrompt(null);

    const pageToUpdate = annotationPages.find((page) => page.url === pageUrl);
    const annotationToDelete = pageToUpdate?.annotations.find(
      (annotation) => annotation.id === annotationId,
    );
    if (!pageToUpdate || !annotationToDelete) {
      alert('Annotation not found');
      return;
    }

    try {
      await db.delete().from('annotations').where(eq('id', annotationId)).execute();
    } catch (error) {
      alert(`Error deleting annotation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  function startEditingComment(
    pageUrl: string,
    annotationId: string,
    currentComment = '',
  ) {
    setEditingComment({ pageUrl, annotationId, comment: currentComment });
  }

  function cancelEditingComment() {
    setEditingComment(null);
  }

  async function saveComment() {
    if (!editingComment) return;

    const edit = editingComment;
    setEditingComment(null);

    try {
      await db.update({
        comment: edit.comment.trim() || null,
        updated_at: syncTimestamp(),
      }).from('annotations').where(eq('id', edit.annotationId)).execute();
    } catch (error) {
      alert(`Error saving comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function saveAndNavigateToPage(rawUrl: string) {
    try {
      const absoluteUrl = toAbsoluteUrl(rawUrl);
      if (!absoluteUrl) throw new Error('Please enter a valid URL');
      const normalized = normalizeUrl(absoluteUrl);

      await ensurePage(normalized);
      await navigateToPage(normalized);
    } catch (error) {
      alert(`Error opening page: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  const handleAnnotateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void saveAndNavigateToPage(enterUrl);
  };

  const sidebarContent = (
    <>
      <div className="dashboard-brand-row">
        <div className="dashboard-brand">
          <span className="dashboard-brand-mark" aria-hidden="true">
            <FiLayers />
          </span>
          <div>
            <h1 className="dashboard-brand-title">Annotation Studio</h1>
            <p className="dashboard-brand-subtitle">
              {totalAnnotations} highlight{totalAnnotations === 1 ? '' : 's'} across {totalUrls} page{totalUrls === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {isMobile && (
          <button
            type="button"
            className="dashboard-icon-button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close library"
          >
            <FiX />
          </button>
        )}
      </div>

      <div className="dashboard-sidebar-actions">
        <label className="dashboard-label" htmlFor="dashboard-url-input">
          Start a new annotation
        </label>
        <form className="dashboard-url-form" onSubmit={handleAnnotateSubmit}>
          <input
            id="dashboard-url-input"
            type="url"
            className="dashboard-input dashboard-url-input"
            placeholder="Paste a website or document URL"
            value={enterUrl}
            onChange={(event) => setEnterUrl(event.target.value)}
            aria-label="URL to annotate"
          />
          <button type="submit" className="dashboard-submit-button" aria-label="Open URL in annotator">
            <FiArrowRight />
          </button>
        </form>

        <label className="dashboard-search">
          <FiSearch aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="search"
            className="dashboard-input"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search your library"
            aria-label="Search annotations"
          />
          <span className="dashboard-search-shortcut" aria-hidden="true">⌘ K</span>
        </label>
      </div>

      <div className="dashboard-library-heading">
        <span>LIBRARY</span>
        <span className="dashboard-library-count">{filteredPages.length}</span>
      </div>

      <nav className="dashboard-library" aria-label="Annotated pages">
        {flattenedUrls.length === 0 ? (
          <div className="dashboard-sidebar-empty">
            {searchQuery
              ? <>No pages match “{searchQuery}”. Try another title, URL, highlight, or note.</>
              : pages.loading || annotations.loading
                ? 'Loading your annotation library…'
                : 'Your saved pages will appear here after you create your first annotation.'}
          </div>
        ) : (
          groupedByFolder.map((group) => {
            const isOpen = openFolders[group.key] ?? true;

            return (
              <section key={group.key} className="dashboard-folder">
                <button
                  type="button"
                  className="dashboard-folder-button"
                  onClick={() => toggleFolder(group.key)}
                  aria-expanded={isOpen}
                >
                  {isOpen ? (
                    <FiChevronDown className="dashboard-folder-chevron" />
                  ) : (
                    <FiChevronRight className="dashboard-folder-chevron" />
                  )}
                  <FiFolder className="dashboard-folder-icon" />
                  <span className="dashboard-folder-name">
                    <span className="dashboard-folder-origin">
                      {group.origin ? group.origin.replace(/^https?:\/\//, '') : 'Other'}
                    </span>
                    <span className="dashboard-folder-path">{group.dirPath}</span>
                  </span>
                  <span className="dashboard-folder-total">{group.pages.length}</span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key={`pages-${group.key}`}
                      className="dashboard-page-list"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                    >
                      {group.pages.map((page) => {
                        const normalizedUrl = normalizeUrl(page.url);
                        const location = getPageLocation(page.url);
                        const isSelected = normalizedUrl === displayedNormalizedUrl;

                        return (
                          <button
                            key={page.url}
                            type="button"
                            className={`dashboard-page-button${isSelected ? ' is-selected' : ''}`}
                            onClick={() => {
                              setSelectedUrl(normalizedUrl);
                              if (isMobile) setSidebarOpen(false);
                            }}
                            aria-current={isSelected ? 'page' : undefined}
                          >
                            <span className="dashboard-page-glyph" aria-hidden="true">
                              <FiFileText />
                            </span>
                            <span className="dashboard-page-copy">
                              <span className="dashboard-page-title">{page.title || location.host}</span>
                              <span className="dashboard-page-path">{location.path}</span>
                            </span>
                            <span className="dashboard-page-count" aria-label={`${page.annotations.length} annotations`}>
                              {page.annotations.length}
                            </span>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            );
          })
        )}
      </nav>

      <div className={`dashboard-sync ${syncTone}`} title={`Sync status: ${syncStatus}`}>
        <span className="dashboard-sync-dot" aria-hidden="true" />
        <span>Sync · {syncStatus}</span>
      </div>
    </>
  );

  return (
    <div className="dashboard-shell">
      <style>{dashboardCss}</style>

      {dataError && (
        <div className="dashboard-error" role="alert">
          <strong>Local data is unavailable.</strong>{' '}
          {String(dataError)}
        </div>
      )}

      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <>
            <motion.button
              type="button"
              className="dashboard-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              aria-label="Close library"
            />
            <motion.aside
              className="dashboard-sidebar dashboard-mobile-sidebar"
              initial={{ x: '-100%', opacity: 0.6 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0.6 }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {!isMobile && <aside className="dashboard-sidebar">{sidebarContent}</aside>}

      <main className="dashboard-main">
        {isMobile && (
          <header className="dashboard-mobile-header">
            <button
              type="button"
              className="dashboard-icon-button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open annotation library"
            >
              <FiMenu />
            </button>
            <span className="dashboard-mobile-title">Annotation Studio</span>
            <span style={{ width: '2.35rem' }} aria-hidden="true" />
          </header>
        )}

        {displayedUrl && displayedPage ? (
          <>
            <header className="dashboard-page-hero">
              <div className="dashboard-page-hero-inner">
                <div className="dashboard-eyebrow-row">
                  <p className="dashboard-eyebrow">
                    <FiGlobe aria-hidden="true" />
                    Selected page
                  </p>
                </div>

                <div className="dashboard-hero-layout">
                  <div className="dashboard-hero-copy">
                    <h2 className="dashboard-hero-title">
                      {displayedPage.title || getPageLocation(displayedUrl).host}
                    </h2>
                    <p className="dashboard-hero-url" title={displayedUrl}>
                      <FiExternalLink aria-hidden="true" />
                      <span>{displayedUrl}</span>
                    </p>
                    <div className="dashboard-meta-row">
                      <span className="dashboard-meta-chip">
                        <FiLayers aria-hidden="true" />
                        {displayedPage.annotations.length} annotation{displayedPage.annotations.length === 1 ? '' : 's'}
                      </span>
                      <span className="dashboard-meta-chip">
                        <FiClock aria-hidden="true" />
                        Updated {formatUpdatedAt(displayedPage.uploadedAt)}
                      </span>
                    </div>
                  </div>

                  <div className="dashboard-hero-actions">
                    <button
                      type="button"
                      className="dashboard-button dashboard-button-primary"
                      onClick={() => void saveAndNavigateToPage(displayedUrl)}
                    >
                      Open annotator
                      <FiExternalLink aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="dashboard-button dashboard-button-danger"
                      onClick={() => void deletePage(displayedUrl, displayedPage.filename)}
                      disabled={deletingPages.has(displayedUrl)}
                    >
                      <FiTrash2 aria-hidden="true" />
                      {deletingPages.has(displayedUrl) ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            </header>

            <div ref={annotationsRef} className="dashboard-content">
              <div className="dashboard-content-inner">
                <div className="dashboard-content-heading">
                  <div>
                    <h3 className="dashboard-content-title">Highlights & notes</h3>
                    <p className="dashboard-content-description">Everything you captured on this page.</p>
                  </div>
                  <span className="dashboard-result-count">{displayedPage.annotations.length}</span>
                </div>

                <AnnotationList
                  mode="card"
                  annotations={displayedPage.annotations}
                  onDeleteAnnotation={(id: string) => deleteAnnotation(displayedUrl, id)}
                  editingComment={editingComment?.pageUrl === displayedUrl
                    ? { annotationId: editingComment.annotationId, comment: editingComment.comment }
                    : null}
                  onStartEditingComment={(id: string, comment: string) => startEditingComment(displayedUrl, id, comment)}
                  onCancelEditingComment={cancelEditingComment}
                  onSaveComment={saveComment}
                />
              </div>
            </div>
          </>
        ) : (
          <section className="dashboard-empty">
            <div className="dashboard-empty-card">
              <div className="dashboard-empty-visual" aria-hidden="true">
                {searchQuery ? <FiSearch /> : <FiFileText />}
              </div>
              <h2 className="dashboard-empty-title">
                {searchQuery ? 'Nothing found' : 'Build your annotation library'}
              </h2>
              <p className="dashboard-empty-description">
                {searchQuery
                  ? `We couldn’t find a page, highlight, or note matching “${searchQuery}”.`
                  : 'Paste any website or document URL to start highlighting the ideas you want to keep.'}
              </p>

              {!searchQuery && (
                <form className="dashboard-empty-form" onSubmit={handleAnnotateSubmit}>
                  <input
                    type="url"
                    className="dashboard-input"
                    placeholder="https://example.com/article"
                    value={enterUrl}
                    onChange={(event) => setEnterUrl(event.target.value)}
                    aria-label="URL to annotate"
                  />
                  <button type="submit" className="dashboard-button dashboard-button-primary">
                    Start annotating
                    <FiArrowRight aria-hidden="true" />
                  </button>
                </form>
              )}
            </div>
          </section>
        )}
      </main>

      {deletePagePrompt && (
        <PromptBox
          message={`Are you sure you want to delete all annotations for "${deletePagePrompt.pageUrl}"? This action cannot be undone.`}
          actions={[
            { label: 'Cancel', action: () => setDeletePagePrompt(null), variant: 'secondary' },
            { label: 'Delete', action: confirmDeletePage, variant: 'destructive' },
          ]}
          onClose={() => setDeletePagePrompt(null)}
        />
      )}

      {deleteAnnotationPrompt && (
        <PromptBox
          message="Are you sure you want to delete this annotation? This action cannot be undone."
          actions={[
            { label: 'Cancel', action: () => setDeleteAnnotationPrompt(null), variant: 'secondary' },
            { label: 'Delete', action: confirmDeleteAnnotation, variant: 'destructive' },
          ]}
          onClose={() => setDeleteAnnotationPrompt(null)}
        />
      )}
    </div>
  );
}
