-- Migration: Add reschedule_reason column to orders table
-- This allows farmers to provide a reason when rescheduling delivery dates

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'reschedule_reason'
  ) THEN
    ALTER TABLE orders ADD COLUMN reschedule_reason TEXT;
    RAISE NOTICE 'Successfully added reschedule_reason column to orders table';
  ELSE
    RAISE NOTICE 'reschedule_reason column already exists in orders table';
  END IF;
END $$;

-- Verify the column exists
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name = 'reschedule_reason';
