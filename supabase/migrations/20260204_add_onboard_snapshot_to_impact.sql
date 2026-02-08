-- Add onboard_snapshot column to impact table to store user demographics at time of impact generation.
-- Used to detect when user demographics have changed so impact can be regenerated.
ALTER TABLE impact
ADD COLUMN IF NOT EXISTS onboard_snapshot text;
