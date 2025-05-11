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

export const ControllersPlugin = new Elysia({ name: "Controllers" })
  // Folders controllers
  .use(createFolderController)
  .use(updateFolderController)
  .use(deleteFolderController)
  .use(getFolderController)
  .use(getFoldersController)
  // Documents controllers
  .use(createDocumentController)
  .use(updateDocumentController)
  .use(deleteDocumentController)
  .use(getDocumentController)
  .use(getDocumentsController);