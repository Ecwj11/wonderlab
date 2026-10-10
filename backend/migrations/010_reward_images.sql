ALTER TABLE family_rewards ADD COLUMN image_key VARCHAR(32) NULL AFTER emoji;
ALTER TABLE reward_redemptions ADD COLUMN image_key VARCHAR(32) NULL AFTER emoji;
