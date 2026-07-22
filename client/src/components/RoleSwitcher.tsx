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
import { isReplit } from "@/lib/env";
import { VISIBLE_UI_ROLES, UI_ROLE_LABELS } from "@shared/uiRoles";
import type { UIRole } from "@shared/uiRoles";
import { User, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RoleSwitcher() {
  const { uiRole, setUIRole } = useUIRole();

  // Dev-only tool: render nothing outside the Replit workspace.
  if (!isReplit()) {
    return null;
  }

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
          <p>{uiRole ? UI_ROLE_LABELS[uiRole] : "Loading..."}</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-40">
        {VISIBLE_UI_ROLES.map((role) => (
          <DropdownMenuItem
            key={role}
            className={`flex items-center justify-between ${
              uiRole === role
                ? "cursor-default font-medium"
                : isReplit()
                  ? "cursor-pointer"
                  : "cursor-default opacity-50"
            }`}
            data-testid={`menu-role-${role.toLowerCase().replace("_", "-")}`}
            onSelect={(e) => {
              if (!isReplit()) { e.preventDefault(); return; }
              setUIRole(role as import("@shared/uiRoles").UIRole);
            }}
          >
            <span>{UI_ROLE_LABELS[role]}</span>
            {uiRole === role && <Check className="h-4 w-4 text-green-600" />}
            {isReplit() && uiRole !== role && (
              <span className="text-[10px] text-orange-400 font-mono ml-1">DEV</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
