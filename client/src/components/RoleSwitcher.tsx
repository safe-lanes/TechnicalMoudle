import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUIRole } from "@/contexts/UIRoleContext";
import { UI_ROLES, UI_ROLE_LABELS } from "@shared/uiRoles";
import type { UIRole } from "@shared/uiRoles";
import { User } from "lucide-react";

export function RoleSwitcher() {
  const { uiRole, setUIRole } = useUIRole();

  return (
    <div className="flex items-center gap-2">
      <User className="h-4 w-4 text-gray-500" />
      <Select
        value={uiRole}
        onValueChange={(value) => setUIRole(value as UIRole)}
      >
        <SelectTrigger 
          className="w-[140px] h-8 text-sm bg-white border-gray-300"
          data-testid="select-role-switcher"
        >
          <SelectValue placeholder="Select Role" />
        </SelectTrigger>
        <SelectContent>
          {UI_ROLES.map((role) => (
            <SelectItem 
              key={role} 
              value={role}
              data-testid={`select-role-${role.toLowerCase().replace("_", "-")}`}
            >
              {UI_ROLE_LABELS[role]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
