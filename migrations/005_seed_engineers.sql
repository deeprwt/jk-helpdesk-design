-- Seed location-bound engineer accounts.
-- Default password: Engineer@123  (engineers should change after first login)
-- bcryptjs hash, cost 10. Idempotent: re-running updates city/state but never overwrites the password.

INSERT INTO users (
  email, password_hash, first_name, last_name, full_name,
  role, org_domain, is_verified, city, state
)
VALUES
  (
    'umang@jkmail.com',
    '$2a$10$Q.eKYL3zmPHD1ZGRep9kkeearLvfxdt2dkk.rim7WnTrlyZ3j7zZm',
    'Umang', '', 'Umang',
    'engineer', 'jkmail.com', true, 'Delhi HO', 'Delhi'
  ),
  (
    'IThelpdesk.tfpl@jkmail.com',
    '$2a$10$Q.eKYL3zmPHD1ZGRep9kkeearLvfxdt2dkk.rim7WnTrlyZ3j7zZm',
    'IT Helpdesk', 'TFPL', 'IT Helpdesk TFPL',
    'engineer', 'jkmail.com', true, 'Surajpur', 'Chhattisgarh'
  ),
  (
    'it.helpdesk@jkmail.com',
    '$2a$10$Q.eKYL3zmPHD1ZGRep9kkeearLvfxdt2dkk.rim7WnTrlyZ3j7zZm',
    'IT Helpdesk', '', 'IT Helpdesk',
    'engineer', 'jkmail.com', true, 'Gajraula', 'Uttar Pradesh'
  )
ON CONFLICT (email) DO UPDATE
  SET role        = EXCLUDED.role,
      city        = EXCLUDED.city,
      state       = EXCLUDED.state,
      org_domain  = EXCLUDED.org_domain,
      is_verified = true;
