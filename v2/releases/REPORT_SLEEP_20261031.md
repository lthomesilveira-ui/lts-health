# Sleep included in calendar reports — candidate .103, 31/10/2026

Direct UI review found recorded sleep present in Home but omitted from calendar reports. Candidate .103 reuses the existing source-isolated hour/day model in weekly/monthly summaries, dated graph/source picker and both local exports. Sources are not pooled, original dates are not moved between nights and current-day values stay outside closed means. Source/date context is readable on screen; PDF values retain a searchable space before their unit.

Candidate bfe268ec140af1eae3fa4c3219cf021ca1c3ce35 passed16/17 workflows; Calendar41238829353 reported7 failures. Artifact13057435003 SHA256f3fa50f912f17b9ad34115a60b08cf6c3569b0e1679d2cc62e707236429eb9d9 was downloaded, verified and inspected. Four PDF failures came from extracted “6h” merging two tokens despite visible ink. Two desktop captures exposed stretched blank card tails; cards now align to their content. The full monthly320px capture exceeded the old100-tile guard; its finite budget now derives from measured report height, preserving all no-gap, visible-text and strictly increasing coverage assertions. No assertion is waived. The corrected candidate still requires the full browser/PDF gate before publication.

Candidate c36993f6dd4dd8412365848d31f4667497f8ba88 resolved all3 layout/capture findings; Calendar41239951471 retained4 PDF tokenization findings. Verified artifact13057441368 SHA25615b0437a9395ddfd9debaccc005f582d4730d9fcc032ef7ff6a94adf2c285b5e proves the short number and hour unit exist as distinct positioned words with valid bounds. The content oracle now compares those same positioned PDF words, retaining the plain-text artifact for diagnosis, every expected token/count, printable bounds, pagination and page-image checks. Negative controls require a missing number or a missing unit to fail. This repairs the demonstrated plain-text extraction false positive; it does not permit content loss. The new exact candidate must pass before publication.

Forty-two model cases and view/print lifecycle tests pass locally. The existing independent browser oracle checks nine metrics, fractional hours and every export row. Protected real-auth adds boolean-only value/date/unit/source/coverage binding, without patient readings/identifiers in logs. Exact candidate renderers/styles were manually reviewed with invented data in desktop and phone journeys. Candidate browser/PDF, deployment/public and protected-auth gates remain pending; .102 remains the verified public release.

Only report inclusion/presentation, focused checks, version/hash references and continuity metadata change. Original observations/identities, integration settings, auth/writes and clinical state are unchanged. Overall owner acceptance and fourteen external/two accepted source/history/native conditions stay independent. EXECUTION_STATE.json is authoritative.

# Composition readability — .102 published and verified, 31/10/2026

PR449 exact candidate f754fe7adc6a142513e810c3bab487443cfc9e12: 16/17 successful workflows at 2026-10-31T20:24:46.153Z; Integrated41237716727 and Functional41237716705 pass. Existing150px narrow chart-entry,14px labels/16px selects,44px controls, complete title, navigation, no-overflow and zero-write assertions remain enforced.

Normal merge 5c4171b4b1ea86bd8e9e905dccc34226725b5564 publishes health-integrated-20261031.102. Deploy41238493135, Pages41238528590/41238528649 and protected real-auth41238493222 pass; publication snapshot 18/21. Unfinished broad repetitions remain explicit, not passed.

Independent Cloud Browser confirms exact public .102 with intact login, private app hidden and no overflow; manual session signed out. Synthetic Composition desktop,320x650,393x650 and393x844 readings, source separation and partial regional detail were inspected separately. No physical-iPhone or new private manual claim.

Earlier narrow geometry failures remain preserved. Final correction reclaims only summary/section spacing, with unchanged text size and150px gate; candidate9508c9f7d1377106da3a15de37c83f69a3530348 artifact13055604062 digest084a844fe64616c14d8ee27036ae016dae4ed9e3e3c2804353d1cecf7820c3e3 verified. Five limitation explanations use ordinary language; original values, units, source/device/link/comparison rules, clinical state, auth and writes are unchanged.

EXECUTION_STATE.json is authoritative; earlier snapshots retain their original scope.


