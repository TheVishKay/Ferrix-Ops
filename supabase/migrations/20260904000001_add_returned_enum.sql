-- =============================================================================
-- EMPLOYEE OPERATIONS MANAGEMENT SYSTEM
-- Migration: Add RETURNED_FOR_CORRECTION Enum
--
-- This is in its own file because PostgreSQL prevents using newly added
-- enum values in the same transaction block where they are created.
-- =============================================================================

ALTER TYPE public.expense_status ADD VALUE 'RETURNED_FOR_CORRECTION' AFTER 'SUBMITTED';
