import { logger } from '@shared/monitoring/src/logger';
import { RwaClient } from '../clients/eden.clients';


export class ParentService {
  constructor(private rwaClient: RwaClient) {}

  public async getParentInfo(type: string, parentId: string, userId: string) {
    let grandParentId: string;
    let ownerId: string;
    let ownerType: string;

    if (type === 'business') {
      const businessResponse = await this.rwaClient.getBusiness.post({
        id: parentId
      });

      if (businessResponse.error) {
        logger.error('Failed to get business:', businessResponse.error);
        throw new Error('Failed to get business data');
      }

      const business = businessResponse.data;

      grandParentId = business.id;
      ownerId = business.ownerId;
      ownerType = business.ownerType;

    } else if (type === 'pool') {
      const poolResponse = await this.rwaClient.getPool.post({
        id: parentId
      });

      if (poolResponse.error) {
        logger.error('Failed to get pool:', poolResponse.error);
        throw new Error('Failed to get pool data');
      }

      const pool = poolResponse.data;

      grandParentId = pool.businessId;
      ownerId = pool.ownerId;
      ownerType = pool.ownerType;
    } else if(type == 'user'){
      if(parentId != userId) {
        throw new Error('User type not equal parentId and userId');
      }
      grandParentId = parentId;
      ownerId = parentId;
      ownerType = 'user';
    } else {
      throw new Error('Invalid parent type');
    }

    return {
      grandParentId,
      ownerId,
      ownerType
    };
  }
}