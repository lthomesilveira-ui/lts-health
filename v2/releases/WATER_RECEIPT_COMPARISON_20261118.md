# Hydration comparison in .150

Nutrition displays the most recent observation date for authenticated iPhone water separately from provider archive coverage. A receipt for another metric cannot advance this date.

An archive total and a phone total for the same day are now compared even when Google Takeout has no entry. Equal totals count once. Conflicting totals remain visible by source and are excluded from consolidated summaries.

Synthetic mobile and desktop tests used matching and conflicting observations. The published Nutrition view was checked in an existing authenticated session against the private receiver and archive.

PR575 candidate f028612b929880c69800cb7aa5baa068508e0959 passed 20 workflows. The deployed application commit 68ed1fb59de48594d0dc8db870247b52941f5571 matched the tested tree 67ed4140e99aa97cbb51be54335388323b6bf5c7. The initial protected report check failed while the numerical comparison was collapsed. PR576 updates that test. All 20 workflows on verification commit da1efcabae68cb7bff20da2a63e815f11a795a73 passed, including protected authenticated run 44372865923.
