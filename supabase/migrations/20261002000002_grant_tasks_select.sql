-- =============================================================================
-- ferrixOps
-- Migration: Grant SELECT on tasks to authenticated
--
-- The public.tasks table was created in migration 20260916125019_tasks.sql,
-- which ran after the main privilege grant migration
-- (20260901000200_fix_authenticated_privileges.sql). As a result, no
-- table-level SELECT privilege was ever granted to the authenticated role.
--
-- PostgreSQL evaluates table grants before RLS. Without a SELECT grant,
-- PostgREST returns HTTP 403 (PostgreSQL error 42501: insufficient_privilege)
-- before any RLS policy is evaluated.
--
-- This migration adds only the minimal required privilege. All RLS policies
-- defined in 20260916125019_tasks.sql remain in effect and unchanged.
-- =============================================================================

GRANT SELECT ON TABLE public.tasks TO authenticated;
