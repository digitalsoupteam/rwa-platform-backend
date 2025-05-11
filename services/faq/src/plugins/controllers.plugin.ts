import { Elysia } from "elysia";
import { createTopicController } from "../controllers/topics/createTopic.controller";
import { updateTopicController } from "../controllers/topics/updateTopic.controller";
import { deleteTopicController } from "../controllers/topics/deleteTopic.controller";
import { getTopicController } from "../controllers/topics/getTopic.controller";
import { getTopicsController } from "../controllers/topics/getTopics.controller";
import { createAnswerController } from "../controllers/answers/createAnswer.controller";
import { updateAnswerController } from "../controllers/answers/updateAnswer.controller";
import { deleteAnswerController } from "../controllers/answers/deleteAnswer.controller";
import { getAnswerController } from "../controllers/answers/getAnswer.controller";
import { getAnswersController } from "../controllers/answers/getAnswers.controller";

export const ControllersPlugin = new Elysia({ name: "Controllers" })
  // Topics controllers
  .use(createTopicController)
  .use(updateTopicController)
  .use(deleteTopicController)
  .use(getTopicController)
  .use(getTopicsController)
  // Answers controllers
  .use(createAnswerController)
  .use(updateAnswerController)
  .use(deleteAnswerController)
  .use(getAnswerController)
  .use(getAnswersController);