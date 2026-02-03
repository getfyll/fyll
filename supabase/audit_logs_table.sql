CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  items_audited INTEGER NOT NULL DEFAULT 0,
  discrepancies INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ NOT NULL,
  performed_by TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_logs
  ENABLE ROW LEVEL SECURITY;
