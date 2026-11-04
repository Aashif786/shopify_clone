# ADR-012: CSV Import Inventory and Variant Integrity

## Status

**Accepted**

## Date

2026-11-04

## Decision

A product CSV import updates sellable stock only. `available_quantity` is changed under a row lock and `reserved_quantity` is left as it is. The write is conditional on the reserved quantity still matching the locked value, so a concurrent reservation cannot be overwritten. A quantity that is not a whole number of zero or more is rejected and the product transaction rolls back.

Variants that are absent from an update file stay unchanged. Archiving a variant requires `Variant Status` of `ARCHIVED` on that variant's row, and the change must be a legal variant transition. A blank option name or option value keeps the current option. Product and variant status values must be legal lifecycle transitions.

Every product in one import runs in a single database transaction. If any product fails, none of the file's writes remain. The same file can be imported again; matching uses variant id, then SKU, then option values.

## Inventory model

`available_quantity` is stock that can still be sold. `reserved_quantity` is stock already held for carts, checkouts, or orders. On-hand stock is their sum. CSV `Available Quantity` sets the sellable number and does not release reservations.
