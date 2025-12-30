import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Wrench, Package, Archive, X } from "lucide-react";
import { useLocation } from "wouter";
import { Marker } from "@/components/Marker";

interface ChangeRequestModalProps {
  open: boolean;
  onClose: () => void;
}

export function ChangeRequestModal({ open, onClose }: ChangeRequestModalProps) {
  const [, setLocation] = useLocation();

  const tiles = [
    {
      id: "components",
      title: "Components",
      description: "Modify component hierarchy, specifications, and configuration",
      icon: Settings,
      color: "bg-blue-50 hover:bg-blue-100 border-blue-200",
      iconColor: "text-blue-600"
    },
    {
      id: "jobs", 
      title: "Jobs",
      description: "Update maintenance schedules, procedures, and requirements",
      icon: Wrench,
      color: "bg-green-50 hover:bg-green-100 border-green-200", 
      iconColor: "text-green-600"
    },
    {
      id: "spares",
      title: "Spares",
      description: "Adjust spare parts inventory, specifications, and stock levels",
      icon: Package,
      color: "bg-orange-50 hover:bg-orange-100 border-orange-200",
      iconColor: "text-orange-600"
    },
    {
      id: "stores",
      title: "Stores", 
      description: "Modify store items, categories, and inventory management",
      icon: Archive,
      color: "bg-purple-50 hover:bg-purple-100 border-purple-200",
      iconColor: "text-purple-600"
    }
  ];

  const handleTileClick = (moduleId: string) => {
    onClose();
    // Navigate to the respective module with modify mode enabled
    switch (moduleId) {
      case "components":
        setLocation("/pms/components?modify=1");
        break;
      case "jobs":
        setLocation("/pms/modify-pms/jobs");
        break;
      case "spares":
        setLocation("/pms/spares?modify=1");
        break;
      case "stores":
        setLocation("/pms/stores?modify=1");
        break;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader className="relative">
          <DialogTitle className="text-xl font-semibold" data-testid="H3.1"><Marker id="H3.1" />New Change Request</DialogTitle>
          <p className="text-sm text-gray-600 mt-2" data-testid="H3.2">
            <Marker id="H3.2" />Select the module you want to modify. You'll be able to navigate to specific items and make changes.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="absolute right-0 top-0 h-8 w-8 p-0"
            data-testid="H3.3"
          >
            <Marker id="H3.3" />
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {tiles.map((tile, index) => {
            const IconComponent = tile.icon;
            const markerId = `H3.${4 + index}`;
            return (
              <Card 
                key={tile.id}
                className={`cursor-pointer transition-all duration-200 ${tile.color} hover:shadow-md`}
                onClick={() => handleTileClick(tile.id)}
                data-testid={markerId}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg bg-white shadow-sm`}>
                      <Marker id={markerId} />
                      <IconComponent className={`h-6 w-6 ${tile.iconColor}`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold text-gray-900">
                        {tile.title}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="text-sm text-gray-600 leading-relaxed">
                    {tile.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
        
        <div className="flex justify-end mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose} data-testid="H3.8">
            <Marker id="H3.8" />Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}