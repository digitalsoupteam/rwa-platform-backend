import { Elysia } from "elysia";

import { getEventsController } from "../controllers/getEvents.controller";
import { getEventByIdController } from "../controllers/getEventById.controller";
import type { ServicesPlugin } from "./services.plugin";
import { withTraceSync } from "@shared/monitoring/src/tracing";

export const createControllersPlugin = (servicesPlugin: ServicesPlugin) => {
  const getEventsCtrl = withTraceSync(
    'blockchain-scanner.init.controllers.get_events',
    () => getEventsController(servicesPlugin)
  );

  const getEventByIdCtrl = withTraceSync(
    'blockchain-scanner.init.controllers.get_event_by_id',
    () => getEventByIdController(servicesPlugin)
  );

  const plugin = withTraceSync(
    'blockchain-scanner.init.controllers.plugin',
    () => new Elysia({ name: "Controllers" })
      .use(getEventsCtrl)
      .use(getEventByIdCtrl)
  );

  return plugin;
}

export type ControllersPlugin = ReturnType<typeof createControllersPlugin>