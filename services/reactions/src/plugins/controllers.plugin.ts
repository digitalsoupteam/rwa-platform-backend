import { Elysia } from "elysia";

import { toggleReactionController } from "../controllers/toggleReaction.controller";
import { getReactionsController } from "../controllers/getReactions.controller";

export const ControllersPlugin = new Elysia({ name: "Controllers" })
  .use(toggleReactionController)
  .use(getReactionsController);