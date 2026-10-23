-- Minimal Supabase auth interface for focused task integration tests.
-- The actual core, task, audit and hardening migrations are loaded by the runner.
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (
    id UUID PRIMARY KEY,
    email TEXT,
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb
);
CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::UUID;
$$;
GRANT USAGE ON SCHEMA auth, public TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;
