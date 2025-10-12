import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../plugins/services.plugin";
import {
  getEventByIdRequest,
  getEventByIdResponse,
} from "../models/validation/event.validation";

export const getEventByIdController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "GetEventByIdController" })
    .use(servicesPlugin)
    .post(
      "/getEventById",
      async ({ body, blockchainScannerService }) => {
        logger.info(
          `POST /getEventById - Getting event with id: ${body.id}`
        );

        return await blockchainScannerService.getEventById(body.id);
      },
      {
        body: getEventByIdRequest,
        response: getEventByIdResponse,
      }
    );
};
