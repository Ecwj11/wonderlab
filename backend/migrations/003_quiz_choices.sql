CREATE TABLE quiz_choices (
 id CHAR(36) PRIMARY KEY,
 user_id CHAR(36) NOT NULL,
 lesson_id CHAR(36) NOT NULL,
 lesson_version INT NOT NULL,
 scene_key VARCHAR(64) NOT NULL,
 question_key VARCHAR(64) NOT NULL,
 option_key VARCHAR(64) NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 UNIQUE KEY uq_first_choice(user_id,lesson_id,lesson_version,scene_key,question_key),
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
);
