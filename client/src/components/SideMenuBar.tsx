import React, { useContext } from "react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useUIRole } from "@/contexts/UIRoleContext";
import { VesselContext } from "@/contexts/VesselContext";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  ClipboardCheck,
  Clock,
  Archive,
  Store,
  FileText,
  Settings2,
  Settings,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle,
  Users,
  Shield,
  ShieldCheck,
  Flag,
  RefreshCw,
  List,
  FileEdit,
  History,
  Gauge,
  Bell,
  Fuel,
  FileDown,
  Ship,
  UserCog,
  Cloud,
  HardDrive,
} from "lucide-react";

interface SideMenuBarProps {
  selectedItem?: string;
  onItemSelect?: (itemId: string) => void;
  subModule: string;
}

interface MenuItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ElementType;
  hidden?: boolean;
}

const menuConfigs: Record<string, MenuItem[]> = {
  pms: [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "components", label: "Components", icon: Package },
    { id: "work-orders", label: "Work orders", icon: ClipboardList },
    { id: "running-hrs", label: "Running Hrs", icon: Clock },
    { id: "spares", label: "Spares", icon: Archive },
    { id: "stores", label: "Stores", icon: Store },
    { id: "reports", label: "Reports", icon: FileText },
    { id: "modify-pms", label: "Modify PMS", icon: Settings2 },
    { id: "admin", label: "Admin", icon: Settings },
  ],
  dashboard: [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "analytics", label: "Analytics", icon: FileText },
    { id: "reports", label: "Reports", icon: FileText },
  ],
  "cert-surveys": [
    { id: "certificates", label: "Certificates", icon: FileSpreadsheet },
    { id: "surveys", label: "Surveys", icon: ClipboardList },
  ],
  defects: [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "defect-log", label: "Defect Log", icon: List },
    { id: "coc", label: "CoC", icon: Flag },
    { id: "recurring", label: "Recurring Defects", icon: RefreshCw },
    { id: "reports", label: "Reports", icon: FileText, hidden: true },
  ],
  admin: [
    // { id: "alerts", label: "Alerts", icon: AlertTriangle },
    { id: "masters", label: "Masters", icon: FileSpreadsheet },
    { id: "ships-certificates", label: "Ship's Certificates", icon: Shield },
    { id: "ships-surveys", label: "Ship's Surveys", icon: ClipboardCheck },
    { id: "ranks", label: "Ranks", icon: UserCog },
    { id: "access-control", label: "Access Control", icon: ShieldCheck },
    { id: "sync-dashboard", label: "Sync Dashboard", icon: Cloud },
    { id: "sync-provisioning", label: "Ship Provisioning", icon: HardDrive },
  ],
  // ====== NOON REPORT MODULE NAV LINK — START (remove to disable) ======
  "noon-report": [
    { id: "entry", label: "Daily Entry", icon: FileEdit },
    { id: "history", label: "Report History", icon: History },
    { id: "fuel-dashboard", label: "Fuel Dashboard", icon: Gauge },
    { id: "alerts", label: "Alerts", icon: Bell },
    { id: "bunker", label: "Bunker Mgmt", icon: Fuel },
    { id: "reports", label: "Reports & Export", icon: FileDown },
    { id: "fleet", label: "Fleet Overview", icon: Ship },
  ],
  // ====== NOON REPORT MODULE NAV LINK — END ======
};

