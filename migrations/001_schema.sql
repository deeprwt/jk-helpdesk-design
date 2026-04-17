-- CGB Helpdesk — PostgreSQL Schema
-- Run: psql $DATABASE_URL -f migrations/001_schema.sql

-- ────────────────────────────────────────────────────────
-- Extensions
-- ────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ────────────────────────────────────────────────────────
-- Organizations
-- ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL,
  domain     VARCHAR(255) UNIQUE NOT NULL,
  status     VARCHAR(50)  DEFAULT 'active',
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────
-- Users
-- ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 VARCHAR(255) UNIQUE NOT NULL,
  password_hash         VARCHAR(255) NOT NULL,
  first_name            VARCHAR(100),
  last_name             VARCHAR(100),
  full_name             VARCHAR(200),
  role                  VARCHAR(50)  DEFAULT 'user' CHECK (role IN ('user', 'engineer', 'admin', 'superadmin')),
  org_domain            VARCHAR(255),
  is_verified           BOOLEAN      DEFAULT false,
  verification_token    VARCHAR(255),
  token_expiry          TIMESTAMPTZ,
  reset_token           VARCHAR(255),
  reset_token_expiry    TIMESTAMPTZ,
  avatar_url            TEXT,
  phone                 VARCHAR(50),
  city                  VARCHAR(100),
  country               VARCHAR(100),
  created_at            TIMESTAMPTZ  DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_organization_access (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE(user_id, organization_id)
);

