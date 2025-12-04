import { useState, useCallback } from 'react';
import { X, Upload, FileText, Image, Trash2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

export interface AttachmentFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
}

interface AttachmentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  attachments: AttachmentFile[];
  onAttachmentsChange: (attachments: AttachmentFile[]) => void;
  maxFileSizeMB?: number;
  allowedTypes?: string[];
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const generateId = () => Math.random().toString(36).substring(2, 9);

export default function AttachmentSheet({
  open,
  onOpenChange,
  title,
  attachments,
  onAttachmentsChange,
  maxFileSizeMB = 5,
  allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
}: AttachmentSheetProps) {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);

  const getFileTypeDisplay = () => {
    const typeLabels: string[] = [];
    if (allowedTypes.includes('application/pdf')) typeLabels.push('PDF');
    if (allowedTypes.some(t => t.startsWith('image/'))) typeLabels.push('JPG', 'PNG');
    return typeLabels.join(', ');
  };

  const validateFile = (file: File): boolean => {
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: `${file.name} is not a supported file type. Allowed: ${getFileTypeDisplay()}`,
        variant: 'destructive',
      });
      return false;
    }

    const maxSize = maxFileSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: `${file.name} exceeds ${maxFileSizeMB}MB limit`,
        variant: 'destructive',
      });
      return false;
    }

    return true;
  };

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;

    const newAttachments: AttachmentFile[] = [];
    
    Array.from(files).forEach((file) => {
      if (validateFile(file)) {
        newAttachments.push({
          id: generateId(),
          name: file.name,
          size: file.size,
          type: file.type,
          url: URL.createObjectURL(file),
        });
      }
    });

    if (newAttachments.length > 0) {
      onAttachmentsChange([...attachments, ...newAttachments]);
      toast({
        title: 'Files added',
        description: `${newAttachments.length} file(s) added successfully`,
      });
    }
  }, [attachments, onAttachmentsChange, toast, maxFileSizeMB, allowedTypes]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = '';
  }, [handleFiles]);

  const handleRemoveAttachment = useCallback((id: string) => {
    onAttachmentsChange(attachments.filter(a => a.id !== id));
    toast({
      title: 'File removed',
      description: 'Attachment removed successfully',
    });
  }, [attachments, onAttachmentsChange, toast]);

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) {
      return <Image className="h-8 w-8 text-blue-500" />;
    }
    return <FileText className="h-8 w-8 text-red-500" />;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] sm:w-[420px] flex flex-col">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="text-lg font-semibold">Manage Attachments</SheetTitle>
          <SheetDescription className="text-sm text-gray-500">
            Attachments for: {title}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 py-4 space-y-4 overflow-hidden">
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragging 
                ? 'border-blue-400 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="attachment-upload"
              className="hidden"
              multiple
              accept={allowedTypes.join(',')}
              onChange={handleFileInputChange}
              data-testid="input-file-upload"
            />
            <label
              htmlFor="attachment-upload"
              className="flex flex-col items-center cursor-pointer"
            >
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <Upload className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-700">Click to upload files</p>
              <p className="text-xs text-gray-500 mt-1">
                {getFileTypeDisplay()} (max {maxFileSizeMB}MB)
              </p>
            </label>
          </div>

          <ScrollArea className="flex-1 h-[calc(100vh-350px)]">
            {attachments.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No attachments yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {attachments.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                    data-testid={`attachment-item-${file.id}`}
                  >
                    <div className="flex-shrink-0">
                      {file.type.startsWith('image/') && file.url ? (
                        <div className="w-12 h-12 rounded overflow-hidden border border-gray-200">
                          <img
                            src={file.url}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded bg-white border border-gray-200 flex items-center justify-center">
                          {getFileIcon(file.type)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-400 hover:text-red-500"
                      onClick={() => handleRemoveAttachment(file.id)}
                      data-testid={`button-remove-attachment-${file.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {attachments.length > 0 && (
            <div className="text-xs text-gray-500 text-center">
              {attachments.length} file{attachments.length !== 1 ? 's' : ''} attached
            </div>
          )}
        </div>

        <SheetFooter className="pt-4 border-t">
          <Button
            className="w-full bg-[#52baf3] hover:bg-[#3da8e0] text-white"
            onClick={() => onOpenChange(false)}
            data-testid="button-done-attachments"
          >
            Done
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
