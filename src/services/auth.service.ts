import { ethers } from 'ethers';
import jwt, { SignOptions } from 'jsonwebtoken';
import { User, UserDocument } from '../models';
import { KYCStatus, UserRole } from '../types/enums';
import { APIError } from '../errors/api.error';

interface JWTPayload {
  address: string;
  role: UserRole;
  nonce: string;
}

interface KYCDocument {
  type: string;
  hash: string;
}

export class AuthService {
  private readonly JWT_SECRET: string;
  private readonly JWT_EXPIRES_IN: number;

  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    this.JWT_EXPIRES_IN = parseInt(process.env.JWT_EXPIRES_IN || '86400'); // 24 часа в секундах
  }

  /**
   * Генерация случайного nonce для подписи сообщения
   */
  public generateNonce(): string {
    return Buffer.from(ethers.randomBytes(32)).toString('hex');
  }

  /**
   * Проверка подписи сообщения
   */
  public verifySignature(message: string, signature: string, address: string): boolean {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        throw new APIError(400, 'Invalid signature');
      }
      return true;
    } catch (error) {
      throw new APIError(400, 'Invalid signature format');
    }
  }

  public async verifyAuth(
    address: string,
    signature: string,
    nonce: string
  ): Promise<UserDocument> {
    const user = await User.findOne({ address: address.toLowerCase() });
    if (!user) {
      throw new APIError(404, 'User not found');
    }

    if (user.nonce !== nonce) {
      throw new APIError(400, 'Invalid nonce');
    }

    const message = `Welcome to RWA Protocol!\nNonce: ${nonce}`;
    this.verifySignature(message, signature, address);

    // Генерируем новый nonce после успешной аутентификации
    user.nonce = this.generateNonce();
    await user.save();

    return user;
  }

  /**
   * Генерация JWT токена
   */
  public async generateToken(user: UserDocument): Promise<string> {
    const payload: JWTPayload = {
      address: user.address,
      role: user.role,
      nonce: user.nonce,
    };

    const options: SignOptions = {
      expiresIn: this.JWT_EXPIRES_IN, // теперь это число
    };

    return new Promise((resolve, reject) => {
      jwt.sign(payload, this.JWT_SECRET, options, (err, token) => {
        if (err) reject(err);
        if (!token) reject(new Error('Token generation failed'));
        resolve(token!);
      });
    });
  }

  /**
   * Верификация JWT токена
   */
  public verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.JWT_SECRET) as JWTPayload;
    } catch (error) {
      throw APIError.Unauthorized('Invalid token');
    }
  }

  /**
   * Подача документов на KYC верификацию
   */
  public async submitKYC(user: UserDocument, documents: KYCDocument[]): Promise<void> {
    // Проверка наличия всех необходимых документов
    const requiredDocuments = ['identity', 'address_proof', 'selfie'];
    const submittedTypes = documents.map((doc) => doc.type);

    const missingDocs = requiredDocuments.filter((doc) => !submittedTypes.includes(doc));
    if (missingDocs.length > 0) {
      throw APIError.BadRequest(`Missing required documents: ${missingDocs.join(', ')}`);
    }

    try {
      // Сохраняем документы и обновляем статус
      await User.findByIdAndUpdate(user._id, {
        $set: {
          'kyc.documents': documents,
          'kyc.status': KYCStatus.PENDING,
          'kyc.submittedAt': new Date(),
        },
      });

      // Отправляем документы в сервис KYC (асинхронно)
      this.processKYCVerification(user.address, documents).catch(console.error);
    } catch (error) {
      throw APIError.Internal('Failed to submit KYC documents');
    }
  }

  /**
   * Обработка KYC верификации (асинхронная)
   */
  private async processKYCVerification(address: string, documents: KYCDocument[]): Promise<void> {
    try {
      // TODO: Интеграция с внешним KYC сервисом
      // Здесь должна быть логика отправки документов в KYC сервис
      // и обработка их ответа

      // Пример асинхронной обработки
      setTimeout(async () => {
        const isApproved = Math.random() > 0.2; // Симуляция проверки

        await User.findOneAndUpdate(
          { address },
          {
            $set: {
              'kyc.status': isApproved ? KYCStatus.APPROVED : KYCStatus.REJECTED,
              'kyc.verifiedAt': new Date(),
              role: isApproved ? UserRole.PRODUCT_OWNER : UserRole.INVESTOR,
            },
          }
        );

        // TODO: Отправка уведомления пользователю о результате проверки
      }, 5000);
    } catch (error) {
      console.error('KYC verification failed:', error);
      // Обновляем статус на REJECTED в случае ошибки
      await User.findOneAndUpdate(
        { address },
        {
          $set: {
            'kyc.status': KYCStatus.REJECTED,
            'kyc.verifiedAt': new Date(),
          },
        }
      );
    }
  }

  /**
   * Проверка роли пользователя
   */
  public async checkRole(address: string, requiredRole: UserRole): Promise<boolean> {
    const user = await User.findOne({ address: address.toLowerCase() });
    if (!user) {
      throw APIError.NotFound('User not found');
    }

    return user.role === requiredRole;
  }

  /**
   * Проверка статуса KYC
   */
  public async checkKYCStatus(address: string): Promise<KYCStatus> {
    const user = await User.findOne({ address: address.toLowerCase() });
    if (!user) {
      throw APIError.NotFound('User not found');
    }
    if (!user.kycStatus) {
      throw APIError.NotFound('KYC status not found');
    }

    return user.kycStatus;
  }
}
