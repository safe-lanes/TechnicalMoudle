ALTER TABLE "work_order_postponements" ADD COLUMN IF NOT EXISTS "approver" text;--> statement-breakpoint
ALTER TABLE "work_order_postponements" ADD COLUMN IF NOT EXISTS "postpone_date" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "postpone_requested_date" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "postpone_approver" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "postponement_approval_date" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "postponement_approval_remarks" text;
