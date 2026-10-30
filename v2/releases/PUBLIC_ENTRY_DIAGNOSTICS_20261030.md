# Public-entry diagnostics — 30/10/2026

A503 resource response failed the signed-out public smoke40988063351 before its success image. Its existing catch covered only login readiness, so the console assertion produced neither a screenshot nor a resource identity; the artifact step then failed on an empty file set. Repeating only that failed job with unchanged code passed. This is observed recovery, not proof of the original resource or a permanent fix to the remote service.

The check now preserves evidence around navigation, readiness and all existing assertions. It retains the original thrown assertion and never retries or suppresses errors. Failed HTTP responses and transport failures stay distinct. Only known public asset names and fixed SDK/resource labels, safe request types/methods and numeric statuses are retained. Queries, fragments, arbitrary origins/paths, headers, bodies, raw error text, credentials and DOM content are excluded. Events are bounded to64 with counts for omissions.

On failure, a screenshot is restricted to the login region and requires the expected build, a visible empty login, hidden private shell and no data renderers. Unverified, private, filled, missing or unavailable pages get only static readiness flags and sanitized metadata. Existing successful screenshots and every authentication/route/state/no-backend/geometry/console assertion remain. The Pages, Homologation and Integrated Production upload paths all retain the new diagnostic JSON.

The focused browser suite injects503 stylesheet,404 unknown-path and aborted-script requests into synthetic pages at320/1536 pixels, preserves the exact original assertion object, and exercises private-renderer, filled-login, absent-login, closed-page and success cases. No account, health data or real backend is used. Its source fixtures and failure labels are synthetic.

Local sanitizer/bounds/listener/upload contracts, syntax, unchanged production/preview graph, privacy and continuity pass. Exact candidate browser artifact inspection and post-promotion public verification remain pending. The app stays health-integrated-20261029.97 with unchanged UI, data, auth/writes, receiver, keys, schedules and icon. Water, basal eligibility, original-source/history, ordinary genuine forms, physical-device and overall acceptance conditions remain independent.

Primary API references: https://playwright.dev/docs/network and https://playwright.dev/docs/api/class-page .
