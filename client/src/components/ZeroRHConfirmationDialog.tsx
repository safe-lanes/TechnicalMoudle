import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Upload } from "lucide-react";
import { RENEWAL_ACTION_TYPES } from "@shared/schema";

interface ZeroRHConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  componentName: string;
  componentCode: string;
  previousRH: number;
  entryDate: string;
  onConfirm: (data: {
    renewalActionType: typeof RENEWAL_ACTION_TYPES[number];
    renewalReason: string;
    renewalReference?: string;
    renewalEvidenceUrls?: string[];
  }) => void;
}

const ZeroRHConfirmationDialog: React.FC<ZeroRHConfirmationDialogProps> = ({
  isOpen,
  onClose,
  componentName,
  componentCode,
  previousRH,
  entryDate,
  onConfirm,
}) => {
  const [formData, setFormData] = useState({
    actionType: "" as typeof RENEWAL_ACTION_TYPES[number] | "",
    reason: "",
    reference: "",
  });
  const [errors, setErrors] = useState<{ actionType?: string; reason?: string }>({});
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  const handleClose = () => {
    setFormData({ actionType: "", reason: "", reference: "" });
    setErrors({});
    setUploadedFiles([]);
    onClose();
  };

  const validateForm = (): boolean => {
    const newErrors: { actionType?: string; reason?: string } = {};
    
    if (!formData.actionType) {
      newErrors.actionType = "Please select an action type";
    }
    if (!formData.reason || formData.reason.trim().length === 0) {
      newErrors.reason = "Reason is required when resetting Running Hours to 0";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConfirm = () => {
    if (!validateForm()) return;
    
    onConfirm({
      renewalActionType: formData.actionType as typeof RENEWAL_ACTION_TYPES[number],
      renewalReason: formData.reason.trim(),
      renewalReference: formData.reference.trim() || undefined,
      renewalEvidenceUrls: uploadedFiles.length > 0 ? uploadedFiles : undefined,
    });
    
    handleClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const fileNames = Array.from(files).map(f => f.name);
      setUploadedFiles(prev => [...prev, ...fileNames]);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Running Hours set to 0
          </DialogTitle>
          <DialogDescription className="text-base">
            Is this component renewed / replaced?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Component:</span>
              <span className="font-medium">{componentName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Component Code:</span>
              <span className="font-medium">{componentCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Previous RH:</span>
              <span className="font-medium">{previousRH.toLocaleString()} hrs</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reset Date:</span>
              <span className="font-medium">{entryDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">New RH:</span>
              <span className="font-medium text-amber-600">0 hrs</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="actionType" className="text-sm font-medium">
              Action Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.actionType}
              onValueChange={(value) => {
                setFormData(prev => ({ ...prev, actionType: value as typeof RENEWAL_ACTION_TYPES[number] }));
                if (errors.actionType) setErrors(prev => ({ ...prev, actionType: undefined }));
              }}
            >
              <SelectTrigger 
                id="actionType" 
                className={errors.actionType ? "border-destructive" : ""}
                data-testid="select-action-type"
              >
                <SelectValue placeholder="Select action type" />
              </SelectTrigger>
              <SelectContent>
                {RENEWAL_ACTION_TYPES.map((type) => (
                  <SelectItem key={type} value={type} data-testid={`option-action-${type.toLowerCase()}`}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.actionType && (
              <p className="text-sm text-destructive">{errors.actionType}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm font-medium">
              Reason / Notes <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              value={formData.reason}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, reason: e.target.value }));
                if (errors.reason) setErrors(prev => ({ ...prev, reason: undefined }));
              }}
              placeholder="Enter reason for renewal/replacement..."
              className={`min-h-[80px] ${errors.reason ? "border-destructive" : ""}`}
              data-testid="input-renewal-reason"
            />
            {errors.reason && (
              <p className="text-sm text-destructive">{errors.reason}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference" className="text-sm font-medium">
              Reference (Work Order / Job ID)
            </Label>
            <Input
              id="reference"
              value={formData.reference}
              onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
              placeholder="Optional reference number..."
              data-testid="input-renewal-reference"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Evidence Upload (Optional)
            </Label>
            <div className="flex items-center gap-2">
              <label 
                className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-muted transition-colors"
                data-testid="button-upload-evidence"
              >
                <Upload className="h-4 w-4" />
                <span className="text-sm">Choose Files</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                />
              </label>
              {uploadedFiles.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {uploadedFiles.length} file(s) selected
                </span>
              )}
            </div>
            {uploadedFiles.length > 0 && (
              <div className="text-xs text-muted-foreground space-y-1">
                {uploadedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <span>• {file}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleClose}
            data-testid="button-cancel-renewal"
          >
            No - Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            className="bg-green-600 hover:bg-green-700"
            data-testid="button-confirm-renewal"
          >
            Yes - Renewed/Replaced
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ZeroRHConfirmationDialog;
