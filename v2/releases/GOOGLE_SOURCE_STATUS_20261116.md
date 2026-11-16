# Google automatic read visibility and upstream nutrition check — .138

The Google card previously showed authorization and only the date of the last read. It now shows the latest successful automatic read with its Brasilia timestamp, the source window and whether water observations were returned. A newer unfinished automatic attempt remains distinct from an older success. Missing water is never rendered as zero or as a confirmed automatic water receipt.

An explicit owner action checks the last seven civil days of nutrition logs through the existing nutrition read-only grant and all available sources. This checks whether the Google account is receiving nutrition independently of hydration. It returns bounded source metadata and observation counts, never meal contents or inferred MyFitnessPal identity. It neither imports meals, promotes water, changes the background schedule nor advances hydration freshness. The same owner-bound encrypted credential, verified Health identity, generation lease, bounded GET transport and pagination safeguards apply.

No clinical data, credential value, encryption key, permission scope, paid service, source attribution or existing training link changes. The .137 selected-date query and empty ProtoJSON handling remain in place.

Validation before publication: the existing Google reader, connection, configuration and scheduling suite with added source-boundary cases; production graph and preview parity; public payload and continuity boundaries. The existing actual-renderer Chromium/WebKit period test also verifies automatic empty-read presentation and the explicit nutrition action at 320, 390 and 1440 pixels. Production and authenticated results are recorded separately after release.
