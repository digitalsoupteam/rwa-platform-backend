import { Elysia } from "elysia";
import { createFolderController } from "../controllers/folders/createFolder.controller";
import { updateFolderController } from "../controllers/folders/updateFolder.controller";
import { deleteFolderController } from "../controllers/folders/deleteFolder.controller";
import { getFolderController } from "../controllers/folders/getFolder.controller";
import { getFoldersController } from "../controllers/folders/getFolders.controller";
import { createDocumentController } from "../controllers/documents/createDocument.controller";
import { updateDocumentController } from "../controllers/folders/updateDocument.controller";
import { deleteDocumentController } from "../controllers/documents/deleteDocument.controller";
import { getDocumentController } from "../controllers/documents/getDocument.controller";
import { getDocumentsController } from "../controllers/documents/getDocuments.controller";
import { withTraceSync } from "@shared/monitoring/src/tracing";
import { ServicesPlugin } from "./services.plugin";

export const createControllersPlugin = (servicesPlugin: ServicesPlugin) => {
  const createFolderCtrl = withTraceSync(
    'documents.init.controllers.create_folder',
    () => createFolderController(servicesPlugin)
  );

  const updateFolderCtrl = withTraceSync(
    'documents.init.controllers.update_folder',
    () => updateFolderController(servicesPlugin)
  );

  const deleteFolderCtrl = withTraceSync(
    'documents.init.controllers.delete_folder',
    () => deleteFolderController(servicesPlugin)
  );

  const getFolderCtrl = withTraceSync(
    'documents.init.controllers.get_folder',
    () => getFolderController(servicesPlugin)
  );

  const getFoldersCtrl = withTraceSync(
    'documents.init.controllers.get_folders',
    () => getFoldersController(servicesPlugin)
  );

  const createDocumentCtrl = withTraceSync(
    'documents.init.controllers.create_document',
    () => createDocumentController(servicesPlugin)
  );

  const updateDocumentCtrl = withTraceSync(
    'documents.init.controllers.update_document',
    () => updateDocumentController(servicesPlugin)
  );

  const deleteDocumentCtrl = withTraceSync(
    'documents.init.controllers.delete_document',
    () => deleteDocumentController(servicesPlugin)
  );

  const getDocumentCtrl = withTraceSync(
    'documents.init.controllers.get_document',
    () => getDocumentController(servicesPlugin)
  );

  const getDocumentsCtrl = withTraceSync(
    'documents.init.controllers.get_documents',
    () => getDocumentsController(servicesPlugin)
  );

  const plugin = withTraceSync(
    'documents.init.controllers.plugin',
    () => new Elysia({ name: "Controllers" })
      .use(createFolderCtrl)
      .use(updateFolderCtrl)
      .use(deleteFolderCtrl)
      .use(getFolderCtrl)
      .use(getFoldersCtrl)
      .use(createDocumentCtrl)
      .use(updateDocumentCtrl)
      .use(deleteDocumentCtrl)
      .use(getDocumentCtrl)
      .use(getDocumentsCtrl)
  );

  return plugin;
}

export type ControllersPlugin = ReturnType<typeof createControllersPlugin>