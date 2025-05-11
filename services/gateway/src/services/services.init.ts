import { redisClient } from '../clients/redis.client';
import { authClient, companyClient, rwaClient } from '../clients/eden.clients';
import { CacheService } from './cache.service';
import { OwnershipService } from './ownership.service';
import { ParentService } from './parent.service';

export const cacheService = new CacheService(redisClient, companyClient);
export const ownershipService = new OwnershipService(cacheService, authClient);
export const parentService = new ParentService(rwaClient);