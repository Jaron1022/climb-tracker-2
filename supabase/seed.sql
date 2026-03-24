insert into public.profiles (id, display_name)
values
  ('11111111-1111-1111-1111-111111111111', 'Jaron'),
  ('22222222-2222-2222-2222-222222222222', 'Maya')
on conflict (id) do nothing;

insert into public.climbs (
  id,
  profile_id,
  photo_url,
  grade,
  style_tags,
  wall_name,
  notes,
  status,
  climbed_on
)
values
  (
    'aaaaaaa1-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    null,
    'V0',
    array['vertical', 'juggy'],
    'Warm Up Wall',
    'Good first send. Focused on feet.',
    'completed',
    '2026-03-18'
  ),
  (
    'aaaaaaa2-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    null,
    'V1',
    array['slab', 'technical'],
    'Blue Arete',
    'Almost slipped off the top move.',
    'completed',
    '2026-03-19'
  ),
  (
    'aaaaaaa3-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    null,
    'V1',
    array['vertical', 'crimpy'],
    'Front Cave',
    'Two tries. Better body tension on the send.',
    'completed',
    '2026-03-21'
  ),
  (
    'aaaaaaa4-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    null,
    'V2',
    array['overhang', 'powerful'],
    'North Cave',
    'Got stuck on the last bump. Come back next session.',
    'attempted',
    '2026-03-22'
  ),
  (
    'bbbbbbb1-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    null,
    'V2',
    array['dynamic', 'juggy'],
    'Comp Slab',
    'Fun coordination style.',
    'completed',
    '2026-03-20'
  )
on conflict (id) do nothing;
