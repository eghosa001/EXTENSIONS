# Chrome Web Store privacy disclosures — Contractor Clipper v1.0.0

Use this as the submission checklist; keep it aligned with `PRIVACY.md` and runtime behavior.

## Website content
**Yes.** After explicit Scan, Contractor Clipper can read product content from the active page: title, identifiers, brand/model, description, price/currency, material/finish/colour, dimensions, availability, image URLs and source URL/domain.

This is not passive browsing-history collection. There is no broad supplier host permission.

## Personally identifiable information
**Yes, if the user enters it.** Quote workspace fields may include client name/email/job address and the user's own business contact details. They remain in Chrome local storage and local backups.

For a paid subscription, the billing email entered on the backend checkout-start page is sent to Paystack. The extension itself does not collect card details.

## Authentication / financial information
- Card/payment credentials: **No.** Entered directly on Paystack.
- Signed subscription license/customer code: **Yes, for paid users.** Stored locally and sent only to the billing service for entitlement verification/management.
- Workspace backup intentionally excludes the activation license.

## User activity / browsing history
**No behavioral tracking.** Contractor Clipper does not monitor browsing activity. Current-page access occurs after explicit invocation and Scan.

## Analytics / advertising
**No** behavioral analytics or advertising in the extension.

## Data transmission
The extension's only remote request in v1 is the optional fixed billing origin used after paid-plan activation/management. Quote/client/product workspace data is not included.

## Client approval
Business exports a standalone HTML package locally. Client response JSON is manually returned/imported; no automatic cloud submission occurs.

## Limited use
Handled data is used only for the disclosed sourcing, estimating, reusable-library, export, procurement, client-response and paid-entitlement functions. It is not sold or used for personalized advertising.
