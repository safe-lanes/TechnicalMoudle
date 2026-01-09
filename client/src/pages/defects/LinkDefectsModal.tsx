import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Link, Search, X, Save } from "lucide-react";
import type { Defect } from "@shared/schema";

interface LinkDefectsModalProps {
  open: boolean;
  onClose: () => void;
  defectId: string;
  currentLinkedDefects?: string[];
}

export default function LinkDefectsModal({ open, onClose, defectId, currentLinkedDefects = [] }: LinkDefectsModalProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDefects, setSelectedDefects] = useState<string[]>(currentLinkedDefects);

  // Initialize selectedDefects when modal opens with new linked defects
  useEffect(() => {
    if (open) {
      setSelectedDefects(currentLinkedDefects);
    }
  }, [open, currentLinkedDefects]);

  // Fetch all defects for searching
  const { data: allDefects = [], isLoading } = useQuery<Defect[]>({
    queryKey: ['/technical/api/defects', { excludeId: defectId }],
    queryFn: async () => {
      const response = await fetch('/technical/api/defects');
      if (!response.ok) throw new Error('Failed to fetch defects');
      const defects = await response.json();
      // Filter out the current defect
      return defects.filter((d: Defect) => d.id !== defectId);
    },
    enabled: open
  });

  // Filter defects based on search term
  const filteredDefects = allDefects.filter(defect => {
    const searchLower = searchTerm.toLowerCase();
    return (
      defect.id.toLowerCase().includes(searchLower) ||
      defect.description.toLowerCase().includes(searchLower) ||
      defect.vesselName.toLowerCase().includes(searchLower)
    );
  });

  const linkDefectsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('PATCH', `/technical/api/defects/${defectId}/link`, {
        linkedDefects: selectedDefects
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Linked ${selectedDefects.length} defect(s) successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/defects'] });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/defects', defectId] });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to link defects",
        variant: "destructive",
      });
    }
  });

  const handleClose = () => {
    setSearchTerm("");
    setSelectedDefects(currentLinkedDefects); // Preserve linked defects
    onClose();
  };

  const toggleDefect = (defectId: string) => {
    setSelectedDefects(prev => 
      prev.includes(defectId) 
        ? prev.filter(id => id !== defectId)
        : [...prev, defectId]
    );
  };

  const handleSubmit = () => {
    if (selectedDefects.length === 0) {
      toast({
        title: "No defects selected",
        description: "Please select at least one defect to link",
        variant: "destructive",
      });
      return;
    }

    linkDefectsMutation.mutate();
  };

  const getStatusBadgeVariant = (status: string) => {
    switch(status) {
      case 'Closed': return 'default';
      case 'Open': return 'destructive';
      case 'In-Progress': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-3xl">
        <button 
          className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none"
          onClick={handleClose}
          data-testid="button-close-link-defects"
        >
          <X className="h-4 w-4" />
        </button>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Link Related Defects
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search Input */}
          <div>
            <Label htmlFor="search">Search Defects</Label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by ID or description..."
                className="pl-10"
              />
            </div>
          </div>

          {/* Selected Defects */}
          {selectedDefects.length > 0 && (
            <div>
              <Label className="text-sm mb-2">Selected Defects ({selectedDefects.length})</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedDefects.map(id => {
                  const defect = allDefects.find(d => d.id === id);
                  return (
                    <Badge 
                      key={id} 
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {id}
                      {defect && ` - ${defect.description.substring(0, 30)}...`}
                      <button
                        onClick={() => toggleDefect(id)}
                        className="ml-1 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* Defects List */}
          <div>
            <Label className="text-sm mb-2">Available Defects</Label>
            <ScrollArea className="h-[300px] border rounded-lg">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                </div>
              ) : filteredDefects.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm ? 'No defects found matching your search' : 'No defects available to link'}
                </div>
              ) : (
                <div className="p-4 space-y-2">
                  {filteredDefects.map((defect) => {
                    const isAlreadyLinked = currentLinkedDefects.includes(defect.id);
                    const isSelected = selectedDefects.includes(defect.id);
                    
                    return (
                      <div
                        key={defect.id}
                        className={`flex items-start space-x-3 p-3 rounded-lg border ${
                          isAlreadyLinked ? 'bg-gray-50 opacity-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <Checkbox
                          id={`defect-${defect.id}`}
                          checked={isSelected || isAlreadyLinked}
                          onCheckedChange={() => !isAlreadyLinked && toggleDefect(defect.id)}
                          disabled={isAlreadyLinked}
                        />
                        <label
                          htmlFor={`defect-${defect.id}`}
                          className="flex-1 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-sm text-blue-600">{defect.id}</span>
                            <Badge variant={getStatusBadgeVariant(defect.status)} className="text-xs">
                              {defect.status}
                            </Badge>
                            {defect.critical && (
                              <Badge variant="destructive" className="text-xs">
                                Critical
                              </Badge>
                            )}
                            {isAlreadyLinked && (
                              <Badge variant="outline" className="text-xs">
                                Already Linked
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-700">{defect.description}</p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                            <span>Vessel: {defect.vesselName}</span>
                            <span>Category: {defect.category}</span>
                            <span>Date: {defect.issueDate}</span>
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleClose} variant="outline">
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={linkDefectsMutation.isPending || selectedDefects.length === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {linkDefectsMutation.isPending ? 'Linking...' : `Link ${selectedDefects.length} Defect(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}