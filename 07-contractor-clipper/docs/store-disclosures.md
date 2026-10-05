# Chrome Web Store privacy disclosure guide

Use this guide when completing the Chrome Web Store Privacy practices tab for Contractor Clipper v0.3.0. Keep the final dashboard answers consistent with the runtime behavior and published privacy policy.

## Single purpose
Turn product information that the user explicitly scans on a supplier website into local project estimates and quote exports.

## Data categories to disclose conservatively
- **Personally identifiable information:** Yes. A user can enter client/company name, client email, job address, and their own business contact details.
- **Website content:** Yes. The extension clips product title, SKU/MPN, price, currency and image/source information from the active page after the user clicks Scan.
- **Web history / browsing activity:** Disclose that the source page URL/domain for explicitly clipped products is saved locally. Contractor Clipper does not passively monitor browsing or collect a background history of visited pages.
- **Financial/payment information:** No. Quote prices and estimate calculations are project content, not payment-card/banking/transaction data, and the extension does not process payments.
- **Authentication information:** No.
- **Personal communications:** No.
- **Health information:** No.
- **Location:** No automatic device/location collection.
- **User activity:** No click/keystroke/scroll monitoring beyond ordinary controls needed to operate the extension.

## Data use
Handled data is used only for the disclosed single purpose: product clipping, supplier memory, local project storage, quote calculations, backup/restore and user-requested exports.

## Data sharing
No clipped or entered user data is sent to Contractor Clipper servers, analytics, advertising networks or other third parties in v0.3.0.

## Limited Use certification
The extension should certify Limited Use only while runtime behavior continues to match this document: no sale of data, no personalized advertising, no unrelated data use, no human access through a backend, and no transmission beyond what is necessary for future explicitly disclosed features.

## Required publishing follow-through
Before submission, publish the privacy policy at a public HTTPS URL and use that exact URL in the Chrome Web Store dashboard. Re-check the dashboard disclosure if any future release adds cloud sync, analytics, accounts, payments or external APIs.
