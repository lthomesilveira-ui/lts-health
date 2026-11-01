# Reports context return — 01/11/2026

Build: `health-integrated-20261031.107`

## Observed defect

At 393x844, Reports → **Ver treinos** opened Training correctly, but **Voltar** returned Home and lost the originating weekly report.

## Bounded correction

- Reports passes an explicit one-use return context to Training.
- Training consumes it when the contextual back action is used.
- Direct Training entry keeps Home as its fallback.
- Report dates, coverage, units, charts, sources, records, authentication and writes are unchanged.

## Verification

- manual invented-data production-renderer journey at 393x844;
- Reports → Training → Voltar returns Reports;
- direct Training → Voltar returns Home;
- report dates, coverage, metric tabs, sources, complete details and width showed no additional defect;
- PR458 candidate `ba60a1aa4db29f8973900f0f5a1a6ee21aec011b`: 17/17 successful workflows;
- publication `5ab534d7e614a1feb5f69555e161db59dee8dbbc`: deploy, Pages, homologation, reports/PDF, isolated preview and protected real-auth retry succeeded;
- first real-auth attempt's transient CSS 503 remains recorded as failure; official retry succeeded;
- Integrated Production publication run `41255413339` attempt 1 was cancelled while browser installation was blocked; official attempt 2 succeeded and the cancellation remains recorded;
- independent public signed-out inspection confirms exact .107, login visible and private app hidden.

No private data, screenshots, tokens or invented production records are included.
