import { Elysia } from "elysia";
import {
  updateMessageRequest,
  updateMessageResponse,
} from "../models/validation/message.validation";
import type { ServicesPlugin } from "../plugins/services.plugin";

export const updateMessageController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "UpdateMessageController" })
    .use(servicesPlugin)
    .post(
      "/updateMessage",
      async ({ body, messageService }) => {
        const message = await messageService.updateMessage(body.id, {
          text: body.text,
        });

        return message;
      },
      {
        body: updateMessageRequest,
        response: updateMessageResponse,
      }
    );
};