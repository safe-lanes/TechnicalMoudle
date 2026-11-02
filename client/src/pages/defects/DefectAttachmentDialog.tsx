import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileAttachmentDialog } from '@/components/FileAttachmentDialog';
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
  const filesRef = useRef(props.attachments);
  filesRef.current = props.attachments;
  // Leave the established inline A/B behavior untouched for incompatible pairs.
  if (!props.externalStorage && !props.attachments.some(isExternalDefectAttachment)) {
    return <FileAttachmentDialog {...props} attachments={props.attachments as any} onAttachmentsChange={props.onAttachmentsChange} />;
  }
  async function upload(files: FileList | null) {
    if (!files || props.readOnly) return;
    setError(''); setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > DEFECT_FILE_BYTES) throw new Error('The maximum file size is 5 MB.');
        let attachment: DefectAttachment;
        if (props.externalStorage) {
          const body = new FormData();
          body.append('file', file); body.append('vesselUuid', props.vesselUuid); body.append('sessionId', props.sessionId);
          const base = props.defectId ? `/technical/api/defects/${encodeURIComponent(String(props.defectId))}` : '/technical/api/defects';
          const response = await fetch(`${base}/file-staging/${props.section}`, {
            method: 'POST', body, headers: defectFileHeaders(props.user), credentials: 'include',
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Upload failed. Please retry.');
          attachment = result;
        } else {
          const data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader(); reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error('The file could not be read.')); reader.readAsDataURL(file);
          });
          attachment = { id: crypto.randomUUID(), name: file.name, size: file.size, type: file.type, data, uploadedAt: new Date().toISOString() };
        }
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
  return <Dialog open={props.open} onOpenChange={open => { if (!busy) props.onOpenChange(open); }}>
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>{props.title}</DialogTitle>
        <DialogDescription>PDF, JPG or PNG. Maximum 5 MB per file. Changes are committed when you save the form.</DialogDescription></DialogHeader>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ul className="max-h-80 overflow-y-auto divide-y">
        {props.attachments.map(file => <li key={file.id} className="py-3 flex gap-2 items-center">
          <div className="min-w-0 flex-1"><p className="break-all text-sm">{file.name}</p>
            <p className="text-xs text-gray-500">{Math.ceil(file.size / 1024)} KB {isExternalDefectAttachment(file) && file.stagedRef ? '· Staged — not saved' : ''}</p></div>
          <Button size="sm" variant="outline" onClick={() => void open(file, false)}>View</Button>
          <Button size="sm" variant="outline" onClick={() => void open(file, true)}>Download</Button>
          {!props.readOnly && <Button disabled={busy} size="sm" variant="outline" onClick={() => props.onAttachmentsChange(props.attachments.filter(item => item.id !== file.id))}>Remove</Button>}
        </li>)}
      </ul>
      {!props.readOnly && <label className="text-sm">Attach files
        <input disabled={busy} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="block mt-2"
          onChange={event => { void upload(event.target.files); event.target.value = ''; }} />
      </label>}
      <Button disabled={busy} type="button" onClick={() => props.onOpenChange(false)}>{busy ? 'Uploading…' : 'Done'}</Button>
    </DialogContent>
  </Dialog>;
}
