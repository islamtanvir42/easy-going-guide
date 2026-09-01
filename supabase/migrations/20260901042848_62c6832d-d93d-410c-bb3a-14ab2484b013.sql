ALTER TABLE public.servers
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS renewal_date date,
  ADD COLUMN IF NOT EXISTS expiry_date date;

CREATE INDEX IF NOT EXISTS servers_expiry_date_idx ON public.servers (expiry_date);

WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY hostname) AS rn
  FROM public.servers
)
UPDATE public.servers s
SET
  start_date = CURRENT_DATE - (INTERVAL '1 year' * (1 + (n.rn % 4))) - (INTERVAL '30 days' * n.rn),
  expiry_date = CURRENT_DATE + (INTERVAL '1 day' * (CASE n.rn % 5 WHEN 0 THEN 25 WHEN 1 THEN 60 WHEN 2 THEN 150 WHEN 3 THEN 260 ELSE 420 END))
FROM numbered n
WHERE s.id = n.id;

UPDATE public.servers
SET renewal_date = expiry_date - INTERVAL '30 days'
WHERE expiry_date IS NOT NULL;