-- ────────────────────────────────────────────────────────
-- Tickets
-- ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tickets (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id            UUID        REFERENCES users(id),
  requester_name          VARCHAR(255),
  contact                 VARCHAR(255),
  subject                 VARCHAR(500) NOT NULL,
  description             TEXT,
  category                VARCHAR(100),
  sub_category            VARCHAR(100),
  priority                VARCHAR(50),
  status                  VARCHAR(50)  DEFAULT 'new',
  location                VARCHAR(255),
  link                    TEXT,
  assignee                UUID        REFERENCES users(id),
  assigned_at             TIMESTAMPTZ,
  closed_comment          TEXT,
  hold_comment            TEXT,
  hold_duration_hours     INTEGER,
  hold_started_at         TIMESTAMPTZ,
  hold_until              TIMESTAMPTZ,
  sla_response_at         TIMESTAMPTZ,
  sla_resolution_at       TIMESTAMPTZ,
  sla_response_breached   BOOLEAN      DEFAULT false,
  sla_resolution_breached BOOLEAN      DEFAULT false,
  sla_admin_notified      BOOLEAN      DEFAULT false,
  sla_paused_ms           BIGINT       DEFAULT 0,
  org_domain              VARCHAR(255),
  created_at              TIMESTAMPTZ  DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID        REFERENCES tickets(id) ON DELETE CASCADE,
  sender_id   UUID        REFERENCES users(id),
  sender_name VARCHAR(255),
  message     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_attachments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID        REFERENCES tickets(id) ON DELETE CASCADE,
  file_name   VARCHAR(500),
  file_path   TEXT,
  file_type   VARCHAR(100),
  file_size   BIGINT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_activity (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  UUID        REFERENCES tickets(id) ON DELETE CASCADE,
  actor_id   UUID        REFERENCES users(id),
  action     VARCHAR(100),
  details    JSONB        DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_assignments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     UUID        REFERENCES tickets(id) ON DELETE CASCADE,
  engineer_id   UUID        REFERENCES users(id),
  action        VARCHAR(50),
  assigned_at   TIMESTAMPTZ DEFAULT NOW(),
  unassigned_at TIMESTAMPTZ
);

-- ────────────────────────────────────────────────────────
-- Assets
-- ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assets (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  type          VARCHAR(100),
  serial_number VARCHAR(255),
  status        VARCHAR(50),
  assigned_to   UUID        REFERENCES users(id),
  org_domain    VARCHAR(255),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_details (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  key      VARCHAR(255),
  value    TEXT
);

CREATE TABLE IF NOT EXISTS asset_assignments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id      UUID        REFERENCES assets(id) ON DELETE CASCADE,
  user_id       UUID        REFERENCES users(id),
  assigned_at   TIMESTAMPTZ DEFAULT NOW(),
  unassigned_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS asset_tickets (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id  UUID REFERENCES assets(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  UNIQUE(asset_id, ticket_id)
);

-- ────────────────────────────────────────────────────────
-- Notifications
-- ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES users(id) ON DELETE CASCADE,
  actor_id   UUID        REFERENCES users(id),
  ticket_id  UUID        REFERENCES tickets(id) ON DELETE CASCADE,
  type       VARCHAR(100),
  message    TEXT,
  is_read    BOOLEAN     DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────
-- Indexes
-- ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tickets_requester    ON tickets(requester_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee     ON tickets(assignee);
CREATE INDEX IF NOT EXISTS idx_tickets_status       ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_org          ON tickets(org_domain);
CREATE INDEX IF NOT EXISTS idx_ticket_msg_ticket    ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_act_ticket    ON ticket_activity(ticket_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user   ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_users_email          ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_org            ON users(org_domain);
CREATE INDEX IF NOT EXISTS idx_assets_org           ON assets(org_domain);

-- ────────────────────────────────────────────────────────
-- updated_at auto-update function
-- ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at   ON users;
DROP TRIGGER IF EXISTS tickets_updated_at ON tickets;
DROP TRIGGER IF EXISTS assets_updated_at  ON assets;

CREATE TRIGGER users_updated_at   BEFORE UPDATE ON users   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER assets_updated_at  BEFORE UPDATE ON assets  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────
-- LISTEN / NOTIFY triggers for WebSocket real-time
-- ────────────────────────────────────────────────────────

-- Tickets
CREATE OR REPLACE FUNCTION notify_ticket_changes()
RETURNS TRIGGER AS $$
DECLARE payload TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    payload := json_build_object('operation','DELETE','id',OLD.id,'org_domain',OLD.org_domain)::text;
    PERFORM pg_notify('ticket_changes', payload);
    RETURN OLD;
  ELSE
    payload := json_build_object(
      'operation', TG_OP,
      'id',         NEW.id,
      'status',     NEW.status,
      'assignee',   NEW.assignee,
      'subject',    NEW.subject,
      'requester_id', NEW.requester_id,
      'org_domain', NEW.org_domain,
      'updated_at', NEW.updated_at
    )::text;
    PERFORM pg_notify('ticket_changes', payload);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ticket_changes_trigger ON tickets;
CREATE TRIGGER ticket_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON tickets
  FOR EACH ROW EXECUTE FUNCTION notify_ticket_changes();

-- Ticket messages
CREATE OR REPLACE FUNCTION notify_message_changes()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('message_changes', json_build_object(
    'id',          NEW.id,
    'ticket_id',   NEW.ticket_id,
    'sender_id',   NEW.sender_id,
    'sender_name', NEW.sender_name,
    'message',     NEW.message,
    'created_at',  NEW.created_at
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS message_changes_trigger ON ticket_messages;
CREATE TRIGGER message_changes_trigger
  AFTER INSERT ON ticket_messages
  FOR EACH ROW EXECUTE FUNCTION notify_message_changes();

-- Ticket activity
CREATE OR REPLACE FUNCTION notify_activity_changes()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('activity_changes', json_build_object(
    'id',        NEW.id,
    'ticket_id', NEW.ticket_id,
    'actor_id',  NEW.actor_id,
    'action',    NEW.action,
    'details',   NEW.details,
    'created_at',NEW.created_at
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS activity_changes_trigger ON ticket_activity;
CREATE TRIGGER activity_changes_trigger
  AFTER INSERT ON ticket_activity
  FOR EACH ROW EXECUTE FUNCTION notify_activity_changes();

-- Notifications
CREATE OR REPLACE FUNCTION notify_notification_changes()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('notification_changes', json_build_object(
    'id',        NEW.id,
    'user_id',   NEW.user_id,
    'actor_id',  NEW.actor_id,
    'ticket_id', NEW.ticket_id,
    'type',      NEW.type,
    'message',   NEW.message,
    'is_read',   NEW.is_read,
    'created_at',NEW.created_at
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notification_changes_trigger ON notifications;
CREATE TRIGGER notification_changes_trigger
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION notify_notification_changes();

-- Users (for deletion detection)
CREATE OR REPLACE FUNCTION notify_user_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM pg_notify('user_changes', json_build_object(
      'operation', 'DELETE',
      'id',        OLD.id
    )::text);
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_changes_trigger ON users;
CREATE TRIGGER user_changes_trigger
  AFTER DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION notify_user_changes();

-- ────────────────────────────────────────────────────────
-- Default superadmin organization (edit domain as needed)
-- ────────────────────────────────────────────────────────
INSERT INTO organizations (name, domain, status)
VALUES ('CGB India', 'cgbindia.com', 'active')
ON CONFLICT (domain) DO NOTHING;
