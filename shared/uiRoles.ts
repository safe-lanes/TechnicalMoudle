export type UIRole = "Sail_Admin" | "Vessel";

export const UI_ROLES: UIRole[] = ["Sail_Admin", "Vessel"];

export const UI_ROLE_LABELS: Record<UIRole, string> = {
  Sail_Admin: "Sail Admin",
  Vessel: "Vessel",
};
