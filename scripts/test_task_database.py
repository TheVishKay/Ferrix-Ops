"""Run real task migrations against a disposable local PostgreSQL cluster.

Requires Python 3 and PostgreSQL binaries (PG_BIN may override their location).
Never connects to an existing database; Supabase auth is represented by a fixture.
"""

import concurrent.futures
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[1]
PG_BIN = Path(os.environ.get("PG_BIN", "/Library/PostgreSQL/18/bin"))
if not (PG_BIN / "initdb").exists():
    binary = shutil.which("initdb")
    if not binary:
        raise SystemExit("Install PostgreSQL or set PG_BIN to its bin directory")
    PG_BIN = Path(binary).parent

OWNER = "00000000-0000-0000-0000-000000000001"
EMPLOYEE = "00000000-0000-0000-0000-000000000002"
ACCOUNTS = "00000000-0000-0000-0000-000000000003"
MISSING_PROFILE = "00000000-0000-0000-0000-000000000004"
ASSIGNEE = "10000000-0000-0000-0000-000000000002"
OTHER_ASSIGNEE = "10000000-0000-0000-0000-000000000003"
checks = 0


def check(name, condition):
    global checks
    if not condition:
        raise AssertionError(name)
    checks += 1
    print(f"PASS {name}", flush=True)


