# Sale draft and inventory count safety

Implemented: 2026-10-25. First implementation increment from the major-page UX audit.

## Changes

- SaleForm now derives its own versioned storage key from authenticated tenant ID, user ID and document mode (sale/proforma). Callers cannot accidentally restore a user-only legacy key. Legacy drafts are deliberately not migrated because their shop cannot be established reliably.
- Drafts expire after seven days. Unsupported versions, malformed JSON, invalid timestamps and malformed product lines are rejected and removed from the scoped key.
- Users choose Reprendre le brouillon or Supprimer le brouillon before editing; no automatic restoration. The draft stays untouched until that choice. The prompt shows its saved date.
- Resume verifies selected client/product IDs against the loaded collections. Missing references require reselection. Current stock and minimum-price validation run before saving. Draft prices remain visible for review; server validation remains authoritative.
- Fresh blank forms do not create drafts. Successful sales clear their draft. Failed saves retain fields and storage. Sale date and proforma validity are included in draft content.
- Tenant/user/mode changes remount the field state. Switching shops cannot carry the preceding shop's field values across. Each mode can resume its own stored draft.
- Blocked/unavailable browser storage is explained inline while the form remains usable. The close dialog now explains draft retention conditionally rather than claiming all input will be discarded.
- A synchronous ref lock blocks simultaneous SaleForm submissions, including programmatic submissions; the form fieldset is disabled while saving. Failed requests release the lock and retain input.
- Physical-count values are indexed by count ID and product ID. Publishing one count sends its own quantities and clears only that count's entry state, preserving other open counts.

## Verification and limits

Automated checks cover scoped keys, expiry/malformed storage, legacy isolation, explicit resume/discard, shop/mode switches, missing references, failed/successful save, blocked storage, simultaneous submits, independent count inputs and publication payloads. The selected UX regression suite passes 81 tests across 17 suites, including 13 added tests for this increment.

This is not server idempotency. Lost mutation responses, refresh/retry across browser sessions and successful proforma creation followed by a failed PDF download still need the durable operation/result workflow. The real guided sale stages and receipt result are not implemented by this increment. Current loaded catalogue/customer lists may be bounded; a referenced record absent from them requires reselection rather than being assumed valid. Count entries remain in memory, with persistence and publication locking left for the dedicated count-session redesign. Existing logout retention policy is unchanged. Live API/mobile/keyboard checks remain pending.
