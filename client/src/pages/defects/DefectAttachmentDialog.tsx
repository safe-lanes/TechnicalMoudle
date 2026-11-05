import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Eye, FileText, Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import { getAccessToken } from '@/lib/authToken';
import { DEFECT_FILE_BYTES, isExternalDefectAttachment, type DefectAttachment, type DefectFileSection } from '@shared/defectAttachments';

export function defectFileHeaders(user?: { userUuid?: string | null }): Record<string, string> {
  const token = getAccessToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(import.meta.env.VITE_APP_ENV === 'replit' ? {
      'x-defect-development': 'default-user', 'x-user-id': user?.userUuid ?? '',
    } : {}),
  };
}
export function defectFileUrl(defect: string | number, section: DefectFileSection, id: string) {
  return `/technical/api/defects/${encodeURIComponent(String(defect))}/files/${section}/${encodeURIComponent(id)}`;
}
export async function fetchDefectFile(url: string, headers: Record<string, string>) {
  const response = await fetch(url, { headers, credentials: 'include' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'The file could not be loaded.');
  }
  return response.blob();
}
type Props = {
  open: boolean; onOpenChange: (open: boolean) => void;
  attachments: DefectAttachment[]; onAttachmentsChange: (files: DefectAttachment[]) => void;
  title: string; itemName?: string; readOnly?: boolean; externalStorage: boolean;
  section: DefectFileSection; vesselUuid: string; defectId?: string | number; sessionId: string;
  user?: { userUuid?: string | null };
};
export function DefectAttachmentDialog(props: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef(props.attachments);
  filesRef.current = props.attachments;
  async function upload(files: FileList | null) {
    if (!files || props.readOnly) return;
    setError(''); setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > DEFECT_FILE_BYTES) throw new Error('The maximum file size is 5 MB.');
        const body = new FormData();
        body.append('file', file); body.append('vesselUuid', props.vesselUuid); body.append('sessionId', props.sessionId);
        const base = props.defectId ? `/technical/api/defects/${encodeURIComponent(String(props.defectId))}` : '/technical/api/defects';
        const response = await fetch(`${base}/file-staging/${props.section}`, {
          method: 'POST', body, headers: defectFileHeaders(props.user), credentials: 'include',
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Upload failed. Please retry.');
        const attachment: DefectAttachment = result;
        filesRef.current = [...filesRef.current, attachment];
        props.onAttachmentsChange(filesRef.current);
      }
    } catch (cause: any) { setError(cause.message); }
    finally { setBusy(false); }
  }
  async function open(file: DefectAttachment, download: boolean) {
    setError('');
    try {
      const blob = isExternalDefectAttachment(file)
        ? await fetchDefectFile(file.stagedRef
          ? `/technical/api/defects/file-staging/${file.stagedRef}?sessionId=${props.sessionId}&backend=${file.backend}`
          : defectFileUrl(props.defectId!, props.section, file.id), defectFileHeaders(props.user))
        : await (await fetch(file.data)).blob();
      const url = URL.createObjectURL(blob);
      if (download) { const link = document.createElement('a'); link.href = url; link.download = file.name; link.click(); }
      else window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause: any) { setError(cause.message); }
  }
  const copy = {
    'part-a': {
      description: 'Defect photos and attachments.',
      picker: 'defect photos and attachments',
      empty: 'No defect photos or attachments yet',
      hint: 'Upload photos or attachments to document the defect.',
    },
    'part-b': {
      description: 'Rectification documentation.',
      picker: 'rectification documents',
      empty: 'No rectification documents yet',
      hint: 'Upload documentation to support defect rectification.',
    },
    'part-c1': {
      description: 'Closure documents and evidence.',
      picker: 'closure documents',
      empty: 'No closure documents yet',
      hint: 'Upload evidence to support defect closure.',
    },
  }[props.section];
    const formatFileSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };
    return <Dialog open={props.open} onOpenChange={open => { if (!busy) props.onOpenChange(open); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-[500px] max-h-[calc(100dvh-2rem)] min-w-0 overflow-x-hidden overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>
            {copy.description} Changes are committed when you save the defect form.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          {!props.readOnly && <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              multiple
              disabled={busy}
              onChange={event => { void upload(event.target.files); event.target.value = ''; }}
              className="hidden"
              aria-label={`Choose ${copy.picker}`}
            />
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              className="h-20 w-full min-w-0 border-2 border-dashed hover:bg-gray-50"
              aria-label={`${busy ? 'Uploading' : 'Click to upload'} ${copy.picker}`}
            >
              <span className="flex flex-col items-center gap-1">
                <Upload className="h-6 w-6 text-gray-400" aria-hidden="true" />
                <span className="text-sm text-gray-600">{busy ? 'Uploading…' : 'Click to upload files'}</span>
                <span className="text-xs text-gray-400">PDF, JPG, PNG (max 5MB)</span>
              </span>
            </Button>
          </>}

          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

          {props.attachments.length > 0 ? (
            <div className="h-[200px] w-full min-w-0 max-w-full overflow-x-hidden overflow-y-auto rounded-md border p-2">
              <div className="w-full min-w-0 max-w-full space-y-2">
                {props.attachments.map(file => (
                  <div key={file.id} className="grid w-full min-w-0 max-w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border bg-gray-50 p-2 hover:bg-gray-100">
                    <div className="flex-shrink-0" aria-hidden="true">
                      {file.type.startsWith('image/')
                        ? <ImageIcon className="h-8 w-8 text-blue-500" />
                        : <FileText className="h-8 w-8 text-red-500" />}
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p
                        className="max-w-full truncate text-sm font-medium text-gray-900"
                        title={file.name}
                        aria-label={`Attachment filename: ${file.name}`}
                      >{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.size)}
                        {isExternalDefectAttachment(file) && file.stagedRef && <span> · Staged — not saved</span>}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-blue-600"
                        onClick={() => void open(file, false)}
                        aria-label={`View ${file.name}`}
                        title="View"
                      ><Eye className="h-4 w-4" aria-hidden="true" /></Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-blue-600"
                        onClick={() => void open(file, true)}
                        aria-label={`Download ${file.name}`}
                        title="Download"
                      ><Download className="h-4 w-4" aria-hidden="true" /></Button>
                      {!props.readOnly && <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={busy}
                        className="h-8 w-8 text-gray-500 hover:text-red-600"
                        onClick={() => props.onAttachmentsChange(props.attachments.filter(item => item.id !== file.id))}
                        aria-label={`Remove ${file.name}`}
                        title="Remove"
                      ><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-gray-500">
              <FileText className="mx-auto mb-2 h-10 w-10 text-gray-300" aria-hidden="true" />
              <p className="text-sm">{copy.empty}</p>
              {!props.readOnly && <p className="mt-1 text-xs text-gray-400">{copy.hint}</p>}
            </div>
          )}
        </div>

        <div className="flex w-full items-center justify-between">
          <span className="text-sm text-gray-500">
            {props.attachments.length} file{props.attachments.length !== 1 ? 's' : ''} attached
          </span>
          <Button type="button" disabled={busy} onClick={() => props.onOpenChange(false)}>
            {busy ? 'Uploading…' : 'Done'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>;
}
