"use client";

import React from "react";
import { MerchantShell } from "@/components/merchant/MerchantShell";
import { MerchantReviewsView } from "@/components/merchant/reviews/merchant-reviews-view";

export default function MerchantReviewsPage() {
  return (
    <MerchantShell>
      <MerchantReviewsView />
    </MerchantShell>
  );
}
