# 05 — Tender Change Monitor

## Product promise
Watch a tender the user already cares about and alert only when a meaningful procurement detail changes.

## Customer
Companies preparing bids, bid consultants and procurement teams.

## MVP
Save URL plus key extracted facts; scheduled checks from a small backend; compare page text/document links; detect deadline changes, addenda, new attachments and changed requirements; send email alert with before/after summary.

## Architecture
Extension for “Watch this tender”; lightweight scheduled worker/backend for monitoring because browser extensions cannot reliably run continuous remote checks. Store hashes/snapshots and fetch only watched URLs.

## Monetization
$9/month for 10 watches, $19 for 50, $49 company tier. High value because missing one addendum can invalidate a bid.

## Launch
Bundle with BidMatrix later, but validate separately first. Recruit active bidders who already manually recheck portals.

## Roadmap
PDF diffing, team notifications, calendar updates, evidence-impact analysis and BidMatrix integration.
