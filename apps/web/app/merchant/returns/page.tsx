"use client";

import React from "react";
import { MerchantShell } from "@/components/merchant/MerchantShell";
import { ReturnsQueueView } from "@/components/merchant/returns/returns-queue-view";

export default function MerchantReturnsPage() {
  return (
    <MerchantShell>
      <ReturnsQueueView />
    </MerchantShell>
  );
}
