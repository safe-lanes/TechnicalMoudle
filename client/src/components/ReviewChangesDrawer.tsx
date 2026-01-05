import React, { useState } from "react";
import { X, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChangeMode } from "@/contexts/ChangeModeContext";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface ReviewChangesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: string;
  targetId: string;
}

export const ReviewChangesDrawer: React.FC<ReviewChangesDrawerProps> = ({
  isOpen,
  onClose,
  targetType,
  targetId
}) => {
  const { getDiffs, changeRequestTitle, changeRequestCategory, originalSnapshot, reset } = useChangeMode();
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const diffs = getDiffs();
  
  // Group diffs by section
  const groupedDiffs = diffs.reduce((acc, diff) => {
    const section = diff.path.split('.')[0] || 'General';
    if (!acc[section]) acc[section] = [];
    acc[section].push(diff);
    return acc;
  }, {} as Record<string, typeof diffs>);
  
  const handleSubmit = async (status: 'draft' | 'submitted') => {
    if (!reason && status === 'submitted') {
      toast({
        title: "Reason required",
        description: "Please provide a reason for this change request",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const response = await apiRequest('POST', '/technical/api/change-requests', {
        title: changeRequestTitle || 'Untitled Change Request',
        category: changeRequestCategory || targetType,
        targetType,
        targetId,
        status,
        reason,
        diffs: diffs.map(d => ({
          field_path: d.path,
          old_value: d.oldVal,
          new_value: d.newVal
        })),
        originalSnapshot
      });
      
      if (response.ok) {
        toast({
          title: status === 'submitted' ? "Change request submitted" : "Draft saved",
          description: status === 'submitted' 
            ? "Your change request has been submitted for approval"
            : "Your change request has been saved as draft"
        });
        
        // Reset and navigate back
        reset();
        setLocation("/pms/modify-pms");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit change request",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/50" onClick={onClose} />
      
      {/* Drawer */}
      <div className="w-[500px] bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Review Changes</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Content */}
        <ScrollArea className="flex-1 px-6 py-4">
          {/* Summary */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-2">Change Summary</h3>
            <p className="text-sm text-gray-600">
              {diffs.length} field{diffs.length !== 1 ? 's' : ''} modified
            </p>
          </div>
          
          {/* Diffs grouped by section */}
          <div className="space-y-6">
            {Object.entries(groupedDiffs).map(([section, sectionDiffs]) => (
              <div key={section}>
                <h4 className="text-sm font-semibold mb-3">{section}</h4>
                <div className="space-y-3">
                  {sectionDiffs.map((diff, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs font-medium text-gray-700 mb-1">
                        {diff.path.split('.').pop()}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-xs text-gray-500">Was:</span>
                          <div className="text-red-600">{String(diff.oldVal) || '-'}</div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">New:</span>
                          <div className="text-green-600">{String(diff.newVal) || '-'}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          {/* Reason for Change */}
          <div className="mt-6">
            <Label htmlFor="reason" className="required">
              Reason for Change
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this change is necessary..."
              rows={4}
              className="mt-2"
            />
          </div>
          
          {/* File Upload (optional) */}
          <div className="mt-6">
            <Label>Evidence/Documentation (Optional)</Label>
            <div className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
              <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">
                Drag and drop files here, or click to browse
              </p>
            </div>
          </div>
        </ScrollArea>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSubmit('draft')}
              disabled={isSubmitting}
            >
              Save Draft
            </Button>
            <Button
              onClick={() => handleSubmit('submitted')}
              disabled={isSubmitting || !reason}
            >
              Submit for Approval
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};