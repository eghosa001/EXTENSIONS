# Contractor Clipper — Production Quality Gate

Use this as a release-blocking audit for Contractor Clipper. Do not grade on feature count. Grade the product on whether a contractor can trust it with a real client estimate.

## Operating rules
- Audit the actual repository state, not the intended roadmap.
- Treat P0/P1 failures as release blockers.
- Fix discovered defects before assigning the final score when a safe scoped fix is possible.
- Do not add unrelated permissions, tracking, remote code, AI, accounts or cloud services.
- Keep the extension's single purpose: supplier product → project estimate.
- Preserve local-first behavior.
- Run only Contractor Clipper-scoped tests/checks.
- Separate automated evidence from manual-browser evidence. Never claim a Chrome interaction was tested if it was not actually run.

## Gate 1 — Product purpose and workflow
PASS only if:
- The single purpose is obvious within seconds.
- Toolbar action → side panel → scan → review → add to project → quote/export is coherent.
- There are no unrelated features.
- The user can recover from empty pages, unsupported pages and failed scans.
- A quote can be created without an account or external service.
- Repeated clipping while the quote workspace is open stays in sync.

## Gate 2 — Product extraction quality
PASS only if:
- Product title, SKU/MPN, price, currency, image, URL and supplier host use deterministic fallbacks.
- JSON-LD Product/Offer/AggregateOffer data is preferred over weak generic selectors.
- Common currency symbols are inferred when structured currency data is absent.
- Relative image URLs are resolved safely.
- Invalid JSON-LD does not crash scanning.
- Extraction never mutates the supplier page.
- At least structured-data and metadata fallback paths are covered by scoped tests.

## Gate 3 — Quote and money correctness
PASS only if:
- Quantity, cost, markup, delivery, labour, discount and tax calculations are deterministic.
- Negative/invalid numeric inputs cannot create a negative client total.
- Currency codes are normalized safely.
- Delivery is not silently lost.
- Client-facing totals reconcile with visible line values.
- Internal cost/markup information is not leaked in printed/PDF client estimates.
- Edge cases are tested with precise unit tests.

## Gate 4 — Project/data integrity
PASS only if:
- Existing v0.1/v0.2 local data is tolerated and normalized.
- Malformed imported/stored records do not crash rendering.
- IDs and user-controlled strings cannot become executable markup.
- Project edits persist.
- Data survives ordinary extension/browser restarts through chrome.storage.local.
- Users have a local backup/export and restore path before relying on local-only storage.
- Destructive actions require confirmation.

## Gate 5 — Security
PASS only if:
- Manifest V3 is used.
- Only minimum necessary permissions are required.
- No broad host permissions are requested when activeTab is sufficient.
- No remote scripts, eval/new Function, inline executable JS or remote code exist.
- Extension-page CSP is explicit and restrictive.
- User-controlled URLs are restricted to safe protocols before rendering.
- Imported data is validated/normalized.
- No hidden network transmission exists.
- No secrets/tokens/credentials are embedded.

## Gate 6 — Privacy and Chrome Web Store policy
PASS only if:
- The extension has one narrow, clearly disclosed purpose.
- Website access occurs only after a user gesture and explicit scan.
- Privacy documentation matches runtime behavior.
- Permission purposes are documented.
- User-data disclosure guidance covers project/client details, saved source URLs and website product content.
- Store copy is current and does not overclaim.
- Version metadata is consistent.
- Chrome compatibility is declared for APIs that require a minimum version.
- Missing store assets/public policy URLs remain explicit blockers rather than being silently ignored.

## Gate 7 — UX/UI quality
PASS only if:
- Side panel works at narrow widths without horizontal clipping.
- Form labels are understandable without documentation.
- Loading/success/error states are clear.
- Primary actions cannot be accidentally double-triggered.
- Keyboard focus is visible.
- Destructive actions look destructive.
- Empty states explain the next action.
- Quote workspace works on laptop and narrow/mobile-width browser windows.
- Light/dark behavior is deliberate rather than accidental.

## Gate 8 — Accessibility
PASS only if:
- Status changes use an appropriate live region.
- Interactive controls have accessible names.
- Form controls are associated with labels.
- Keyboard focus is visible.
- Color alone is not required to understand state.
- Tables have meaningful headers/caption.
- Print output remains readable.

## Gate 9 — Professional estimate output
PASS only if:
- Client PDF/print view hides internal cost/markup controls.
- Estimate number/date/client/job information are present or intentionally omitted with a clear rationale.
- Business branding is optional and safe.
- Quote notes/terms can be included.
- Print styling removes editor chrome and form-control appearance.
- File names are safe and predictable.
- CSV/Excel claims match the actual file format produced.

## Gate 10 — Resilience and performance
PASS only if:
- No heavy frameworks or unnecessary dependencies are introduced.
- Scanning only runs on user request.
- Storage writes are scoped.
- The UI remains responsive with dozens to low hundreds of items.
- External product-image failures do not break the quote.
- Runtime errors are caught at user-facing boundaries.
- Storage updates from another extension page are reflected without requiring a manual reload.

## Gate 11 — Release engineering
PASS only if:
- package.json and manifest versions match.
- Referenced manifest/HTML/script files exist.
- JS syntax checks pass.
- Core/extraction/production-contract tests pass.
- CI is path-scoped to Contractor Clipper.
- Release checklist distinguishes automated PASS from manual Chrome/store tasks.
- No unrelated repo-wide CI is triggered as a substitute for scoped validation.

## Gate 12 — Store-readiness assets and manual QA
Automated audit may mark this CONDITIONAL, never PASS, unless verified:
- Product-specific 16/32/48/128 icons.
- Required Chrome Web Store icon and screenshots.
- Public privacy-policy URL.
- Public support URL/contact path.
- Load-unpacked test in current Chrome.
- Toolbar action opens side panel.
- 3–5 real supplier sites tested.
- CSV/Excel/print files opened successfully.
- Browser restart confirms persistence.

## Severity
- P0: security/privacy/data-loss or materially wrong money calculation.
- P1: broken core workflow, misleading client output, store rejection risk.
- P2: quality/reliability/accessibility issue with workaround.
- P3: polish or optimization.

## Final verdict
Return:
1. Score out of 100.
2. PASS / CONDITIONAL PASS / FAIL.
3. P0/P1 blockers.
4. Automated checks executed and their results.
5. Manual checks still required.
6. Exact fixes made.
7. Whether the extension is safe to submit to the Chrome Web Store today.
