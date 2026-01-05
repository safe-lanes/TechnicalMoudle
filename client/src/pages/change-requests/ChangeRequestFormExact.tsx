import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Eye, Upload, Plus, Edit, Trash2, Calendar, GitPullRequest } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { insertChangeRequestSchema, type InsertChangeRequest, type ChangeRequest } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useVessel } from "@/contexts/VesselContext";

// Generate change request reference number
const generateRequestRef = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `CR/${year}/${month}${day}/${random}`;
};

// Form validation schema
const changeRequestFormSchema = insertChangeRequestSchema.extend({
  vesselId: insertChangeRequestSchema.shape.vesselId.refine(val => val && val.length > 0, "Vessel is required"),
  title: insertChangeRequestSchema.shape.title.refine(val => val && val.length > 0, "Title is required"),
  reason: insertChangeRequestSchema.shape.reason.refine(val => val && val.length > 0, "Reason is required"),
  category: insertChangeRequestSchema.shape.category.refine(val => val && val.length > 0, "Category is required"),
});

type ChangeRequestFormData = typeof changeRequestFormSchema._type;

interface ProposedChange {
  id: string;
  field: string;
  oldValue: string;
  newValue: string;
  justification: string;
}

interface ChangeRequestFormExactProps {
  onClose: () => void;
  changeRequest?: ChangeRequest | null;
  mode?: 'view' | 'edit' | 'new';
}

