import { ComponentRepository } from "./repositories/componentRepository";
import { ComponentService } from "./services/componentService";
import { ComponentUploadService } from "./services/componentUploadService";
import { DocumentStorageService } from "./services/documentStorageService";
import { ComponentController } from "./controllers/componentController";
import { ComponentUploadController } from "./controllers/componentUploadController";
import { createComponentRouter } from "./routes";

export function createV2ComponentModule() {
  const repository = new ComponentRepository();
  const service = new ComponentService(repository);
  const uploadService = new ComponentUploadService(repository);
  const documentStorage = new DocumentStorageService();
  const controller = new ComponentController(service, documentStorage);
  const uploadController = new ComponentUploadController(uploadService);
  const router = createComponentRouter(controller, uploadController);

  return { router, repository, service, uploadService, documentStorage, controller, uploadController };
}
