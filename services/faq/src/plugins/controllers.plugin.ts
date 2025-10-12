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
import { withTraceSync } from "@shared/monitoring/src/tracing";
import { ServicesPlugin } from "./services.plugin";

export const createControllersPlugin = (servicesPlugin: ServicesPlugin) => {
  const createTopicCtrl = withTraceSync(
    'faq.init.controllers.create_topic',
    () => createTopicController(servicesPlugin)
  );

  const updateTopicCtrl = withTraceSync(
    'faq.init.controllers.update_topic',
    () => updateTopicController(servicesPlugin)
  );

  const deleteTopicCtrl = withTraceSync(
    'faq.init.controllers.delete_topic',
    () => deleteTopicController(servicesPlugin)
  );

  const getTopicCtrl = withTraceSync(
    'faq.init.controllers.get_topic',
    () => getTopicController(servicesPlugin)
  );

  const getTopicsCtrl = withTraceSync(
    'faq.init.controllers.get_topics',
    () => getTopicsController(servicesPlugin)
  );

  const createAnswerCtrl = withTraceSync(
    'faq.init.controllers.create_answer',
    () => createAnswerController(servicesPlugin)
  );

  const updateAnswerCtrl = withTraceSync(
    'faq.init.controllers.update_answer',
    () => updateAnswerController(servicesPlugin)
  );

  const deleteAnswerCtrl = withTraceSync(
    'faq.init.controllers.delete_answer',
    () => deleteAnswerController(servicesPlugin)
  );

  const getAnswerCtrl = withTraceSync(
    'faq.init.controllers.get_answer',
    () => getAnswerController(servicesPlugin)
  );

  const getAnswersCtrl = withTraceSync(
    'faq.init.controllers.get_answers',
    () => getAnswersController(servicesPlugin)
  );

  const plugin = withTraceSync(
    'faq.init.controllers.plugin',
    () => new Elysia({ name: "Controllers" })
      .use(createTopicCtrl)
      .use(updateTopicCtrl)
      .use(deleteTopicCtrl)
      .use(getTopicCtrl)
      .use(getTopicsCtrl)
      .use(createAnswerCtrl)
      .use(updateAnswerCtrl)
      .use(deleteAnswerCtrl)
      .use(getAnswerCtrl)
      .use(getAnswersCtrl)
  );

  return plugin;
}

export type ControllersPlugin = ReturnType<typeof createControllersPlugin>