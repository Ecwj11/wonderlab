CREATE TABLE family_reward_settings (
 family_id CHAR(36) PRIMARY KEY, lesson_stars INT UNSIGNED NOT NULL DEFAULT 5,
 correct_answer_stars INT UNSIGNED NOT NULL DEFAULT 1, perfect_quiz_bonus_stars INT UNSIGNED NOT NULL DEFAULT 5,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 FOREIGN KEY(family_id) REFERENCES families(id) ON DELETE CASCADE,
 CHECK(lesson_stars<=100 AND correct_answer_stars<=100 AND perfect_quiz_bonus_stars<=100)
);
CREATE TABLE family_rewards (
 id CHAR(36) PRIMARY KEY, family_id CHAR(36) NOT NULL, child_id CHAR(36),
 name VARCHAR(100) NOT NULL, description VARCHAR(500) NOT NULL, emoji VARCHAR(16) NOT NULL,
 star_cost INT UNSIGNED NOT NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 FOREIGN KEY(family_id) REFERENCES families(id) ON DELETE CASCADE, FOREIGN KEY(child_id) REFERENCES family_children(user_id) ON DELETE CASCADE,
 CHECK(star_cost>=1 AND star_cost<=1000000), INDEX idx_family_reward(family_id,is_active,created_at), INDEX idx_reward_child(child_id)
);
CREATE TABLE child_star_wallets (
 child_id CHAR(36) PRIMARY KEY, balance INT UNSIGNED NOT NULL DEFAULT 0, lifetime_earned INT UNSIGNED NOT NULL DEFAULT 0,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 FOREIGN KEY(child_id) REFERENCES family_children(user_id) ON DELETE CASCADE
);
CREATE TABLE reward_redemptions (
 id CHAR(36) PRIMARY KEY, family_id CHAR(36) NOT NULL, child_id CHAR(36) NOT NULL, reward_id CHAR(36) NOT NULL, request_id CHAR(36) NOT NULL,
 name VARCHAR(100) NOT NULL, description VARCHAR(500) NOT NULL, emoji VARCHAR(16) NOT NULL, star_cost INT UNSIGNED NOT NULL,
 status ENUM('PENDING','FULFILLED','DECLINED','CANCELLED') NOT NULL DEFAULT 'PENDING', note VARCHAR(300) NOT NULL DEFAULT '',
 pending_marker TINYINT GENERATED ALWAYS AS (IF(status='PENDING',1,NULL)) STORED,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), resolved_at DATETIME(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 FOREIGN KEY(family_id) REFERENCES families(id) ON DELETE CASCADE, FOREIGN KEY(child_id) REFERENCES family_children(user_id) ON DELETE CASCADE,
 FOREIGN KEY(reward_id) REFERENCES family_rewards(id) ON DELETE CASCADE,
 UNIQUE KEY uq_redemption_request(child_id,request_id), UNIQUE KEY uq_pending_prize(child_id,reward_id,pending_marker),
 INDEX idx_redemption_family(family_id,status,created_at), INDEX idx_redemption_child(child_id,created_at)
);
CREATE TABLE child_star_transactions (
 id CHAR(36) PRIMARY KEY, child_id CHAR(36) NOT NULL, lesson_id CHAR(36), redemption_id CHAR(36),
 source_key VARCHAR(180) NOT NULL, amount INT NOT NULL, kind ENUM('EARN','REDEEM','REFUND') NOT NULL, reason VARCHAR(180) NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY(child_id) REFERENCES family_children(user_id) ON DELETE CASCADE, FOREIGN KEY(lesson_id) REFERENCES lessons(id) ON DELETE SET NULL,
 FOREIGN KEY(redemption_id) REFERENCES reward_redemptions(id) ON DELETE SET NULL,
 UNIQUE KEY uq_star_source(child_id,source_key), INDEX idx_star_history(child_id,created_at), CHECK(amount<>0)
);
INSERT IGNORE INTO child_star_transactions(id,child_id,lesson_id,source_key,amount,kind,reason,created_at)
 SELECT UUID(),x.user_id,x.lesson_id,CONCAT('earn:',x.reward_key),FLOOR(x.amount/10),'EARN','Learning before Stars',x.created_at
 FROM user_xp_transactions x JOIN family_children c ON c.user_id=x.user_id
 WHERE x.amount>=10 AND (x.reward_key LIKE 'complete:%' OR x.reward_key LIKE 'quiz:%');
INSERT IGNORE INTO child_star_wallets(child_id,balance,lifetime_earned)
 SELECT child_id,SUM(amount),SUM(amount) FROM child_star_transactions WHERE kind='EARN' GROUP BY child_id;
