CREATE TABLE subscription_plans (
 id CHAR(36) PRIMARY KEY, name VARCHAR(80) NOT NULL, description VARCHAR(500) NOT NULL,
 price_monthly_cents INT UNSIGNED NOT NULL, currency CHAR(3) NOT NULL DEFAULT 'MYR', child_limit INT UNSIGNED NOT NULL,
 generation_limit INT UNSIGNED NOT NULL, trial_days INT UNSIGNED NOT NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);
CREATE TABLE families (
 id CHAR(36) PRIMARY KEY, parent_id CHAR(36) NOT NULL UNIQUE, name VARCHAR(100) NOT NULL, code VARCHAR(16) NOT NULL UNIQUE,
 status ENUM('ACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE', trial_started_at DATETIME(3), trial_ends_at DATETIME(3),
 trial_child_limit INT UNSIGNED NOT NULL, trial_generation_limit INT UNSIGNED NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), FOREIGN KEY(parent_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE family_children (
 user_id CHAR(36) PRIMARY KEY, family_id CHAR(36) NOT NULL, username VARCHAR(32) NOT NULL, school_level VARCHAR(64) NOT NULL,
 avatar VARCHAR(16) NOT NULL DEFAULT 'fox', can_generate BOOLEAN NOT NULL DEFAULT FALSE, allowed_subjects JSON NOT NULL,
 daily_minutes_limit INT UNSIGNED NOT NULL DEFAULT 30, UNIQUE KEY uq_child_username(family_id,username),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(family_id) REFERENCES families(id) ON DELETE CASCADE
);
CREATE TABLE family_subscriptions (
 id CHAR(36) PRIMARY KEY, family_id CHAR(36) NOT NULL, plan_id CHAR(36) NOT NULL, plan_name VARCHAR(80) NOT NULL,
 price_monthly_cents INT UNSIGNED NOT NULL, child_limit INT UNSIGNED NOT NULL, generation_limit INT UNSIGNED NOT NULL,
 currency CHAR(3) NOT NULL DEFAULT 'MYR', status ENUM('PENDING','ACTIVE','CANCELLED','EXPIRED') NOT NULL DEFAULT 'PENDING',
 starts_at DATETIME(3), ends_at DATETIME(3), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY(family_id) REFERENCES families(id) ON DELETE CASCADE, FOREIGN KEY(plan_id) REFERENCES subscription_plans(id),
 INDEX idx_family_subscription(family_id,status,ends_at)
);
CREATE TABLE child_daily_usage (
 child_id CHAR(36) NOT NULL, local_date DATE NOT NULL, learning_seconds INT UNSIGNED NOT NULL DEFAULT 0,
 heartbeat_at DATETIME(3), PRIMARY KEY(child_id,local_date), FOREIGN KEY(child_id) REFERENCES users(id) ON DELETE CASCADE
);
ALTER TABLE generation_jobs ADD COLUMN family_id CHAR(36), ADD INDEX idx_jobs_family_period(family_id,created_at), ADD FOREIGN KEY(family_id) REFERENCES families(id) ON DELETE SET NULL;
INSERT INTO subscription_plans(id,name,description,price_monthly_cents,child_limit,generation_limit,trial_days) VALUES
 ('40000000-0000-4000-8000-000000000001','Starter','A shared learning workspace for a small family.',2900,2,20,14),
 ('40000000-0000-4000-8000-000000000002','Family','More children and learning adventures for your family.',4900,5,60,14);
