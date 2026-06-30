import { AppError } from '@shared/errors/app-errors';
import type { AuthClient, ApiKeysClient } from '../clients/eden.clients';
import { extractFromToken } from '../utils/jwt.utils';

export class UserResolverService {
  constructor(
    private authClient: AuthClient,
    private apiKeysClient: ApiKeysClient,
  ) {}

  async resolveUser(token: string | null): Promise<{ userId: string; wallet: string } | null> {
    if (!token) return null;

    // 1. Если токен начинается с 'apikey_' — это API-ключ
    if (token.startsWith('apikey_')) {
      const response = await this.apiKeysClient.validateApiKey.post({ apiKey: token });
      if (response.error) {
        // 404 — ключ не найден → null (корректный 401)
        // 500/network — сервис недоступен → 503
        if (Number(response.error.status) < 500) return null;
        throw new AppError({
          message: 'API keys service unavailable',
          statusCode: 503,
          code: 'SERVICE_UNAVAILABLE',
        });
      }
      return { userId: response.data.userId, wallet: response.data.wallet };
    }

    // 2. Иначе — пробуем JWT (sync, без HTTP-вызова)
    return extractFromToken(token);
  }
}
