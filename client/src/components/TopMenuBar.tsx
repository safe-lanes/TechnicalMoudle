import React from "react";
import { useLocation } from "wouter";
import { 
  Grid3X3, 
  BarChart3, 
  FileCheck, 
  AlertTriangle, 
  Wrench,
  Shield
} from "lucide-react";
import { cn } from "@/lib/utils";
import sailLogoPath from "@assets/SAIL logo Transparent_1753957135582.png";
import { SyncStatusIndicator } from "./SyncStatusIndicator";
import { RoleSwitcher } from "./RoleSwitcher";
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
  ];

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm relative sticky top-0 z-50">
      <div className="flex items-stretch h-16 bg-white">
        <div className="flex items-center px-4 bg-white">
          <img 
            src={sailLogoPath} 
            alt="SAIL Logo" 
            className="h-8 w-auto"
          />
        </div>
        
        <div className="w-8"></div>
        
        {menuItems.map((item) => {
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
                    className={cn(
                      "flex flex-col items-center justify-center w-[110px] transition-all duration-200 relative cursor-pointer select-none",
                      "hover:bg-gray-50",
                      "bg-white border-r border-gray-200"
                    )}
                    data-testid="dropdown-technical-module"
                  >
                    <Icon className="h-5 w-5 mb-1" style={{ color: '#333' }} />
                    <span className="text-xs font-medium" style={{ color: '#333' }}>
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
          
          return (
            <button
              key={item.id}
              onClick={() => onSubModuleChange(item.id)}
              className={cn(
                "flex flex-col items-center justify-center w-[110px] transition-all duration-200 relative",
                "hover:bg-gray-50",
                "bg-white"
              )}
            >
              <Icon className="h-5 w-5 mb-1" style={{ color: isSelected ? '#1a6eb5' : '#333' }} />
              <span className="text-xs font-medium" style={{ color: isSelected ? '#1a6eb5' : '#333' }}>
                {item.label}
              </span>
              {isSelected && (
                <div className="absolute bottom-0 left-0 right-0 z-10" style={{ height: '3px', background: '#1a6eb5' }} />
              )}
            </button>
          );
        })}
        
        <div className="flex-1" />
        
        <div className="flex items-center px-4">
          <RoleSwitcher />
        </div>
        
        <div className="flex items-center px-4">
          <SyncStatusIndicator />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-[#e2e8f0]" />
    </div>
  );
};