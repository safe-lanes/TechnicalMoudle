-- 185: Job "Office Reviewer rule" — how the Job's Office Reviewer roles approve.
--   'any' = Any one (OR): one of the roles approving is enough (DEFAULT = today's behaviour)
--   'all' = All (AND): each role must approve
-- Read by the approval engine's "Job's Office Reviewers" approver (WO Office Review, later form
-- approvals). Synced with the job row (additive column, full-row sync). No CHECK constraint on a
-- synced text column; the value is validated in the application (shared/officeReviewer.ts).
-- Idempotent: ADD COLUMN IF NOT EXISTS; existing rows get the default.

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS office_reviewer_rule TEXT NOT NULL DEFAULT 'any';
