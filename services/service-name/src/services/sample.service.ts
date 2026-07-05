import { ethers } from 'ethers';
import { AppError } from '@shared/errors/app-errors';
import { SampleRepository } from '../repositories/sample.repository';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { setSpanAttributes } from '@shared/monitoring/src/tracing';

export class SampleService {
  constructor(private readonly sampleRepository: SampleRepository) {}

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ name: a[0].name }),
  })
  async process(data: { name: string }) {
    setSpanAttributes({ name: data.name });

    const existing = await this.sampleRepository.findAll();
    // Business logic here

    const created = await this.sampleRepository.create(data);
    return {
      id: created._id.toString(),
      name: created.name,
      createdAt: created.createdAt,
    };
  }
}
