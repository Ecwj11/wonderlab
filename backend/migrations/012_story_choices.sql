CREATE TABLE story_choices (
 id CHAR(36) PRIMARY KEY,
 user_id CHAR(36) NOT NULL,
 lesson_id CHAR(36) NOT NULL,
 lesson_version INT NOT NULL,
 scene_key VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
 step_key VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
 choice_key VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uq_story_choice(user_id,lesson_id,lesson_version,scene_key,step_key),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(lesson_id,lesson_version) REFERENCES lesson_versions(lesson_id,version) ON DELETE CASCADE
);
