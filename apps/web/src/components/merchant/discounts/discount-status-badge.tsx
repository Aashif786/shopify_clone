"use client";

import React from "react";
import { Badge, type BadgeProps } from "@shopify-clone/ui";
import type { DiscountStatus } from "../../../lib/merchant-discount-helpers";

export interface DiscountStatusBadgeProps {
  status: DiscountStatus;
  size?: BadgeProps["size"];
}

export function DiscountStatusBadge({ status, size = "sm" }: DiscountStatusBadgeProps) {
  switch (status) {
    case "ACTIVE":
      return (
        <Badge variant="success" size={size} data-testid="discount-status-active">
          Active
        </Badge>
      );
    case "DISABLED":
      return (
        <Badge variant="warning" size={size} data-testid="discount-status-disabled">
          Disabled
        </Badge>
      );
    case "EXPIRED":
      return (
        <Badge variant="danger" size={size} data-testid="discount-status-expired">
          Expired
        </Badge>
      );
    case "DRAFT":
    default:
      return (
        <Badge variant="neutral" size={size} data-testid="discount-status-draft">
          Draft
        </Badge>
      );
  }
}
