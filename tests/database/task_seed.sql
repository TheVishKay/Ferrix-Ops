INSERT INTO auth.users(id, email) VALUES
('00000000-0000-0000-0000-000000000001', 'owner@example.test'),
('00000000-0000-0000-0000-000000000002', 'employee@example.test'),
('00000000-0000-0000-0000-000000000003', 'accounts@example.test');
UPDATE public.profiles SET role = 'OWNER' WHERE email = 'owner@example.test';
UPDATE public.profiles SET role = 'ACCOUNTS' WHERE email = 'accounts@example.test';
INSERT INTO public.departments(id, name) VALUES
('20000000-0000-0000-0000-000000000001', 'Test');
INSERT INTO public.designations(id, name) VALUES
('30000000-0000-0000-0000-000000000001', 'Test');
INSERT INTO public.employees(id, user_id, employee_code, first_name, last_name,
company_email, department_id, designation_id, joining_date) VALUES
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002',
'E2', 'Test', 'Employee', 'employee@example.test',
'20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', CURRENT_DATE),
('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003',
'E3', 'Test', 'Accounts', 'accounts@example.test',
'20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', CURRENT_DATE);
GRANT SELECT ON public.employees TO authenticated;
