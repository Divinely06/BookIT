-- Restore dean approval between faculty review and CDMO review.

alter table booking drop constraint if exists booking_status_check;

update booking
set status = 'Dean review'
where status = 'Admin review';

alter table booking
  add constraint booking_status_check
  check (status in (
    'Faculty review', 'Dean review', 'Admin review', 'CDMO review',
    'Final admin review', 'Approved', 'Prepared', 'Rejected'
  ));