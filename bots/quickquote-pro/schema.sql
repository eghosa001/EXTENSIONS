CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  business TEXT NOT NULL DEFAULT 'My Business',
  currency TEXT NOT NULL DEFAULT 'NGN',
  draft TEXT,
  flow TEXT,
  plan_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS updates (
  id INTEGER PRIMARY KEY,
  seen_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS documents (
  update_id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_documents_usage ON documents(user_id,created_at);
CREATE TABLE IF NOT EXISTS orders (
  payload TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  stars INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','refunded')),
  ack_sent INTEGER NOT NULL DEFAULT 0,
  charge_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  paid_at INTEGER
);
CREATE TRIGGER IF NOT EXISTS grant_pro_once
AFTER UPDATE OF status ON orders
WHEN OLD.status = 'pending' AND NEW.status = 'paid'
BEGIN
  UPDATE users SET plan_until =
    MAX(COALESCE(plan_until,0), CAST(strftime('%s','now') AS INTEGER)) + 2592000
  WHERE id = NEW.user_id;
END;

-- Refund service updates are idempotent and revoke only the refunded plan's
-- portion of remaining access. A charge ID can be refunded once.
CREATE TRIGGER IF NOT EXISTS revoke_pro_once
AFTER UPDATE OF status ON orders
WHEN OLD.status = 'paid' AND NEW.status = 'refunded'
BEGIN
  UPDATE users SET plan_until = MAX(0, plan_until - 2592000)
  WHERE id = NEW.user_id;
END;
