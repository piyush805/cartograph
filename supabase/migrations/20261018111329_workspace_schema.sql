-- Every row belongs to an organization, and the organization id is the Clerk
-- org id carried in the session token as `o.id`. Policies compare against that
-- claim and nothing else; the application never filters by organization.
--
-- Child tables carry organization_id themselves (rather than joining up to it)
-- so each policy is a single indexed comparison. Composite foreign keys pin a
-- child to its parent's organization, so a row can't claim one organization
-- while pointing at another's analysis.

create table public.organizations (
  id text primary key check (id like 'org\_%'),
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations (id) on delete cascade,
  repo_owner text not null,
  repo_name text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, repo_owner, repo_name),
  unique (id, organization_id)
);

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations (id) on delete cascade,
  project_id uuid not null,
  status text not null default 'queued'
    check (status in ('queued', 'parsing', 'complete', 'failed')),
  commit_sha text,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (id, organization_id),
  foreign key (project_id, organization_id)
    references public.projects (id, organization_id) on delete cascade
);

create index analyses_organization_created_idx
  on public.analyses (organization_id, created_at desc);
create index analyses_project_idx on public.analyses (project_id, organization_id);

create table public.files (
  id bigint generated always as identity primary key,
  organization_id text not null references public.organizations (id) on delete cascade,
  analysis_id uuid not null,
  path text not null,
  folder text not null,
  lines integer not null check (lines >= 0),
  content_hash text not null,
  unique (analysis_id, path),
  unique (id, analysis_id),
  foreign key (analysis_id, organization_id)
    references public.analyses (id, organization_id) on delete cascade
);

create index files_organization_idx on public.files (organization_id);
create index files_analysis_org_idx on public.files (analysis_id, organization_id);

create table public.edges (
  id bigint generated always as identity primary key,
  organization_id text not null references public.organizations (id) on delete cascade,
  analysis_id uuid not null,
  source_file_id bigint not null,
  target_file_id bigint not null,
  kind text not null check (kind in ('import', 're-export', 'dynamic', 'require')),
  unique (analysis_id, source_file_id, target_file_id, kind),
  foreign key (analysis_id, organization_id)
    references public.analyses (id, organization_id) on delete cascade,
  foreign key (source_file_id, analysis_id)
    references public.files (id, analysis_id) on delete cascade,
  foreign key (target_file_id, analysis_id)
    references public.files (id, analysis_id) on delete cascade
);

create index edges_organization_idx on public.edges (organization_id);
create index edges_analysis_org_idx on public.edges (analysis_id, organization_id);
create index edges_source_idx on public.edges (source_file_id, analysis_id);
create index edges_target_idx on public.edges (target_file_id, analysis_id);

-- Method and path are both required: a route that can't be fully recovered is
-- not stored at all.
create table public.routes (
  id bigint generated always as identity primary key,
  organization_id text not null references public.organizations (id) on delete cascade,
  analysis_id uuid not null,
  file_id bigint not null,
  method text not null,
  path text not null,
  foreign key (analysis_id, organization_id)
    references public.analyses (id, organization_id) on delete cascade,
  foreign key (file_id, analysis_id)
    references public.files (id, analysis_id) on delete cascade
);

create index routes_organization_idx on public.routes (organization_id);
create index routes_analysis_org_idx on public.routes (analysis_id, organization_id);
create index routes_file_idx on public.routes (file_id, analysis_id);

create table public.explanations (
  id bigint generated always as identity primary key,
  organization_id text not null references public.organizations (id) on delete cascade,
  analysis_id uuid not null,
  subject_path text not null,
  content_hash text not null,
  model text not null,
  body text not null,
  created_at timestamptz not null default now(),
  foreign key (analysis_id, organization_id)
    references public.analyses (id, organization_id) on delete cascade
);

create index explanations_organization_idx on public.explanations (organization_id);
create index explanations_analysis_org_idx on public.explanations (analysis_id, organization_id);

create table public.file_roles (
  id bigint generated always as identity primary key,
  organization_id text not null references public.organizations (id) on delete cascade,
  analysis_id uuid not null,
  file_id bigint not null,
  role text not null,
  source text not null check (source in ('convention', 'model')),
  unique (file_id),
  foreign key (analysis_id, organization_id)
    references public.analyses (id, organization_id) on delete cascade,
  foreign key (file_id, analysis_id)
    references public.files (id, analysis_id) on delete cascade
);

create index file_roles_organization_idx on public.file_roles (organization_id);
create index file_roles_analysis_org_idx on public.file_roles (analysis_id, organization_id);
create index file_roles_file_analysis_idx on public.file_roles (file_id, analysis_id);

create table public.insights (
  id bigint generated always as identity primary key,
  organization_id text not null references public.organizations (id) on delete cascade,
  analysis_id uuid not null,
  kind text not null
    check (kind in ('cycle', 'unimported', 'high_fan_in', 'long_file')),
  file_paths text[] not null check (cardinality(file_paths) > 0),
  foreign key (analysis_id, organization_id)
    references public.analyses (id, organization_id) on delete cascade
);

create index insights_organization_idx on public.insights (organization_id);
create index insights_analysis_org_idx on public.insights (analysis_id, organization_id);

-- The project's ensure_rls event trigger already enables RLS on new public
-- tables, but it swallows failures and lives outside version control. Enabling
-- it here as well means this file alone guarantees it.
alter table public.organizations enable row level security;
alter table public.projects enable row level security;
alter table public.analyses enable row level security;
alter table public.files enable row level security;
alter table public.edges enable row level security;
alter table public.routes enable row level security;
alter table public.explanations enable row level security;
alter table public.file_roles enable row level security;
alter table public.insights enable row level security;

-- Read-only for now: nothing in the app writes yet, so no write policies exist
-- and every write is refused.
revoke all on
  public.organizations, public.projects, public.analyses, public.files,
  public.edges, public.routes, public.explanations, public.file_roles,
  public.insights
from anon, authenticated;

grant select on
  public.organizations, public.projects, public.analyses, public.files,
  public.edges, public.routes, public.explanations, public.file_roles,
  public.insights
to authenticated;

-- `(select ...)` makes Postgres evaluate the claim once per query rather than
-- once per row.
create policy "members read their organization" on public.organizations
  for select to authenticated
  using (id = (select auth.jwt() -> 'o' ->> 'id'));

create policy "members read their organization's rows" on public.projects
  for select to authenticated
  using (organization_id = (select auth.jwt() -> 'o' ->> 'id'));

create policy "members read their organization's rows" on public.analyses
  for select to authenticated
  using (organization_id = (select auth.jwt() -> 'o' ->> 'id'));

create policy "members read their organization's rows" on public.files
  for select to authenticated
  using (organization_id = (select auth.jwt() -> 'o' ->> 'id'));

create policy "members read their organization's rows" on public.edges
  for select to authenticated
  using (organization_id = (select auth.jwt() -> 'o' ->> 'id'));

create policy "members read their organization's rows" on public.routes
  for select to authenticated
  using (organization_id = (select auth.jwt() -> 'o' ->> 'id'));

create policy "members read their organization's rows" on public.explanations
  for select to authenticated
  using (organization_id = (select auth.jwt() -> 'o' ->> 'id'));

create policy "members read their organization's rows" on public.file_roles
  for select to authenticated
  using (organization_id = (select auth.jwt() -> 'o' ->> 'id'));

create policy "members read their organization's rows" on public.insights
  for select to authenticated
  using (organization_id = (select auth.jwt() -> 'o' ->> 'id'));
