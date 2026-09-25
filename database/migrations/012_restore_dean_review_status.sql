-- Restore the Faculty -> Dean workflow status used by the current API.

alter table booking drop constraint if exists booking_status_check;

alter table booking
  add constraint booking_status_check
  check (status in (
    'Faculty review', 'Dean review', 'Admin review', 'CDMO review',
    'Final admin review', 'Approved', 'Prepared', 'Rejected'
  ));