with tempfile.TemporaryDirectory(prefix="ferrixops-pg-") as directory:
    temp = Path(directory)
    data = temp / "data"
    socket = temp / "socket"
    socket.mkdir()
    subprocess.run(
        [str(PG_BIN / "initdb"), "-D", str(data), "-A", "trust", "-U", "postgres"],
        check=True, capture_output=True, text=True,
    )
    started = False
    try:
        subprocess.run(
            [str(PG_BIN / "pg_ctl"), "-D", str(data), "-l", str(temp / "server.log"),
             "-o", f"-F -k {socket} -c listen_addresses=''", "-w", "start"],
            check=True, capture_output=True, text=True,
        )
        started = True

        def sql(statement, actor=None, role="authenticated", failure=None):
            if actor is not None:
                statement = (
                    f"SET ROLE {role}; SET request.jwt.claim.sub = '{actor}'; " + statement
                )
            result = subprocess.run(
                [str(PG_BIN / "psql"), "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
                 "-h", str(socket), "-U", "postgres", "-d", "postgres"],
                input=statement, capture_output=True, text=True, timeout=30,
            )
            if failure:
                check(failure, result.returncode != 0 and failure in result.stderr)
            elif result.returncode:
                raise RuntimeError(result.stderr)
            return result.stdout.strip()

        sql((ROOT / "tests/database/task_auth_fixture.sql").read_text())
        for migration in [
            "20260831000100_core_and_employees.sql",
            "20260906000003_audit_logging.sql",
            "20260916125019_tasks.sql",
            "20261002000001_tasks_rpc_and_audit.sql",
            "20261002000002_grant_tasks_select.sql",
        ]:
            sql((ROOT / "supabase/migrations" / migration).read_text())
        sql((ROOT / "tests/database/task_seed.sql").read_text())

        # Demonstrate the old vulnerability in this disposable database first.
        sql("SELECT public.update_task_positions('[]');", MISSING_PROFILE)
        check("reproduced pre-fix null-role authorization bypass", True)
        sql((ROOT / "supabase/migrations/20261023000001_harden_task_ordering.sql").read_text())

        def create(title, assignee=ASSIGNEE, actor=OWNER):
            return sql(
                f"SELECT (public.create_task('{title}', p_assigned_to_id => '{assignee}', "
                "p_status => 'ASSIGNED')).id;", actor,
            )

        task = create("Regression task")
        peer_task = create("Peer task", OTHER_ASSIGNEE)
        payload = json.dumps([{"id": task, "position": 500}])
        reorder = f"SELECT public.update_task_positions('{payload}'::jsonb);"
        sql(reorder, OWNER, role="anon", failure="permission denied for function update_task_positions")
        for actor in [MISSING_PROFILE, EMPLOYEE, ACCOUNTS]:
            sql(reorder, actor, failure="Only owners can reorder tasks")
        for bad in ["null", "{}", '[{"id": null, "position": 1}]',
                    '[{"id": "' + task + '", "position": "NaN"}]']:
            expected = "JSON array" if bad in ["null", "{}"] else "numeric position"
            sql(f"SELECT public.update_task_positions('{bad}'::jsonb);", OWNER, failure=expected)
        sql(f"SELECT public.update_task_positions('{json.dumps([{'id': task, 'position': 1}] * 2)}');",
            OWNER, failure="Duplicate task ids")
        sql(reorder, OWNER)
        check("owner reorder updates position and records audit", sql(
            f"SELECT position = 500 AND EXISTS (SELECT 1 FROM public.audit_logs "
            f"WHERE entity_id = '{task}' AND action = 'TASK_REORDERED') "
            f"FROM public.tasks WHERE id = '{task}';") == "t")
        mixed = json.dumps([{"id": task, "position": 999},
                            {"id": "ffffffff-ffff-ffff-ffff-ffffffffffff", "position": 1}])
        sql(f"SELECT public.update_task_positions('{mixed}');", OWNER, failure="Task not found")
        check("invalid batch rolls back prior positions and audit", sql(
            f"SELECT position = 500 AND (SELECT count(*) FROM public.audit_logs "
            f"WHERE action = 'TASK_REORDERED') = 1 FROM public.tasks WHERE id = '{task}';") == "t")
        sql(f"UPDATE public.tasks SET title = 'bypass' WHERE id = '{task}';",
            OWNER, failure="permission denied for table tasks")
        check("RLS isolates employee task reads", sql(
            "SELECT count(*) FROM public.tasks;", EMPLOYEE) == "1")
        sql(f"SELECT public.update_task_status('{peer_task}', 'IN_PROGRESS');", EMPLOYEE,
            failure="You are not assigned to this task")
        sql(f"SELECT public.update_task_status('{task}', 'COMPLETED');", EMPLOYEE,
            failure="is not permitted for employees")
        sql(f"SELECT public.update_task_status('{task}', 'IN_PROGRESS');", EMPLOYEE)
        check("valid employee transition is audited", sql(
            f"SELECT EXISTS (SELECT 1 FROM public.audit_logs WHERE entity_id = '{task}' "
            "AND action = 'TASK_STATUS_UPDATED');") == "t")

        def submit_for_review(_):
            try:
                sql(f"SELECT public.update_task_status('{task}', 'READY_FOR_REVIEW');", EMPLOYEE)
                return True
            except RuntimeError as error:
                if "is not permitted for employees" not in str(error):
                    raise
                return False

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            transitions = list(pool.map(submit_for_review, range(2)))
        check("concurrent employee transitions allow only one state change", sum(transitions) == 1)

        sql("""CREATE FUNCTION public.reject_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'forced audit failure'; END; $$;
        CREATE TRIGGER reject_test_audit BEFORE INSERT ON public.audit_logs
        FOR EACH ROW EXECUTE FUNCTION public.reject_test_audit();""")
        sql("SELECT public.create_task('Must rollback', p_assigned_to_id => '" + ASSIGNEE + "');",
            OWNER, failure="forced audit failure")
        check("audit failure rolls back task insert", sql(
            "SELECT count(*) FROM public.tasks WHERE title = 'Must rollback';") == "0")
        sql("DROP TRIGGER reject_test_audit ON public.audit_logs;")

        # Hold every insertion briefly to force overlapping allocation attempts.
        sql("""CREATE FUNCTION public.slow_test_insert() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN PERFORM pg_sleep(0.02); RETURN NEW; END; $$;
        CREATE TRIGGER slow_test_insert BEFORE INSERT ON public.tasks
        FOR EACH ROW EXECUTE FUNCTION public.slow_test_insert();""")
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            ids = list(pool.map(lambda i: create(f"Concurrent {i}"), range(20)))
        check("20 concurrent creates return distinct task ids", len(set(ids)) == 20)
        check("20 concurrent creates allocate distinct positions", sql(
            "SELECT count(*) = 20 AND count(DISTINCT position) = 20 "
            "FROM public.tasks WHERE title LIKE 'Concurrent %';") == "t")
        check("every concurrent creation has exactly one audit record", sql(
            "SELECT count(*) = 20 AND count(DISTINCT a.entity_id) = 20 "
            "FROM public.audit_logs a JOIN public.tasks t ON t.id = a.entity_id "
            "WHERE t.title LIKE 'Concurrent %' AND a.action = 'TASK_CREATED';") == "t")
        print(f"{checks} checks passed; disposable cluster will be removed.", flush=True)
    finally:
        if started:
            subprocess.run([str(PG_BIN / "pg_ctl"), "-D", str(data), "-m", "immediate", "stop"],
                           check=True, capture_output=True)
