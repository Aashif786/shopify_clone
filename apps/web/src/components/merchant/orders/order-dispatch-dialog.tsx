"use client";

import React, { useState } from "react";
import type { OrderDTO, ShipmentDTO } from "@calcart/orders";
import { Alert, Button, Dialog, FormField, Input, Textarea } from "@calcart/ui";
import { ApiClientError, apiClient } from "../../../lib/api-client";
import { getOrderRecipientName } from "../../../lib/merchant-order-helpers";
import { Truck } from "lucide-react";

export interface OrderDispatchDialogProps {
  storeId: string;
  order: OrderDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedOrder: OrderDTO, shipment: ShipmentDTO) => void;
}

interface DispatchResponse {
  order: OrderDTO;
  shipment: ShipmentDTO;
  created: boolean;
}

const CARRIER_PRESETS = [
  { code: "delhivery", name: "Delhivery Express", tag: "Auto AWB" },
  { code: "bluedart", name: "Blue Dart Express", tag: "Auto AWB" },
  { code: "shiprocket", name: "Shiprocket Logistics", tag: "Auto AWB" },
  { code: "manual", name: "Custom Courier", tag: "Manual Entry" },
];

export function OrderDispatchDialog({
  storeId,
  order,
  isOpen,
  onClose,
  onSuccess,
}: OrderDispatchDialogProps) {
  const [selectedPreset, setSelectedPreset] = useState("delhivery");
  const [carrier, setCarrier] = useState("Delhivery Express");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [carrierStatus, setCarrierStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !order) return null;

  const handleSelectPreset = (preset: typeof CARRIER_PRESETS[number]) => {
    setSelectedPreset(preset.code);
    if (preset.code === "manual") {
      setCarrier("");
      setTrackingUrl("");
      setCarrierStatus("");
    } else {
      setCarrier(preset.name);
      setCarrierStatus("Manifest Generated - Scheduled for Pickup");
      if (preset.code === "delhivery") {
        setTrackingUrl("https://www.delhivery.com/track/package/");
      } else if (preset.code === "bluedart") {
        setTrackingUrl("https://www.bluedart.com/tracking");
      } else if (preset.code === "shiprocket") {
        setTrackingUrl("https://shiprocket.co/tracking");
      }
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setSelectedPreset("delhivery");
    setCarrier("Delhivery Express");
    setTrackingNumber("");
    setTrackingUrl("");
    setCarrierStatus("");
    setNotes("");
    setSubmitError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !order) return;
    const finalCarrier = carrier.trim() || CARRIER_PRESETS.find(p => p.code === selectedPreset)?.name || "";
    if (finalCarrier.length === 0) {
      setSubmitError("Enter the carrier that is taking this order.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await apiClient.post<DispatchResponse>(
        `/api/v1/stores/${encodeURIComponent(storeId)}/orders/${encodeURIComponent(order.id)}/shipments`,
        {
          carrierName: finalCarrier,
          providerCode: selectedPreset,
          trackingNumber: trackingNumber.trim() || null,
          trackingUrl: trackingUrl.trim() || null,
          carrierStatus: carrierStatus.trim() || null,
          reason: notes.trim() || null,
        },
      );
      handleClose();
      onSuccess(result.order, result.shipment);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setSubmitError(
          err.status === 403
            ? "Access denied: dispatching an order requires at least staff permissions."
            : err.message || "The order could not be dispatched.",
        );
      } else {
        setSubmitError(err instanceof Error ? err.message : "The order could not be dispatched.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const recipientName = getOrderRecipientName(order);
  const itemCount = order.items?.reduce((acc, item) => acc + item.quantity, 0) ?? 0;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title={`Dispatch order #${order.orderNumber}`}
      description="The whole order ships together. Enter the carrier you are handing it to."
      size="md"
      footer={
        <div className="flex gap-2.5 justify-end w-full pt-2">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting} type="button">
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={isSubmitting} type="submit" className="gap-1.5">
            <Truck className="w-3.5 h-3.5" />
            <span>Dispatch</span>
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {submitError && (
          <Alert variant="danger" title="Could not dispatch">
            {submitError}
          </Alert>
        )}

        <div className="bg-muted/40 border border-border/50 rounded-lg p-3 text-xs space-y-1">
          <div className="font-semibold text-foreground text-sm">Recipient: {recipientName}</div>
          <div className="text-muted-foreground">
            Items to ship: {itemCount} {itemCount === 1 ? "unit" : "units"} ({order.items?.length ?? 0} line items)
          </div>
        </div>

        {/* Courier Presets */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
            Courier Service Partner
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CARRIER_PRESETS.map((p) => {
              const isSelected = selectedPreset === p.code;
              return (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  disabled={isSubmitting}
                  className={`text-left p-2.5 rounded-xl border text-xs transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10 text-foreground font-semibold shadow-xs ring-1 ring-primary/30"
                      : "border-border/60 bg-card hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{p.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        p.code !== "manual"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {p.tag}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <FormField
          label="Carrier Name"
          helperText="The company taking the parcel"
          htmlFor="dispatch-carrier"
          required
        >
          <Input
            id="dispatch-carrier"
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            placeholder="e.g. Delhivery Express"
            disabled={isSubmitting}
            autoComplete="off"
          />
        </FormField>

        <FormField
          label="Waybill / Tracking Number"
          helperText={
            selectedPreset !== "manual"
              ? "Leave blank to automatically generate authoritative AWB upon dispatch."
              : "Optional tracking code provided to the customer."
          }
          htmlFor="dispatch-tracking"
        >
          <Input
            id="dispatch-tracking"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder={
              selectedPreset === "delhivery"
                ? "Auto-generated (e.g. DLHV189283719283)"
                : selectedPreset === "bluedart"
                ? "Auto-generated (e.g. BLDT982147910)"
                : selectedPreset === "shiprocket"
                ? "Auto-generated (e.g. SR89218921901)"
                : "e.g. TRK-9821479102"
            }
            disabled={isSubmitting}
            autoComplete="off"
          />
        </FormField>

        <FormField
          label="Tracking link"
          helperText="Optional. Must start with https://"
          htmlFor="dispatch-url"
        >
          <Input
            id="dispatch-url"
            type="url"
            value={trackingUrl}
            onChange={(e) => setTrackingUrl(e.target.value)}
            placeholder="https://www.bluedart.com/tracking"
            disabled={isSubmitting}
          />
        </FormField>

        <FormField
          label="Carrier status"
          helperText="Optional note the customer sees, such as “Handed to courier”"
          htmlFor="dispatch-status"
        >
          <Input
            id="dispatch-status"
            value={carrierStatus}
            onChange={(e) => setCarrierStatus(e.target.value)}
            placeholder="Handed to courier"
            disabled={isSubmitting}
          />
        </FormField>

        <FormField label="Note" helperText="Stored on the order history" htmlFor="dispatch-note">
          <Textarea
            id="dispatch-note"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            disabled={isSubmitting}
          />
        </FormField>
      </form>
    </Dialog>
  );
}
