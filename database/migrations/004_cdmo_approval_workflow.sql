-- Replace the old maintenance/dean workflow with Faculty -> Admin -> CDMO -> Admin.

alter table app_user drop constraint if exists app_user_role_check;
alter table booking drop constraint if exists booking_status_check;
alter table approval drop constraint if exists approval_approval_level_check;

update app_user
set role = 'cdmo'
where role = 'maintenance';

update app_user
set role = 'admin'
where role = 'dean';

update booking
set status = case status
  when 'Maintenance review' then 'Admin review'
  when 'Dean review' then 'Final admin review'
  else status
end;

update approval
set approval_level = case approval_level
  when 2 then 2
  when 3 then 3
  when 4 then 4
  else approval_level
end;

alter table app_user
  add constraint app_user_role_check
  check (role in ('organization', 'faculty', 'admin', 'cdmo'));

alter table booking
  add constraint booking_status_check
  check (status in (
    'Faculty review', 'Admin review', 'CDMO review',
    'Final admin review', 'Approved', 'Prepared', 'Rejected'
  ));

alter table approval
  add constraint approval_approval_level_check
  check (approval_level in (1, 2, 3, 4));
