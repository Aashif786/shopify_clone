"use client";

import React from "react";
import { MerchantShell } from "@/components/merchant/MerchantShell";
import { ShippingView } from "@/components/merchant/shipping/shipping-view";

export default function MerchantShippingPage() {
  return (
    <MerchantShell>
      <ShippingView />
    </MerchantShell>
  );
}
