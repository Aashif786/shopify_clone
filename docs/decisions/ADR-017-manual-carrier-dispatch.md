# ADR-017: One shipment per order, dispatched through a manual carrier port

- **Status**: Accepted
- **Date**: 2026-11-06
- **Context**: COD / dispatch / shipping, Phase 1 (shipments and a manual carrier)
- **Related**: [ADR-016](./ADR-016-order-owned-inventory-reservations-and-merchant-status-transitions.md)

---

## Context

Phase 0 made an order movable and kept its reserved stock until fulfillment.
Dispatch itself was still three loose columns on `orders` (`tracking_carrier`,
`tracking_number`, `tracking_url`) written by the fulfill route. There was no
shipment, no rule that an order ships once, and no place a later carrier
integration could plug in without calling that carrier from the orders module.

The merchant hands the parcel to a carrier they already have an account with.
Cal Cart does not hold carrier credentials and does not pay a shipping provider.

## Decision

An order has at most one shipment. Partial shipments are not supported.
`PROCESSING` is the packing step. Dispatch is allowed from `PROCESSING`, and is
idempotent once the order is `SHIPPED`.

`POST /api/v1/stores/:storeId/orders/:orderId/shipments` (staff and above):

1. Asks a carrier port to open the shipment.
2. Moves the order to `SHIPPED` in the same transaction, which marks it
   `FULFILLED` and commits the reserved stock (ADR-016).
3. Inserts one `shipments` row and copies the carrier, tracking number and
   tracking link onto the order so existing order screens keep working.
4. Queues the existing fulfillment email. A repeat call returns the shipment
   and does not send the email again.

The port lives in `modules/orders` as `CarrierDispatchPort`. The only
implementation in this phase is `ManualCarrierProvider` in `modules/shipping`.
It checks the merchant's input and returns it. It does not make an HTTP call.
A later provider implements the same function with the merchant's own
credentials. `provider_code` is free text of a bounded length so that provider
does not need a new check constraint.

Tracking is returned to the customer only from the storefront order route,
and only after the logged-in customer or guest token is checked. Delivery and
failed-delivery outcomes are columns on `shipments` and are not written yet.

## Alternatives rejected

**Keep tracking only on the order.** A second dispatch could not be told apart
from an edit, and a carrier adapter would have nowhere to record which
provider created the shipment.

**Call a carrier API from the orders module.** That would import a provider
SDK into orders and would bill the platform for labels. The port keeps that
choice at the edge, and the manual provider is the choice for launch.

## Consequences

- Orders fulfilled through the older fulfill route still have tracking columns
  and no `shipments` row. Dispatching an order that is already `SHIPPED` and
  has no shipment records one.
- Marking an order `SHIPPED` through the status endpoint does not create a
  shipment. The dispatch button is the path that does.
- Delivered and failed-delivery emails wait until those shipment transitions
  exist.
