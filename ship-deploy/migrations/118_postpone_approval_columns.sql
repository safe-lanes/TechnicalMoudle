-- Migration 118: Postponement Approval Workflow (Plan B)
-- Adds office-approval tracking columns to work_orders and work_order_postponements
-- All statements are idempotent (ADD COLUMN IF NOT EXISTS).

-- work_orders: ship's requested new due date (set when postpone-request is submitted)
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS postpone_requested_date TEXT;

-- work_orders: static "Office" approver stored at request submission time
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS postpone_approver TEXT;

-- work_orders: ISO date when office approved or rejected the postponement
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS postponement_approval_date TEXT;

-- work_orders: optional remarks from office on approve/reject
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS postponement_approval_remarks TEXT;

-- work_order_postponements: designated approver (static "Office" value)
ALTER TABLE work_order_postponements ADD COLUMN IF NOT EXISTS approver TEXT;

-- work_order_postponements: raw postpone date entered in the dialog form
ALTER TABLE work_order_postponements ADD COLUMN IF NOT EXISTS postpone_date TEXT;

-- work_order_postponements: remarks captured when office approves or rejects
ALTER TABLE work_order_postponements ADD COLUMN IF NOT EXISTS approval_remarks TEXT;

-- work_order_postponements: ISO date the office decision was recorded
ALTER TABLE work_order_postponements ADD COLUMN IF NOT EXISTS approved_date TEXT;

-- work_order_postponements: name/role of the office user who made the decision
ALTER TABLE work_order_postponements ADD COLUMN IF NOT EXISTS approved_by TEXT;
