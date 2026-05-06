-- Migration 108: Repair corrupted JSON columns caused by fieldLogger String() coercion
-- String() converts objects/arrays to "[object Object]" instead of proper JSON.
-- This migration resets any corrupted values to valid empty arrays/objects.
-- Idempotent: only touches rows that are already corrupted.

--> statement-breakpoint

-- work_orders.consumed_spare_parts
UPDATE work_orders SET consumed_spare_parts = '[]'::json
WHERE consumed_spare_parts IS NOT NULL
AND consumed_spare_parts::text NOT LIKE '[%'
AND consumed_spare_parts::text NOT LIKE '{%'
AND consumed_spare_parts::text != 'null';

--> statement-breakpoint

-- work_orders.required_spare_parts
UPDATE work_orders SET required_spare_parts = '[]'::json
WHERE required_spare_parts IS NOT NULL
AND required_spare_parts::text NOT LIKE '[%'
AND required_spare_parts::text NOT LIKE '{%'
AND required_spare_parts::text != 'null';

--> statement-breakpoint

-- work_orders.required_tools
UPDATE work_orders SET required_tools = '[]'::json
WHERE required_tools IS NOT NULL
AND required_tools::text NOT LIKE '[%'
AND required_tools::text NOT LIKE '{%'
AND required_tools::text != 'null';

--> statement-breakpoint

-- work_orders.safety_requirements
UPDATE work_orders SET safety_requirements = '{"ppeRequirements":[],"permitRequirements":[],"otherRequirements":[]}'::json
WHERE safety_requirements IS NOT NULL
AND safety_requirements::text NOT LIKE '[%'
AND safety_requirements::text NOT LIKE '{%'
AND safety_requirements::text != 'null';

--> statement-breakpoint

-- work_orders.uploaded_documents
UPDATE work_orders SET uploaded_documents = '[]'::json
WHERE uploaded_documents IS NOT NULL
AND uploaded_documents::text NOT LIKE '[%'
AND uploaded_documents::text NOT LIKE '{%'
AND uploaded_documents::text != 'null';

--> statement-breakpoint

-- jobs.required_spare_parts
UPDATE jobs SET required_spare_parts = '[]'::json
WHERE required_spare_parts IS NOT NULL
AND required_spare_parts::text NOT LIKE '[%'
AND required_spare_parts::text NOT LIKE '{%'
AND required_spare_parts::text != 'null';

--> statement-breakpoint

-- jobs.required_tools
UPDATE jobs SET required_tools = '[]'::json
WHERE required_tools IS NOT NULL
AND required_tools::text NOT LIKE '[%'
AND required_tools::text NOT LIKE '{%'
AND required_tools::text != 'null';

--> statement-breakpoint

-- jobs.safety_requirements
UPDATE jobs SET safety_requirements = '{"ppeRequirements":[],"permitRequirements":[],"otherRequirements":[]}'::json
WHERE safety_requirements IS NOT NULL
AND safety_requirements::text NOT LIKE '[%'
AND safety_requirements::text NOT LIKE '{%'
AND safety_requirements::text != 'null';

--> statement-breakpoint

-- fleet_jobs.required_spare_parts
UPDATE fleet_jobs SET required_spare_parts = '[]'::json
WHERE required_spare_parts IS NOT NULL
AND required_spare_parts::text NOT LIKE '[%'
AND required_spare_parts::text NOT LIKE '{%'
AND required_spare_parts::text != 'null';

--> statement-breakpoint

-- fleet_jobs.required_tools
UPDATE fleet_jobs SET required_tools = '[]'::json
WHERE required_tools IS NOT NULL
AND required_tools::text NOT LIKE '[%'
AND required_tools::text NOT LIKE '{%'
AND required_tools::text != 'null';

--> statement-breakpoint

-- component_maintenance_history.spares_used (has immutability trigger — must disable first)
ALTER TABLE component_maintenance_history DISABLE TRIGGER prevent_maintenance_history_update;

--> statement-breakpoint

UPDATE component_maintenance_history SET spares_used = '[]'::json
WHERE spares_used IS NOT NULL
AND spares_used::text NOT LIKE '[%'
AND spares_used::text NOT LIKE '{%'
AND spares_used::text != 'null';

--> statement-breakpoint

ALTER TABLE component_maintenance_history ENABLE TRIGGER prevent_maintenance_history_update;

--> statement-breakpoint

-- work_order_executions.consumed_spare_parts
UPDATE work_order_executions SET consumed_spare_parts = '[]'::json
WHERE consumed_spare_parts IS NOT NULL
AND consumed_spare_parts::text NOT LIKE '[%'
AND consumed_spare_parts::text NOT LIKE '{%'
AND consumed_spare_parts::text != 'null';

--> statement-breakpoint

-- work_order_executions.uploaded_documents
UPDATE work_order_executions SET uploaded_documents = '[]'::json
WHERE uploaded_documents IS NOT NULL
AND uploaded_documents::text NOT LIKE '[%'
AND uploaded_documents::text NOT LIKE '{%'
AND uploaded_documents::text != 'null';

--> statement-breakpoint

-- sync_field_log: clean corrupted newValue entries (so future syncs don't reapply corruption)
UPDATE sync_field_log SET new_value = '[]'
WHERE new_value = '[object Object]';

--> statement-breakpoint

UPDATE sync_field_log SET old_value = '[]'
WHERE old_value = '[object Object]';
