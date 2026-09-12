import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { AppError } from '@shared/errors/app-errors';
import { UserRepository } from '../repositories/user.repository';
import { RefreshTokenRepository } from '../repositories/refreshToken.repository';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { setSpanAttributes } from '@shared/monitoring/src/tracing';
import { metrics } from '@shared/monitoring/src/metrics';

export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly jwtSecret: string,
    private readonly accessTokenExpiry: jwt.SignOptions['expiresIn'],
    private readonly refreshTokenExpiry: jwt.SignOptions['expiresIn'],
    private readonly domainName: string,
    private readonly domainVersion: string,
  ) {}

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({
      wallet: a[0].wallet,
      timestamp: a[0].timestamp,
    }),
  })
  async authenticate(data: { wallet: string; signature: string; timestamp: number }) {
    setSpanAttributes({ wallet: data.wallet });

    // Check timestamp is within 1 minute of server time
    const now = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(now - data.timestamp);

    if (timeDiff > 60) {
      throw new AppError({
        message: 'Timestamp is too far from server time',
        statusCode: 401,
        code: 'AUTHENTICATION_ERROR',
      });
    }

    // Build EIP-712 message object
    const message = {
      wallet: data.wallet,
      timestamp: data.timestamp,
      message: `Welcome to RWA Platform!\n\nWe prioritize the security of your assets and personal data. To ensure secure access to your account, we kindly request you to verify ownership of your wallet by signing this message.`,
    };

    // Verify signature using EIP-712
    const isValid = this.verifySignature(message, data.signature, data.wallet);

    if (!isValid) {
      throw new AppError({
        message: 'Invalid signature',
        statusCode: 401,
        code: 'AUTHENTICATION_ERROR',
      });
    }

    const isNewUser = !(await this.userRepository.exists(data.wallet));

    // Find or create user
    const user = await this.userRepository.findOrCreate(data.wallet);

    if (isNewUser) {
      metrics.counter('auth_users_created_total');
    }

    // Generate tokens
    const tokens = await this.generateTokens(data.wallet, user._id.toString());

    return {
      userId: user._id.toString(),
      wallet: user.wallet,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator()
  async refreshToken(data: { refreshToken: string }) {
    // Verify JWT token payload (this checks expiration automatically)
    const payload = this.verifyToken(data.refreshToken);
    setSpanAttributes({ wallet: payload.wallet });
    if (payload.type !== 'refresh') {
      throw new AppError({
        message: 'Invalid token type',
        statusCode: 401,
        code: 'AUTHENTICATION_ERROR',
      });
    }

    // Create token hash for database lookup
    const tokenHash = crypto.createHash('sha256').update(data.refreshToken).digest('hex');

    // Find token in database
    const tokenRecord = await this.refreshTokenRepository.findByTokenHash(tokenHash);

    if (!tokenRecord) {
      throw new AppError({
        message: 'Invalid refresh token',
        statusCode: 401,
        code: 'AUTHENTICATION_ERROR',
      });
    }

    // Delete the used refresh token (one-time use)
    await this.refreshTokenRepository.deleteTokens(tokenRecord.userId, [tokenHash]);

    // Get user by userId from token payload
    const user = await this.userRepository.findById(payload.userId);

    // Generate new tokens
    const tokens = await this.generateTokens(payload.wallet, user._id.toString());

    return {
      userId: user._id.toString(),
      wallet: user.wallet,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  @TraceDecorator()
  private verifySignature(
    message: { wallet: string; timestamp: number; message: string },
    signature: string,
    wallet: string,
  ): boolean {
    try {
      const typedData = {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
          ],
          Message: [
            { name: 'wallet', type: 'address' },
            { name: 'timestamp', type: 'uint256' },
            { name: 'message', type: 'string' },
          ],
        },
        primaryType: 'Message',
        domain: {
          name: this.domainName,
          version: this.domainVersion,
        },
        message,
      };

      const recovered = ethers.verifyTypedData(
        typedData.domain,
        { Message: typedData.types.Message },
        message,
        signature,
      );

      return recovered.toLowerCase() === wallet.toLowerCase();
    } catch (error) {
      return false;
    }
  }

  @TraceDecorator()
  private async generateTokens(wallet: string, userId: string) {
    const accessTokenJti = crypto.randomBytes(16).toString('hex');
    const refreshTokenJti = crypto.randomBytes(16).toString('hex');

    const accessToken = jwt.sign(
      {
        userId,
        wallet,
        type: 'access',
        jti: accessTokenJti,
      },
      this.jwtSecret,
      { expiresIn: this.accessTokenExpiry },
    );

    const refreshToken = jwt.sign(
      {
        userId,
        wallet,
        type: 'refresh',
        jti: refreshTokenJti,
      },
      this.jwtSecret,
      { expiresIn: this.refreshTokenExpiry },
    );

    // Save refresh token to database
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const decoded = jwt.decode(refreshToken) as any;
    const expiresAt = decoded.exp;

    await this.refreshTokenRepository.create(userId, tokenHash, expiresAt);

    return { wallet, accessToken, refreshToken };
  }

  @TraceDecorator()
  private verifyToken(token: string) {
    const payload = jwt.verify(token, this.jwtSecret) as {
      userId: string;
      wallet: string;
      type: 'access' | 'refresh';
      jti: string;
    };

    return payload;
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ userId: a[0] }),
  })
  async getUser(userId: string) {
    setSpanAttributes({ userId });
    const user = await this.userRepository.findById(userId);

    return {
      userId: user._id.toString(),
      wallet: user.wallet,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ userId: a[0] }),
  })
  async getUserTokens(userId: string) {
    setSpanAttributes({ userId });
    const tokens = await this.refreshTokenRepository.findByUserId(userId);

    return tokens.map((token) => ({
      tokenId: token._id.toString(),
      userId: token.userId.toString(),
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      createdAt: token.createdAt,
      updatedAt: token.updatedAt,
    }));
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ userId: a[0] }),
  })
  async revokeTokens(userId: string, tokenHashes: string[]) {
    setSpanAttributes({ userId });
    const revokedCount = await this.refreshTokenRepository.deleteTokens(userId, tokenHashes);

    return {
      revokedCount,
    };
  }
}
