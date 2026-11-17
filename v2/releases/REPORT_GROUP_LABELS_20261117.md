# Training report group labels — .143

The authenticated weekly report fragmented one recorded muscle group into separate bars when exercise labels differed only by capitalization or spacing. This also allowed two variants within one workout to count as two group sessions.

The report now groups presentation labels using canonical Unicode composition, trimmed/collapsed whitespace and Portuguese case folding. Accents are retained; no synonyms, muscle-role mapping, side merging or compound-label decomposition is introduced. Sessions use distinct already accepted workout identities. Main sets, extensions and exercise counts use the existing strict session evidence. Exact original variants remain in the model and in unchanged session/exercise detail records.

The shared read-only calendar model supplies weekly/monthly overview, detailed chart and PDF. There is no database, server, source, workout, set, medication or laboratory write. Water investigation remains independent and unresolved.

44 model tests passed, including new mixed-case/space, repeated-session, Unicode, unknown-group, missing-set, order-independence, anatomical distinction and immutable-source cases. Existing browser fixtures now contain original case variants. Independent expectations check accepted session identities, source exercise/set counts and unique compact chart labels. Remote Chromium/WebKit and PDF gates, exact publication and authenticated post-deploy totals remain pending.
