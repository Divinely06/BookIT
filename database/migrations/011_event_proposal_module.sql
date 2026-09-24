-- Independent Event Proposal module. It is not a booking or SAAF record.
create table if not exists activity (
  activity_id integer generated always as identity primary key,
  org_id integer not null references student_organization(org_id),
  created_by_user_id integer not null references app_user(user_id),
  created_at timestamptz not null default now()
);

create table if not exists event_proposal (
  proposal_id integer generated always as identity primary key,
  activity_id integer references activity(activity_id) on delete set null,
  org_id integer not null references student_organization(org_id),
  created_by_user_id integer not null references app_user(user_id),
  form_data jsonb not null default '{}'::jsonb,
  status text not null default 'Draft'
    check (status in ('Draft', 'Submitted', 'Adviser Noted', 'Approved', 'Rejected')),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz
);

create index if not exists event_proposal_org_updated_idx
  on event_proposal(org_id, updated_at desc);

create index if not exists event_proposal_creator_updated_idx
  on event_proposal(created_by_user_id, updated_at desc);

create table if not exists event_proposal_approval (
  approval_id integer generated always as identity primary key,
  proposal_id integer not null references event_proposal(proposal_id) on delete cascade,
  approved_user_id integer not null references app_user(user_id),
  approval_stage text not null check (approval_stage in ('Adviser', 'Final')),
  status text not null check (status in ('Noted', 'Approved', 'Rejected')),
  date_actioned timestamptz not null default now(),
  remarks text,
  unique (proposal_id, approval_stage)
);