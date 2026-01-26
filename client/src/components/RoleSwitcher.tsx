import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUIRole } from "@/contexts/UIRoleContext";
import { UI_ROLES, UI_ROLE_LABELS } from "@shared/uiRoles";
import type { UIRole } from "@shared/uiRoles";
import { User, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RoleSwitcher() {
  const { uiRole, setUIRole } = useUIRole();

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              data-testid="button-role-switcher"
            >
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-gray-900 text-white">
          <p>{UI_ROLE_LABELS[uiRole]}</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-40">
        {UI_ROLES.map((role) => (
          <DropdownMenuItem
            key={role}
            onClick={() => setUIRole(role)}
            className="flex items-center justify-between cursor-pointer"
            data-testid={`menu-role-${role.toLowerCase().replace("_", "-")}`}
          >
            <span>{UI_ROLE_LABELS[role]}</span>
            {uiRole === role && <Check className="h-4 w-4 text-green-600" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
