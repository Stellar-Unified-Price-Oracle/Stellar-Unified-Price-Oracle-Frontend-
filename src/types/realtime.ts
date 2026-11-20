export type RealtimeSubscriptionStatus =
  | 'idle'
  | 'connecting'
  | 'subscribed'
  | 'unsubscribed'
  | 'error';

export interface SubscriptionOptions {
  /** Unique channel/topic name to subscribe to. */
  channel: string;
  /** Optional filter payload forwarded to the realtime provider. */
  filter?: Record<string, unknown>;
  /** Whether the subscription should be re-established after a reconnect. */
  resubscribe?: boolean;
}

export type RealtimeSubscriptionOptions = SubscriptionOptions;

export interface RealtimeSubscription {
  /** Stable identifier for this subscription instance. */
  id: string;
  /** Channel/topic the subscription is bound to. */
  channel: string;
  /** Current lifecycle status. */
  status: RealtimeSubscriptionStatus;
  /** Number of active consumers sharing this subscription. */
  refCount: number;
  /** Options used to create the subscription. */
  options: SubscriptionOptions;
  /** Tear down the underlying provider subscription. */
  unsubscribe: () => void;
}
