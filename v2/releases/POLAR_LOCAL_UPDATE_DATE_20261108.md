# Polar update date in São Paulo — candidate.128

The genuine connection card displayed the next UTC date for the last synchronization beside a São Paulo date/time for the last automatic update. last_sync_at was passed directly to the date-only formatter, which preserves the date prefix of source records.

The bounded change converts only this timestamp to its São Paulo civil date before formatting. The original timestamp, all health dates/values, source identity, synchronization, background schedule and authorization are preserved. Invalid timestamps produce the existing unknown-date mark rather than breaking the card. Production and isolated preview use identical source.

The actual card renderer passed independent expectations across São Paulo midnight, year transition, leap day, explicit UTC offset and invalid input. Existing owner/session/manual-read boundaries passed. Exact candidate regression and published genuine card verification remain pending. The completed.127 water-window/recovery package is recorded separately; original nine conditions stay open.
