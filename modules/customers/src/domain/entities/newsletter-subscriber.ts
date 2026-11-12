export type NewsletterSubscriberStatus = "SUBSCRIBED" | "UNSUBSCRIBED";

export const VALID_NEWSLETTER_STATUSES: readonly NewsletterSubscriberStatus[] = [
  "SUBSCRIBED",
  "UNSUBSCRIBED",
] as const;

export interface NewsletterSubscriber {
  id: string;
  storeId: string;
  email: string;
  status: NewsletterSubscriberStatus;
  source: string;
  subscribedAt: Date;
  unsubscribedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
