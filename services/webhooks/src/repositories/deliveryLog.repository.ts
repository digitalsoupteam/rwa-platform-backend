import { DeliveryLogEntity } from '../models/entity/deliveryLog.entity';
import type { IDeliveryLogEntity } from '../models/entity/deliveryLog.entity';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export class DeliveryLogRepository {
  constructor(private readonly model = DeliveryLogEntity) {}

  @TraceDecorator()
  async createDeliveryLog(
    data: Pick<IDeliveryLogEntity, 'endpointId' | 'eventType' | 'eventId' | 'payload'> &
      Partial<Pick<IDeliveryLogEntity, 'status'>>,
  ) {
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  @TraceDecorator()
  async findById(id: string) {
    return await this.model.findById(id).lean();
  }

  @TraceDecorator()
  async findByEndpointId(endpointId: string) {
    return await this.model.find({ endpointId }).sort({ createdAt: -1 }).lean();
  }

  @TraceDecorator()
  async updateStatus(id: string, data: Partial<Pick<IDeliveryLogEntity, 'status' | 'nextRetryAt'>>) {
    return await this.model.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
  }

  @TraceDecorator()
  async pushAttempt(
    id: string,
    attempt: {
      timestamp: number;
      statusCode?: number;
      responseBody?: string;
      error?: string;
    },
  ) {
    return await this.model.findByIdAndUpdate(id, { $push: { attempts: attempt } }, { new: true }).lean();
  }
}
