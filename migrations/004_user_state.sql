-- Add state field for user profile
ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(100);
