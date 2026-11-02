import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { getCurrentTenantContext } from '../../../utils/asyncLocalStorage';
import { objectStorageClient } from '../../../objectStorage';
import { validateDefectFileKey } from '@shared/defectAttachments';

export const fileHash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
/** No path fallback: the committed metadata selects exactly one backend. */
export class DefectFileStore {
  constructor(private root = path.resolve(process.cwd(), '.private')) {}
  backend(): 'object' | 'local' {
    return process.env.PRIVATE_OBJECT_DIR || process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ? 'object' : 'local';
  }
  private location(key: string, staging = false) {
    if (staging) {
      if (!/^[a-f0-9]{64}\/[a-f0-9-]{36}\.(json|bin)$/.test(key)) throw new Error('Invalid staging identity.');
    } else validateDefectFileKey(key);
    const tenant = getCurrentTenantContext()?.tuid;
    const prefix = tenant ? `tenants/${createHash('sha256').update(tenant).digest('hex')}` : '';
    return path.join(prefix, staging ? 'defect-docs-staging' : 'defect-docs', key);
  }
  private object(relative: string) {
    const root = process.env.PRIVATE_OBJECT_DIR;
    if (root) {
      const [bucket, ...prefix] = root.replace(/^\/+/, '').split('/');
      return objectStorageClient.bucket(bucket).file([...prefix, relative].filter(Boolean).join('/'));
    }
    const bucket = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucket) throw new Error('Private defect storage is not configured.');
    return objectStorageClient.bucket(bucket).file(`.private/${relative}`);
  }
  async write(key: string, bytes: Buffer, backend: string, staging = false) {
    if (!['local', 'object'].includes(backend)) throw new Error('Unknown defect storage backend.');
    const relative = this.location(key, staging);
    if (backend === 'object') {
      // Atomic object creation; never overwrite a committed object.
      await this.object(relative).save(bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 } });
    } else {
      const target = path.join(this.root, relative);
      await fs.mkdir(path.dirname(target), { recursive: true });
      const temporary = `${target}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 });
        await fs.link(temporary, target); // atomic creation, never replaces existing bytes
      } finally { await fs.unlink(temporary).catch(() => {}); }
    }
  }
  async read(key: string, backend: string, staging = false): Promise<Buffer> {
    if (!['local', 'object'].includes(backend)) throw new Error('Unknown defect storage backend.');
    const relative = this.location(key, staging);
    if (backend === 'object') return (await this.object(relative).download())[0];
    return fs.readFile(path.join(this.root, relative));
  }
  async remove(key: string, backend: string, staging = false) {
    if (!['local', 'object'].includes(backend)) throw new Error('Unknown defect storage backend.');
    const relative = this.location(key, staging);
    if (backend === 'object') await this.object(relative).delete({ ignoreNotFound: true });
    else await fs.unlink(path.join(this.root, relative)).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
  async manifests(backend: string): Promise<string[]> {
    if (backend === 'object') {
      const marker = this.object(this.location(`${'0'.repeat(64)}/${'0'.repeat(36)}.json`, true).replace(/0{64}\/0{36}\.json$/, ''));
      const [files] = await marker.bucket.getFiles({ prefix: marker.name });
      return files.map(file => file.name.slice(marker.name.length)).filter(key => key.endsWith('.json'));
    }
    const base = path.dirname(path.dirname(path.join(this.root, this.location(`${'0'.repeat(64)}/${'0'.repeat(36)}.json`, true))));
    const tenants = await fs.readdir(base).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
    const result: string[] = [];
    for (const tenant of tenants) {
      if (!/^[a-f0-9]{64}$/.test(tenant)) continue;
      for (const file of await fs.readdir(path.join(base, tenant))) if (file.endsWith('.json')) result.push(`${tenant}/${file}`);
    }
    return result;
  }
}
export const defectFileStore = new DefectFileStore();
