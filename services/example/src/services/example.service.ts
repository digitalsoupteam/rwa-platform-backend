import { logger } from '@shared/monitoring/src/monitoring.plugin';
import { TracingDecoratorClass } from '@shared/monitoring/src/tracingDecoratorClass';

@TracingDecoratorClass()
export class ExampleService {
  getDefaultGreeting() {
    logger.debug('Returning default greeting');
    return 'Hello, World!';
  }
}
