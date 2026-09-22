-- Create and link an organization record for every organization account.

insert into student_organization (org_name, contact_email, status)
select u.full_name, u.email, 'Active'
from app_user u
where u.role = 'organization'
  and not exists (
    select 1
    from student_organization organization
    where lower(organization.contact_email) = lower(u.email)
  );

update student_organization organization
set status = 'Active'
from app_user u
where u.role = 'organization'
  and lower(organization.contact_email) = lower(u.email);

insert into user_organization (user_id, org_id, membership_role, status)
select u.user_id, organization.org_id, 'Requester', 'Active'
from app_user u
join student_organization organization
  on lower(organization.contact_email) = lower(u.email)
where u.role = 'organization'
on conflict (user_id, org_id) do update
  set membership_role = 'Requester',
      status = 'Active';