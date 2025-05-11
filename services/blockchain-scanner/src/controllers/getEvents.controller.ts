import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../plugins/services.plugin";
import {
  getEventsRequest,
  getEventsResponse,
} from "../models/validation/event.validation";

export const getEventsController = new Elysia().use(ServicesPlugin).post(
  "/getEvents",
  async ({ body, blockchainScannerService }) => {
    logger.info(
      `POST /getEvents - Getting events with filters: ${JSON.stringify(body)}`
    );

    const { pagination, ...filters } = body;

    return await blockchainScannerService.getEvents(filters, pagination);
  },
  {
    body: getEventsRequest,
    response: getEventsResponse,
  }
);