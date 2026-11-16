# Google water availability comparison — .139

When water is visible in the native Google app but the normal read is empty, the owner can explicitly compare the recent civil-date query with the most recent water records returned by the API. The existing read-only nutrition grant, verified provider identity and owner lease are reused. No additional authorization, source mapping or clinical write is introduced.

The comparison makes three water-only requests: the selected seven civil days with explicit all-sources, one unfiltered page with explicit all-sources, and one unfiltered page using the documented default source family. Each probe is limited to 25 points, existing byte limits and a shared 30-second deadline; next pages are reported as truncation and never followed. The two latest-record probes intentionally omit the date predicate to investigate a filter discrepancy. Their metadata cannot be mistaken for complete history.

The response contains counts, observed date bounds and limited source metadata. It excludes point IDs, amounts, raw provider bodies, meals and credentials. A closed server event logs only independent counts and truncation flags; counts from overlapping probes are never added into a water total. Normal hydration reads, snapshots, automatic freshness and source approval rules remain unchanged. A successful comparison does not establish an automatic water receipt.

The production and preview cards expose one explicit control with a concise result. Ordinary navigation does not run the comparison. The date range, count bounds, malformed responses, account identity, concurrent disconnect, privacy, freshness and unchanged clinical records are validation boundaries. Existing mobile/desktop browser gates cover the actual card wiring.

Status: candidate prepared; publication and real-account result must be recorded in the private project checkpoint after verification. No personal amounts, screenshots or account identifiers are stored in this public document.
