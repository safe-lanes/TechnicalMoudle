import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit, Save, X } from "lucide-react";
import type { Defect } from "@shared/schema";

interface EditDefectModalProps {
  open: boolean;
  onClose: () => void;
  defectId: string;
}

export default function EditDefectModal({ open, onClose, defectId }: EditDefectModalProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<Defect>>({});

  const { data: defect, isLoading } = useQuery<Defect>({
    queryKey: ['/api/defects', defectId],
    queryFn: async () => {
      const response = await fetch(`/api/defects/${defectId}`);
      if (!response.ok) throw new Error('Failed to fetch defect');
      return response.json();
    },
    enabled: open && !!defectId
  });

  useEffect(() => {
    if (defect) {
      setFormData({
        ...defect,
        // Exclude non-editable fields
        id: undefined,
        createdAt: undefined,
        updatedAt: undefined,
        reportedBy: undefined,
      });
    }
  }, [defect]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Defect>) => {
      return apiRequest(`/api/defects/${defectId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Defect updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/defects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/defects', defectId] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update defect",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = () => {
    // Validate required fields
    if (!formData.vesselName || !formData.description || !formData.category) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate(formData);
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading || !defect) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Loading Defect...</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-gray-900 flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit Defect Report - {defect.id}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-120px)]">
          <div className="p-6 space-y-6">
            {/* Non-editable fields display */}
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <Label className="text-gray-600">ID</Label>
                  <p className="font-mono">{defect.id}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Created By</Label>
                  <p>{defect.reportedBy}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Created On</Label>
                  <p>{new Date(defect.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Vessel Name *</Label>
                  <Input 
                    value={formData.vesselName || ''} 
                    onChange={(e) => handleInputChange('vesselName', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Category *</Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(value) => handleInputChange('category', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Defect">Defect</SelectItem>
                      <SelectItem value="COC">COC</SelectItem>
                      <SelectItem value="Observation">Observation</SelectItem>
                      <SelectItem value="NCR">NCR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Defect Type *</Label>
                  <Select 
                    value={formData.defectType || ''} 
                    onValueChange={(value) => handleInputChange('defectType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Routine">Routine</SelectItem>
                      <SelectItem value="Corrective">Corrective</SelectItem>
                      <SelectItem value="Emergency">Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(value) => handleInputChange('status', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Open">Open</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="In-Progress">In-Progress</SelectItem>
                      <SelectItem value="Awaiting Parts">Awaiting Parts</SelectItem>
                      <SelectItem value="Deferred">Deferred</SelectItem>
                      <SelectItem value="Closed">Closed</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select 
                    value={formData.priority || 'Medium'} 
                    onValueChange={(value) => handleInputChange('priority', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Severity *</Label>
                  <Select 
                    value={formData.severity?.toString() || '1'} 
                    onValueChange={(value) => handleInputChange('severity', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - Minor</SelectItem>
                      <SelectItem value="2">2 - Moderate</SelectItem>
                      <SelectItem value="3">3 - Major</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Source</Label>
                  <Select 
                    value={formData.source || ''} 
                    onValueChange={(value) => handleInputChange('source', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SIRE">SIRE</SelectItem>
                      <SelectItem value="PSC">PSC</SelectItem>
                      <SelectItem value="Internal">Internal</SelectItem>
                      <SelectItem value="Class">Class</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Assigned To</Label>
                  <Input 
                    value={formData.assignedTo || ''} 
                    onChange={(e) => handleInputChange('assignedTo', e.target.value)}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="critical"
                    checked={formData.critical || false}
                    onCheckedChange={(checked) => handleInputChange('critical', checked)}
                  />
                  <Label htmlFor="critical" className="text-red-600 font-medium">
                    Mark as Critical
                  </Label>
                </div>
              </CardContent>
            </Card>

            {/* Equipment/Hardware */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Equipment / Hardware</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Equipment Category</Label>
                  <Input 
                    value={formData.equipmentCategory || ''} 
                    onChange={(e) => handleInputChange('equipmentCategory', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Equipment Type</Label>
                  <Input 
                    value={formData.equipmentType || ''} 
                    onChange={(e) => handleInputChange('equipmentType', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Make</Label>
                  <Input 
                    value={formData.equipmentMake || ''} 
                    onChange={(e) => handleInputChange('equipmentMake', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Model</Label>
                  <Input 
                    value={formData.equipmentModel || ''} 
                    onChange={(e) => handleInputChange('equipmentModel', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Serial No</Label>
                  <Input 
                    value={formData.equipmentSerialNo || ''} 
                    onChange={(e) => handleInputChange('equipmentSerialNo', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input 
                    value={formData.equipmentLocation || ''} 
                    onChange={(e) => handleInputChange('equipmentLocation', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Dates */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Important Dates</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Issue Date</Label>
                  <Input 
                    type="date"
                    value={formData.issueDate ? formData.issueDate.split('-').reverse().join('-') : ''} 
                    onChange={(e) => {
                      const date = e.target.value ? e.target.value.split('-').reverse().join('-') : '';
                      handleInputChange('issueDate', date);
                    }}
                  />
                </div>
                <div>
                  <Label>Target Date *</Label>
                  <Input 
                    type="date"
                    value={formData.targetDate ? formData.targetDate.split('-').reverse().join('-') : ''} 
                    onChange={(e) => {
                      const date = e.target.value ? e.target.value.split('-').reverse().join('-') : '';
                      handleInputChange('targetDate', date);
                    }}
                  />
                </div>
                <div>
                  <Label>Date Completed</Label>
                  <Input 
                    type="date"
                    value={formData.dateCompleted ? formData.dateCompleted.split('-').reverse().join('-') : ''} 
                    onChange={(e) => {
                      const date = e.target.value ? e.target.value.split('-').reverse().join('-') : '';
                      handleInputChange('dateCompleted', date);
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>Defect Description *</Label>
                    <Textarea 
                      value={formData.description || ''} 
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      className="min-h-[100px]"
                      placeholder="Enter detailed description of the defect..."
                    />
                  </div>
                  <div>
                    <Label>Action Taken / Requested</Label>
                    <Textarea 
                      value={formData.actionTakenRequested || ''} 
                      onChange={(e) => handleInputChange('actionTakenRequested', e.target.value)}
                      className="min-h-[80px]"
                      placeholder="Describe actions taken or requested..."
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cause Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Cause Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>Immediate Cause Explanation</Label>
                    <Textarea 
                      value={formData.immediateCauseExplanation || ''} 
                      onChange={(e) => handleInputChange('immediateCauseExplanation', e.target.value)}
                      className="min-h-[60px]"
                      placeholder="Explain the immediate cause..."
                    />
                  </div>
                  <div>
                    <Label>Root Cause Explanation</Label>
                    <Textarea 
                      value={formData.rootCauseExplanation || ''} 
                      onChange={(e) => handleInputChange('rootCauseExplanation', e.target.value)}
                      className="min-h-[60px]"
                      placeholder="Explain the root cause..."
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <Button onClick={onClose} variant="outline">
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={updateMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}