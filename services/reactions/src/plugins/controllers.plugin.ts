import { Elysia } from "elysia";

import { setReactionController } from "../controllers/setReaction.controller";
import { resetReactionController } from "../controllers/resetReaction.controller";
import { getEntityReactionsController } from "../controllers/getEntityReactions.controller";

export const ControllersPlugin = new Elysia({ name: "Controllers" })
  .use(setReactionController)
  .use(resetReactionController)
  .use(getEntityReactionsController);