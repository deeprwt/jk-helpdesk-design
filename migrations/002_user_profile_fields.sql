-- Additional profile fields for users
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id        VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS designation        VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS department         VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS position           VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS manager            VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS present_address    TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS permanent_address  TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS postal_code        VARCHAR(30);
