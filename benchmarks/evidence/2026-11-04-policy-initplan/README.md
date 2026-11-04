# Retained ferrixOps benchmark evidence

- `confirmatory/`: the complete five-pair statement-level role-helper experiment at commit `a31ea3881b445474e611438620388fb715d2d044`, including all raw samples, manifests, plans, summaries, charts and independent verification.
- `index-diagnostic/`: the earlier index-only exploratory run at `b834566`. It was intentionally stopped after one completed pair when the diagnostic showed no gain; `aborted.json` records the interruption. It is excluded from confirmatory statistics.

Read [the case study](../../../docs/ferrixOps_API_BENCHMARK_RESULTS.md) before interpreting these numbers. They describe synthetic local API requests, not factory adoption or production guarantees. The mixed workload improved; deep-page classes regressed.

Verify the retained full result using `python3 benchmarks/verify_results.py benchmarks/evidence/2026-11-04-policy-initplan/confirmatory` from the repository root.
