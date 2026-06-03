-- ============================================================
-- CTech Fleet Connect — Quote + PMS SMS automation
-- Run this in the EXTERNAL Supabase project (azcrctokesvpwxdptatl)
-- via Dashboard → SQL Editor.
-- ============================================================

-- ---------- 1. quotations ----------
CREATE TABLE IF NOT EXISTS public.quotations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number    TEXT NOT NULL UNIQUE,
  client_id       UUID NOT NULL REFERENCES public.fleet_clients(id) ON DELETE CASCADE,
  vehicle_id      UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','accepted','declined','expired')),
  total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  valid_until     DATE,
  notes           TEXT,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quotations_client ON public.quotations(client_id);
CREATE INDEX IF NOT EXISTS idx_quotations_vehicle ON public.quotations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON public.quotations(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotations TO authenticated;
GRANT ALL ON public.quotations TO service_role;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all quotations"
  ON public.quotations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Fleet managers view own client quotations"
  ON public.quotations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.client_id = quotations.client_id
    )
  );

-- ---------- 2. quote_line_items ----------
CREATE TABLE IF NOT EXISTS public.quote_line_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id      UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  service_code  TEXT,
  description   TEXT NOT NULL,
  qty           NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total    NUMERIC(12,2) GENERATED ALWAYS AS (qty * unit_price) STORED,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quote_line_items_quote ON public.quote_line_items(quote_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_line_items TO authenticated;
GRANT ALL ON public.quote_line_items TO service_role;
ALTER TABLE public.quote_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all line items"
  ON public.quote_line_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Fleet managers view own line items"
  ON public.quote_line_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quotations q
      JOIN public.user_roles ur ON ur.client_id = q.client_id
      WHERE q.id = quote_line_items.quote_id
        AND ur.user_id = auth.uid()
    )
  );

-- ---------- 3. notification_queue ----------
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,                      -- e.g. 'quote_created'
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','sent','failed')),
  attempts    INT NOT NULL DEFAULT 0,
  last_error  TEXT,
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status
  ON public.notification_queue(status, created_at);

GRANT SELECT ON public.notification_queue TO authenticated;
GRANT ALL ON public.notification_queue TO service_role;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read notification queue"
  ON public.notification_queue FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------- 4. pms_sms_log ----------
CREATE TABLE IF NOT EXISTS public.pms_sms_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id            UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  client_id             UUID REFERENCES public.fleet_clients(id) ON DELETE SET NULL,
  phone                 TEXT NOT NULL,
  message               TEXT NOT NULL,
  status                TEXT NOT NULL CHECK (status IN ('sent','failed','dry_run')),
  semaphore_message_id  TEXT,
  dry_run               BOOLEAN NOT NULL DEFAULT false,
  error                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pms_sms_log_vehicle ON public.pms_sms_log(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_pms_sms_log_created ON public.pms_sms_log(created_at DESC);

GRANT SELECT ON public.pms_sms_log TO authenticated;
GRANT ALL ON public.pms_sms_log TO service_role;
ALTER TABLE public.pms_sms_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read sms log"
  ON public.pms_sms_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Fleet managers read own sms log"
  ON public.pms_sms_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.client_id = pms_sms_log.client_id
    )
  );

-- ---------- 5. updated_at trigger ----------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_quotations_updated_at ON public.quotations;
CREATE TRIGGER trg_quotations_updated_at
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 6. Auto-enqueue notification on quote insert ----------
CREATE OR REPLACE FUNCTION public.enqueue_quote_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notification_queue (type, payload)
  VALUES (
    'quote_created',
    jsonb_build_object('quote_id', NEW.id, 'quote_number', NEW.quote_number)
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_quote_notify ON public.quotations;
CREATE TRIGGER trg_quote_notify
  AFTER INSERT ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_quote_notification();
