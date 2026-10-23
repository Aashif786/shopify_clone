"use client";

import React from "react";
import type { CustomerAnalyticsDto } from "@shopify-clone/orders";
import { formatOrderPrice } from "../../../lib/merchant-order-helpers";

interface CustomerAnalyticsCardProps {
  data: CustomerAnalyticsDto;
  currency?: string;
}

export function CustomerAnalyticsCard({
  data,
  currency = "USD",
}: CustomerAnalyticsCardProps) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        padding: "var(--space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-2)",
        }}
      >
        <div>
          <h3
            style={{
              fontSize: "var(--font-size-base)",
              fontWeight: 600,
              color: "var(--color-text)",
              margin: 0,
            }}
          >
            Customer Growth & Retention
          </h3>
          <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
            Buyer acquisition, repeat purchasing, and top customers
          </span>
        </div>

        <a href="/merchant/customers" className="btn btn-outline btn-sm">
          View All Customers →
        </a>
      </div>

      {/* Metric Tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "var(--space-3)",
        }}
      >
        <div
          style={{
            background: "var(--color-surface-subtle)",
            padding: "var(--space-3) var(--space-4)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
            Total Customers
          </div>
          <div style={{ fontSize: "var(--font-size-xl, 20px)", fontWeight: 700, color: "var(--color-text)" }}>
            {data.totalCustomers.toLocaleString()}
          </div>
        </div>

        <div
          style={{
            background: "var(--color-surface-subtle)",
            padding: "var(--space-3) var(--space-4)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
            New in Period
          </div>
          <div style={{ fontSize: "var(--font-size-xl, 20px)", fontWeight: 700, color: "var(--color-primary, #2563eb)" }}>
            +{data.newCustomersInPeriod.toLocaleString()}
          </div>
        </div>

        <div
          style={{
            background: "var(--color-surface-subtle)",
            padding: "var(--space-3) var(--space-4)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
            Active Buyers
          </div>
          <div style={{ fontSize: "var(--font-size-xl, 20px)", fontWeight: 700, color: "var(--color-text)" }}>
            {data.activeCustomersInPeriod.toLocaleString()}
          </div>
        </div>

        <div
          style={{
            background: "var(--color-surface-subtle)",
            padding: "var(--space-3) var(--space-4)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
            Repeat Buyers
          </div>
          <div style={{ fontSize: "var(--font-size-xl, 20px)", fontWeight: 700, color: "var(--color-success, #10b981)" }}>
            {data.repeatCustomerCount.toLocaleString()}
          </div>
        </div>

        <div
          style={{
            background: "var(--color-surface-subtle)",
            padding: "var(--space-3) var(--space-4)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
            Repeat Rate
          </div>
          <div style={{ fontSize: "var(--font-size-xl, 20px)", fontWeight: 700, color: "var(--color-text)" }}>
            {data.repeatCustomerRate}%
          </div>
        </div>
      </div>

      {/* Top Spenders Table */}
      {data.topCustomers.length > 0 && (
        <div style={{ marginTop: "var(--space-2)" }}>
          <span
            style={{
              fontSize: "var(--font-size-xs)",
              fontWeight: 600,
              color: "var(--color-text-muted)",
              textTransform: "uppercase",
              display: "block",
              marginBottom: "var(--space-2)",
            }}
          >
            Top Spending Customers in Period
          </span>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
                fontSize: "var(--font-size-sm)",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--color-border)",
                    color: "var(--color-text-muted)",
                    fontSize: "var(--font-size-xs)",
                  }}
                >
                  <th style={{ padding: "6px 10px" }}>Customer</th>
                  <th style={{ padding: "6px 10px", textAlign: "right" }}>Orders</th>
                  <th style={{ padding: "6px 10px", textAlign: "right" }}>Total Spent</th>
                </tr>
              </thead>
              <tbody>
                {data.topCustomers.map((cust) => {
                  const name = [cust.firstName, cust.lastName].filter(Boolean).join(" ");
                  return (
                    <tr
                      key={cust.customerId}
                      style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
                    >
                      <td style={{ padding: "8px 10px" }}>
                        <div style={{ fontWeight: 500, color: "var(--color-text)" }}>
                          {name || cust.email}
                        </div>
                        {name && (
                          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                            {cust.email}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>
                        {cust.orderCount}
                      </td>
                      <td
                        style={{
                          padding: "8px 10px",
                          textAlign: "right",
                          fontWeight: 600,
                          color: "var(--color-primary, #2563eb)",
                        }}
                      >
                        {formatOrderPrice(cust.totalSpent, currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