export const SideMenuBar: React.FC<SideMenuBarProps> = ({
  selectedItem = "dashboard",
  onItemSelect,
  subModule,
}) => {
  const [, setLocation] = useLocation();
  const { canViewSidebarItem } = usePermissions();
  const { isSailAdmin } = useUIRole();
  const vesselCtx = useContext(VesselContext);
  const vesselId = vesselCtx?.vesselId ?? "";

  // Sidebar badge: unacknowledged noon-report alert count
  const { data: alertCountData } = useQuery<{ count: number }>({
    queryKey: ["/technical/api/nr-alerts", vesselId, "count"],
    queryFn: async () => {
      if (!vesselId) return { count: 0 };
      const res = await fetch(`/technical/api/nr-alerts/${vesselId}/count`);
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    enabled: subModule === "noon-report" && !!vesselId,
    refetchInterval: subModule === "noon-report" && !!vesselId ? 300_000 : false,
  });
  const nrAlertCount = alertCountData?.count ?? 0;

  const allMenuItems = menuConfigs[subModule] || menuConfigs.pms;
  const menuItems = allMenuItems.filter((item) => {
    if (item.id === "access-control") return isSailAdmin;
    return canViewSidebarItem(subModule, item.id);
  });

  const handleItemClick = (itemId: string) => {
    // Use navigation for routing
    if (subModule === "pms") {
      if (itemId === "spares") {
        setLocation("/spares");
      } else if (itemId === "stores") {
        setLocation("/stores");
      } else if (itemId === "dashboard") {
        setLocation("/pms/dashboard");
      } else {
        setLocation(`/pms/${itemId}`);
      }
    } else if (subModule === "admin") {
      setLocation(`/admin/${itemId}`);
    } else if (subModule === "defects") {
      if (itemId === "dashboard") {
        setLocation("/defects");
      } else if (itemId === "defect-log") {
        setLocation("/defects/active");
      } else if (itemId === "coc") {
        setLocation("/defects/coc");
      } else if (itemId === "recurring") {
        setLocation("/defects/recurring");
      } else {
        setLocation(`/defects/${itemId}`);
      }
    } else if (subModule === "cert-surveys") {
      setLocation(`/cert-surveys/${itemId}`);
    // ====== NOON REPORT MODULE — START ======
    } else if (subModule === "noon-report") {
      setLocation(`/noon-report/${itemId}`);
    // ====== NOON REPORT MODULE — END ======
    }
    // Still call the callback for state management if provided
    onItemSelect?.(itemId);
  };

  return (
    <div className="sticky top-[68px] h-[calc(100vh-68px)] flex flex-col items-center pb-4 w-full overflow-y-auto">
      {menuItems.filter((item) => !item.hidden).map((item) => {
        const Icon = item.icon;
        const isSelected = item.id === selectedItem || 
          (item.id === "modify-pms" && selectedItem?.startsWith("modify-pms/"));

        // Show badge on the Alerts item when there are unacknowledged alerts
        const showBadge = subModule === "noon-report" && item.id === "alerts" && nrAlertCount > 0;

        return (
          <button
            key={item.id}
            onClick={() => handleItemClick(item.id)}
            className={cn(
              "w-full flex flex-col items-center justify-center transition-all duration-200 px-2 py-3 h-16",
              !isSelected && "hover:bg-white/[0.08]",
              "group relative"
            )}
            style={isSelected ? { backgroundColor: '#52baf3' } : undefined}
            role="link"
            aria-label={item.sublabel ? `${item.label}, ${item.sublabel}` : item.label}
            aria-current={isSelected ? "page" : undefined}
            data-testid={`nav-${subModule}-${item.id}`}
          >
            <div className="relative">
              <Icon
                className="h-6 w-6 mb-1"
                style={{ color: isSelected ? '#ffffff' : 'rgba(255,255,255,0.75)' }}
              />
              {showBadge && (
                <span
                  className="absolute -top-1 -right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-[3px] leading-none"
                  data-testid="badge-alert-count"
                >
                  {nrAlertCount > 99 ? "99+" : nrAlertCount}
                </span>
              )}
            </div>
            <span className="text-center leading-tight break-words text-[10px]" style={{ color: isSelected ? '#ffffff' : 'rgba(255,255,255,0.75)' }}>
              {item.label}
            </span>
            {item.sublabel && (
              <span className="text-[8px] text-center leading-tight" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {item.sublabel}
              </span>
            )}
            
            {/* Tooltip on hover */}
            <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
              {item.sublabel ? `${item.label} - ${item.sublabel}` : item.label}
              {showBadge ? ` (${nrAlertCount} active)` : ""}
            </div>
          </button>
        );
      })}
    </div>
  );
};