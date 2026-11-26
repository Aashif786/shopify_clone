# ADR-019: Platform-managed store types and Fit Check activation

## Status

Accepted (Phases 1–3). Avatar, garment and storefront try-on phases are pending.

## Decisions

- **Store types are data, not code.** `store_types` (migration 0058) holds `key`, `name`, `description` and `is_fashion`. Platform admins manage them (`stores:read` / `stores:write`, audited with a reason). The merchant app reads the list; nothing is hardcoded.
- **Ownership.** The `stores` module owns `store_types`, `stores.store_type_id` and `stores.fit_check_enabled` (`StoreTypeService`). `apps/platform-admin` calls it after its own permission check.
- **Backward compatibility.** Existing stores are backfilled to `general_retail`; a trigger applies the same default to stores inserted by code that is unaware of store types. `fit_check_enabled` defaults to `FALSE`.
- **Eligibility is enforced server-side in three places:** `StoreTypeService.setFitCheckEnabled`, a database trigger (rejects `fit_check_enabled = TRUE` unless the type is fashion), and storefront routes calling `isFitCheckActive`.
- **Clothing never auto-enables Fit Check.** Merchants must enable it explicitly. Changing to a non-fashion type requires `confirmDisableFitCheck` and then disables it; un-flagging a type or reassigning stores on delete also disables it.
- **Deleting a type in use** returns 409 unless `reassignToId` is supplied; reassignment runs in one transaction.
- **Body profiles** (`customer_body_profiles`, migration 0059) live in the `customers` module, are keyed by `(store_id, customer_id)` with a composite FK to `customers`, store metric values, and are never returned by merchant endpoints. The storefront API resolves the customer from the session, never from client input, and responds with `Cache-Control: private, no-store`. Measurement values are never logged.
- **Measurements collected:** height, weight, chest, waist and hip circumference. They are the inputs a parametric morph-target body can use; none were added speculatively.

## Phase 4: avatar generation

- **Technique:** a parametric mannequin, generated locally. `computeAvatarParams` (customers module) turns height, weight, chest, waist and hip into torso cross-sections (elliptical rings from circumference), limb radii (BMI-scaled) and segment lengths (population-average ratios). The result is persisted in `customer_body_avatars` (migration 0060) with a `generator_version`, regenerated in the same transaction whenever the profile is saved, and deleted with the profile.
- **Rendering:** `three` only (no react-three-fiber/drei, to keep dependencies minimal), loaded lazily on the Fit Check page. Orbit rotate/zoom, render-on-demand, pixel ratio capped on touch devices, WebGL-unavailable fallback.
- **No third-party assets or services:** the mannequin is built from generated geometry, so there is no mesh licence, hosting cost or data leaving the platform.
- **Accuracy limits:** shoulder width, limb lengths, posture and body-fat/muscle distribution are inferred from population averages. The avatar represents relative proportions, not an anatomically accurate likeness.

## Phase 5: garment assets

- **Asset type:** merchant-uploaded, pre-modelled binary glTF 2.0 (`.glb`, max 15MB, textures embedded). A product photo is not a usable garment; Fit Check never overlays 2D images.
- **Attachment:** `product_garment_assets` (migration 0061) is owned by the `products` module. One asset per scope: product-level (`variant_id IS NULL`, applies to all variants) or variant-level; a variant's own asset wins. Uploading again replaces the asset for that scope. Existing product/variant tables are unchanged and assets cascade with them.
- **Reference body:** each asset stores the height/chest/waist/hip of the body it was modelled on, so the renderer can scale the garment from that reference to a customer's avatar. Garment slot: top, bottom, outerwear, dress.
- **Safety:** `inspectGlb` checks the GLB header/JSON chunk, requires at least one mesh and rejects any external URI. Files are stored under a server-generated name in `storage/uploads/stores/<storeId>/garments/` (separate from the image-only uploads path) and served only through the storefront route, which requires an active store, active Fit Check, an enabled asset and an ACTIVE product/variant.
- **Gating:** uploads require admin role and active Fit Check. Storefront endpoints return no garments when Fit Check is inactive. Products without a usable garment are simply absent from the storefront catalog, so unsupported products never show Fit Check.
- **Not verified here:** GLB validation is structural. It cannot judge whether a model is well-fitted or rigged; that remains the merchant's authoring responsibility.

## Phase 6: storefront try-on

- **Rendering/fitting:** the existing three.js avatar viewer now accepts a garment. Garments load with `GLTFLoader` (cached by URL, cloned per instance) and are cross-faded in place, so selecting another product swaps the garment without recreating the avatar, camera or canvas.
- **Fit:** `computeGarmentFit` scales the rigid GLB from its stored reference body to the avatar: height ratio vertically, and chest (tops/outerwear), hip (bottoms) or their average (dresses) horizontally, clamped. This is proportional scaling, not cloth simulation or per-region deformation; a garment is only as good as its model.
- **UI:** the collection page shows a Fit Check button only on products present in the storefront garment catalog. A sticky fitting-room panel sits beside the grid on desktop; on mobile it is a bottom sheet and the grid keeps its own scroll space. Variant selection resolves variant garment first, then product garment, else "no 3D garment" messaging.
- **Resilience:** all Fit Check requests fail closed (the feature simply hides); guest, no-profile, avatar failure, garment failure (with retry), WebGL-unsupported and store-switch states are handled. The avatar is re-read each time the panel opens and when the tab regains focus, so changed/deleted measurements or a different signed-in customer are picked up.
- **Scope note:** only the collection detail page is integrated; the all-products listing is not.

## Phase 6b: photo-driven garments that conform to the body

Uploaded GLB garments are only scaled from a reference body, so they do not follow a customer's body shape. A second garment source, `generated` (migration 0062), fits the body and takes its appearance from the product photo:

- **Shape:** `buildGeneratedGarment` builds the garment on the client from the customer's own avatar parameters — torso shell lofted from the same cross-sections the avatar uses (via `sampleTorsoProfile`), sleeves and trouser legs from the avatar's limb sizes — plus a fit ease (slim/regular/loose) and a layer offset so nothing intersects the body. The cut (T-shirt, long sleeve, jacket, trousers, shorts) is a template chosen by the merchant. Nothing is reconstructed from the photo.
- **Appearance:** the merchant picks one of the product's images (default: first). In the browser it is cropped to the garment, plain/transparent background pixels are replaced by the garment colour, and it is front-projected over the garment; the back and non-front faces use the dominant colour. Photos without a plain background are not guessed at; they are used whole and the limitation is documented in the merchant UI.
- **Persistence:** `product_garment_assets.source` is `glb` or `generated`; a DB check keeps the two shapes distinct. Generated rows have no file, so nothing is stored or served for them; the storefront catalog returns template, fit and the resolved photo URL.
- **Limits:** collars, pockets, buttons and drape are not modelled; prints show only as far as the front of the photo shows them; photos taken on a model or at an angle will look wrong. An image-to-3D service could infer more detail but would send product photos to a third party and cost per garment; it was not adopted.
