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
import { withTraceSync } from "@shared/monitoring/src/tracing";
import type { ServicesPlugin } from "./services.plugin";

export const createControllersPlugin = (servicesPlugin: ServicesPlugin) => {
  const createTopicCtrl = withTraceSync(
    'questions.init.controllers.create_topic',
    () => createTopicController(servicesPlugin)
  );

  const updateTopicCtrl = withTraceSync(
    'questions.init.controllers.update_topic',
    () => updateTopicController(servicesPlugin)
  );

  const deleteTopicCtrl = withTraceSync(
    'questions.init.controllers.delete_topic',
    () => deleteTopicController(servicesPlugin)
  );

  const getTopicCtrl = withTraceSync(
    'questions.init.controllers.get_topic',
    () => getTopicController(servicesPlugin)
  );

  const getTopicsCtrl = withTraceSync(
    'questions.init.controllers.get_topics',
    () => getTopicsController(servicesPlugin)
  );

  const createQuestionCtrl = withTraceSync(
    'questions.init.controllers.create_question',
    () => createQuestionController(servicesPlugin)
  );

  const updateQuestionTextCtrl = withTraceSync(
    'questions.init.controllers.update_question_text',
    () => updateQuestionTextController(servicesPlugin)
  );

  const createQuestionAnswerCtrl = withTraceSync(
    'questions.init.controllers.create_question_answer',
    () => createQuestionAnswerController(servicesPlugin)
  );

  const updateQuestionAnswerCtrl = withTraceSync(
    'questions.init.controllers.update_question_answer',
    () => updateQuestionAnswerController(servicesPlugin)
  );

  const deleteQuestionCtrl = withTraceSync(
    'questions.init.controllers.delete_question',
    () => deleteQuestionController(servicesPlugin)
  );

  const getQuestionCtrl = withTraceSync(
    'questions.init.controllers.get_question',
    () => getQuestionController(servicesPlugin)
  );

  const getQuestionsCtrl = withTraceSync(
    'questions.init.controllers.get_questions',
    () => getQuestionsController(servicesPlugin)
  );

  const toggleQuestionLikeCtrl = withTraceSync(
    'questions.init.controllers.toggle_question_like',
    () => toggleQuestionLikeController(servicesPlugin)
  );

  const plugin = withTraceSync(
    'questions.init.controllers.plugin',
    () => new Elysia({ name: "Controllers" })
      .use(createTopicCtrl)
      .use(updateTopicCtrl)
      .use(deleteTopicCtrl)
      .use(getTopicCtrl)
      .use(getTopicsCtrl)
      .use(createQuestionCtrl)
      .use(updateQuestionTextCtrl)
      .use(createQuestionAnswerCtrl)
      .use(updateQuestionAnswerCtrl)
      .use(deleteQuestionCtrl)
      .use(getQuestionCtrl)
      .use(getQuestionsCtrl)
      .use(toggleQuestionLikeCtrl)
  );

  return plugin;
}

export type ControllersPlugin = ReturnType<typeof createControllersPlugin>