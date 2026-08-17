import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

function computeInitials(
  fullName?: string | null,
  username?: string | null,
): string {
  const name = (fullName || "").trim();
  if (name) {
    const tokens = name.split(/\s+/).filter(Boolean);
    if (tokens.length === 1) {
      return tokens[0].slice(0, 2).toUpperCase();
    }
    const first = tokens[0][0] ?? "";
    const last = tokens[tokens.length - 1][0] ?? "";
    const initials = `${first}${last}`.toUpperCase();
    if (initials) return initials;
  }
  const uname = (username || "").trim();
  if (uname) return uname.slice(0, 2).toUpperCase();
  return "?";
}

export function UserMenu() {
  const { currentUser, domain, logout } = useAuth();

  const fullName = currentUser?.fullName || currentUser?.username || "User";
  const role = currentUser?.role || "—";
  const domainName = domain || "—";
  const initials = computeInitials(currentUser?.fullName, currentUser?.username);

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full bg-[#52baf3] text-white hover:bg-[#3da4dd] hover:text-white"
              data-testid="button-user-menu"
            >
              <span className="text-sm font-semibold">{initials}</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-gray-900 text-white">
          <p>{fullName}</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 text-sm">
          <span className="text-gray-500">User Name : </span>
          <span
            className="font-semibold text-gray-900"
            data-testid="text-user-name"
          >
            {fullName}
          </span>
        </div>
        <div className="px-2 py-1.5 text-sm">
          <span className="text-gray-500">Role : </span>
          <span
            className="font-semibold text-gray-900"
            data-testid="text-user-role"
          >
            {role}
          </span>
        </div>
        <div className="px-2 py-1.5 text-sm">
          <span className="text-gray-500">Domain Name : </span>
          <span
            className="font-semibold text-gray-900"
            data-testid="text-user-domain"
          >
            {domainName}
          </span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={logout}
          className="cursor-pointer text-red-600 focus:text-red-600"
          data-testid="button-logout"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
