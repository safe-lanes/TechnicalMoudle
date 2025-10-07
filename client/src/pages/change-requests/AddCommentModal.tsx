import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Save, X } from "lucide-react";

interface AddCommentModalProps {
  open: boolean;
  onClose: () => void;
  requestId: number;
}

export default function AddCommentModal({ open, onClose, requestId }: AddCommentModalProps) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");

  const addCommentMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/change-requests/${requestId}/comments`, {
        message,
        userId: 'Current User' // In real app, get from auth context
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Comment added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/change-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/change-requests', requestId] });
      queryClient.invalidateQueries({ queryKey: ['/api/change-requests', requestId, 'comments'] });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add comment",
        variant: "destructive",
      });
    }
  });

  const handleClose = () => {
    setMessage("");
    onClose();
  };

  const handleSubmit = () => {
    if (!message.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a comment",
        variant: "destructive",
      });
      return;
    }
    addCommentMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            <DialogTitle>Add Comment to Change Request</DialogTitle>
            <Badge variant="outline" className="ml-2">
              CR-{String(requestId).padStart(4, '0')}
            </Badge>
          </div>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="comment" className="text-sm font-medium">
              Comment *
            </Label>
            <Textarea
              id="comment"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter your comment here..."
              rows={6}
              className="mt-1"
              data-testid="textarea-comment"
            />
            <p className="text-xs text-gray-500 mt-1">
              {message.length} characters
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Comments will be visible to all users with access to this change request.
              They become part of the change request's audit trail.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={addCommentMutation.isPending}
            data-testid="button-cancel"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={addCommentMutation.isPending || !message.trim()}
            className="bg-blue-600 hover:bg-blue-700"
            data-testid="button-save-comment"
          >
            <Save className="w-4 h-4 mr-2" />
            {addCommentMutation.isPending ? 'Saving...' : 'Save Comment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}