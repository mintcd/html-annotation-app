# Annotation requirements

Status: Current baseline. Date: 2026-10-18.

## Purpose and scope

Let a reader select text in the prepared iframe, save an annotation, recover its
highlight after a reload, and edit its extent, color, or comment. These
requirements describe the current implementation, including its matching limits.
[ADR-0002](../adr/0002-quote-based-annotation-anchors.md) records the anchoring
decision.

## Behavioral requirements

| ID | Requirement | Observable acceptance criterion |
| --- | --- | --- |
| A01 | Capture a new annotation before changing the selected DOM. | A non-collapsed selection inside the session root produces a text anchor and sanitized excerpt before wrapping. The annotation text equals the anchor's canonical `exact` quote. A failed local create does not create highlight spans. |
| A02 | Persist the quote and surrounding context independently of DOM nodes. | Runtime annotation rows store `exact`, `prefix`, and `suffix`. Loading a row reconstructs a version-1 `TextAnchor`; offsets are runtime hints, with `start: 0` and `end: exact.length` when the row has no position object. |
| A03 | Use one normalized text representation for anchor creation and recovery. | Indexing NFC-normalizes text segments, removes the configured invisible characters, collapses whitespace, and retains mappings back to original text-node boundaries. Script, style, template, noscript, hidden, and non-visible content does not contribute to the index. |
| A04 | Count the supported rendered math representation once. | Visual MathJax/KaTeX text can remain indexable despite its rendering tree's `aria-hidden` attribute. MathJax previews, assistive MathML, KaTeX MathML duplicates, and math source scripts do not add duplicate quote text. |
| A05 | Recover unchanged and uniquely occurring quotes. | An exact quote at the runtime start offset uses that position. Otherwise, one occurrence of the normalized exact quote produces a range. An empty or absent quote fails rather than highlighting unrelated text. |
| A06 | Require context before choosing among relocated repeated quotes. | Multiple occurrences outside the position fast path are ranked by matching prefix/suffix length and then distance from the runtime start. A match needs at least `min(8, prefix.length + suffix.length)` context characters and non-empty context. Equal best context and distance is unresolved; proximity alone with no context is insufficient. |
| A07 | Resolve a saved batch before wrapping text. | One fresh text index is shared by the batch. Every candidate range is resolved before DOM changes, then wrapping proceeds from later starts to earlier starts. Results identify annotations that matched and annotations that failed. |
| A08 | Refresh quote context when recovery changes an anchor. | Successfully highlighted annotations whose resolved anchor differs trigger a background persistence attempt for the resolved quote/context, preserving `updated_at`. A failed repair is logged and does not undo the visible highlight. |
| A09 | Bound recovery on pages that continue changing. | Unmatched annotations retry after meaningful mutations with a 150 ms debounce. Matching finalizes after 1.5 seconds without a relevant mutation or a 10-second maximum window. Annotator-owned markup is ignored, and navigation or session disposal cancels the old observer and timers. |
| A10 | Validate a resized annotation through the same anchor model. | A non-collapsed candidate inside the root becomes an anchor, old spans are removed, and a fresh range is reconstructed before saving the new excerpt and quote/context. Desktop custom handles and coarse-pointer native selection feed this path. Reconstruction failure skips persistence and attempts to restore the old highlight; a failed save attempts rollback only while that resize is still current. |
| A11 | Store excerpts as sanitized display content. | `cleanHtml()` removes annotation wrappers while keeping their contents and passes excerpts through the sanitizer. Output uses allowed text/formatting elements, removes dangerous element contents and media, strips ordinary attributes, and permits only validated HTTP(S) or fragment links. The excerpt is never the range-recovery input. |
| A12 | Keep visual wrappers associated with an annotation identity. | Highlight spans carry `highlighted-text`, `data-highlight-id`, a background color, and `--highlight-color`. An annotation may span several wrappers. Removal unwraps their contents and normalizes affected parents instead of deleting source text. |
| A13 | Support comment, color, and deletion actions on existing annotations. | Comment edits persist trimmed text or an empty value; color edits immediately update all matching spans and queue the field update. Deletion removes visible spans and the local annotation before queuing its deletion. Persistence failures update the save status. |

## Anchor representation and matching limits

The in-memory `TextAnchor` contains `version`, `start`, `end`, `exact`, `prefix`,
and `suffix`. Newly created context contains up to 48 JavaScript string units on
each side of the selection. Offsets refer to the normalized index, and its
character mapping reconstructs the original DOM range.

The current synchronized row schema retains only the quote/context fields.
Consequently, a reload does not retain the previously resolved offset. Anchor
repair can refresh persisted context, but it cannot make an offset durable. The
stored-position fast path checks the quote alone, including when the runtime
position was synthesized at zero.

Matching is exact after normalization; it does not perform fuzzy matching or
semantic relocation when the selected wording changes. Repeated quotes with
matching context can still be selected by proximity when their context scores
tie. This behavior is confidence-based, not a guarantee that every resolved
quote is the intended occurrence.

The index walks DOM text nodes and uses their existing whitespace; it does not
infer separators between blocks or interpret mathematical notation. NFC
normalization is applied to segments within each text node, with grapheme
segmentation when available. Math support covers the representations recognized
by the selectors in the implementation, rather than every renderer.

Dynamic recovery is a short initial matching window. It does not continuously
relocate highlights throughout a page's lifetime. Resize rollback and background
anchor repair are best-effort operations on a changing document. Ordinary color
and delete failures report save status without a general DOM rollback contract.
The excerpt allowlist can discard source formatting and rendered math markup.

## Implementation and verification

| Area | Implementation | Existing automated evidence |
| --- | --- | --- |
| Quote/context model and matching (A02, A05, A06) | [Anchor model](../../core/annotation/model/index.ts), [row normalization and writes](../../core/persistence/syncData.ts), [row types](../../sync/types.ts) | [Text anchor tests](../../tests/textAnchor.test.ts) cover the position fast path, relocation, and refusal of unsupported repeated matches. |
| Text indexing and range reconstruction (A03, A04) | [DOM index and range functions](../../core/annotation/dom/dom.ts) | [Text anchor tests](../../tests/textAnchor.test.ts) cover normalization, MathJax indexing, and recovery after surrounding text changes. |
| Creation, presentation, editing, and resizing (A01, A10, A12, A13) | [Selection toolbar](../../components/SelectionToolbar.tsx), [resize handles](../../components/AnnotationResizeHandles.tsx), [annotation context](../../components/Annotator.context.tsx), [DOM wrappers](../../core/annotation/dom/dom.ts) | These UI transitions require browser verification; the current anchor tests do not exercise the interaction or rollback paths. |
| Batch application and recovery (A07-A09) | [Batch highlighting](../../core/annotation/session/highlights.ts), [annotation session](../../core/annotation/session/useAnnotationSession.ts) | Source establishes batch ordering and retry bounds; no dedicated automated test currently covers these session transitions. |
| Excerpts (A11) | [Excerpt cleaning](../../core/annotation/dom/dom.ts), [sanitizer](../../core/annotation/dom/sanitizeHtml.ts) | [Sanitizer tests](../../tests/sanitizeHtml.test.ts) cover formatting, removed content, attributes, entities, and link validation. They do not cover the complete DOM-based `cleanHtml()` pipeline. |

