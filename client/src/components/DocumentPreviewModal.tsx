import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, FileText, Loader2, AlertCircle } from 'lucide-react';

interface DocumentPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string | null;
  fileName: string;
  fileType: string;
  fileSize?: number;
  fetchUrl?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64Data] = dataUrl.split(',');
  const mimeMatch = header.match(/data:([^;]+)/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const binaryStr = atob(base64Data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function isImageType(mime: string): boolean {
  return mime.startsWith('image/');
}

function isPdfType(mime: string): boolean {
  return mime === 'application/pdf';
}

export function DocumentPreviewModal({
  open,
  onOpenChange,
  documentId,
  fileName,
  fileType,
  fileSize,
  fetchUrl,
}: DocumentPreviewModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);

  const cleanup = useCallback(() => {
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
    }
    setBlobUrl(null);
    setBlob(null);
    setLoading(false);
    setError(null);
  }, [blobUrl]);

  useEffect(() => {
    if (!open || !documentId) {
      cleanup();
      return;
    }

    let cancelled = false;

    const fetchDocument = async () => {
      setLoading(true);
      setError(null);

      try {
        const url = fetchUrl || `/technical/api/work-order-documents/${documentId}/download`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to retrieve document');
        const result = await response.json();

        if (cancelled) return;

        if (result.dataUrl) {
          const fileBlob = dataUrlToBlob(result.dataUrl);
          const objectUrl = URL.createObjectURL(fileBlob);
          setBlob(fileBlob);
          setBlobUrl(objectUrl);
        } else {
          throw new Error('No file data received');
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('Document preview fetch error:', err);
          setError(err.message || 'Failed to load document');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchDocument();

    return () => {
      cancelled = true;
    };
  }, [open, documentId, fetchUrl]);

  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  const handleDownload = () => {
    if (!blobUrl || !blob) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-3" data-testid="preview-loading">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm text-gray-500">Loading preview...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-3" data-testid="preview-error">
          <AlertCircle className="h-10 w-10 text-red-400" />
          <p className="text-sm text-red-600 font-medium">Failed to load document</p>
          <p className="text-xs text-gray-500">{error}</p>
        </div>
      );
    }

    if (!blobUrl) return null;

    if (isImageType(fileType)) {
      return (
        <div className="flex items-center justify-center max-h-[60vh] overflow-auto">
          <img
            src={blobUrl}
            alt={fileName}
            className="max-w-full max-h-[60vh] object-contain rounded"
            data-testid="preview-image"
          />
        </div>
      );
    }

    if (isPdfType(fileType)) {
      return (
        <iframe
          src={blobUrl}
          title={fileName}
          className="w-full h-[60vh] rounded border border-gray-200"
          data-testid="preview-pdf"
        />
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3" data-testid="preview-unsupported">
        <FileText className="h-12 w-12 text-gray-400" />
        <p className="text-sm font-medium text-gray-700">{fileName}</p>
        {fileSize != null && (
          <p className="text-xs text-gray-500">{formatFileSize(fileSize)}</p>
        )}
        <p className="text-xs text-gray-400">Preview not available for this file type</p>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl w-[90vw]"
        data-testid="document-preview-modal"
      >
        <DialogHeader>
          <DialogTitle className="text-base truncate pr-8" data-testid="preview-title">
            {fileName}
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            {fileType}{fileSize != null ? ` · ${formatFileSize(fileSize)}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[200px]">
          {renderPreview()}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleClose}
            data-testid="button-preview-close"
          >
            Close
          </Button>
          <Button
            onClick={handleDownload}
            disabled={!blobUrl || loading}
            data-testid="button-preview-download"
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
