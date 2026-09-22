-- Keep each organization account linked to its own email address.

delete from user_organization membership
where exists (
  select 1
  from app_user member
  join student_organization organization on organization.org_id = membership.org_id
  where member.user_id = membership.user_id
    and member.role = 'organization'
    and lower(member.email) <> lower(organization.contact_email)
);

alter table student_organization
  add constraint student_organization_contact_email_key unique (contact_email);

alter table student_organization
  add constraint student_organization_contact_email_fkey
  foreign key (contact_email) references app_user(email);