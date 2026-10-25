// Job Work Instructions (mig 183) — thin pass-through to storage, like the other PMS repositories.
import { storage } from '../../../storage';
import type { InsertJobWorkInstructionFile, InsertJobWorkInstructionLink } from '@shared/schema';

export async function findJob(id: string) {
  return storage.getJob(id);
}

export async function listVesselFiles(vesselId: string) {
  return storage.getJobWorkInstructionFiles(vesselId);
}

export async function findFile(jwfuuid: string) {
  return storage.getJobWorkInstructionFile(jwfuuid);
}

export async function findFileByName(vesselId: string, fileName: string) {
  return storage.findJobWorkInstructionFileByName(vesselId, fileName);
}

export async function createFile(data: InsertJobWorkInstructionFile) {
  return storage.createJobWorkInstructionFile(data);
}

export async function listLinks(jobId: string, includeRemoved = false) {
  return storage.getJobWorkInstructionLinks(jobId, includeRemoved);
}

export async function findLink(jwluuid: string) {
  return storage.getJobWorkInstructionLink(jwluuid);
}

export async function findActiveLink(jobId: string, fileUuid: string) {
  return storage.findActiveJobWorkInstructionLink(jobId, fileUuid);
}

export async function createLink(data: InsertJobWorkInstructionLink) {
  return storage.createJobWorkInstructionLink(data);
}

export async function setLinkDeleted(jwluuid: string, isDeleted: boolean, actorUuid: string | null) {
  return storage.setJobWorkInstructionLinkDeleted(jwluuid, isDeleted, actorUuid);
}
