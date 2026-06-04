export type UIRole = "Sail_Admin" | "Client_Admin" | "Tech_Superintendent" | "Head_of_Dept" | "Vessel" | "External";

export const UI_ROLES: UIRole[] = ["Sail_Admin", "Client_Admin", "Tech_Superintendent", "Head_of_Dept", "Vessel", "External"];

export const VISIBLE_UI_ROLES: UIRole[] = [
  "Sail_Admin",
  "Client_Admin",
  "Tech_Superintendent",
  "Head_of_Dept",
  "Vessel",
  "External",
];

export const UI_ROLE_LABELS: Record<UIRole, string> = {
  Sail_Admin: "Sail Admin",
  Client_Admin: "Client Admin",
  Tech_Superintendent: "Superintendent",
  Head_of_Dept: "Head of Dept",
  Vessel: "Vessel",
  External: "External",
};

export function mapLoggedRoleToUIRole(userType: string | undefined | null, profileRole: string | undefined | null): UIRole | null {
  if (userType === "Office") {
    if (profileRole === "Sail Admin") return "Sail_Admin";
    if (profileRole === "Admin") return "Tech_Superintendent";
    if (profileRole === "External 10") return "External";
    return "Client_Admin";
  }

  if (userType === "Ship") {
    if (profileRole === "Vessel Admin") return "Head_of_Dept";
    return "Vessel";
  }

  return null;
}
