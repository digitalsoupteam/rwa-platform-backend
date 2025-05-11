import { Elysia } from "elysia";
import { createAssistantController } from "../controllers/createAssistant.controller";
import { updateAssistantController } from "../controllers/updateAssistant.controller";
import { getAssistantController } from "../controllers/getAssistant.controller";
import { getUserAssistantsController } from "../controllers/getUserAssistants.controller";
import { createMessageController } from "../controllers/createMessage.controller";
import { getMessageHistoryController } from "../controllers/getMessageHistory.controller";
import { getMessageController } from "../controllers/getMessage.controller";
import { deleteMessageController } from "../controllers/deleteMessage.controller";
import { updateMessageController } from "../controllers/updateMessage.controller";
import { deleteAssistantController } from "../controllers/deleteAssistant.controller";

export const ControllersPlugin = new Elysia({ name: "Controllers" })
  .use(createAssistantController)
  .use(updateAssistantController)
  .use(deleteAssistantController)
  .use(getAssistantController)
  .use(getUserAssistantsController)
  .use(createMessageController)
  .use(getMessageHistoryController)
  .use(getMessageController)
  .use(deleteMessageController)
  .use(updateMessageController);