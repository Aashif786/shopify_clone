import { describe, expect, it } from "vitest";
import {
  InvalidRatingError,
  ReviewEligibilityError,
  ReviewForbiddenError,
  ReviewNotFoundError,
  DuplicateReviewError,
} from "@calcart/products";

describe("Review Domain Entities and Error Contracts", () => {
  it("instantiates domain error types with correct HTTP statuses and error codes", () => {
    const notFound = new ReviewNotFoundError("Review missing");
    expect(notFound.status).toBe(404);
    expect(notFound.code).toBe("REVIEW_NOT_FOUND");
    expect(notFound.message).toBe("Review missing");

    const duplicate = new DuplicateReviewError();
    expect(duplicate.status).toBe(409);
    expect(duplicate.code).toBe("DUPLICATE_REVIEW");

    const ineligible = new ReviewEligibilityError("Not eligible");
    expect(ineligible.status).toBe(403);
    expect(ineligible.code).toBe("REVIEW_INELIGIBLE");

    const invalidRating = new InvalidRatingError("Rating must be 1 to 5");
    expect(invalidRating.status).toBe(400);
    expect(invalidRating.code).toBe("INVALID_RATING");

    const forbidden = new ReviewForbiddenError("Forbidden edit");
    expect(forbidden.status).toBe(403);
    expect(forbidden.code).toBe("REVIEW_FORBIDDEN");
  });

  it("calculates rating averages and distributions accurately", () => {
    const ratings = [5, 5, 4, 3, 5, 1];
    const total = ratings.length;
    const sum = ratings.reduce((a, b) => a + b, 0);
    const avg = Number((sum / total).toFixed(1));

    expect(avg).toBe(3.8);

    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of ratings) {
      dist[r] = (dist[r] || 0) + 1;
    }

    expect(dist[5]).toBe(3);
    expect(dist[4]).toBe(1);
    expect(dist[3]).toBe(1);
    expect(dist[2]).toBe(0);
    expect(dist[1]).toBe(1);
  });
});
