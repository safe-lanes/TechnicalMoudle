import * as formsRepo from '../repositories/formsRepository';
import { ValidationError, NotFoundError } from '../../shared/errors';

// ── Form Definitions ──

export async function seedForms() {
  await formsRepo.seedForms();
}

export async function getFormDefinitions() {
  let forms = await formsRepo.getFormDefinitions();

  // Auto-seed if no forms exist
  if (forms.length === 0) {
    await formsRepo.seedForms();
    forms = await formsRepo.getFormDefinitions();
  }

  // Get latest version for each form
  const formsWithVersions = await Promise.all(
    forms.map(async (form) => {
      const latestVersion = await formsRepo.getLatestPublishedVersion(form.fduuid);
      return {
        ...form,
        versionNo: latestVersion?.versionNo || 0,
        versionDate: latestVersion?.versionDate || null,
        status: latestVersion?.status || 'NO_VERSION'
      };
    })
  );

  return formsWithVersions;
}

// ── Versions ──

export async function getFormVersions(formId: string) {
  return formsRepo.getFormVersions(formId);
}

export async function getFormVersion(versionId: string) {
  const version = await formsRepo.getFormVersion(versionId);
  if (!version) {
    throw new NotFoundError('Version not found');
  }
  return version;
}

export async function createDraftVersion(formId: string, userId: string) {
  const latestPublished = await formsRepo.getLatestPublishedVersion(formId);
  if (!latestPublished) {
    throw new NotFoundError('No published version found to clone');
  }

  const existingVersions = await formsRepo.getFormVersions(formId);
  const existingDraft = existingVersions.find((v: any) => v.status === 'DRAFT');
  if (existingDraft) {
    throw new ValidationError('Draft version already exists');
  }

  return formsRepo.createFormVersion({
    formId: latestPublished.formId,             // Legacy integer reference
    formDefinitionUuid: formId,                  // UUID FK → form_definitions.fduuid
    versionNo: latestPublished.versionNo + 1,
    versionDate: new Date(),
    status: 'DRAFT',
    authorUserId: userId || 'user',
    changelog: null,
    schemaJson: latestPublished.schemaJson
  });
}

export async function updateDraftSchema(versionId: string, schemaJson: any) {
  if (!schemaJson) {
    throw new ValidationError('Schema JSON is required');
  }

  return formsRepo.updateFormVersion(versionId, {
    schemaJson: typeof schemaJson === 'string' ? schemaJson : JSON.stringify(schemaJson)
  });
}

export async function publishVersion(versionId: string, userId: string, changelog: string) {
  if (!changelog) {
    throw new ValidationError('Changelog is required');
  }

  return formsRepo.publishFormVersion(versionId, userId || 'user', changelog);
}

export async function discardVersion(versionId: string) {
  return formsRepo.discardFormVersion(versionId);
}

export async function rollbackToVersion(formId: string, versionId: string, userId: string) {
  const sourceVersion = await formsRepo.getFormVersion(versionId);
  if (!sourceVersion) {
    throw new NotFoundError('Version not found');
  }

  const existingVersions = await formsRepo.getFormVersions(formId);
  const existingDraft = existingVersions.find((v: any) => v.status === 'DRAFT');
  if (existingDraft) {
    throw new ValidationError('Draft version already exists');
  }

  const latestVersion = existingVersions[0];
  const newVersionNo = latestVersion ? latestVersion.versionNo + 1 : 1;

  return formsRepo.createFormVersion({
    formId: sourceVersion.formId,               // Legacy integer reference
    formDefinitionUuid: formId,                  // UUID FK → form_definitions.fduuid
    versionNo: newVersionNo,
    versionDate: new Date(),
    status: 'DRAFT',
    authorUserId: userId || 'user',
    changelog: `Rollback from version ${sourceVersion.versionNo}`,
    schemaJson: sourceVersion.schemaJson
  });
}

// ── Runtime ──

export async function getRuntimeSchema(name: string, module: string) {
  const version = await formsRepo.getLatestPublishedVersionByName(name);
  if (!version) {
    throw new NotFoundError('No published version found');
  }

  await formsRepo.createFormVersionUsage({
    formVersionId: version.id,            // Legacy integer reference
    formVersionUuid: version.fvuuid,      // UUID FK → form_versions.fvuuid
    usedInModule: module || 'unknown',
    usedAt: new Date()
  });

  return {
    versionId: version.fvuuid,
    versionNo: version.versionNo,
    schema: JSON.parse(version.schemaJson)
  };
}