export default function ChangeRequestFormExact({ onClose, changeRequest, mode = 'new' }: ChangeRequestFormExactProps) {
  const { toast } = useToast();
  const { vesselId: selectedVessel } = useVessel();
  const [activeSection, setActiveSection] = useState<string>('basic');
  const [proposedChanges, setProposedChanges] = useState<ProposedChange[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [editingChange, setEditingChange] = useState<ProposedChange | null>(null);

  const { data: vessels = [] } = useQuery({
    queryKey: ['/technical/api/vessels'],
    queryFn: async () => {
      const response = await fetch('/technical/api/vessels');
      if (!response.ok) throw new Error('Failed to fetch vessels');
      return response.json();
    }
  });

  const defaultVesselId = changeRequest?.vesselId || selectedVessel;

  const form = useForm<ChangeRequestFormData>({
    resolver: zodResolver(changeRequestFormSchema),
    defaultValues: changeRequest ? {
      vesselId: changeRequest.vesselId,
      category: changeRequest.category,
      title: changeRequest.title,
      reason: changeRequest.reason,
      targetType: changeRequest.targetType || undefined,
      targetId: changeRequest.targetId || undefined,
      status: changeRequest.status,
      requestedByUserId: changeRequest.requestedByUserId,
    } : {
      vesselId: defaultVesselId,
      category: 'components',
      status: 'draft',
      requestedByUserId: 'Current User', // In real app, get from auth context
    }
  });

  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';

  // Create change request mutation
  const createMutation = useMutation({
    mutationFn: async (data: ChangeRequestFormData) => {
      const requestData = {
        ...data,
        proposedChangesJson: proposedChanges.length > 0 ? proposedChanges : null,
      };
      return apiRequest('POST', '/technical/api/change-requests', requestData);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Success",
        description: `Change request CR-${String(data.id).padStart(4, '0')} created successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/change-requests'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create change request",
        variant: "destructive",
      });
    }
  });

  // Update change request mutation
  const updateMutation = useMutation({
    mutationFn: async (data: ChangeRequestFormData) => {
      const requestData = {
        ...data,
        proposedChangesJson: proposedChanges.length > 0 ? proposedChanges : null,
      };
      return apiRequest('PATCH', `/technical/api/change-requests/${changeRequest?.id}`, requestData);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Success",
        description: `Change request CR-${String(data.id).padStart(4, '0')} updated successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/change-requests'] });
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

  // Submit change request mutation (change status to submitted)
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!changeRequest) return;
      return apiRequest('POST', `/technical/api/change-requests/${changeRequest.id}/submit`, {
        userId: 'Current User' // In real app, get from auth context
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Change request submitted for approval",
      });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/change-requests'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit change request",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (data: ChangeRequestFormData) => {
    if (isEditMode && changeRequest) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleSubmitForApproval = () => {
    if (changeRequest?.status === 'draft') {
      submitMutation.mutate();
    }
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
    setShowChangesModal(true);
  };

  const saveProposedChange = (change: ProposedChange) => {
    if (editingChange && editingChange.id) {
      // Update existing change
      setProposedChanges(prev => prev.map(c => c.id === editingChange.id ? change : c));
    } else {
      // Add new change
      setProposedChanges(prev => [...prev, { ...change, id: Date.now().toString() }]);
    }
    setShowChangesModal(false);
    setEditingChange(null);
  };

  const deleteProposedChange = (id: string) => {
    setProposedChanges(prev => prev.filter(c => c.id !== id));
  };

  // Handle file attachments
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      const maxSize = 25 * 1024 * 1024; // 25MB
      
      if (!validTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not a supported file type`,
          variant: "destructive",
        });
        return false;
      }
      
      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds the 25MB limit`,
          variant: "destructive",
        });
        return false;
      }
      
      return true;
    });
    
    setAttachments(prev => [...prev, ...validFiles]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Get category icon
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'components':
        return '🔧';
      case 'work_orders':
        return '📋';
      case 'spares':
        return '📦';
      case 'stores':
        return '🏪';
      default:
        return '📄';
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b bg-blue-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GitPullRequest className="w-6 h-6 text-blue-600" />
                <DialogTitle className="text-xl font-semibold text-blue-900">
                  {isViewMode ? 'View Change Request' : isEditMode ? 'Edit Change Request' : 'New Change Request'}
                </DialogTitle>
                {changeRequest && (
                  <Badge variant="outline" className="ml-2">
                    CR-{String(changeRequest.id).padStart(4, '0')}
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                data-testid="button-close"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="flex h-full">
              {/* Sidebar */}
              <div className="w-48 border-r bg-gray-50 p-4">
                <nav className="space-y-2">
                  <Button
                    variant={activeSection === 'basic' ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => setActiveSection('basic')}
                    data-testid="nav-basic"
                  >
                    Basic Details
                  </Button>
                  <Button
                    variant={activeSection === 'target' ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => setActiveSection('target')}
                    data-testid="nav-target"
                  >
                    Target Selection
                  </Button>
                  <Button
                    variant={activeSection === 'changes' ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => setActiveSection('changes')}
                    data-testid="nav-changes"
                  >
                    Proposed Changes
                    {proposedChanges.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {proposedChanges.length}
                      </Badge>
                    )}
                  </Button>
                  <Button
                    variant={activeSection === 'attachments' ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => setActiveSection('attachments')}
                    data-testid="nav-attachments"
                  >
                    Attachments
                    {attachments.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {attachments.length}
                      </Badge>
                    )}
                  </Button>
                </nav>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 p-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                    {/* Basic Details Section */}
                    {activeSection === 'basic' && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Basic Information</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="vesselId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Vessel *</FormLabel>
                                <Select 
                                  value={field.value} 
                                  onValueChange={field.onChange}
                                  disabled={isViewMode}
                                >
                                  <FormControl>
                                    <SelectTrigger data-testid="select-vessel">
                                      <SelectValue placeholder="Select vessel" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="V001">MV SEAFARER</SelectItem>
                                    <SelectItem value="V002">MV VOYAGER</SelectItem>
                                    <SelectItem value="V003">MV EXPLORER</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Category *</FormLabel>
                                <Select 
                                  value={field.value} 
                                  onValueChange={field.onChange}
                                  disabled={isViewMode}
                                >
                                  <FormControl>
                                    <SelectTrigger data-testid="select-category">
                                      <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="components">Components</SelectItem>
                                    <SelectItem value="work_orders">Work Orders</SelectItem>
                                    <SelectItem value="spares">Spares</SelectItem>
                                    <SelectItem value="stores">Stores</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                              <FormItem className="col-span-2">
                                <FormLabel>Title *</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field}
                                    placeholder="Enter a descriptive title for the change request"
                                    maxLength={120}
                                    disabled={isViewMode}
                                    data-testid="input-title"
                                  />
                                </FormControl>
                                <span className="text-xs text-gray-500">
                                  {field.value?.length || 0}/120 characters
                                </span>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="reason"
                            render={({ field }) => (
                              <FormItem className="col-span-2">
                                <FormLabel>Reason for Change *</FormLabel>
                                <FormControl>
                                  <Textarea
                                    {...field}
                                    placeholder="Explain why this change is needed"
                                    rows={4}
                                    disabled={isViewMode}
                                    data-testid="textarea-reason"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </CardContent>
                      </Card>
                    )}

                    {/* Target Selection Section */}
                    {activeSection === 'target' && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Target Selection</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <FormField
                            control={form.control}
                            name="targetType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Target Type</FormLabel>
                                <Select 
                                  value={field.value || ''} 
                                  onValueChange={field.onChange}
                                  disabled={isViewMode}
                                >
                                  <FormControl>
                                    <SelectTrigger data-testid="select-target-type">
                                      <SelectValue placeholder="Select target type" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="">None</SelectItem>
                                    <SelectItem value="component">Component</SelectItem>
                                    <SelectItem value="work_order">Work Order</SelectItem>
                                    <SelectItem value="spare">Spare</SelectItem>
                                    <SelectItem value="store">Store</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="targetId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Target ID</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field}
                                    value={field.value || ''}
                                    placeholder="Enter the ID of the target item"
                                    disabled={isViewMode}
                                    data-testid="input-target-id"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </CardContent>
                      </Card>
                    )}

                    {/* Proposed Changes Section */}
                    {activeSection === 'changes' && (
                      <Card>
                        <CardHeader>
                          <div className="flex justify-between items-center">
                            <CardTitle>Proposed Changes</CardTitle>
                            {!isViewMode && (
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
                            )}
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
                                  {!isViewMode && <TableHead>Actions</TableHead>}
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
                                    {!isViewMode && (
                                      <TableCell>
                                        <div className="flex gap-1">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                              setEditingChange(change);
                                              setShowChangesModal(true);
                                            }}
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
                                    )}
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
                    )}

                    {/* Attachments Section */}
                    {activeSection === 'attachments' && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Attachments</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {!isViewMode && (
                            <div className="flex items-center gap-4">
                              <Input
                                type="file"
                                onChange={handleFileChange}
                                multiple
                                accept=".pdf,.jpg,.jpeg,.png,.docx"
                                className="flex-1"
                                data-testid="input-file"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                              >
                                <Upload className="w-4 h-4 mr-2" />
                                Upload
                              </Button>
                            </div>
                          )}

                          {attachments.length > 0 ? (
                            <div className="space-y-2">
                              {attachments.map((file, index) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between p-3 border rounded-lg"
                                  data-testid={`attachment-${index}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                                      📄
                                    </div>
                                    <div>
                                      <p className="font-medium">{file.name}</p>
                                      <p className="text-sm text-gray-500">
                                        {(file.size / 1024 / 1024).toFixed(2)} MB
                                      </p>
                                    </div>
                                  </div>
                                  {!isViewMode && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeAttachment(index)}
                                      className="h-8 w-8 text-red-600"
                                      data-testid={`button-remove-attachment-${index}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-gray-500">
                              No attachments uploaded
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </form>
                </Form>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-between">
            <Button
              variant="outline"
              onClick={onClose}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <div className="flex gap-2">
              {changeRequest?.status === 'draft' && !isViewMode && (
                <Button
                  variant="outline"
                  onClick={handleSubmitForApproval}
                  disabled={submitMutation.isPending}
                  className="bg-blue-50 text-blue-600 hover:bg-blue-100"
                  data-testid="button-submit-approval"
                >
                  Submit for Approval
                </Button>
              )}
              {!isViewMode && (
                <Button
                  onClick={form.handleSubmit(handleSubmit)}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                  data-testid="button-save"
                >
                  {isEditMode ? 'Update' : 'Save as Draft'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Proposed Change Modal */}
      {showChangesModal && (
        <Dialog open={showChangesModal} onOpenChange={setShowChangesModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingChange?.id ? 'Edit' : 'Add'} Proposed Change</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium">Field Name *</label>
                <Input
                  value={editingChange?.field || ''}
                  onChange={(e) => setEditingChange(prev => prev ? { ...prev, field: e.target.value } : null)}
                  placeholder="e.g., Component Name, Stock Level"
                  data-testid="input-change-field"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Old Value</label>
                <Input
                  value={editingChange?.oldValue || ''}
                  onChange={(e) => setEditingChange(prev => prev ? { ...prev, oldValue: e.target.value } : null)}
                  placeholder="Current value"
                  data-testid="input-change-old"
                />
              </div>
              <div>
                <label className="text-sm font-medium">New Value *</label>
                <Input
                  value={editingChange?.newValue || ''}
                  onChange={(e) => setEditingChange(prev => prev ? { ...prev, newValue: e.target.value } : null)}
                  placeholder="Proposed new value"
                  data-testid="input-change-new"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Justification *</label>
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
                    setShowChangesModal(false);
                    setEditingChange(null);
                  }}
                  data-testid="button-change-cancel"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (editingChange && editingChange.field && editingChange.newValue && editingChange.justification) {
                      saveProposedChange(editingChange);
                    }
                  }}
                  disabled={!editingChange?.field || !editingChange?.newValue || !editingChange?.justification}
                  data-testid="button-change-save"
                >
                  Save Change
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}