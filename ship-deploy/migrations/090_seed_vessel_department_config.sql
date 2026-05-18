INSERT INTO vessel_department_config (vessel_id, department, is_enabled, sort_order)
SELECT v.vuuid, ml.list_value, true, ml.display_order
FROM vessels v
CROSS JOIN master_lists ml
WHERE ml.list_type = 'department' AND ml.is_active = true
ON CONFLICT (vessel_id, department) DO NOTHING;
