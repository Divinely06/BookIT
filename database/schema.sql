-- Cardinal Resource Hub PostgreSQL schema for Neon.

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

create table app_user (
  user_id integer generated always as identity primary key,
  full_name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null check (
    role in ('organization', 'faculty', 'admin', 'cdmo')
  ),
  contact_number text
);

create table student_organization (
  org_id integer generated always as identity primary key,
  org_name text not null unique,
  faculty_adviser_id integer references app_user(user_id),
  contact_email text not null,
  status text not null default 'Active'
    check (status in ('Active', 'Pending', 'Inactive'))
);

create table user_organization (
  user_id integer not null
    references app_user(user_id) on delete cascade,
  org_id integer not null
    references student_organization(org_id) on delete cascade,
  membership_role text not null default 'Member',
  status text not null default 'Active'
    check (status in ('Active', 'Inactive')),
  primary key (user_id, org_id)
);

create table room (
  room_id integer generated always as identity primary key,
  room_name text not null unique,
  location text not null,
  capacity integer not null check (capacity > 0),
  availability_status text not null default 'Available'
    check (availability_status in ('Available', 'Unavailable'))
);

create table equipment (
  equipment_id integer generated always as identity primary key,
  equipment_name text not null unique,
  category text not null,
  quantity_available integer not null default 0
    check (quantity_available >= 0),
  status text not null default 'Available'
    check (status in ('Available', 'Unavailable', 'Maintenance'))
);

create table booking (
  booking_id integer generated always as identity primary key,
  org_id integer not null references student_organization(org_id),
  room_id integer not null references room(room_id),
  requested_by_user_id integer not null references app_user(user_id),
  event_name text not null,
  participant_count integer not null check (participant_count > 0),
  date_requested timestamptz not null default now(),
  event_date date not null,
  start_time time not null,
  end_time time not null,
  purpose text not null,
  client_request_id text not null unique,
  rejection_reason text,
  status text not null default 'Faculty review'
    check (
      status in (
        'Faculty review', 'Admin review', 'CDMO review',
        'Final admin review', 'Approved', 'Prepared', 'Rejected'
      )
    ),
  check (end_time > start_time),
  foreign key (requested_by_user_id, org_id)
    references user_organization(user_id, org_id)
);

create table booking_equipment (
  booking_id integer not null
    references booking(booking_id) on delete cascade,
  equipment_id integer not null references equipment(equipment_id),
  quantity_requested integer not null check (quantity_requested > 0),
  primary key (booking_id, equipment_id)
);

create table document (
  document_id integer generated always as identity primary key,
  booking_id integer not null
    references booking(booking_id) on delete cascade,
  file_name text not null,
  file_path text not null,
  content_type text not null default 'application/octet-stream',
  upload_date timestamptz not null default now(),
  signature_status text not null default 'Pending'
    check (signature_status in ('Pending', 'Signed', 'Rejected'))
);

create table approval (
  approval_id integer generated always as identity primary key,
  booking_id integer not null
    references booking(booking_id) on delete cascade,
  approved_user_id integer not null references app_user(user_id),
  approval_level integer not null check (approval_level in (1, 2, 3, 4)),
  status text not null check (status in ('Approved', 'Rejected', 'Pending')),
  date_actioned timestamptz,
  remarks text,
  unique (booking_id, approval_level)
);

create table notification (
  notification_id integer generated always as identity primary key,
  user_id integer not null references app_user(user_id) on delete cascade,
  booking_id integer references booking(booking_id) on delete cascade,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notification_user_created_idx
  on notification(user_id, created_at desc);

alter table booking
  add constraint no_overlapping_room_bookings
  exclude using gist (
    room_id with =,
    tsrange(event_date + start_time, event_date + end_time, '[)') with &&
  )
  where (status <> 'Rejected');
