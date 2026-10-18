# ADR-0002: Recover annotations from quotes and surrounding context

Status: Accepted (retrospective record of the current implementation).

Date: 2026-10-18

Requirements: [A01-A12](../requirements/annotations.md).

## Context

A selection is a live DOM `Range` inside the prepared iframe. Its node references
cannot survive reloads. Source pages can add wrappers, render math, or insert
text, and applying the app's own highlight spans splits and moves text nodes.
Recovering annotations therefore needs a representation independent of those
node identities.

Repeated quotes need evidence from surrounding text. Math renderers can expose
visual, assistive, and source copies of the same formula, so raw
`Range.toString()` is not a consistent quote representation. Saved HTML excerpts
also serve a different purpose: they are sanitized for display and can lose
source structure.

## Decision

Use version-1 text anchors in memory, with normalized `exact` text, `prefix` and
`suffix` context, and `start`/`end` offsets into a normalized text index. New
anchors capture up to 48 JavaScript string units on each side of the selection.
Persist `exact`, `prefix`, and `suffix` in the current synchronized annotation
rows. Offsets are transient hints; row normalization normally reconstructs them
as zero and the quote length.

Build the index from visible text nodes. Normalize Unicode to NFC per text
segment, remove configured invisible characters, and collapse whitespace while
retaining original node/offset mappings. Exclude scripts, styles, templates,
noscript, hidden content, and known duplicate math representations. Allow the
recognized visual MathJax/KaTeX tree to contribute text even when the renderer
marks that visual tree `aria-hidden`.

Recover a range in this order:

1. Accept the runtime start offset when its slice equals the normalized quote.
2. Use the quote when it occurs exactly once in the current index.
3. For multiple occurrences, score matching suffix-of-prefix and
   prefix-of-suffix context, then prefer the candidate nearest the runtime start.
   Require non-empty context and at least
   `min(8, prefix.length + suffix.length)` matching context characters. Reject a
   tie in both context score and distance.

Fail recovery when the quote is missing or matching confidence is insufficient.
Do not add fuzzy or semantic matching to this path.

Create an anchor before highlight wrapping mutates the DOM. For a saved batch,
build one fresh index and resolve all ranges before wrapping from later starts
to earlier starts. Attempt background quote/context repairs for successfully
resolved anchors that changed, preserving their `updated_at` values. The
current schema does not persist resolved offsets.

Retry initially unmatched annotations after relevant DOM changes for a bounded
window: a 150 ms debounce, a 1.5-second idle limit, and a 10-second maximum.
Ignore annotator-owned changes and dispose the observer when the session changes.

Use the same anchoring path for resizing. Reconstruct the new range after
removing the old spans, regenerate its sanitized excerpt, reapply the highlight,
and then persist its quote/context. Try to restore the prior highlight when
reconstruction or the still-current resize save fails.

Treat highlight spans and sanitized excerpts as presentation. An annotation can
have several spans sharing its ID and color; removal unwraps their source
contents. Excerpt cleaning unwraps annotation spans and applies an element,
attribute, and link allowlist. Saved excerpts do not locate annotations.

## Alternatives

**Persist live ranges or node paths:** ranges contain document-specific node
references; paths depend on tree structure that wrappers and dynamic pages can
change. Neither supplies quote/context evidence for relocation.

**Persist offsets alone:** offsets can locate unchanged text quickly but shift
when preceding content changes. The current implementation uses offsets as an
in-memory shortcut and persists quote/context instead.

**Recover from the exact quote alone:** sufficient for a unique quote, but a
repeated phrase needs context. Always choosing its first occurrence would hide
uncertainty.

**Recover from saved HTML:** sanitizer output is designed for safe display. It
can discard attributes, media, math markup, and source wrappers, so it is not a
stable locator for the current iframe DOM.

**Fuzzy or semantic matching:** could recover edited wording, but needs a
separate confidence policy and verification. It is outside the current matcher.

## Consequences

Highlights can recover after many wrapper changes and surrounding-text
insertions without depending on original node identities. A character-to-node
map makes normalized quotes usable as DOM ranges. Batch resolution and fresh
indexes reduce dependence on ranges invalidated by the app's own wrapping.

Quote recovery remains limited by the indexed representation and confidence
heuristic. A changed quote is unresolved. Matching context scores can be broken
by proximity, and the position fast path checks the quote without requiring
context. Because offsets are not durable, loading a row normally supplies a
zero start hint; repeated text can still resolve to an unintended occurrence.
This ADR records that current behavior rather than a stronger disambiguation
guarantee.

The short mutation window handles late initial content without keeping a
permanent relocation observer. Changes after that window can leave highlights
missing or stale. Background repairs do not block display, and resize rollback
can fail if the document changes again. Sanitized excerpts preserve safe text
and selected formatting, not full source or rendered-math fidelity.

The implementation is in the [anchor model](../../core/annotation/model/index.ts),
[DOM functions](../../core/annotation/dom/dom.ts),
[batch application](../../core/annotation/session/highlights.ts),
[session](../../core/annotation/session/useAnnotationSession.ts), and
[resize flow](../../components/AnnotationResizeHandles.tsx).
[Text anchor tests](../../tests/textAnchor.test.ts) exercise matching and MathJax
indexing; [sanitizer tests](../../tests/sanitizeHtml.test.ts) exercise the excerpt
allowlist. UI wrapping, retry timing, and rollback require browser verification.
