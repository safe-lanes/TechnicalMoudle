export type UIRole = "Sail_Admin" | "Client_Admin" | "Head_of_Dept" | "Vessel";

export const UI_ROLES: UIRole[] = ["Sail_Admin", "Client_Admin", "Head_of_Dept", "Vessel"];

// Visible roles in the dropdown - Sail_Admin is hidden but can be uncommented later
export const VISIBLE_UI_ROLES: UIRole[] = [
  // "Sail_Admin", // Uncomment to show Sail Admin in dropdown
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
