import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Upload, X, Calendar, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import type { Defect } from "@shared/schema";

interface CloseDefectModalProps {
  open: boolean;
  onClose: () => void;
  defectId: string;
}

export default function CloseDefectModal({ open, onClose, defectId }: CloseDefectModalProps) {
  const { toast } = useToast();
  const [closureComment, setClosureComment] = useState("");
  const [closureFiles, setClosureFiles] = useState<File[]>([]);
  const [actionTaken, setActionTaken] = useState("");
  const [targetDate, setTargetDate] = useState<Date | undefined>(undefined);
  const [completionDate, setCompletionDate] = useState<Date | undefined>(new Date());

  // Fetch defect details
  const { data: defect, isLoading } = useQuery<Defect>({
    queryKey: ['/api/defects', defectId],
    queryFn: async () => {
      const response = await fetch(`/api/defects/${defectId}`);
      if (!response.ok) throw new Error('Failed to fetch defect');
      return response.json();
    },
    enabled: open && !!defectId
  });

  const closeDefectMutation = useMutation({
    mutationFn: async () => {
      // For now, we'll just store file names as strings
      // In a real implementation, you'd upload files to storage first
      const fileNames = closureFiles.map(file => file.name);
      
      return apiRequest('PATCH', `/api/defects/${defectId}/close`, {
        closedBy: 'Current User', // In real app, get from auth context
        closureComment,
        closureFiles: fileNames,
        actionTakenRequested: actionTaken,
        targetCloseDate: targetDate ? format(targetDate, 'dd-MM-yyyy') : null,
        dateCompleted: completionDate ? format(completionDate, 'dd-MM-yyyy') : null
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Defect closed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/defects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/defects', defectId] });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to close defect",
        variant: "destructive",
      });
    }
  });

  const handleClose = () => {
    setClosureComment("");
    setClosureFiles([]);
    setActionTaken("");
    setTargetDate(undefined);
    setCompletionDate(new Date());
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
    
    if (closureFiles.length + validFiles.length > 10) {
      toast({
        title: "Too many files",
        description: "Maximum 10 files allowed",
        variant: "destructive",
      });
      return;
    }
    
    setClosureFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setClosureFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    // Validate required fields
    if (!closureComment || closureComment.trim().length === 0) {
      toast({
        title: "Validation Error",
        description: "Closure comment is required",
        variant: "destructive",
      });
      return;
    }

    if (!actionTaken || actionTaken.trim().length === 0) {
      toast({
        title: "Validation Error",
        description: "Action taken is required to close the defect",
        variant: "destructive",
      });
      return;
    }

    if (!targetDate) {
      toast({
        title: "Validation Error",
        description: "Target date is required",
        variant: "destructive",
      });
      return;
    }

    if (!completionDate) {
      toast({
        title: "Validation Error", 
        description: "Completion date is required",
        variant: "destructive",
      });
      return;
    }

    closeDefectMutation.mutate();
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return '🖼️';
    if (file.type === 'application/pdf') return '📄';
    if (file.type.includes('word')) return '📝';
    return '📎';
  };

  if (isLoading || !defect) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
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

  const currentDate = new Date().toLocaleString();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Close Defect
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Summary Section */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-3 text-sm">Defect Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Defect ID:</span>
                  <span className="font-mono">{defect.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Vessel:</span>
                  <span>{defect.vesselName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Category:</span>
                  <Badge variant="outline">{defect.category}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <Badge variant={defect.critical ? "destructive" : "secondary"}>
                    {defect.status}
                    {defect.critical && (
                      <AlertTriangle className="h-3 w-3 ml-1" />
                    )}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Target Date:</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {defect.targetDate || 'Not set'}
                  </span>
                </div>
                <Separator className="my-2" />
                <div>
                  <span className="text-gray-600">Description:</span>
                  <p className="mt-1 text-gray-800">{defect.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Closure Details */}
          <div className="space-y-4">
            {/* Action Taken Field */}
            <div>
              <Label htmlFor="action-taken">
                Action Taken / Requested <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="action-taken"
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
                placeholder="Describe the actions taken to resolve this defect..."
                className="min-h-[100px] mt-2"
              />
            </div>

            {/* Date Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="target-date">
                  Target Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  id="target-date"
                  className="mt-2"
                  value={targetDate ? format(targetDate, "yyyy-MM-dd") : ""}
                  onChange={(e) => setTargetDate(e.target.value ? new Date(e.target.value) : undefined)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="completion-date">
                  Date Completed <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  id="completion-date"
                  className="mt-2"
                  value={completionDate ? format(completionDate, "yyyy-MM-dd") : ""}
                  onChange={(e) => setCompletionDate(e.target.value ? new Date(e.target.value) : undefined)}
                  required
                />
              </div>
            </div>

            {/* Closure Comment */}
            <div>
              <Label htmlFor="closure-comment">
                Closure Comment <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="closure-comment"
                value={closureComment}
                onChange={(e) => setClosureComment(e.target.value)}
                placeholder="Provide details about how the defect was resolved..."
                className="min-h-[100px] mt-2"
              />
            </div>

            <div>
              <Label htmlFor="closure-files">
                Attach Files <span className="text-xs text-gray-500">(optional, max 10 files)</span>
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
                      Click to upload evidence files
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      JPG, JPEG, PNG, PDF, DOCX (max 25MB per file)
                    </p>
                  </label>
                </div>

                {closureFiles.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <Label className="text-sm">Attached Files ({closureFiles.length}/10)</Label>
                    <div className="space-y-2">
                      {closureFiles.map((file, index) => (
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
                            onClick={() => removeFile(index)}
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Closed By</Label>
                <div className="mt-2 p-2 bg-gray-50 rounded">
                  <p className="text-sm">Current User</p>
                </div>
              </div>
              <div>
                <Label>Closed On</Label>
                <div className="mt-2 p-2 bg-gray-50 rounded">
                  <p className="text-sm">{currentDate}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button onClick={handleClose} variant="outline">
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={closeDefectMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            {closeDefectMutation.isPending ? 'Closing...' : 'Mark as Closed'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}