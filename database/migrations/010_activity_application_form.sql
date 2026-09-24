-- Store the online Student Activity Application without changing existing bookings.
create table if not exists activity_application (
  application_id integer generated always as identity primary key,
  booking_id integer references booking(booking_id) on delete set null,
  org_id integer not null references student_organization(org_id),
  applicant_user_id integer not null references app_user(user_id),
  form_data jsonb not null default '{}'::jsonb,
  status text not null default 'Draft'
    check (status in ('Draft', 'Submitted', 'Approved', 'Rejected')),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  unique (booking_id)
);

create index if not exists activity_application_org_updated_idx
  on activity_application(org_id, updated_at desc);

create index if not exists activity_application_applicant_idx
  on activity_application(applicant_user_id, updated_at desc);