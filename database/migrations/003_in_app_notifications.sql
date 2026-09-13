create table if not exists notification (
  notification_id integer generated always as identity primary key,
  user_id integer not null references app_user(user_id) on delete cascade,
  booking_id integer references booking(booking_id) on delete cascade,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notification_user_created_idx
  on notification(user_id, created_at desc);