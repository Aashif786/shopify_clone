"use client";

import React from "react";
import { MerchantShell } from "@/components/merchant/MerchantShell";
import { TaxView } from "@/components/merchant/tax/tax-view";

export default function MerchantTaxPage() {
  return (
    <MerchantShell>
      <TaxView />
    </MerchantShell>
  );
}
