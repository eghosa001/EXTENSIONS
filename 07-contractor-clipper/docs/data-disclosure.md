# Chrome Web Store data-disclosure notes

Use these notes when completing the Chrome Web Store privacy questionnaire for v1.0.0. Re-check the form wording at submission time.

## Data types this build handles

### Personally identifiable information — Yes
Users can voluntarily store client names, client email addresses, project addresses, company contact information and a company logo. In v1.0.0 this information remains in local extension storage and is not transmitted to Contractor Clipper servers.

### Website content — Yes
When the user explicitly scans the active tab, the extension reads product-page content needed for the clipping workflow: product title, SKU, price, currency, supplier/brand, image URLs and source URL.

## Data types not intentionally handled by v1.0.0
- Health information
- Authentication credentials
- Personal communications
- Precise location
- General web history
- User activity / keystroke monitoring
- Payment card or bank-account information

Estimate prices and totals are project-estimating data; the extension does not process payment credentials or transaction history.

## Required certifications
The release should be represented as local-first, single-purpose and limited-use. Do not claim that no data is handled at all, because users can store client/contact information and the extension reads website content during a user-triggered clip.
