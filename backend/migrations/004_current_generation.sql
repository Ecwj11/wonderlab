ALTER TABLE lessons ADD COLUMN current_job_id CHAR(36) NULL, ADD INDEX idx_current_job (current_job_id);
UPDATE lessons l SET current_job_id=(SELECT j.id FROM generation_jobs j WHERE j.lesson_id=l.id ORDER BY j.created_at DESC,j.id DESC LIMIT 1);
