import { storage } from '../../../storage';

export async function getFormDefinitions() {
  return storage.getFormDefinitions();
}

export async function seedForms() {
  if (storage.seedForms) {
    await storage.seedForms();
  }
}

export async function getLatestPublishedVersion(formId: string) {
  return storage.getLatestPublishedVersion(formId);
}

export async function getLatestPublishedVersionByName(name: string) {
  return storage.getLatestPublishedVersionByName(name);
}

export async function getFormVersions(formId: string) {
  return storage.getFormVersions(formId);
}

export async function getFormVersion(versionId: string) {
  return storage.getFormVersion(versionId);
}

export async function createFormVersion(data: any) {
  return storage.createFormVersion(data);
}

export async function updateFormVersion(versionId: string, data: any) {
  return storage.updateFormVersion(versionId, data);
}

export async function publishFormVersion(versionId: string, userId: string, changelog: string) {
  return storage.publishFormVersion(versionId, userId, changelog);
}

export async function discardFormVersion(versionId: string) {
  return storage.discardFormVersion(versionId);
}

export async function createFormVersionUsage(data: any) {
  return storage.createFormVersionUsage(data);
}
