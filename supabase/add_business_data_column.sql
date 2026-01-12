-- Add data column to businesses table for storing business settings
-- Run this in your Supabase SQL Editor

-- Add data JSONB column to businesses table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'businesses'
    AND column_name = 'data'
  ) THEN
    ALTER TABLE public.businesses ADD COLUMN data JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Enable realtime for the businesses table (if not already enabled)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.businesses;
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- Table already in publication, ignore
END $$;
