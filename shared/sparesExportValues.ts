import { SPARES_TEMPLATE_FIELDS } from "./sparesTemplateFields";

function yesNo(value: unknown) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (value == null || value === "") return "";
  const normalized = String(value).trim().toLowerCase();
  if (["yes", "y", "true", "1", "critical", "present"].includes(normalized)) return "Yes";
  if (["no", "n", "false", "0", "non-critical", "non critical", "not present"].includes(normalized)) return "No";
  return String(value);
}
export function componentSpareValues(spare: Record<string, any>, component: Record<string, any>) {
  const values = {
    ...spare, reserved: "", fleetEquipmentCode: component.fleetEquipmentCode ?? "",
    fleetEquipmentName: component.fleetEquipmentName ?? "", componentCode: component.componentCode,
    componentName: component.name, drawingNumber: spare.drawingNumber ?? spare.drawingNo ?? "",
    criticality: yesNo(spare.critical ?? spare.criticality), totalRob: spare.rob,
    locationA: spare.location, locationARob: spare.robLocationA, locationB: spare.location2,
    locationBRob: spare.robLocationB, minimumStock: spare.min,
    isActive: spare.isActive == null ? "Yes" : yesNo(spare.isActive),
    ihm: yesNo(spare.ihm ?? spare.ihmPresence),
    isRotationItem: spare.isRotationItem == null ? "No" : yesNo(spare.isRotationItem),
  } as Record<string, any>;
  return SPARES_TEMPLATE_FIELDS.map(field => values[field.key] ?? "");
}
