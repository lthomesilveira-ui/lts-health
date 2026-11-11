# Google Health Takeout water

The hydration timeline previously excluded the newly recovered Google Health Takeout source. This release accepts a separate, server-authenticated source family for verified positive MyFitnessPal daily logs. It preserves archive digest, CSV member and line, original source and interval, unit, amount and local timezone in private evidence.

The offline reviewer reads hydration CSV members only. It never opens credential or profile files, connects to a provider or writes a database. Missing units, zero, invalid intervals, unknown sources and multiple positive logs on the same day are excluded. Record identity is stable across archive names and CSV ordering.

The database retains the existing canonical branches and Auto Export trigger. An additional server-only guard prevents browsers from creating, updating or relabelling Takeout evidence. Required payload fields fail closed when absent. A reviewed import must additionally verify one active owner, absent target days and unchanged existing canonical water before and after its transaction.

The frontend includes this source in the established hydration timeline and consumers. Equal mirrored totals count once; different totals remain a conflict. This source does not satisfy the independent complete MyFitnessPal-history request and does not imply present-day water or automatic recurring delivery.

Validation covers invented ZIPs, provenance and stable IDs, bad-unit/zero/unknown-source/ambiguous-day exclusions, actual PostgreSQL role and owner isolation, untouched prior rows, and existing hydration/privacy/production contracts. Native data import and release evidence are recorded privately after their checks complete. No original archive or actual health value belongs in this repository.
