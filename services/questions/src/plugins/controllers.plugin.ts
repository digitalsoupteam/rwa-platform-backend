import { Elysia } from "elysia";

// Topics controllers
import { createTopicController } from "../controllers/topics/createTopic.controller";
import { updateTopicController } from "../controllers/topics/updateTopic.controller";
import { deleteTopicController } from "../controllers/topics/deleteTopic.controller";
import { getTopicController } from "../controllers/topics/getTopic.controller";
import { getTopicsController } from "../controllers/topics/getTopics.controller";

// Questions controllers
import { createQuestionController } from "../controllers/questions/createQuestion.controller";
import { updateQuestionTextController } from "../controllers/questions/updateQuestionText.controller";
import { createQuestionAnswerController } from "../controllers/questions/createQuestionAnswer.controller";
import { updateQuestionAnswerController } from "../controllers/questions/updateQuestionAnswer.controller";
import { deleteQuestionController } from "../controllers/questions/deleteQuestion.controller";
import { getQuestionController } from "../controllers/questions/getQuestion.controller";
import { getQuestionsController } from "../controllers/questions/getQuestions.controller";
import { toggleQuestionLikeController } from "../controllers/questions/toggleQuestionLike.controller";

export const ControllersPlugin = new Elysia({ name: "Controllers" })
  // Topics routes
  .use(createTopicController)
  .use(updateTopicController)
  .use(deleteTopicController)
  .use(getTopicController)
  .use(getTopicsController)
  // Questions routes
  .use(createQuestionController)
  .use(updateQuestionTextController)
  .use(createQuestionAnswerController)
  .use(updateQuestionAnswerController)
  .use(deleteQuestionController)
  .use(getQuestionController)
  .use(getQuestionsController)
  .use(toggleQuestionLikeController);