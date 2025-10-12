import { AuthClient } from '../clients/eden.clients';
import { CacheService } from './cache.service';
import { ForbiddenError } from '@shared/errors/app-errors';


import { TracingDecorator } from '@shared/monitoring/src/tracingDecorator';

@TracingDecorator()
export class OwnershipService {
  constructor(
    private cacheService: CacheService,
    private authClient: AuthClient
  ) { }

  async checkOwnership(params: {
    userId: string;
    ownerId: string;
    ownerType: string;
    permission: 'content' | 'deploy';
    entityId?: string;
  }): Promise<void> {
    const { userId, ownerId, ownerType, permission, entityId = '*' } = params;

    if (ownerType === 'user') {
      if (ownerId !== userId) {
        throw new ForbiddenError('User does not have permission');
      }
    } else if (ownerType === 'company') {
      const companyResponse = await this.cacheService.getCompany({ id: ownerId });
      if (companyResponse.error || !companyResponse.data) {
        throw new ForbiddenError('Failed to get company data');
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
        throw new ForbiddenError('User does not have required company permissions');
      }
    } else {
      throw new ForbiddenError('Invalid owner type');
    }
  }

  async getOwnerWallet(params: {
    user: { id: string; wallet: string };
    ownerId: string;
    ownerType: string;
  }): Promise<string> {
    const { user, ownerId, ownerType } = params;

    if (ownerType === 'user') {
      return user.wallet;
    }

    if (ownerType === 'company') {
      const companyResponse = await this.cacheService.getCompany({ id: ownerId });
      if (companyResponse.error || !companyResponse.data) {
        throw new ForbiddenError('Failed to get company data');
      }

      const ownerResponse = await this.authClient.getUser.post({
        userId: companyResponse.data.ownerId
      });
      if (ownerResponse.error || !ownerResponse.data) {
        throw new ForbiddenError('Failed to get company owner data');
      }

      return ownerResponse.data.wallet;
    }

    throw new ForbiddenError('Invalid owner type');
  }
}