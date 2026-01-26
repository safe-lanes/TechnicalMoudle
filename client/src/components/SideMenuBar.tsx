import React from "react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
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
  Flag,
  RefreshCw,
  List,
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
    { id: "reports", label: "Reports", icon: FileText },
  ],
  admin: [
    // { id: "alerts", label: "Alerts", icon: AlertTriangle },
    { id: "masters", label: "Masters", icon: FileSpreadsheet },
    { id: "ships-certificates", label: "Ship's Certificates", icon: Shield },
    // { id: "permissions", label: "Permissions", icon: Shield },
    // { id: "bulk-data-import", label: "Data Management", icon: FileSpreadsheet },
  ],
};

export const SideMenuBar: React.FC<SideMenuBarProps> = ({
  selectedItem = "dashboard",
  onItemSelect,
  subModule,
}) => {
  const [, setLocation] = useLocation();
  const menuItems = menuConfigs[subModule] || menuConfigs.pms;

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
    }
    // Still call the callback for state management if provided
    onItemSelect?.(itemId);
  };

  return (
    <div className="sticky top-[68px] h-[calc(100vh-68px)] flex flex-col items-center pb-4 w-full overflow-y-auto">
      {menuItems.map((item) => {
        const Icon = item.icon;
        const isSelected = item.id === selectedItem || 
          (item.id === "modify-pms" && selectedItem?.startsWith("modify-pms/"));

        return (
          <button
            key={item.id}
            onClick={() => handleItemClick(item.id)}
            className={cn(
              "w-full flex flex-col items-center justify-center transition-all duration-200 px-2 py-3 h-16",
              isSelected ? "bg-[#52baf3]" : "hover:bg-[#1d4ed8]",
              "group relative"
            )}
            role="link"
            aria-label={item.sublabel ? `${item.label}, ${item.sublabel}` : item.label}
            aria-current={isSelected ? "page" : undefined}
          >
            <Icon
              className={cn(
                "h-6 w-6 mb-1",
                isSelected ? "text-white" : "text-blue-100"
              )}
            />
            <span className="text-white text-center leading-tight break-words text-[10px]">
              {item.label}
            </span>
            {item.sublabel && (
              <span className="text-[8px] text-blue-200 text-center leading-tight opacity-90">
                {item.sublabel}
              </span>
            )}
            
            {/* Tooltip on hover */}
            <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
              {item.sublabel ? `${item.label} - ${item.sublabel}` : item.label}
            </div>
          </button>
        );
      })}
    </div>
  );
};