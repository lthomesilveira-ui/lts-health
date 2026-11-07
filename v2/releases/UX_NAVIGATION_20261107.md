# UX navigation and startup — 2026-11-07

Status: candidate .126, not yet published.

## Observed defects

- The exact signed-out public entry remained visually empty until a reload. Both account and app containers began hidden while the account SDK blocked parsing in the head.
- The genuine authenticated route journey Training → Composition → Back opened Home rather than the preceding app area.
- ArrowRight on the selected Training Sessions tab did not change selection. Tab controls lacked a panel relationship and a single keyboard stop.
- The current primary route was styled but not identified with aria-current.
- Several laboratory series shared the same laboratory/unit label and differed mainly by ordinal and count; their recorded method/date context was hidden in a separate disclosure.

- Timeline cross-domain rows from different origins could have identical visible and accessible names, and two filters lacked accessible labels.

## Change

Render protected startup feedback before the account SDK is requested. Offer retry after delayed or failed startup; clear recovery if loading later succeeds. Keep noscript guidance. No automatic login, session copying or data fallback.

Keep bounded history metadata on entries created by this app. Back uses that history only when the current scope and route match; otherwise it opens Home. Internal measurement/exercise back actions and explicit returns to reports remain intact. Repeated route taps replace their entry.

Expose current route semantics and keyboard-operated Training tabs, including Home/End, wrapping arrows and focus restoration. Keep current visual spacing and preserve search/year selections.

Distinguish overlapping timeline rows by their existing origin and label period/area filters. No event is removed, merged or reclassified.

Add recorded laboratory method and date extent to series options. Raw results, grouping keys and comparability are unchanged.

## Verification

Local source parity, dependency inventory, preview isolation, navigation state, privacy and existing auth/write boundaries pass. Candidate workflows, responsive Chromium/WebKit journeys, publication and exact authenticated verification are pending.

Synthetic tests exercise delayed SDK/failed main module, late recovery, protected account boundary, 320/393/1440 widths, actual menu controls, route return with filters, repeated route taps and tab focus. Public repository evidence contains generic behavior only.

## Remaining dependencies

The nine original source/provider/owner conditions remain independent. In particular this does not restore missing hydration, identify unknown source metadata, infer basal coverage or authorize historical laboratory corrections.

## Candidate correction history

The first candidate revealed that its preview startup guard was still located in the head, before its new status markup. It was moved with the account SDK and existing read-only guard before application modules. Initial preview/training/calendar failures are preserved. The previous training test expected Tab to visit each tab; it now uses the tablist arrow convention while retaining the same fourth-destination and content checks.
