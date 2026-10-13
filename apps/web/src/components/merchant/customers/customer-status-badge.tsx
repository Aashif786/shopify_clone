"use client";

import React from "react";
import type { CustomerStatus } from "@shopify-clone/customers";
import { Badge } from "@shopify-clone/ui";
import { getCustomerStatusBadgeConfig } from "../../../lib/merchant-customer-helpers";

export interface CustomerStatusBadgeProps {
  status: CustomerStatus;
  size?: "sm" | "md";
}

export function CustomerStatusBadge({
  status,
  size = "sm",
}: CustomerStatusBadgeProps) {
  const { variant, label } = getCustomerStatusBadgeConfig(status);
  return (
    <Badge variant={variant} size={size}>
      {label}
    </Badge>
  );
}
