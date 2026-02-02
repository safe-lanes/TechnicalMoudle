import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Paperclip, Upload, X, Save } from "lucide-react";

interface AddNoteModalProps {
  open: boolean;
  onClose: () => void;
  defectId: string;
}

export default function AddNoteModal({ open, onClose, defectId }: AddNoteModalProps) {
  const { toast } = useToast();
  const [noteText, setNoteText] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);

  // Reset form state when dialog closes
  useEffect(() => {
    if (!open) {
      setNoteText("");
      setAttachments([]);
    }
  }, [open]);

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      // For now, we'll just store file names as strings
      // In a real implementation, you'd upload files to storage first
      const attachmentNames = attachments.map(file => file.name);
      
      return apiRequest('POST', `/technical/api/defects/${defectId}/notes`, {
        noteText,
        attachments: attachmentNames,
        createdBy: 'Current User' // In real app, get from auth context
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Note added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/defects'] });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/defects', defectId] });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/defects?includeClosedDefects=true'] });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add note",
        variant: "destructive",
      });
    }
  });

  const handleClose = () => {
    setNoteText("");
    setAttachments([]);
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
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
          description: `${file.name} exceeds 25MB limit`,
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

  const handleSubmit = () => {
    if (!noteText || noteText.trim().length < 10) {
      toast({
        title: "Validation Error",
        description: "Note text must be at least 10 characters",
        variant: "destructive",
      });
      return;
    }

    addNoteMutation.mutate();
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return '🖼️';
    if (file.type === 'application/pdf') return '📄';
    if (file.type.includes('word')) return '📝';
    return '📎';
  };

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-2xl" onInteractOutside={(e) => e.preventDefault()}>
        <button 
          className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none"
          onClick={onClose}
          data-testid="button-close-add-note"
        >
          <X className="h-4 w-4" />
        </button>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            Add Note to Defect {defectId}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="note-text">
              Note Text <span className="text-red-500">*</span>
              <span className="text-xs text-gray-500 ml-2">(min. 10 characters)</span>
            </Label>
            <Textarea
              id="note-text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Enter your note here..."
              className="min-h-[120px] mt-2"
            />
            <div className="text-xs text-gray-500 text-right mt-1">
              {noteText.length} characters
            </div>
          </div>

          <div>
            <Label htmlFor="attachments">
              Attachments <span className="text-xs text-gray-500">(optional)</span>
            </Label>
            <div className="mt-2">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  multiple
                  accept=".jpg,.jpeg,.png,.pdf,.docx"
                  onChange={handleFileChange}
                />
                <label
                  htmlFor="file-upload"
                  className="flex flex-col items-center cursor-pointer"
                >
                  <Upload className="h-8 w-8 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-600">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Accepted: JPG, JPEG, PNG, PDF, DOCX (max 25MB per file)
                  </p>
                </label>
              </div>

              {attachments.length > 0 && (
                <div className="mt-4 space-y-2">
                  <Label className="text-sm">Selected Files ({attachments.length})</Label>
                  <div className="space-y-2">
                    {attachments.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getFileIcon(file)}</span>
                          <div>
                            <p className="text-sm font-medium">{file.name}</p>
                            <p className="text-xs text-gray-500">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeAttachment(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleClose} variant="outline">
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={addNoteMutation.isPending || !noteText || noteText.trim().length < 10}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {addNoteMutation.isPending ? 'Saving...' : 'Save Note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}