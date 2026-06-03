ALTER TABLE "work_order_postponements" ADD COLUMN "approver" text;--> statement-breakpoint
ALTER TABLE "work_order_postponements" ADD COLUMN "postpone_date" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "postpone_requested_date" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "postpone_approver" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "postponement_approval_date" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "postponement_approval_remarks" text;