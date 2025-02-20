import { TaskQueue, TaskQueueConfig, Task } from './task-queue';
import { logger } from '../utils/structured-logger';
import { metrics } from '../utils/monitoring';

export interface WorkflowStep<T = any, R = any> {
  name: string;
  service: string;
  data: T;
  result?: R;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: Error;
  startTime?: number;
  endTime?: number;
}

export interface Workflow<T = any> {
  id: string;
  type: string;
  steps: WorkflowStep[];
  currentStep: number;
  data: T;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  error?: Error;
}

export interface WorkflowQueueConfig extends TaskQueueConfig {
  serviceName: string;
}

export class WorkflowQueue extends TaskQueue {
  private readonly serviceName: string;

  constructor(config: WorkflowQueueConfig) {
    super({
      ...config,
      queueName: `workflow.${config.serviceName}`,
    });
    this.serviceName = config.serviceName;
  }

  async startWorkflow<T>(
    workflowType: string,
    data: T,
    steps: Omit<WorkflowStep, 'status' | 'startTime' | 'endTime'>[]
  ): Promise<string> {
    const workflow: Workflow<T> = {
      id: Math.random().toString(36).substring(7),
      type: workflowType,
      steps: steps.map(step => ({
        ...step,
        status: 'pending',
      })),
      currentStep: 0,
      data,
      status: 'pending',
      startTime: Date.now(),
    };

    try {
      await this.publishTask({
        id: workflow.id,
        type: 'workflow.start',
        data: workflow,
      });

      metrics.increment('workflow_started', {
        type: workflowType,
        service: this.serviceName,
      });

      logger.info('Workflow started', {
        workflowId: workflow.id,
        type: workflowType,
        steps: steps.length,
      });

      return workflow.id;
    } catch (error) {
      logger.error('Failed to start workflow', {
        error,
        type: workflowType,
      });
      throw error;
    }
  }

  async handleWorkflowStep<T = any, R = any>(
    stepName: string,
    handler: (data: T) => Promise<R>
  ): Promise<void> {
    await this.consumeTasks(async (task: Task<Workflow>) => {
      const workflow = task.data;
      const currentStep = workflow.steps[workflow.currentStep];

      // Проверяем, что это наш шаг и сервис
      if (currentStep.name !== stepName || currentStep.service !== this.serviceName) {
        // Пропускаем шаг, если он не для нас
        return;
      }

      metrics.increment('workflow_step_started', {
        workflow: workflow.type,
        step: stepName,
        service: this.serviceName,
      });

      const startTime = Date.now();
      currentStep.startTime = startTime;
      currentStep.status = 'processing';

      try {
        // Выполняем обработчик шага
        const result = await handler(currentStep.data);
        
        // Обновляем информацию о шаге
        currentStep.result = result;
        currentStep.status = 'completed';
        currentStep.endTime = Date.now();

        // Переходим к следующему шагу
        workflow.currentStep++;

        if (workflow.currentStep >= workflow.steps.length) {
          // Рабочий процесс завершен
          workflow.status = 'completed';
          workflow.endTime = Date.now();

          metrics.increment('workflow_completed', {
            type: workflow.type,
            service: this.serviceName,
          });

          const duration = workflow.endTime - workflow.startTime;
          metrics.gauge('workflow_duration', duration, {
            type: workflow.type,
            service: this.serviceName,
          });

          logger.info('Workflow completed', {
            workflowId: workflow.id,
            type: workflow.type,
            duration,
          });
        } else {
          // Публикуем задачу для следующего шага
          const nextStep = workflow.steps[workflow.currentStep];
          await this.publishTask({
            id: `${workflow.id}.${workflow.currentStep}`,
            type: `workflow.${nextStep.service}`,
            data: workflow,
          });

          metrics.increment('workflow_step_completed', {
            workflow: workflow.type,
            step: stepName,
            service: this.serviceName,
          });

          logger.debug('Workflow step completed', {
            workflowId: workflow.id,
            step: stepName,
            nextStep: nextStep.name,
          });
        }
      } catch (error: any) {
        // Обработка ошибки шага
        currentStep.status = 'failed';
        currentStep.error = error;
        currentStep.endTime = Date.now();

        workflow.status = 'failed';
        workflow.error = error;
        workflow.endTime = Date.now();

        metrics.increment('workflow_step_failed', {
          workflow: workflow.type,
          step: stepName,
          service: this.serviceName,
        });

        logger.error('Workflow step failed', {
          error,
          workflowId: workflow.id,
          step: stepName,
        });

        throw error; // Пробрасываем ошибку для ретрая
      }
    }, {
      taskType: `workflow.${this.serviceName}`,
    });

    logger.info('Workflow step handler registered', {
      step: stepName,
      service: this.serviceName,
    });
  }

  async getWorkflowStatus(workflowId: string): Promise<Workflow | null> {
    // В реальном приложении здесь был бы запрос к хранилищу
    // Сейчас это заглушка для демонстрации интерфейса
    logger.info('Getting workflow status', { workflowId });
    return null;
  }
}
