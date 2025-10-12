import { Elysia } from "elysia";
import { setReactionController } from "../controllers/setReaction.controller";
import { resetReactionController } from "../controllers/resetReaction.controller";
import { getEntityReactionsController } from "../controllers/getEntityReactions.controller";
import { getReactionsController } from "../controllers/getReactions.controller";
import { withTraceSync } from "@shared/monitoring/src/tracing";
import { ServicesPlugin } from "./services.plugin";

export const createControllersPlugin = (servicesPlugin: ServicesPlugin) => {
  const setReactionCtrl = withTraceSync(
    'reactions.init.controllers.set_reaction',
    () => setReactionController(servicesPlugin)
  );

  const resetReactionCtrl = withTraceSync(
    'reactions.init.controllers.reset_reaction',
    () => resetReactionController(servicesPlugin)
  );

  const getEntityReactionsCtrl = withTraceSync(
    'reactions.init.controllers.get_entity_reactions',
    () => getEntityReactionsController(servicesPlugin)
  );

  const getReactionsCtrl = withTraceSync(
    'reactions.init.controllers.get_reactions',
    () => getReactionsController(servicesPlugin)
  );

  const plugin = withTraceSync(
    'reactions.init.controllers.plugin',
    () => new Elysia({ name: "Controllers" })
      .use(setReactionCtrl)
      .use(resetReactionCtrl)
      .use(getEntityReactionsCtrl)
      .use(getReactionsCtrl)
  );

  return plugin;
}

export type ControllersPlugin = ReturnType<typeof createControllersPlugin>