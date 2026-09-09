import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, Trash2, FileText, Image as ImageIcon, X, Eye } from 'lucide-react';

export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string;
  uploadedAt: string;
}

interface FileAttachmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachments: FileAttachment[];
  onAttachmentsChange: (attachments: FileAttachment[]) => void;
  title?: string;
  itemName?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

export function FileAttachmentDialog({
  open,
  onOpenChange,
  attachments,
  onAttachmentsChange,
  title = 'Manage Attachments',
  itemName,
}: FileAttachmentDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string | null>(null);

  const attachmentsRef = useRef<FileAttachment[]>(attachments);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  const commitAttachments = (next: FileAttachment[]) => {
    attachmentsRef.current = next;
    onAttachmentsChange(next);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const errors: string[] = [];

    Array.from(files).forEach((file) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Invalid file type. Only PDF, JPG, and PNG are allowed.`);
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File too large. Maximum size is 5MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const attachment: FileAttachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          type: file.type,
          size: file.size,
          data: e.target?.result as string,
          uploadedAt: new Date().toISOString(),
        };

        commitAttachments([...attachmentsRef.current, attachment]);

        toast({
          title: 'File Uploaded',
          description: `${file.name} has been attached successfully.`,
        });
      };
      reader.readAsDataURL(file);
    });

    if (errors.length > 0) {
      toast({
        title: 'Upload Error',
        description: errors.join('\n'),
        variant: 'destructive',
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (id: string) => {
    const current = attachmentsRef.current;
    const attachment = current.find((a) => a.id === id);
    if (!attachment) return;
    commitAttachments(current.filter((a) => a.id !== id));

    toast({
      title: 'File Removed',
      description: `${attachment.name} has been removed.`,
    });
  };

  const handlePreview = (attachment: FileAttachment) => {
    if (attachment.type === 'application/pdf') {
      const byteCharacters = atob(attachment.data.split(',')[1]);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } else {
      setPreviewUrl(attachment.data);
      setPreviewType(attachment.type);
    }
  };

  const closePreview = () => {
    if (previewUrl && previewType === 'application/pdf') {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPreviewType(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type === 'application/pdf') {
      return <FileText className="h-8 w-8 text-red-500" />;
    }
    return <ImageIcon className="h-8 w-8 text-blue-500" />;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-[500px] min-w-0 overflow-hidden">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {itemName ? `Attachments for: ${itemName}` : 'Upload PDF or image files (JPG, PNG). Max 5MB per file.'}
            </DialogDescription>
          </DialogHeader>

          <div className="min-w-0 space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              data-testid="input-file-attachment"
            />

            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full min-w-0 border-dashed border-2 h-20 hover:bg-gray-50"
              data-testid="button-upload-file"
            >
              <div className="flex flex-col items-center gap-1">
                <Upload className="h-6 w-6 text-gray-400" />
                <span className="text-sm text-gray-600">Click to upload files</span>
                <span className="text-xs text-gray-400">PDF, JPG, PNG (max 5MB)</span>
              </div>
            </Button>

            {attachments.length > 0 && (
              <div className="h-[200px] w-full min-w-0 max-w-full overflow-x-hidden overflow-y-auto rounded-md border p-2">
                <div className="w-full min-w-0 max-w-full space-y-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="grid w-full min-w-0 max-w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border bg-gray-50 p-2 hover:bg-gray-100"
                      data-testid={`attachment-item-${attachment.id}`}
                    >
                      <div className="flex-shrink-0">
                        {attachment.type.startsWith('image/') ? (
                          <img
                            src={attachment.data}
                            alt={attachment.name}
                            className="h-10 w-10 object-cover rounded"
                          />
                        ) : (
                          getFileIcon(attachment.type)
                        )}
                      </div>
                      
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p
                          className="max-w-full truncate text-sm font-medium text-gray-900"
                          title={attachment.name}
                          aria-label={`Attachment filename: ${attachment.name}`}
                        >
                          {attachment.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(attachment.size)}
                        </p>
                      </div>

                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-blue-600"
                          onClick={() => handlePreview(attachment)}
                          data-testid={`button-preview-${attachment.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-red-600"
                          onClick={() => handleRemoveAttachment(attachment.id)}
                          data-testid={`button-remove-${attachment.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {attachments.length === 0 && (
              <div className="text-center py-6 text-gray-500">
                <FileText className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No attachments yet</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <div className="flex justify-between w-full items-center">
              <span className="text-sm text-gray-500">
                {attachments.length} file{attachments.length !== 1 ? 's' : ''} attached
              </span>
              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                data-testid="button-close-attachment-dialog"
              >
                Done
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {previewUrl && (
        <Dialog open={!!previewUrl} onOpenChange={() => closePreview()}>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>File Preview</DialogTitle>
              <DialogDescription>
                Viewing attached file
              </DialogDescription>
            </DialogHeader>
            <div className="relative flex items-center justify-center min-h-[400px]">
              {previewType?.startsWith('image/') ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-w-full max-h-[60vh] object-contain"
                />
              ) : previewType === 'application/pdf' ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-[60vh] border rounded"
                  title="PDF Preview"
                />
              ) : (
                <p className="text-gray-500">Preview not available for this file type</p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => closePreview()} data-testid="button-close-preview">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
