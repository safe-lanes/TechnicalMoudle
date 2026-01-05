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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Save, X, Plus, Trash2, GitPullRequest } from "lucide-react";
import type { ChangeRequest } from "@shared/schema";

interface EditChangeRequestModalProps {
  open: boolean;
  onClose: () => void;
  requestId: number;
}

interface ProposedChange {
  id: string;
  field: string;
  oldValue: string;
  newValue: string;
  justification: string;
}

export default function EditChangeRequestModal({ open, onClose, requestId }: EditChangeRequestModalProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<ChangeRequest>>({});
  const [proposedChanges, setProposedChanges] = useState<ProposedChange[]>([]);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [editingChange, setEditingChange] = useState<ProposedChange | null>(null);

  const { data: changeRequest, isLoading } = useQuery<ChangeRequest>({
    queryKey: ['/technical/api/change-requests', requestId],
    queryFn: async () => {
      const response = await fetch(`/technical/api/change-requests/${requestId}`);
      if (!response.ok) throw new Error('Failed to fetch change request');
      return response.json();
    },
    enabled: open && !!requestId
  });

  useEffect(() => {
    if (changeRequest) {
      setFormData({
        ...changeRequest,
        // Exclude non-editable fields
        id: undefined,
        createdAt: undefined,
        updatedAt: undefined,
      });
      
      // Parse proposed changes if they exist
      if (changeRequest.proposedChangesJson) {
        const changes = typeof changeRequest.proposedChangesJson === 'string' 
          ? JSON.parse(changeRequest.proposedChangesJson)
          : changeRequest.proposedChangesJson;
        setProposedChanges(changes || []);
      }
    }
  }, [changeRequest]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<ChangeRequest>) => {
      const updateData = {
        ...data,
        proposedChangesJson: proposedChanges.length > 0 ? proposedChanges : null,
      };
      return apiRequest('PATCH', `/technical/api/change-requests/${requestId}`, updateData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Change request updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/change-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/change-requests', requestId] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update change request",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = () => {
    updateMutation.mutate(formData);
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle proposed changes
  const addProposedChange = () => {
    setEditingChange({
      id: Date.now().toString(),
      field: '',
      oldValue: '',
      newValue: '',
      justification: ''
    });
    setShowChangeModal(true);
  };

  const saveProposedChange = () => {
    if (!editingChange || !editingChange.field || !editingChange.newValue || !editingChange.justification) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (editingChange.id && proposedChanges.find(c => c.id === editingChange.id)) {
      // Update existing change
      setProposedChanges(prev => prev.map(c => c.id === editingChange.id ? editingChange : c));
    } else {
      // Add new change
      setProposedChanges(prev => [...prev, { ...editingChange, id: Date.now().toString() }]);
    }
    setShowChangeModal(false);
    setEditingChange(null);
  };

  const editProposedChange = (change: ProposedChange) => {
    setEditingChange(change);
    setShowChangeModal(true);
  };

  const deleteProposedChange = (id: string) => {
    setProposedChanges(prev => prev.filter(c => c.id !== id));
  };

  if (isLoading || !changeRequest) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Loading...</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Don't allow editing if status is not draft or returned
  if (changeRequest.status !== 'draft' && changeRequest.status !== 'returned') {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cannot Edit Change Request</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>This change request cannot be edited because its status is: <strong>{changeRequest.status}</strong></p>
            <p className="mt-2 text-sm text-gray-600">
              Only change requests in "Draft" or "Returned" status can be edited.
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={onClose} variant="outline">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="px-6 py-4 border-b bg-blue-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GitPullRequest className="w-6 h-6 text-blue-600" />
              <DialogTitle className="text-xl text-blue-900">
                Edit Change Request CR-{String(changeRequest.id).padStart(4, '0')}
              </DialogTitle>
              <Badge variant="secondary">{changeRequest.status}</Badge>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(90vh-8rem)]">
          <div className="p-6 space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Vessel *</Label>
                  <Select 
                    value={formData.vesselId || ''} 
                    onValueChange={(value) => handleInputChange('vesselId', value)}
                  >
                    <SelectTrigger data-testid="select-vessel">
                      <SelectValue placeholder="Select vessel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="V001">MV SEAFARER</SelectItem>
                      <SelectItem value="V002">MV VOYAGER</SelectItem>
                      <SelectItem value="V003">MV EXPLORER</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Category *</Label>
                  <Select 
                    value={formData.category || ''} 
                    onValueChange={(value) => handleInputChange('category', value)}
                  >
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="components">Components</SelectItem>
                      <SelectItem value="work_orders">Work Orders</SelectItem>
                      <SelectItem value="spares">Spares</SelectItem>
                      <SelectItem value="stores">Stores</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label>Title *</Label>
                  <Input
                    value={formData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="Enter a descriptive title"
                    maxLength={120}
                    data-testid="input-title"
                  />
                  <span className="text-xs text-gray-500">
                    {(formData.title?.length || 0)}/120 characters
                  </span>
                </div>

                <div className="col-span-2">
                  <Label>Reason for Change *</Label>
                  <Textarea
                    value={formData.reason || ''}
                    onChange={(e) => handleInputChange('reason', e.target.value)}
                    placeholder="Explain why this change is needed"
                    rows={4}
                    data-testid="textarea-reason"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Target Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Target Selection</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Target Type</Label>
                  <Select 
                    value={formData.targetType || ''} 
                    onValueChange={(value) => handleInputChange('targetType', value || null)}
                  >
                    <SelectTrigger data-testid="select-target-type">
                      <SelectValue placeholder="Select target type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      <SelectItem value="component">Component</SelectItem>
                      <SelectItem value="work_order">Work Order</SelectItem>
                      <SelectItem value="spare">Spare</SelectItem>
                      <SelectItem value="store">Store</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Target ID</Label>
                  <Input
                    value={formData.targetId || ''}
                    onChange={(e) => handleInputChange('targetId', e.target.value || null)}
                    placeholder="Enter the ID of the target item"
                    data-testid="input-target-id"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Proposed Changes */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Proposed Changes</CardTitle>
                  <Button
                    type="button"
                    onClick={addProposedChange}
                    variant="outline"
                    size="sm"
                    data-testid="button-add-change"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Change
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {proposedChanges.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Field</TableHead>
                        <TableHead>Old Value</TableHead>
                        <TableHead>New Value</TableHead>
                        <TableHead>Justification</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {proposedChanges.map((change) => (
                        <TableRow key={change.id} data-testid={`row-change-${change.id}`}>
                          <TableCell className="font-medium">{change.field}</TableCell>
                          <TableCell>
                            <span className="text-red-600">{change.oldValue || '-'}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-green-600">{change.newValue}</span>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {change.justification}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => editProposedChange(change)}
                                className="h-8 w-8"
                                data-testid={`button-edit-change-${change.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteProposedChange(change.id)}
                                className="h-8 w-8 text-red-600"
                                data-testid={`button-delete-change-${change.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No proposed changes added yet
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        <div className="px-6 py-4 border-t flex justify-between">
          <Button
            onClick={onClose}
            variant="outline"
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updateMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
            data-testid="button-save"
          >
            <Save className="w-4 h-4 mr-2" />
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        {/* Proposed Change Modal */}
        {showChangeModal && (
          <Dialog open={showChangeModal} onOpenChange={setShowChangeModal}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingChange?.id && proposedChanges.find(c => c.id === editingChange.id) ? 'Edit' : 'Add'} Proposed Change</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label className="text-sm font-medium">Field Name *</Label>
                  <Input
                    value={editingChange?.field || ''}
                    onChange={(e) => setEditingChange(prev => prev ? { ...prev, field: e.target.value } : null)}
                    placeholder="e.g., Component Name, Stock Level"
                    data-testid="input-change-field"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Old Value</Label>
                  <Input
                    value={editingChange?.oldValue || ''}
                    onChange={(e) => setEditingChange(prev => prev ? { ...prev, oldValue: e.target.value } : null)}
                    placeholder="Current value"
                    data-testid="input-change-old"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">New Value *</Label>
                  <Input
                    value={editingChange?.newValue || ''}
                    onChange={(e) => setEditingChange(prev => prev ? { ...prev, newValue: e.target.value } : null)}
                    placeholder="Proposed new value"
                    data-testid="input-change-new"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Justification *</Label>
                  <Textarea
                    value={editingChange?.justification || ''}
                    onChange={(e) => setEditingChange(prev => prev ? { ...prev, justification: e.target.value } : null)}
                    placeholder="Explain why this change is needed"
                    rows={3}
                    data-testid="textarea-change-justification"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowChangeModal(false);
                      setEditingChange(null);
                    }}
                    data-testid="button-change-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={saveProposedChange}
                    data-testid="button-change-save"
                  >
                    Save Change
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}