"use client";

import React from "react";
import type {
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderStatus,
} from "@shopify-clone/orders";
import { Badge } from "@shopify-clone/ui";
import {
  getOrderFulfillmentBadgeConfig,
  getOrderPaymentBadgeConfig,
  getOrderStatusBadgeConfig,
} from "../../../lib/merchant-order-helpers";

export interface OrderStatusBadgeProps {
  status: OrderStatus;
  size?: "sm" | "md";
}

export function OrderStatusBadge({ status, size = "sm" }: OrderStatusBadgeProps) {
  const { variant, label } = getOrderStatusBadgeConfig(status);
  return (
    <Badge variant={variant} size={size}>
      {label}
    </Badge>
  );
}

export interface OrderPaymentBadgeProps {
  status: OrderPaymentStatus;
  size?: "sm" | "md";
}

export function OrderPaymentBadge({ status, size = "sm" }: OrderPaymentBadgeProps) {
  const { variant, label } = getOrderPaymentBadgeConfig(status);
  return (
    <Badge variant={variant} size={size}>
      {label}
    </Badge>
  );
}

export interface OrderFulfillmentBadgeProps {
  status: OrderFulfillmentStatus;
  size?: "sm" | "md";
}

export function OrderFulfillmentBadge({
  status,
  size = "sm",
}: OrderFulfillmentBadgeProps) {
  const { variant, label } = getOrderFulfillmentBadgeConfig(status);
  return (
    <Badge variant={variant} size={size}>
      {label}
    </Badge>
  );
}
