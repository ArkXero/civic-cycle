-- Allow multi-county school board body labels on imported meetings.

ALTER TABLE public.meetings
  DROP CONSTRAINT IF EXISTS meetings_body_check;

ALTER TABLE public.meetings
  ADD CONSTRAINT meetings_body_check
  CHECK (
    body IN (
      'FCPS School Board',
      'Loudoun County School Board',
      'Prince William County School Board',
      'Arlington School Board',
      'Board of Supervisors'
    )
  );
