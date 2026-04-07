-- Delete duplicate fleet_component_mapping rows (keep lowest ID per group)
DELETE FROM fleet_component_mapping a
USING fleet_component_mapping b
WHERE a.id > b.id
  AND a.fleet_equipment_code = b.fleet_equipment_code
  AND a.component_code = b.component_code
  AND a.vessel_code = b.vessel_code;

-- Add unique constraint
ALTER TABLE "fleet_component_mapping" ADD CONSTRAINT "unique_fleet_comp_vessel_component" UNIQUE("fleet_equipment_code","vessel_code","component_code");
