-- Stand-in rows until something creates real analyses. Each organization gets
-- its own repositories so the dashboard visibly changes on switch. Organization
-- ids are real Clerk org ids; a made-up one would never match a token.
-- Fixed ids make this safe to re-run.

insert into public.organizations (id) values
  ('org_3KrcoOh7Hrw7mw7ds1BipB8i8Om'),
  ('org_3KridClDLxzJRI7ZqDFXB7QmYsy')
on conflict (id) do nothing;

insert into public.projects (id, organization_id, repo_owner, repo_name) values
  ('a1000000-0000-4000-8000-000000000001', 'org_3KrcoOh7Hrw7mw7ds1BipB8i8Om', 'vercel', 'next.js'),
  ('a1000000-0000-4000-8000-000000000002', 'org_3KrcoOh7Hrw7mw7ds1BipB8i8Om', 'colinhacks', 'zod'),
  ('a2000000-0000-4000-8000-000000000001', 'org_3KridClDLxzJRI7ZqDFXB7QmYsy', 'expressjs', 'express'),
  ('a2000000-0000-4000-8000-000000000002', 'org_3KridClDLxzJRI7ZqDFXB7QmYsy', 'nestjs', 'nest')
on conflict (id) do nothing;

insert into public.analyses
  (id, organization_id, project_id, status, commit_sha, error, created_at, finished_at)
values
  ('b1000000-0000-4000-8000-000000000001', 'org_3KrcoOh7Hrw7mw7ds1BipB8i8Om',
   'a1000000-0000-4000-8000-000000000001', 'complete', '4f2b9c1e7a0d', null,
   now() - interval '2 days', now() - interval '2 days' + interval '41 seconds'),
  ('b1000000-0000-4000-8000-000000000002', 'org_3KrcoOh7Hrw7mw7ds1BipB8i8Om',
   'a1000000-0000-4000-8000-000000000002', 'failed', null,
   'Repository archive exceeded the size limit',
   now() - interval '5 hours', now() - interval '5 hours' + interval '3 seconds'),
  ('b1000000-0000-4000-8000-000000000003', 'org_3KrcoOh7Hrw7mw7ds1BipB8i8Om',
   'a1000000-0000-4000-8000-000000000001', 'parsing', null, null,
   now() - interval '2 minutes', null),
  ('b2000000-0000-4000-8000-000000000001', 'org_3KridClDLxzJRI7ZqDFXB7QmYsy',
   'a2000000-0000-4000-8000-000000000001', 'complete', '9e1d03b7c52a', null,
   now() - interval '1 day', now() - interval '1 day' + interval '18 seconds'),
  ('b2000000-0000-4000-8000-000000000002', 'org_3KridClDLxzJRI7ZqDFXB7QmYsy',
   'a2000000-0000-4000-8000-000000000002', 'queued', null, null,
   now() - interval '30 seconds', null)
on conflict (id) do nothing;
