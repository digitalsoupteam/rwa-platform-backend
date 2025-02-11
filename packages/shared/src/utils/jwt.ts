import jwt from 'jsonwebtoken';
import { logger, metrics } from '../index';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface JWTPayload {
  address: string;
}

export const jwtService = {
  generate(address: string): string {
    return jwt.sign({ address }, JWT_SECRET, { expiresIn: '24h' });
  },

  verify(token: string): JWTPayload {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  }
};