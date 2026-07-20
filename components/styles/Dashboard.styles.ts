export const dashboardCss = String.raw`
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
    background: var(--dash-bg);
  }

  .dashboard-shell,
  .dashboard-shell * {
    box-sizing: border-box;
  }

  .dashboard-shell button,
  .dashboard-shell input {
    font: inherit;
  }

  .dashboard-auth-shell {
    align-items: center;
    justify-content: center;
    padding: clamp(1rem, 4vw, 3rem);
  }

  .dashboard-auth-main {
    width: min(100%, 25rem);
    margin: auto;
  }

  .dashboard-auth-panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
    padding: 1.15rem;
    border: 1px solid rgba(31, 35, 48, 0.08);
    border-radius: 0.5rem;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 20px 60px rgba(41, 45, 66, 0.12);
    backdrop-filter: blur(18px);
  }

  .dashboard-auth-brand {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  .dashboard-auth-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 760;
  }

  .dashboard-auth-subtitle {
    margin: 0.12rem 0 0;
    color: var(--dash-muted);
    font-size: 0.74rem;
    font-weight: 560;
  }

  .dashboard-auth-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.25rem;
    padding: 0.25rem;
    border: 1px solid #ececf2;
    border-radius: 0.5rem;
    background: #f7f8fb;
  }

  .dashboard-auth-tab {
    display: inline-flex;
    min-width: 0;
    min-height: 2.2rem;
    align-items: center;
    justify-content: center;
    gap: 0.42rem;
    border: 0;
    border-radius: 0.38rem;
    color: #6f7585;
    background: transparent;
    font-size: 0.75rem;
    font-weight: 720;
    cursor: pointer;
    transition: 150ms ease;
  }

  .dashboard-auth-tab.is-selected {
    color: var(--dash-primary);
    background: white;
    box-shadow: 0 1px 6px rgba(31, 35, 48, 0.08);
  }

  .dashboard-auth-tab svg {
    width: 0.9rem;
    height: 0.9rem;
  }

  .dashboard-auth-form {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .dashboard-auth-field {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .dashboard-auth-field span {
    color: #3d4352;
    font-size: 0.72rem;
    font-weight: 720;
  }

  .dashboard-auth-input-row {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    min-height: 2.75rem;
    padding: 0 0.75rem;
    border: 1px solid var(--dash-line);
    border-radius: 0.5rem;
    color: #8b91a0;
    background: #fafafe;
    transition: 150ms ease;
  }

  .dashboard-auth-input-row:focus-within {
    border-color: rgba(37, 99, 235, 0.52);
    color: var(--dash-primary);
    background: white;
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08);
  }

  .dashboard-auth-input-row svg {
    width: 0.95rem;
    height: 0.95rem;
    flex: 0 0 auto;
  }

  .dashboard-auth-input-row .dashboard-input {
    padding: 0.65rem 0;
    font-size: 0.82rem;
  }

  .dashboard-auth-error {
    margin: 0;
    padding: 0.65rem 0.75rem;
    border: 1px solid #f1cbd2;
    border-radius: 0.5rem;
    color: #8f2f40;
    background: #fff4f6;
    font-size: 0.74rem;
    line-height: 1.45;
  }

  .dashboard-auth-status {
    margin: 0;
    color: var(--dash-muted);
    font-size: 0.78rem;
  }

  .dashboard-sidebar {
    position: relative;
    z-index: 20;
    width: 19.5rem;
    flex: 0 0 19.5rem;
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
    border-radius: 0 0.5rem 0.5rem 0;
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
    border-radius: 0.5rem;
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
    letter-spacing: 0;
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
    border-radius: 0.5rem;
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
  .dashboard-auth-tab:focus-visible,
  .dashboard-sign-out:focus-visible,
  .dashboard-page-card:focus-visible,
  .dashboard-detail-back:focus-visible,
  .dashboard-button:focus-visible,
  .dashboard-submit-button:focus-visible,
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
    border-radius: 0.5rem;
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
    border-radius: 0.4rem;
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
    border-radius: 0.5rem;
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

  .dashboard-sync {
    display: flex;
    align-items: center;
    justify-content: space-between;
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

  .dashboard-sync-state {
    display: inline-flex;
    min-width: 0;
    flex: 1;
    align-items: center;
    gap: 0.48rem;
  }

  .dashboard-sync-copy {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.12rem;
  }

  .dashboard-sync-label,
  .dashboard-account-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dashboard-account-label {
    color: #9aa0ad;
    font-size: 0.62rem;
    font-weight: 640;
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

  .dashboard-sign-out {
    display: inline-flex;
    min-height: 1.85rem;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    padding: 0 0.55rem;
    border: 1px solid transparent;
    border-radius: 0.48rem;
    color: #7d8493;
    background: transparent;
    font-size: 0.68rem;
    font-weight: 720;
    cursor: pointer;
    transition: 150ms ease;
  }

  .dashboard-sign-out:hover:not(:disabled) {
    color: #303544;
    border-color: var(--dash-line);
    background: white;
  }

  .dashboard-sign-out:disabled {
    cursor: wait;
    opacity: 0.62;
  }

  .dashboard-sign-out svg {
    width: 0.88rem;
    height: 0.88rem;
  }

  .dashboard-sign-out-error {
    margin: -0.65rem 1.25rem 1rem;
    color: var(--dash-danger);
    font-size: 0.68rem;
    line-height: 1.35;
  }

  .dashboard-sidebar-filler {
    flex: 1 1 auto;
    min-height: 1rem;
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

  .dashboard-library-view {
    flex: 1;
    overflow-y: auto;
    padding: 0 clamp(1.25rem, 4vw, 4rem) 3rem;
  }

  .dashboard-library-view-inner {
    max-width: 76rem;
    margin: 0 auto;
  }

  .dashboard-library-hero {
    padding: 2.3rem 0 1.35rem;
    border-bottom: 1px solid rgba(31, 35, 48, 0.08);
  }

  .dashboard-library-title {
    margin: 0.35rem 0 0;
    color: #1b1e2a;
    font-size: 2.2rem;
    font-weight: 770;
    letter-spacing: 0;
    line-height: 1.08;
  }

  .dashboard-library-summary {
    margin: 0.55rem 0 0;
    color: #747b8d;
    font-size: 0.84rem;
    line-height: 1.55;
  }

  .dashboard-page-groups {
    display: flex;
    flex-direction: column;
    gap: 1.65rem;
    padding: 1.45rem 0 0;
  }

  .dashboard-site-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .dashboard-site-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .dashboard-site-title {
    min-width: 0;
    margin: 0;
    overflow: hidden;
    color: #353a49;
    font-size: 0.86rem;
    font-weight: 750;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dashboard-site-count {
    flex: 0 0 auto;
    color: #878d9c;
    font-size: 0.68rem;
    font-weight: 700;
  }

  .dashboard-page-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(17.5rem, 1fr));
    gap: 0.75rem;
  }

  .dashboard-page-card {
    display: flex;
    width: 100%;
    min-width: 0;
    min-height: 8.6rem;
    flex-direction: column;
    align-items: stretch;
    gap: 0.65rem;
    padding: 0.9rem;
    border: 1px solid #e8e9f0;
    border-radius: 0.5rem;
    color: var(--dash-ink);
    background: rgba(255, 255, 255, 0.86);
    box-shadow: 0 1px 2px rgba(28, 32, 46, 0.03);
    cursor: pointer;
    text-align: left;
    transition: 150ms ease;
  }

  .dashboard-page-card:hover {
    border-color: rgba(37, 99, 235, 0.24);
    background: white;
    box-shadow: 0 10px 24px rgba(31, 35, 48, 0.08);
    transform: translateY(-1px);
  }

  .dashboard-page-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .dashboard-page-card-icon {
    display: grid;
    width: 2.05rem;
    height: 2.05rem;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 0.45rem;
    color: var(--dash-primary);
    background: var(--dash-primary-soft);
  }

  .dashboard-page-card-icon svg {
    width: 0.94rem;
    height: 0.94rem;
  }

  .dashboard-page-card-count {
    display: inline-grid;
    min-width: 1.65rem;
    height: 1.65rem;
    place-items: center;
    padding: 0 0.42rem;
    border-radius: 999px;
    color: white;
    background: var(--dash-primary);
    font-size: 0.68rem;
    font-weight: 760;
  }

  .dashboard-page-card-title {
    display: -webkit-box;
    min-height: 2.1rem;
    overflow: hidden;
    color: #242837;
    font-size: 0.9rem;
    font-weight: 730;
    line-height: 1.25;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .dashboard-page-card-url {
    overflow: hidden;
    color: #7d8493;
    font-size: 0.72rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dashboard-page-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.7rem;
    margin-top: auto;
    padding-top: 0.2rem;
  }

  .dashboard-page-card-date {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    gap: 0.36rem;
    overflow: hidden;
    color: #8b91a0;
    font-size: 0.68rem;
    font-weight: 620;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dashboard-page-card-date svg {
    width: 0.76rem;
    height: 0.76rem;
    flex: 0 0 auto;
  }

  .dashboard-detail-back {
    display: inline-flex;
    min-height: 2.1rem;
    align-items: center;
    justify-content: center;
    gap: 0.42rem;
    margin: 0 0 1rem;
    padding: 0.4rem 0.62rem;
    border: 1px solid #e5e7ef;
    border-radius: 0.5rem;
    color: #606778;
    background: rgba(255, 255, 255, 0.82);
    font-size: 0.72rem;
    font-weight: 720;
    cursor: pointer;
    transition: 150ms ease;
  }

  .dashboard-detail-back:hover {
    color: var(--dash-primary);
    border-color: rgba(37, 99, 235, 0.22);
    background: white;
  }

  .dashboard-detail-back svg {
    width: 0.82rem;
    height: 0.82rem;
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
    font-size: 2.15rem;
    font-weight: 770;
    letter-spacing: 0;
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
    border-radius: 0.5rem;
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
    letter-spacing: 0;
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
    border-radius: 0.5rem;
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
    border-radius: 0.5rem;
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
    letter-spacing: 0;
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
    border-radius: 0.5rem;
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
    .dashboard-library-view {
      padding: 0 1rem 2rem;
    }

    .dashboard-library-hero {
      padding: 1.45rem 0 1rem;
    }

    .dashboard-library-title {
      font-size: 1.65rem;
    }

    .dashboard-page-groups {
      gap: 1.25rem;
      padding-top: 1.1rem;
    }

    .dashboard-page-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .dashboard-page-card {
      min-height: 7.75rem;
    }

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
      flex-wrap: wrap;
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
      border-radius: 0.5rem;
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
      border-radius: 0.5rem;
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
