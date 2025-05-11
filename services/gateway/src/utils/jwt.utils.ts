import { CONFIG } from "../config";
import { logger } from "@shared/monitoring/src/logger";
import * as jwt from 'jsonwebtoken';


export interface TokenPayload {
  userId: string;
  wallet: string;
  type: 'access' | 'refresh';
  exp: number;
  iat: number;
}


export interface DecodedToken {
  exp: number;
  [key: string]: string | number;
}


export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, CONFIG.JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    logger.error(`Error verifying JWT token: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}


export function decodeToken(token: string): DecodedToken | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64').toString();
    return JSON.parse(decoded) as DecodedToken;
  } catch (error) {
    logger.error(`Error decoding JWT token: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}


export function isTokenExpired(decodedToken: DecodedToken): boolean {
  try {
    if (!decodedToken || !decodedToken.exp) {
      return true;
    }
    
    const currentTime = Math.floor(Date.now() / 1000);
    return decodedToken.exp < currentTime;
  } catch (error) {
    logger.error(`Error checking token expiration: ${error instanceof Error ? error.message : String(error)}`);
    return true;
  }
}


export function extractFromToken(token: string): { userId: string; wallet: string } | null {
  try {
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId || !decoded.wallet || decoded.type !== 'access') {
      return null;
    }
    
    return {
      userId: decoded.userId,
      wallet: decoded.wallet,
    };
  } catch (error) {
    logger.error(`Error extracting from token: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}