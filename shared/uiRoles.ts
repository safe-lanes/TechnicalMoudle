export type UIRole = "Sail_Admin" | "Client_Admin" | "Head_of_Dept" | "Vessel";

export const UI_ROLES: UIRole[] = ["Sail_Admin", "Client_Admin", "Head_of_Dept", "Vessel"];

// Visible roles in the dropdown
export const VISIBLE_UI_ROLES: UIRole[] = [
  "Sail_Admin",
  "Client_Admin",
  "Head_of_Dept",
  "Vessel",
];

export const UI_ROLE_LABELS: Record<UIRole, string> = {
  Sail_Admin: "Sail Admin",
  Client_Admin: "Client Admin",
  Head_of_Dept: "Head of Dept",
  Vessel: "Vessel",
};
