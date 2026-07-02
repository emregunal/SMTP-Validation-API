export type BounceEventType =
  'hard_bounce' | 'soft_bounce' | 'delivered' | 'complained' | 'unsubscribed';

export interface EmailEvent {
  id: string;
  email: string;
  normalizedEmail: string;
  domain: string;
  eventType: BounceEventType;
  smtpCode?: string;
  enhancedCode?: string;
  reason?: string;
  provider?: string;
  rawMessage?: string;
  occurredAt: string;
  createdAt: string;
}

export interface EmailReputation {
  email: string;
  normalizedEmail: string;
  domain: string;
  lastEventType: BounceEventType | null;
  hardBounceCount: number;
  softBounceCount: number;
  deliveredCount: number;
  complaintCount: number;
  unsubscribedCount: number;
  lastSeenAt: string | null;
  reputationScore: number;
  confidence: 'high' | 'medium' | 'low';
}
