import gzip
import hashlib
import json
import math
import statistics
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
directory = Path(sys.argv[1])
manifest = json.loads((directory / 'manifest.json').read_text())
comparison = json.loads((directory / 'comparison.json').read_text())
assert manifest['config']['mode'] == 'full'
assert manifest['dirty'] is False
assert manifest['config']['rows'] == 10000
assert manifest['config']['repeats'] == 5
assert manifest['config']['clients'] == 20
revision = manifest['git']
for entry in manifest['source']:
    source = subprocess.check_output(['git', 'show', f"{revision}:{entry['file']}"], cwd=root)
    assert hashlib.sha256(source).hexdigest() == entry['sha256'], entry['file']
for entry in manifest['migrations']:
    source = subprocess.check_output(['git', 'show', f"{revision}:supabase/migrations/{entry['name']}"], cwd=root)
    assert hashlib.sha256(source).hexdigest() == entry['sha256'], entry['name']

def p95(values):
    return statistics.quantiles(values, n=100, method='inclusive')[94]

rows = []
payloads = {}
records = {}
for pair in range(1, 6):
    for variant in ['baseline', 'candidate']:
        prefix = f'{pair}-{variant}'
        record = json.loads((directory / f'{prefix}.json').read_text())
        records[(pair, variant)] = record
        with gzip.open(directory / f'{prefix}.samples.ndjson.gz', 'rt') as stream:
            samples = [json.loads(line) for line in stream if line.strip()]
        assert record['pair'] == pair and record['variant'] == variant
        assert len(samples) == record['metrics']['attempts']
        assert sum(s['ok'] for s in samples) == record['metrics']['successes']
        assert all(s['status'] == 200 and s['ok'] for s in samples)
        assert len(samples) >= 2000
        measured = p95([s['ms'] for s in samples])
        assert math.isclose(measured, record['metrics']['p95_ms'], abs_tol=1e-8)
        assert math.isclose(statistics.median([s['ms'] for s in samples]), record['metrics']['p50_ms'], abs_tol=1e-8)
        assert math.isclose(len(samples) / record['actual_seconds'], record['metrics']['successful_ops_per_second'], abs_tol=1e-8)
        assert record['correctness_checks'] == 49
        assert len(record['metrics']['by_query']) == 9
        for name, metrics in record['metrics']['by_query'].items():
            group = [s for s in samples if s['query'] == name]
            assert len(group) == metrics['samples']
            assert math.isclose(p95([s['ms'] for s in group]), metrics['p95_ms'], abs_tol=1e-8)
            body_sizes = {s['bytes'] for s in group}
            assert len(body_sizes) == 1
            if name in payloads:
                assert payloads[name] == body_sizes
            payloads[name] = body_sizes
        rows.append({'pair': pair, 'variant': variant, 'attempts': len(samples),
                     'p50_ms': record['metrics']['p50_ms'], 'p95_ms': measured,
                     'ops_per_second': record['metrics']['successful_ops_per_second'],
                     'cpu_fraction': record['runtime']['cpu_fraction'],
                     'event_loop_p95_ms': record['runtime']['event_loop_p95_ms'],
                     'by_query': record['metrics']['by_query']})

for pair in range(1, 6):
    before = records[(pair, 'baseline')]
    after = records[(pair, 'candidate')]
    assert before['indexes'] == after['indexes'], 'Index definitions changed'
    assert len(before['policies']) == len(after['policies'])
    for b, a in zip(before['policies'], after['policies']):
        for field in ['policyname', 'cmd', 'roles', 'permissive', 'with_check']:
            assert b[field] == a[field], field
        if b['policyname'] not in ['Accounts view submitted expenses', 'Owner views all expenses']:
            assert b['qual'] == a['qual']
    assert 'InitPlan' in json.dumps(after['diagnostic_plan'])

baseline = [r for r in rows if r['variant'] == 'baseline']
candidate = [r for r in rows if r['variant'] == 'candidate']
a = statistics.median(r['p95_ms'] for r in baseline)
b = statistics.median(r['p95_ms'] for r in candidate)
assert math.isclose(a, comparison['median_baseline_p95_ms'], abs_tol=1e-8)
assert math.isclose(b, comparison['median_candidate_p95_ms'], abs_tol=1e-8)
percent = (a - b) / a * 100
assert math.isclose(percent, comparison['reduction_percent'], abs_tol=1e-8)
result = {
    'verification': 'Independent Python recomputation of all ten raw-sample files passed',
    'git': revision, 'total_requests': sum(r['attempts'] for r in rows),
    'baseline_requests': sum(r['attempts'] for r in baseline),
    'candidate_requests': sum(r['attempts'] for r in candidate),
    'median_run_p95_baseline_ms': a, 'median_run_p95_candidate_ms': b,
    'reduction_percent': percent, 'failures': 0, 'correctness_checks': 490,
    'candidate_for_manual_review': comparison['candidate_for_manual_review'],
    'reasons': comparison['reasons'], 'rows': rows,
    'query_median_p95': {name: {variant: statistics.median(r['by_query'][name]['p95_ms'] for r in rows if r['variant'] == variant)
                                for variant in ['baseline', 'candidate']} for name in payloads},
}
(directory / 'independent-verification.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
