import { UserRole } from './enums';

export interface JWTPayload {
  address: string;
  role: UserRole;
  nonce: string;
}
