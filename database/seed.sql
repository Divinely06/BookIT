-- Starter records for local/demo use. Run after schema.sql in Neon.
-- Change these demo passwords before production use.

create extension if not exists pgcrypto;

select setval(
  pg_get_serial_sequence('app_user', 'user_id'),
  coalesce(max(user_id), 1),
  max(user_id) is not null
)
from app_user;

insert into app_user (full_name, email, password_hash, role, contact_number)
values
  ('Prof. Maria Santos', 'faculty@mapua.edu.ph', crypt('demo', gen_salt('bf')), 'faculty', null),
  ('Dean Reviewer', 'dean@mapua.edu.ph', crypt('demo', gen_salt('bf')), 'dean', null),
  ('Administrator', 'admin@mapua.edu.ph', crypt('demo', gen_salt('bf')), 'admin', null),
  ('CDMO Officer', 'cdmo@mapua.edu.ph', crypt('demo', gen_salt('bf')), 'cdmo', null),
  ('SSC Requester', 'ssc@mapua.edu.ph', crypt('demo', gen_salt('bf')), 'organization', null),
  ('ITSS Requester', 'itss@mapua.edu.ph', crypt('demo', gen_salt('bf')), 'organization', null),
  ('BEC Requester', 'bec@mapua.edu.ph', crypt('demo', gen_salt('bf')), 'organization', null)
on conflict (email) do nothing;

insert into student_organization (
  org_name,
  faculty_adviser_id,
  contact_email,
  status
)
select values_table.org_name, adviser.user_id, values_table.contact_email, 'Active'
from (
  values
    ('Supreme Student Council', 'ssc@mapua.edu.ph'),
    ('IT Students Society', 'itss@mapua.edu.ph'),
    ('Business Enthusiasts Club', 'bec@mapua.edu.ph')
) as values_table(org_name, contact_email)
join app_user adviser on adviser.email = 'faculty@mapua.edu.ph'
on conflict (org_name) do nothing;

insert into user_organization (user_id, org_id, membership_role)
select member.user_id, organization.org_id, 'Requester'
from app_user member
join student_organization organization
  on organization.contact_email = member.email
where member.role = 'organization'
on conflict (user_id, org_id) do nothing;

insert into room (room_name, location, capacity, availability_status)
values
  ('Multi-Purpose Hall', 'Building A · Ground Floor', 200, 'Available'),
  ('Function Room 1', 'Building B · 2nd Floor', 50, 'Available'),
  ('Audio-Visual Room', 'Building C · 3rd Floor', 80, 'Available'),
  ('Open Court', 'Campus Grounds', 300, 'Unavailable')
on conflict (room_name) do nothing;

insert into equipment (equipment_name, category, quantity_available, status)
values
  ('Wireless Microphone', 'Audio', 8, 'Available'),
  ('LCD Projector', 'Audiovisual', 4, 'Available'),
  ('Folding Tables', 'Furniture', 35, 'Available'),
  ('Monobloc Chairs', 'Furniture', 150, 'Available'),
  ('LED Spotlight', 'Lighting', 2, 'Available'),
  ('Speaker Set', 'Audio', 0, 'Unavailable')
on conflict (equipment_name) do nothing;

insert into booking (
  org_id,
  room_id,
  requested_by_user_id,
  event_name,
  participant_count,
  event_date,
  start_time,
  end_time,
  purpose,
  client_request_id,
  status
)
select
  organization.org_id,
  room.room_id,
  requester.user_id,
  booking_data.event_name,
  booking_data.participant_count,
  booking_data.event_date,
  booking_data.start_time,
  booking_data.end_time,
  booking_data.purpose,
  booking_data.client_request_id,
  booking_data.status
from (
  values
    ('Supreme Student Council', 'ssc@mapua.edu.ph', 'Multi-Purpose Hall', 'Leadership Summit 2026', 150, date '2026-09-20', time '08:00', time '17:00', 'Annual leadership training and summit for organization officers.', 'seed-leadership-summit-2026', 'Admin review'),
    ('IT Students Society', 'itss@mapua.edu.ph', 'Audio-Visual Room', 'Tech Talk Series: AI in Industry', 60, date '2026-09-25', time '13:00', time '17:00', 'Speaker series featuring industry professionals in AI and technology.', 'seed-tech-talk-2026', 'Faculty review'),
    ('Business Enthusiasts Club', 'bec@mapua.edu.ph', 'Multi-Purpose Hall', 'Entrepreneurship Fair 2026', 200, date '2026-10-05', time '09:00', time '16:00', 'Annual fair showcasing student business projects.', 'seed-entrepreneurship-fair-2026', 'Admin review')
) as booking_data(
  org_name,
  requester_email,
  room_name,
  event_name,
  participant_count,
  event_date,
  start_time,
  end_time,
  purpose,
  client_request_id,
  status
)
join student_organization organization on organization.org_name = booking_data.org_name
join app_user requester on requester.email = booking_data.requester_email
join room on room.room_name = booking_data.room_name
where not exists (
  select 1
  from booking existing
  where existing.event_name = booking_data.event_name
);
