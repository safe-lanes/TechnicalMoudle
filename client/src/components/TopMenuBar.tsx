import React from "react";
import { useLocation } from "wouter";
import { 
  Grid3X3, 
  BarChart3, 
  FileCheck, 
  AlertTriangle, 
  Wrench,
  Shield,
  Anchor,
  ShoppingCart,
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
// ====== NOON REPORT MODULE NAV LINK — START (remove to disable) ======
import { NOON_MODULE_ENABLED } from "@/modules/noon-report/config";
// ====== NOON REPORT MODULE NAV LINK — END ======
import { cn } from "@/lib/utils";
import sailLogoPath from "@assets/SAIL logo Transparent_1753957135582.png";
import { SyncStatusIndicator } from "./SyncStatusIndicator";
import { RoleSwitcher } from "./RoleSwitcher";
import { NotificationBell } from "./NotificationBell";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useUIRole } from "@/contexts/UIRoleContext";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

interface TopMenuBarProps {
  selectedSubModule: string;
  onSubModuleChange: (subModule: string) => void;
}

export const TopMenuBar: React.FC<TopMenuBarProps> = ({ 
  selectedSubModule, 
  onSubModuleChange 
}) => {
  const { hasAnyChildAccess, isLoading: permissionsLoading } = usePermissions();
  const { isSailAdmin } = useUIRole();

  const menuItems = [
    {
      id: "module",
      label: "Technical",
      icon: Grid3X3,
      isModule: true,
    },
    {
      id: "cert-surveys",
      label: "Cert. & Surveys",
      icon: FileCheck,
    },
    {
      id: "defects",
      label: "Defects",
      icon: AlertTriangle,
    },
    {
      id: "pms",
      label: "PMS",
      icon: Wrench,
    },
    {
      id: "admin",
      label: "Admin",
      icon: Shield,
    },
    // ====== PURCHASING NAV LINK (placeholder) — START ======
    // TODO: Once a menu-master row for "purchasing" exists, drop
    // `bypassPermissionCheck` and let the standard
    // `hasAnyChildAccess('purchasing')` filter gate visibility.
    // Click handler currently shows a "Coming soon" toast — the real
    // JWT-SSO redirect is wired in once the Purchasing integration URL
    // and token contract are available. See the Purchasing section in
    // replit.md for the planned integration shape.
    {
      id: "purchasing",
      label: "Purchasing",
      icon: ShoppingCart,
      bypassPermissionCheck: true,
      isPlaceholder: true,
    },
    // ====== PURCHASING NAV LINK (placeholder) — END ======
    // ====== NOON REPORT MODULE NAV LINK — START (remove to disable) ======
    ...(NOON_MODULE_ENABLED && isSailAdmin ? [{
      id: "noon-report",
      label: "Noon Report",
      icon: Anchor,
    }] : []),
    // ====== NOON REPORT MODULE NAV LINK — END ======
  ];

  return (
    <div className="relative sticky top-0 z-50" style={{ backgroundColor: '#f1f1f1', borderBottom: '2px solid #52baf3' }}>
      <div className="flex items-stretch h-16" style={{ backgroundColor: '#f1f1f1' }}>
        <div className="flex items-center px-4" style={{ backgroundColor: '#f1f1f1' }}>
          <img 
            src={sailLogoPath} 
            alt="SAIL Logo" 
            className="h-8 w-auto"
          />
        </div>
        
        <div className="w-8"></div>
        
        {menuItems.filter((item) => {
          if (item.isModule) return true;
          if (item.bypassPermissionCheck) return true;
          return hasAnyChildAccess(item.id);
        }).map((item) => {
          const Icon = item.icon;
          const isSelected = item.id === selectedSubModule;
          
          if (item.isModule) {
            const protocol = window.location.protocol;
            const hostname = window.location.hostname;
            let portNumber = window.location.port;
            portNumber = portNumber ? `:${portNumber}` : '';
            const fullUrl = `${protocol}//${hostname}${portNumber}`;
            
            return (
              <DropdownMenu key={item.id}>
                <DropdownMenuTrigger asChild>
                  <div
                    className="flex flex-col items-center justify-center w-[110px] transition-all duration-200 relative cursor-pointer select-none"
                    style={{ backgroundColor: '#f1f1f1', borderRight: '1px solid #e5e7eb' }}
                    data-testid="dropdown-technical-module"
                  >
                    <Icon className="h-5 w-5 mb-1" style={{ color: '#4b5563' }} />
                    <span className="text-xs font-medium" style={{ color: '#4b5563' }}>
                      {item.label}
                    </span>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40">
                  <DropdownMenuItem
                    onClick={() => {
                      localStorage.setItem("selected_module", "U2FsdGVkX19gp34OrOluh/gJ6eeByT19nc8eMBUBsVE=");
                      window.location.assign(`${fullUrl}/audit/dashboard/summary`);
                    }}
                    className="cursor-pointer"
                    data-testid="menu-item-audit"
                  >
                    Audit
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }
          
          const buttonEl = (
            <button
              key={item.id}
              onClick={() => {
                if (item.isPlaceholder) {
                  // Placeholder for the future JWT-SSO Purchasing
                  // integration. Click is a no-op — the hover
                  // tooltip is the only feedback until the real
                  // redirect is wired in (see "Purchasing" section
                  // in replit.md).
                  return;
                }
                onSubModuleChange(item.id);
              }}
              className="flex flex-col items-center justify-center w-[110px] transition-all duration-200 relative"
              style={{ backgroundColor: isSelected ? '#52baf3' : '#f1f1f1' }}
              data-testid={`button-nav-${item.id}`}
            >
              <Icon className="h-5 w-5 mb-1" style={{ color: isSelected ? '#ffffff' : '#4b5563' }} />
              <span className="text-xs font-medium" style={{ color: isSelected ? '#ffffff' : '#4b5563' }}>
                {item.label}
              </span>
            </button>
          );

          if (item.isPlaceholder) {
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>{buttonEl}</TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  sideOffset={6}
                  data-testid={`tooltip-nav-${item.id}`}
                >
                  Coming soon
                </TooltipContent>
              </Tooltip>
            );
          }

          return buttonEl;
        })}
        
        <div className="flex-1" />

        <div className="flex items-center px-2">
          <NotificationBell />
        </div>

        <div className="flex items-center px-4">
          <RoleSwitcher />
        </div>
        
        <div className="flex items-center px-4">
          <SyncStatusIndicator />
        </div>
      </div>
    </div>
  );
};