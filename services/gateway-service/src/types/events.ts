export interface KYCStatusUpdatePayload {
  userId: string;
  status: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  provider?: string;
  timestamp: string;
  details?: Record<string, any>;
}
