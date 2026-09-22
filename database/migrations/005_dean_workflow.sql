-- Align the approval workflow with Organization -> Faculty -> Dean -> CDMO -> Admin.

alter table app_user drop constraint if exists app_user_role_check;
alter table booking drop constraint if exists booking_status_check;

update app_user
set role = 'dean'
where role = 'admin'
  and lower(email) = 'dean@mapua.edu.ph';

update app_user
set role = 'cdmo'
where role = 'maintenance';

update booking
set status = case status
  when 'Final admin review' then 'Admin review'
  else status
end;

alter table app_user
  add constraint app_user_role_check
  check (role in ('organization', 'faculty', 'dean', 'cdmo', 'admin'));

alter table booking
  add constraint booking_status_check
  check (status in (
    'Faculty review', 'Dean review', 'CDMO review',
    'Admin review', 'Approved', 'Prepared', 'Rejected'
  ));