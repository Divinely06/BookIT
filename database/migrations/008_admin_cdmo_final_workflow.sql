-- Align booking stages with Faculty -> Admin review -> CDMO -> final Admin confirmation.

alter table booking drop constraint if exists booking_status_check;

update booking
set status = case status
  when 'Dean review' then 'Admin review'
  else status
end;

alter table booking
  add constraint booking_status_check
  check (status in (
    'Faculty review', 'Admin review', 'CDMO review',
    'Final admin review', 'Approved', 'Prepared', 'Rejected'
  ));