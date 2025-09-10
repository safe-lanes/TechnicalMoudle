import React from "react";
import { useLocation } from "wouter";
import { 
  Grid3X3, 
  BarChart3, 
  FileCheck, 
  AlertTriangle, 
  Wrench, 
  Settings,
  Shield
} from "lucide-react";
import { cn } from "@/lib/utils";
import sailLogoPath from "@assets/SAIL logo Transparent_1753957135582.png";

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
      id: "dashboard",
      label: "Dashboard",
      icon: BarChart3,
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
    <div className="bg-white border-b border-gray-200 shadow-sm relative">
      <div className="flex items-stretch h-16 bg-[#fafafa]">
        {/* SAIL Logo */}
        <div className="flex items-center px-4">
          <img 
            src={sailLogoPath} 
            alt="SAIL Logo" 
            className="h-8 w-auto"
          />
        </div>
        
        {/* Spacer to push module selector to the right */}
        <div className="w-8"></div>
        
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isSelected = item.id === selectedSubModule;
          
          return (
            <button
              key={item.id}
              onClick={() => !item.isModule && onSubModuleChange(item.id)}
              className={cn(
                "flex flex-col items-center justify-center px-6 min-w-[100px] transition-all duration-200 relative",
                "hover:bg-gray-50",
                item.isModule && "bg-gray-50 border-r border-gray-200",
                isSelected && !item.isModule && "bg-[#52baf3] text-white hover:bg-[#52baf3]",
                !isSelected && !item.isModule && "text-gray-600 hover:text-gray-900"
              )}
              disabled={item.isModule}
            >
              <Icon className={cn(
                "h-5 w-5 mb-1",
                isSelected && !item.isModule && "text-white",
                !isSelected && !item.isModule && "text-gray-600"
              )} />
              <span className={cn(
                "text-xs font-medium",
                isSelected && !item.isModule && "text-white",
                !isSelected && !item.isModule && "text-gray-600"
              )}>
                {item.label}
              </span>
              {isSelected && !item.isModule && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
              )}
            </button>
          );
        })}
      </div>
      {/* Blue line at bottom border matching SAIL Phase 2 design */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#52baf3]" />
    </div>
  );
};