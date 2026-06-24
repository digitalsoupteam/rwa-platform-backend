import type { AuthClient } from '../clients/eden.clients';
import { CacheService } from './cache.service';
import { AppError } from '@shared/errors/app-errors';

import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { setSpanAttributes } from '@shared/monitoring/src/tracing';


export class OwnershipService {
  constructor(
    private cacheService: CacheService,
    private authClient: AuthClient
  ) { }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['params'] })
  async checkOwnership(params: {
    userId: string;
    ownerId: string;
    ownerType: string;
    permission: 'content' | 'deploy';
    entityId?: string;
  }): Promise<void> {
    setSpanAttributes({
      userId: params.userId,
      entityType: params.ownerType,
      ...(params.entityId !== undefined && { entityId: params.entityId }),
    });
    const { userId, ownerId, ownerType, permission, entityId = '*' } = params;

    if (ownerType === 'user') {
      if (ownerId !== userId) {
        throw new AppError({ message: 'User does not have permission', statusCode: 403, code: 'FORBIDDEN' });
      }
    } else if (ownerType === 'company') {
      const companyResponse = await this.cacheService.getCompany({ id: ownerId });
      if (companyResponse.error || !companyResponse.data) {
        throw new AppError({ message: 'Failed to get company data', statusCode: 403, code: 'FORBIDDEN' });
      }

      const company = companyResponse.data

      let hasPermission: boolean
      if (userId === company.ownerId) {
        hasPermission = true;
      } else {
        const user = company.users.find(u => u.userId === userId);
        if (!user) {
          hasPermission = false;
        } else {
          hasPermission = user.permissions.some(p =>
            p.permission === permission &&
            (p.entity === '*' || p.entity === entityId)
          );
        }
      }

      if (!hasPermission) {
        throw new AppError({ message: 'User does not have required company permissions', statusCode: 403, code: 'FORBIDDEN' });
      }
    } else {
      throw new AppError({ message: 'Invalid owner type', statusCode: 403, code: 'FORBIDDEN' });
    }
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['params'] })
  async getOwnerWallet(params: {
    user: { id: string; wallet: string };
    ownerId: string;
    ownerType: string;
  }): Promise<string> {
    setSpanAttributes({
      userId: params.user.id,
      wallet: params.user.wallet,
      entityType: params.ownerType,
    });
    const { user, ownerId, ownerType } = params;

    if (ownerType === 'user') {
      return user.wallet;
    }

    if (ownerType === 'company') {
      const companyResponse = await this.cacheService.getCompany({ id: ownerId });
      if (companyResponse.error || !companyResponse.data) {
        throw new AppError({ message: 'Failed to get company data', statusCode: 403, code: 'FORBIDDEN' });
      }

      const ownerResponse = await this.authClient.getUser.post({
        userId: companyResponse.data.ownerId
      });
      if (ownerResponse.error || !ownerResponse.data) {
        throw new AppError({ message: 'Failed to get company owner data', statusCode: 403, code: 'FORBIDDEN' });
      }

      return ownerResponse.data.wallet;
    }

    throw new ForbiddenError('Invalid owner type');
  }
}