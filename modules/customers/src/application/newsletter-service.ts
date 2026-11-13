import type { DatabaseClient } from "@calcart/db";
import { NewsletterRepository } from "../infrastructure/newsletter-repository.js";
import { normalizeEmail, isValidEmailFormat } from "../domain/validation.js";
import { InvalidCustomerEmailError } from "../domain/errors.js";
import type {
  ListNewsletterSubscribersFilter,
  NewsletterSubscriberDTO,
  NewsletterSubscriberListDTO,
  SubscribeNewsletterInput,
  SubscribeNewsletterResultDTO,
} from "./dtos.js";
import type { NewsletterSubscriber } from "../domain/entities/newsletter-subscriber.js";

export class NewsletterService {
  constructor(private readonly repo: NewsletterRepository = new NewsletterRepository()) {}

  private toDTO(sub: NewsletterSubscriber): NewsletterSubscriberDTO {
    return {
      id: sub.id,
      storeId: sub.storeId,
      email: sub.email,
      status: sub.status,
      source: sub.source,
      subscribedAt: sub.subscribedAt.toISOString(),
      unsubscribedAt: sub.unsubscribedAt ? sub.unsubscribedAt.toISOString() : null,
      createdAt: sub.createdAt.toISOString(),
      updatedAt: sub.updatedAt.toISOString(),
    };
  }

  async subscribe(
    client: DatabaseClient,
    storeId: string,
    input: SubscribeNewsletterInput,
  ): Promise<SubscribeNewsletterResultDTO> {
    if (!storeId || typeof storeId !== "string" || storeId.trim().length === 0) {
      throw new Error("storeId is required");
    }

    if (!input || !input.email || !isValidEmailFormat(input.email)) {
      throw new InvalidCustomerEmailError(input?.email || "");
    }

    const email = normalizeEmail(input.email);
    const source = (input.source || "STOREFRONT_LANDING").trim();

    const { subscriber, isNew } = await this.repo.subscribe(client, storeId, email, source);

    return {
      subscriber: this.toDTO(subscriber),
      isNew,
      message: isNew
        ? "Thank you for subscribing to our newsletter!"
        : "You are already subscribed to our newsletter.",
    };
  }

  async unsubscribe(
    client: DatabaseClient,
    storeId: string,
    email: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!isValidEmailFormat(email)) {
      throw new InvalidCustomerEmailError(email);
    }

    const normalized = normalizeEmail(email);
    const subscriber = await this.repo.unsubscribe(client, storeId, normalized);

    return {
      success: Boolean(subscriber),
      message: subscriber
        ? "You have been successfully unsubscribed."
        : "Email was not found in our subscriber directory.",
    };
  }

  async listSubscribers(
    client: DatabaseClient,
    storeId: string,
    filter: ListNewsletterSubscribersFilter = {},
  ): Promise<NewsletterSubscriberListDTO> {
    if (!storeId || typeof storeId !== "string" || storeId.trim().length === 0) {
      throw new Error("storeId is required");
    }

    const { items, total, activeCount } = await this.repo.listSubscribers(client, storeId, filter);

    return {
      items: items.map((sub) => this.toDTO(sub)),
      total,
      activeCount,
    };
  }
}
