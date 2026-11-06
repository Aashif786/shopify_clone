import { describe, expect, it } from "vitest";
import {
  InvalidCarrierDispatchError,
  ManualCarrierProvider,
} from "../../modules/shipping/src/application/carrier-provider.js";

const provider = new ManualCarrierProvider();

describe("ManualCarrierProvider", () => {
  it("records the carrier the merchant typed and does not invent a tracking number", async () => {
    const result = await provider.dispatch({
      carrierName: "  BlueDart ",
      trackingNumber: " TRK-1 ",
      trackingUrl: "https://track.example/TRK-1",
      carrierStatus: " Handed to courier ",
    });

    expect(result).toEqual({
      providerCode: "manual",
      carrierName: "BlueDart",
      trackingNumber: "TRK-1",
      trackingUrl: "https://track.example/TRK-1",
      carrierStatus: "Handed to courier",
    });
  });

  it("allows a dispatch with only a carrier name", async () => {
    const result = await provider.dispatch({ carrierName: "India Post" });
    expect(result.trackingNumber).toBeNull();
    expect(result.trackingUrl).toBeNull();
    expect(result.carrierStatus).toBeNull();
  });

  it("rejects a missing carrier and a tracking link that is not http", async () => {
    await expect(provider.dispatch({ carrierName: "  " })).rejects.toBeInstanceOf(
      InvalidCarrierDispatchError,
    );
    await expect(
      provider.dispatch({ carrierName: "BlueDart", trackingUrl: "ftp://files.example/x" }),
    ).rejects.toBeInstanceOf(InvalidCarrierDispatchError);
  });
});
