-- Grant authenticated users the base PostgreSQL privilege required
-- before RLS policies can evaluate access.
GRANT SELECT ON TABLE public.profiles TO authenticated;