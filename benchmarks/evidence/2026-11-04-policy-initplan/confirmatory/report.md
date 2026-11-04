# ferrixOps expense API benchmark

Mode: **full**. Local synthetic fixture: **10000 expenses, 50 employees**.

This compares an equivalent 50-row HTTP contract before/after statement-level role-helper evaluation in two SELECT policies. Indexes, grants and visibility rules are unchanged. It is not a before/after measurement of the original unpaginated UI.

Timing: Node monotonic clock from fetch start through full response-body consumption, including connection setup if needed; JSON parsing and assertions are outside the timed interval. HTTP compression requested as identity.

| Pair | Variant | Attempts | Failures | p50 ms | p95 ms | Successful ops/s | Mean body bytes |
|---|---|---|---|---|---|---|---|
| 1 | baseline | 25663 | 0 | 32.83 | 78.30 | 85.47 | 24328 |
| 1 | candidate | 27200 | 0 | 19.17 | 35.36 | 90.62 | 24328 |
| 2 | candidate | 27121 | 0 | 19.93 | 36.80 | 90.36 | 24328 |
| 2 | baseline | 24580 | 0 | 38.78 | 109.06 | 81.84 | 24328 |
| 3 | baseline | 24413 | 0 | 42.54 | 109.66 | 81.29 | 24328 |
| 3 | candidate | 27201 | 0 | 19.03 | 35.50 | 90.64 | 24328 |
| 4 | candidate | 27083 | 0 | 20.14 | 35.90 | 90.21 | 24328 |
| 4 | baseline | 24934 | 0 | 34.28 | 104.89 | 82.92 | 24328 |
| 5 | baseline | 25036 | 0 | 39.78 | 91.42 | 83.38 | 24328 |
| 5 | candidate | 27120 | 0 | 19.98 | 36.19 | 90.34 | 24328 |

Median run-level p95: 104.89 → 35.90 ms. Observed difference: 65.78%.

**Candidate result for manual methodology/resource review; not automatically a resume claim.**


All runs, query-class distributions, sample counts, environment/migration manifests and scrubbed raw samples are retained next to this report. Same-machine Docker contention and closed-loop throughput changes still require interpretation. Representative SQL plans are diagnostics, not the exact PostgREST embedding plan.
