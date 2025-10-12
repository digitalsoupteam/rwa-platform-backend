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
import { withTraceSync } from "@shared/monitoring/src/tracing";
import type { ServicesPlugin } from "./services.plugin";

export const createControllersPlugin = (servicesPlugin: ServicesPlugin) => {
  const createAssistantCtrl = withTraceSync(
    'ai-assistant.init.controllers.create_assistant',
    () => createAssistantController(servicesPlugin)
  );

  const updateAssistantCtrl = withTraceSync(
    'ai-assistant.init.controllers.update_assistant',
    () => updateAssistantController(servicesPlugin)
  );

  const deleteAssistantCtrl = withTraceSync(
    'ai-assistant.init.controllers.delete_assistant',
    () => deleteAssistantController(servicesPlugin)
  );

  const getAssistantCtrl = withTraceSync(
    'ai-assistant.init.controllers.get_assistant',
    () => getAssistantController(servicesPlugin)
  );

  const getUserAssistantsCtrl = withTraceSync(
    'ai-assistant.init.controllers.get_user_assistants',
    () => getUserAssistantsController(servicesPlugin)
  );

  const createMessageCtrl = withTraceSync(
    'ai-assistant.init.controllers.create_message',
    () => createMessageController(servicesPlugin)
  );

  const getMessageHistoryCtrl = withTraceSync(
    'ai-assistant.init.controllers.get_message_history',
    () => getMessageHistoryController(servicesPlugin)
  );

  const getMessageCtrl = withTraceSync(
    'ai-assistant.init.controllers.get_message',
    () => getMessageController(servicesPlugin)
  );

  const deleteMessageCtrl = withTraceSync(
    'ai-assistant.init.controllers.delete_message',
    () => deleteMessageController(servicesPlugin)
  );

  const updateMessageCtrl = withTraceSync(
    'ai-assistant.init.controllers.update_message',
    () => updateMessageController(servicesPlugin)
  );

  const plugin = withTraceSync(
    'ai-assistant.init.controllers.plugin',
    () => new Elysia({ name: "Controllers" })
      .use(createAssistantCtrl)
      .use(updateAssistantCtrl)
      .use(deleteAssistantCtrl)
      .use(getAssistantCtrl)
      .use(getUserAssistantsCtrl)
      .use(createMessageCtrl)
      .use(getMessageHistoryCtrl)
      .use(getMessageCtrl)
      .use(deleteMessageCtrl)
      .use(updateMessageCtrl)
  );

  return plugin;
}

export type ControllersPlugin = ReturnType<typeof createControllersPlugin>