import { ethers } from "ethers";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { logger } from "@shared/monitoring/src/logger";
import { InvalidTokenError } from "@shared/errors/app-errors";
import { UserRepository } from "../repositories/user.repository";

export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtSecret: string,
    private readonly accessTokenExpiry: jwt.SignOptions["expiresIn"],
    private readonly refreshTokenExpiry: jwt.SignOptions["expiresIn"],
    private readonly domainName: string,
    private readonly domainVersion: string
  ) {}

  /**
   * Authenticates user with signed message
   */
  async authenticate(data: {
    wallet: string;
    signature: string;
    timestamp: number;
  }) {
    logger.debug("Authenticating user", { wallet: data.wallet, timestamp: data.timestamp });

    // Check timestamp is within 1 minute of server time
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - data.timestamp) > 60) {
      throw new Error("Timestamp is too far from server time");
    }

    // Build EIP-712 message object
    const message = {
      wallet: data.wallet,
      timestamp: data.timestamp,
      message: `Welcome to RWA Platform!

We prioritize the security of your assets and personal data. To ensure secure access to your account, we kindly request you to verify ownership of your wallet by signing this message.`
    };

    // Verify signature using EIP-712
    const isValid = this.verifySignature(message, data.signature, data.wallet);
    if (!isValid) {
      throw new Error("Invalid signature");
    }

    // Find or create user
    const user = await this.userRepository.findOrCreate(data.wallet);

    // Generate tokens
    const tokens = this.generateTokens(data.wallet, user._id.toString());

    return {
      userId: user._id.toString(),
      wallet: user.wallet,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  }

  /**
   * Refreshes access token using refresh token
   */
  async refreshToken(data: {
    refreshToken: string;
  }) {
    logger.debug("Refreshing token");

    // Verify token payload
    const payload = this.verifyToken(data.refreshToken);
    if (payload.type !== "refresh") {
      logger.error("Invalid token type", { type: payload.type });
      throw new InvalidTokenError("Invalid token type");
    }

    // Get user to return their data
    const user = await this.userRepository.findByWallet(payload.wallet);
    
    // Generate new tokens
    const tokens = this.generateTokens(payload.wallet, user._id.toString());

    return {
      userId: user._id.toString(),
      wallet: user.wallet,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  }

  /**
   * Verifies the EIP-712 signature for the given typed data and wallet.
   */
  private verifySignature(
    message: { wallet: string; timestamp: number; message: string },
    signature: string,
    wallet: string
  ): boolean {
    try {
      const typedData = {
        types: {
          EIP712Domain: [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
          ],
          Message: [
            { name: "wallet", type: "address" },
            { name: "timestamp", type: "uint256" },
            { name: "message", type: "string" },
          ],
        },
        primaryType: "Message",
        domain: {
          name: this.domainName,
          version: this.domainVersion,
        },
        message,
      }
      const recovered = ethers.verifyTypedData(
        typedData.domain,
        { Message: typedData.types.Message },
        message,
        signature
      );
      const isValid = recovered.toLowerCase() === wallet.toLowerCase();
      logger.info(
        `Signature verification result for ${wallet}: ${isValid ? "VALID" : "INVALID"}`
      );
      return isValid;
    } catch (err) {
      logger.error("Signature verification error", { err });
      return false;
    }
  }

  /**
   * Private method to generate access and refresh tokens
   */
  private generateTokens(wallet: string, userId: string) {
    const accessToken = jwt.sign(
      {
        userId,
        wallet,
        type: "access",
        jti: crypto.randomBytes(16).toString('hex') // Add unique JWT ID
      },
      this.jwtSecret,
      { expiresIn: this.accessTokenExpiry }
    );

    const refreshToken = jwt.sign(
      {
        userId,
        wallet,
        type: "refresh",
        jti: crypto.randomBytes(16).toString('hex') // Add unique JWT ID
      },
      this.jwtSecret,
      { expiresIn: this.refreshTokenExpiry }
    );

    return { wallet, accessToken, refreshToken };
  }

  /**
   * Private method to verify token
   */
  private verifyToken(token: string) {
    return jwt.verify(token, this.jwtSecret) as {
      wallet: string;
      type: "access" | "refresh";
      jti: string;
    };
  }

  /**
   * Get user by userId
   */
  async getUser(userId: string) {
    logger.debug("Getting user", { userId });

    const user = await this.userRepository.findById(userId);

    return {
      userId: user._id.toString(),
      wallet: user.wallet
    };
  }
}
