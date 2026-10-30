export function getOpenApiDocument(): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: "Cal Cart Platform API",
      version: "1.0.0",
      description:
        "Modular monolith commerce platform REST API foundation providing thin versioned routes, server-side authentication, tenant isolation, and standardized response envelopes.",
    },
    servers: [
      {
        url: "/api/v1",
        description: "API v1 base namespace",
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "calcart_session",
          description: "HttpOnly session cookie",
        },
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "Bearer session token",
        },
      },
      schemas: {
        ApiSuccessResponse: {
          type: "object",
          required: ["success", "data"],
          properties: {
            success: { type: "boolean", const: true },
            data: { type: "object" },
          },
        },
        ApiErrorDetails: {
          type: "object",
          required: ["code", "message"],
          properties: {
            code: { type: "string" },
            message: { type: "string" },
            requestId: { type: "string" },
            details: { type: "object" },
            fields: {
              type: "object",
              additionalProperties: { type: "string" },
            },
          },
        },
        ApiErrorResponse: {
          type: "object",
          required: ["success", "error"],
          properties: {
            success: { type: "boolean", const: false },
            error: { $ref: "#/components/schemas/ApiErrorDetails" },
          },
        },
        User: {
          type: "object",
          required: ["id", "email", "name", "status"],
          properties: {
            id: { type: "string", format: "uuid" },
            email: { type: "string", format: "email" },
            name: { type: "string" },
            status: {
              type: "string",
              enum: ["ACTIVE", "SUSPENDED", "INACTIVE"],
            },
          },
        },
        RegisterRequest: {
          type: "object",
          required: ["email", "password", "name"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
            name: { type: "string", maxLength: 100 },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
        },
        PaginationParams: {
          type: "object",
          properties: {
            limit: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 25,
            },
            cursor: { type: "string" },
          },
        },
        PaginatedResult: {
          type: "object",
          required: ["items", "hasMore"],
          properties: {
            items: {
              type: "array",
              items: { type: "object" },
            },
            hasMore: { type: "boolean" },
            nextCursor: { type: "string" },
          },
        },
        StoreSummary: {
          type: "object",
          required: [
            "id",
            "organizationId",
            "name",
            "slug",
            "status",
            "currency",
            "locale",
            "timezone",
            "createdAt",
            "updatedAt",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            organizationId: { type: "string", format: "uuid" },
            name: { type: "string" },
            slug: { type: "string" },
            status: {
              type: "string",
              enum: ["DRAFT", "ACTIVE", "SUSPENDED", "ARCHIVED"],
            },
            currency: { type: "string" },
            locale: { type: "string" },
            timezone: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        StoreSettings: {
          type: "object",
          properties: {
            contactEmail: { type: ["string", "null"] },
            contactPhone: { type: ["string", "null"] },
            description: { type: ["string", "null"] },
          },
        },
        StoreDetail: {
          type: "object",
          required: [
            "id",
            "organizationId",
            "name",
            "slug",
            "status",
            "currency",
            "locale",
            "timezone",
            "settings",
            "createdAt",
            "updatedAt",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            organizationId: { type: "string", format: "uuid" },
            name: { type: "string" },
            slug: { type: "string" },
            status: {
              type: "string",
              enum: ["DRAFT", "ACTIVE", "SUSPENDED", "ARCHIVED"],
            },
            currency: { type: "string" },
            locale: { type: "string" },
            timezone: { type: "string" },
            settings: { $ref: "#/components/schemas/StoreSettings" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        StoreMember: {
          type: "object",
          required: [
            "id",
            "storeId",
            "userId",
            "role",
            "status",
            "createdAt",
            "updatedAt",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            storeId: { type: "string", format: "uuid" },
            userId: { type: "string", format: "uuid" },
            role: { type: "string", enum: ["owner", "admin", "staff"] },
            status: {
              type: "string",
              enum: ["INVITED", "ACTIVE", "SUSPENDED", "REMOVED"],
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateStoreRequest: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", maxLength: 100 },
            slug: { type: "string" },
            currency: { type: "string" },
            locale: { type: "string" },
            timezone: { type: "string" },
            organizationId: { type: "string", format: "uuid" },
            contactEmail: { type: "string", format: "email" },
            contactPhone: { type: "string" },
            description: { type: "string" },
          },
        },
        UpdateStoreRequest: {
          type: "object",
          properties: {
            name: { type: "string", maxLength: 100 },
            currency: { type: "string" },
            locale: { type: "string" },
            timezone: { type: "string" },
            contactEmail: { type: "string", format: "email" },
            contactPhone: { type: "string" },
            description: { type: "string" },
          },
        },
        AddStoreMemberRequest: {
          type: "object",
          required: ["userId", "role"],
          properties: {
            userId: { type: "string", format: "uuid" },
            role: { type: "string", enum: ["owner", "admin", "staff"] },
          },
        },
        UpdateStoreMemberRequest: {
          type: "object",
          properties: {
            role: { type: "string", enum: ["owner", "admin", "staff"] },
            status: {
              type: "string",
              enum: ["INVITED", "ACTIVE", "SUSPENDED", "REMOVED"],
            },
          },
        },
        ProductVariant: {
          type: "object",
          required: [
            "id",
            "productId",
            "title",
            "price",
            "currency",
            "position",
            "status",
            "createdAt",
            "updatedAt",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            productId: { type: "string", format: "uuid" },
            title: { type: "string" },
            sku: { type: "string", nullable: true },
            price: {
              type: "integer",
              minimum: 0,
              description: "Integer minor units (cents)",
            },
            compareAtPrice: { type: "integer", minimum: 0, nullable: true },
            currency: { type: "string" },
            position: { type: "integer" },
            status: {
              type: "string",
              enum: ["ACTIVE", "INACTIVE", "ARCHIVED"],
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        ProductMedia: {
          type: "object",
          required: [
            "id",
            "productId",
            "url",
            "position",
            "createdAt",
            "updatedAt",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            productId: { type: "string", format: "uuid" },
            variantId: { type: "string", format: "uuid", nullable: true },
            url: { type: "string" },
            altText: { type: "string", nullable: true },
            position: { type: "integer" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        ProductSummary: {
          type: "object",
          required: [
            "id",
            "storeId",
            "title",
            "slug",
            "status",
            "variantsCount",
            "mediaCount",
            "createdAt",
            "updatedAt",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            storeId: { type: "string", format: "uuid" },
            title: { type: "string" },
            slug: { type: "string" },
            status: { type: "string", enum: ["DRAFT", "ACTIVE", "ARCHIVED"] },
            publishedAt: { type: "string", format: "date-time", nullable: true },
            variantsCount: { type: "integer" },
            mediaCount: { type: "integer" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        ProductDetail: {
          type: "object",
          required: [
            "id",
            "storeId",
            "title",
            "slug",
            "status",
            "variants",
            "media",
            "createdAt",
            "updatedAt",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            storeId: { type: "string", format: "uuid" },
            title: { type: "string" },
            description: { type: "string", nullable: true },
            slug: { type: "string" },
            status: { type: "string", enum: ["DRAFT", "ACTIVE", "ARCHIVED"] },
            publishedAt: { type: "string", format: "date-time", nullable: true },
            variants: {
              type: "array",
              items: { $ref: "#/components/schemas/ProductVariant" },
            },
            media: {
              type: "array",
              items: { $ref: "#/components/schemas/ProductMedia" },
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateProductRequest: {
          type: "object",
          required: ["title"],
          properties: {
            title: { type: "string", maxLength: 255 },
            description: { type: "string", nullable: true },
            slug: { type: "string" },
            status: { type: "string", enum: ["DRAFT", "ACTIVE", "ARCHIVED"] },
            price: { type: "integer", minimum: 0 },
            compareAtPrice: { type: "integer", minimum: 0, nullable: true },
            sku: { type: "string", nullable: true },
            currency: { type: "string" },
          },
        },
        UpdateProductRequest: {
          type: "object",
          properties: {
            title: { type: "string", maxLength: 255 },
            description: { type: "string", nullable: true },
            slug: { type: "string" },
          },
        },
        CreateVariantRequest: {
          type: "object",
          required: ["title", "price"],
          properties: {
            title: { type: "string" },
            price: { type: "integer", minimum: 0 },
            compareAtPrice: { type: "integer", minimum: 0, nullable: true },
            sku: { type: "string", nullable: true },
            position: { type: "integer" },
          },
        },
        UpdateVariantRequest: {
          type: "object",
          properties: {
            title: { type: "string" },
            price: { type: "integer", minimum: 0 },
            compareAtPrice: { type: "integer", minimum: 0, nullable: true },
            sku: { type: "string", nullable: true },
            position: { type: "integer" },
            status: {
              type: "string",
              enum: ["ACTIVE", "INACTIVE", "ARCHIVED"],
            },
          },
        },
        InventoryItem: {
          type: "object",
          required: [
            "id",
            "storeId",
            "variantId",
            "availableQuantity",
            "reservedQuantity",
            "totalQuantity",
            "createdAt",
            "updatedAt",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            storeId: { type: "string", format: "uuid" },
            variantId: { type: "string", format: "uuid" },
            availableQuantity: { type: "integer" },
            reservedQuantity: { type: "integer" },
            totalQuantity: { type: "integer" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        InventoryAvailability: {
          type: "object",
          required: [
            "variantId",
            "availableQuantity",
            "reservedQuantity",
            "totalQuantity",
            "isAvailable",
          ],
          properties: {
            variantId: { type: "string", format: "uuid" },
            availableQuantity: { type: "integer" },
            reservedQuantity: { type: "integer" },
            totalQuantity: { type: "integer" },
            isAvailable: { type: "boolean" },
          },
        },
        InventoryAdjustment: {
          type: "object",
          required: [
            "id",
            "storeId",
            "inventoryItemId",
            "quantityDelta",
            "previousQuantity",
            "newQuantity",
            "reason",
            "createdAt",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            storeId: { type: "string", format: "uuid" },
            inventoryItemId: { type: "string", format: "uuid" },
            quantityDelta: { type: "integer" },
            previousQuantity: { type: "integer" },
            newQuantity: { type: "integer" },
            reason: {
              type: "string",
              enum: [
                "INITIAL_STOCK",
                "RESTOCK",
                "MANUAL_CORRECTION",
                "DAMAGED",
                "LOST",
                "RETURNED",
                "OTHER",
              ],
            },
            referenceType: { type: ["string", "null"] },
            referenceId: { type: ["string", "null"] },
            createdBy: { type: ["string", "null"] },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        InventoryReservation: {
          type: "object",
          required: [
            "id",
            "storeId",
            "inventoryItemId",
            "referenceType",
            "referenceId",
            "quantity",
            "status",
            "expiresAt",
            "createdAt",
            "updatedAt",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            storeId: { type: "string", format: "uuid" },
            inventoryItemId: { type: "string", format: "uuid" },
            referenceType: { type: "string" },
            referenceId: { type: "string" },
            quantity: { type: "integer", minimum: 1 },
            status: {
              type: "string",
              enum: ["ACTIVE", "RELEASED", "COMMITTED"],
            },
            expiresAt: { type: "string", format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        AdjustInventoryRequest: {
          type: "object",
          required: ["quantityDelta", "reason"],
          properties: {
            quantityDelta: { type: "integer" },
            reason: {
              type: "string",
              enum: [
                "INITIAL_STOCK",
                "RESTOCK",
                "MANUAL_CORRECTION",
                "DAMAGED",
                "LOST",
                "RETURNED",
                "OTHER",
              ],
            },
            referenceType: { type: "string", maxLength: 255 },
            referenceId: { type: "string", maxLength: 255 },
          },
        },
        CreateReservationRequest: {
          type: "object",
          properties: {
            variantId: { type: "string", format: "uuid" },
            quantity: { type: "integer", minimum: 1 },
            items: {
              type: "array",
              items: {
                type: "object",
                required: ["variantId", "quantity"],
                properties: {
                  variantId: { type: "string", format: "uuid" },
                  quantity: { type: "integer", minimum: 1 },
                },
              },
            },
            referenceType: { type: "string", maxLength: 255 },
            referenceId: { type: "string", maxLength: 255 },
            expiresAt: { type: "string", format: "date-time" },
          },
        },
        Customer: {
          type: "object",
          required: [
            "id",
            "storeId",
            "email",
            "status",
            "createdAt",
            "updatedAt",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            storeId: { type: "string", format: "uuid" },
            userId: { type: ["string", "null"], format: "uuid" },
            email: { type: "string", format: "email" },
            firstName: { type: ["string", "null"] },
            lastName: { type: ["string", "null"] },
            phone: { type: ["string", "null"] },
            status: { type: "string", enum: ["ACTIVE", "DISABLED"] },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CustomerAddress: {
          type: "object",
          required: [
            "id",
            "storeId",
            "customerId",
            "addressLine1",
            "city",
            "postalCode",
            "country",
            "isDefault",
            "createdAt",
            "updatedAt",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            storeId: { type: "string", format: "uuid" },
            customerId: { type: "string", format: "uuid" },
            firstName: { type: ["string", "null"] },
            lastName: { type: ["string", "null"] },
            company: { type: ["string", "null"] },
            addressLine1: { type: "string" },
            addressLine2: { type: ["string", "null"] },
            city: { type: "string" },
            state: { type: ["string", "null"] },
            postalCode: { type: "string" },
            country: { type: "string" },
            phone: { type: ["string", "null"] },
            label: { type: ["string", "null"] },
            isDefault: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CustomerDetail: {
          type: "object",
          required: [
            "id",
            "storeId",
            "email",
            "status",
            "addresses",
            "createdAt",
            "updatedAt",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            storeId: { type: "string", format: "uuid" },
            userId: { type: ["string", "null"], format: "uuid" },
            email: { type: "string", format: "email" },
            firstName: { type: ["string", "null"] },
            lastName: { type: ["string", "null"] },
            phone: { type: ["string", "null"] },
            status: { type: "string", enum: ["ACTIVE", "DISABLED"] },
            addresses: {
              type: "array",
              items: { $ref: "#/components/schemas/CustomerAddress" },
            },
            defaultAddress: {
              anyOf: [
                { $ref: "#/components/schemas/CustomerAddress" },
                { type: "null" },
              ],
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateCustomerRequest: {
          type: "object",
          required: ["email"],
          properties: {
            email: { type: "string", format: "email" },
            firstName: { type: ["string", "null"] },
            lastName: { type: ["string", "null"] },
            phone: { type: ["string", "null"] },
            userId: { type: ["string", "null"], format: "uuid" },
          },
        },
        UpdateCustomerRequest: {
          type: "object",
          properties: {
            email: { type: "string", format: "email" },
            firstName: { type: ["string", "null"] },
            lastName: { type: ["string", "null"] },
            phone: { type: ["string", "null"] },
            status: { type: "string", enum: ["ACTIVE", "DISABLED"] },
            userId: { type: ["string", "null"], format: "uuid" },
          },
        },
        CreateCustomerAddressRequest: {
          type: "object",
          required: [
            "addressLine1",
            "city",
            "postalCode",
            "country",
          ],
          properties: {
            addressLine1: { type: "string" },
            addressLine2: { type: ["string", "null"] },
            city: { type: "string" },
            state: { type: ["string", "null"] },
            postalCode: { type: "string" },
            country: { type: "string" },
            firstName: { type: ["string", "null"] },
            lastName: { type: ["string", "null"] },
            company: { type: ["string", "null"] },
            phone: { type: ["string", "null"] },
            label: { type: ["string", "null"] },
            isDefault: { type: "boolean" },
          },
        },
        UpdateCustomerAddressRequest: {
          type: "object",
          properties: {
            addressLine1: { type: "string" },
            addressLine2: { type: ["string", "null"] },
            city: { type: "string" },
            state: { type: ["string", "null"] },
            postalCode: { type: "string" },
            country: { type: "string" },
            firstName: { type: ["string", "null"] },
            lastName: { type: ["string", "null"] },
            company: { type: ["string", "null"] },
            phone: { type: ["string", "null"] },
            label: { type: ["string", "null"] },
            isDefault: { type: "boolean" },
          },
        },
        CartItem: {
          type: "object",
          required: [
            "id",
            "cartId",
            "storeId",
            "variantId",
            "quantity",
            "unitPrice",
            "lineSubtotal",
            "createdAt",
            "updatedAt",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            cartId: { type: "string", format: "uuid" },
            storeId: { type: "string", format: "uuid" },
            variantId: { type: "string", format: "uuid" },
            quantity: { type: "integer", minimum: 1 },
            unitPrice: { type: "integer", minimum: 0 },
            lineSubtotal: { type: "integer", minimum: 0 },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Cart: {
          type: "object",
          required: [
            "id",
            "storeId",
            "status",
            "currency",
            "subtotal",
            "discountTotal",
            "taxTotal",
            "shippingTotal",
            "grandTotal",
            "items",
            "createdAt",
            "updatedAt",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            storeId: { type: "string", format: "uuid" },
            customerId: { type: ["string", "null"], format: "uuid" },
            guestIdentifier: { type: ["string", "null"] },
            status: {
              type: "string",
              enum: ["ACTIVE", "CONVERTED", "ABANDONED", "EXPIRED"],
            },
            currency: { type: "string", minLength: 3, maxLength: 3 },
            subtotal: { type: "integer", minimum: 0 },
            discountTotal: { type: "integer", minimum: 0 },
            taxTotal: { type: "integer", minimum: 0 },
            shippingTotal: { type: "integer", minimum: 0 },
            grandTotal: { type: "integer", minimum: 0 },
            items: {
              type: "array",
              items: { $ref: "#/components/schemas/CartItem" },
            },
            expiresAt: { type: ["string", "null"], format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateCartRequest: {
          type: "object",
          properties: {
            customerId: { type: ["string", "null"], format: "uuid" },
            guestIdentifier: { type: ["string", "null"] },
            currency: { type: "string", minLength: 3, maxLength: 3 },
            expiresAt: { type: ["string", "null"], format: "date-time" },
          },
        },
        AddCartItemRequest: {
          type: "object",
          required: ["variantId", "quantity"],
          properties: {
            variantId: { type: "string", format: "uuid" },
            quantity: { type: "integer", minimum: 1 },
          },
        },
        UpdateCartItemQuantityRequest: {
          type: "object",
          required: ["quantity"],
          properties: {
            quantity: { type: "integer", minimum: 0 },
          },
        },
        AssociateCustomerRequest: {
          type: "object",
          required: ["customerId"],
          properties: {
            customerId: { type: "string", format: "uuid" },
          },
        },
        CheckoutAddress: {
          type: "object",
          required: ["addressLine1", "city", "country", "postalCode"],
          properties: {
            addressLine1: { type: "string" },
            addressLine2: { type: ["string", "null"] },
            city: { type: "string" },
            state: { type: ["string", "null"] },
            postalCode: { type: "string" },
            country: { type: "string" },
            firstName: { type: ["string", "null"] },
            lastName: { type: ["string", "null"] },
            phone: { type: ["string", "null"] },
          },
        },
        CheckoutItem: {
          type: "object",
          required: [
            "id",
            "checkoutId",
            "storeId",
            "variantId",
            "productNameSnapshot",
            "variantNameSnapshot",
            "unitPrice",
            "quantity",
            "lineTotal",
            "createdAt",
            "updatedAt",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            checkoutId: { type: "string", format: "uuid" },
            storeId: { type: "string", format: "uuid" },
            variantId: { type: "string", format: "uuid" },
            productNameSnapshot: { type: "string" },
            variantNameSnapshot: { type: "string" },
            skuSnapshot: { type: ["string", "null"] },
            unitPrice: { type: "integer", minimum: 0 },
            quantity: { type: "integer", minimum: 1 },
            lineTotal: { type: "integer", minimum: 0 },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Checkout: {
          type: "object",
          required: [
            "id",
            "storeId",
            "cartId",
            "status",
            "currency",
            "subtotal",
            "discountTotal",
            "taxTotal",
            "shippingTotal",
            "total",
            "createdAt",
            "updatedAt",
            "items",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            storeId: { type: "string", format: "uuid" },
            cartId: { type: "string", format: "uuid" },
            customerId: { type: ["string", "null"], format: "uuid" },
            email: { type: ["string", "null"], format: "email" },
            status: {
              type: "string",
              enum: [
                "OPEN",
                "PAYMENT_PENDING",
                "COMPLETED",
                "CANCELLED",
                "EXPIRED",
                "FAILED",
              ],
            },
            currency: { type: "string", minLength: 3, maxLength: 3 },
            subtotal: { type: "integer", minimum: 0 },
            discountTotal: { type: "integer", minimum: 0 },
            taxTotal: { type: "integer", minimum: 0 },
            shippingTotal: { type: "integer", minimum: 0 },
            total: { type: "integer", minimum: 0 },
            shippingAddress: {
              anyOf: [
                { $ref: "#/components/schemas/CheckoutAddress" },
                { type: "null" },
              ],
            },
            billingAddress: {
              anyOf: [
                { $ref: "#/components/schemas/CheckoutAddress" },
                { type: "null" },
              ],
            },
            paymentStatus: {
              type: "string",
              enum: ["NOT_PAID", "PENDING", "PAID", "FAILED", "CANCELLED"],
            },
            expiresAt: { type: ["string", "null"], format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            items: {
              type: "array",
              items: { $ref: "#/components/schemas/CheckoutItem" },
            },
          },
        },
        CreateCheckoutRequest: {
          type: "object",
          properties: {
            cartId: { type: ["string", "null"], format: "uuid" },
            customerId: { type: ["string", "null"], format: "uuid" },
            email: { type: ["string", "null"], format: "email" },
            currency: { type: "string", minLength: 3, maxLength: 3 },
            shippingAddress: {
              anyOf: [
                { $ref: "#/components/schemas/CheckoutAddress" },
                { type: "null" },
              ],
            },
            billingAddress: {
              anyOf: [
                { $ref: "#/components/schemas/CheckoutAddress" },
                { type: "null" },
              ],
            },
            expiresAt: { type: ["string", "null"], format: "date-time" },
          },
        },
        UpdateCheckoutRequest: {
          type: "object",
          properties: {
            customerId: { type: ["string", "null"], format: "uuid" },
            email: { type: ["string", "null"], format: "email" },
            shippingAddress: {
              anyOf: [
                { $ref: "#/components/schemas/CheckoutAddress" },
                { type: "null" },
              ],
            },
            billingAddress: {
              anyOf: [
                { $ref: "#/components/schemas/CheckoutAddress" },
                { type: "null" },
              ],
            },
            discountTotal: { type: "integer", minimum: 0 },
            taxTotal: { type: "integer", minimum: 0 },
            shippingTotal: { type: "integer", minimum: 0 },
            itemAction: {
              type: "object",
              required: ["action"],
              properties: {
                action: { type: "string", enum: ["add", "update", "remove"] },
                variantId: { type: "string", format: "uuid" },
                itemId: { type: "string", format: "uuid" },
                quantity: { type: "integer", minimum: 1 },
              },
            },
          },
        },
      },
    },
    paths: {
      "/health": {
        get: {
          summary: "API and database health check",
          responses: {
            "200": {
              description: "System is healthy",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          status: { type: "string" },
                          database: { type: "string" },
                          timestamp: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/openapi": {
        get: {
          summary: "OpenAPI 3.1 Specification",
          responses: {
            "200": {
              description: "OpenAPI specification document",
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
      "/auth/register": {
        post: {
          summary: "Register new user account",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RegisterRequest" },
              },
            },
          },
          responses: {
            "201": {
              description: "User registered successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          user: { $ref: "#/components/schemas/User" },
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Validation error",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiErrorResponse" },
                },
              },
            },
            "409": {
              description: "User already exists",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/auth/login": {
        post: {
          summary: "Authenticate credentials and establish session",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Authenticated successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          user: { $ref: "#/components/schemas/User" },
                        },
                      },
                    },
                  },
                },
              },
            },
            "401": {
              description: "Invalid credentials",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/auth/logout": {
        post: {
          summary: "Revoke active session and clear cookie",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          responses: {
            "200": {
              description: "Logged out successfully",
            },
            "401": {
              description: "Authentication required",
            },
          },
        },
      },
      "/auth/me": {
        get: {
          summary: "Get current authenticated user profile",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          responses: {
            "200": {
              description: "Current user profile",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          user: { $ref: "#/components/schemas/User" },
                        },
                      },
                    },
                  },
                },
              },
            },
            "401": {
              description: "Authentication required",
            },
          },
        },
      },
      "/stores": {
        post: {
          summary: "Create a new store",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateStoreRequest" },
              },
            },
          },
          responses: {
            "201": {
              description: "Store created successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/StoreDetail" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "409": { description: "Store slug already exists" },
          },
        },
        get: {
          summary: "List stores accessible to authenticated user",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          responses: {
            "200": {
              description: "Accessible stores list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          items: {
                            type: "array",
                            items: {
                              $ref: "#/components/schemas/StoreSummary",
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "401": { description: "Authentication required" },
          },
        },
      },
      "/stores/{storeId}": {
        get: {
          summary: "Get store details",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Store details",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/StoreDetail" },
                    },
                  },
                },
              },
            },
            "401": { description: "Authentication required" },
            "404": { description: "Store not found" },
          },
        },
        patch: {
          summary: "Update store configuration",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateStoreRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Store updated successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/StoreDetail" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden" },
            "404": { description: "Store not found" },
          },
        },
      },
      "/stores/{storeId}/activate": {
        post: {
          summary: "Activate store",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Store activated successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/StoreDetail" },
                    },
                  },
                },
              },
            },
            "400": { description: "Invalid status transition" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden" },
            "404": { description: "Store not found" },
          },
        },
      },
      "/stores/{storeId}/suspend": {
        post: {
          summary: "Suspend store",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Store suspended successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/StoreDetail" },
                    },
                  },
                },
              },
            },
            "400": { description: "Invalid status transition" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden" },
            "404": { description: "Store not found" },
          },
        },
      },
      "/stores/{storeId}/reactivate": {
        post: {
          summary: "Reactivate suspended store",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Store reactivated successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/StoreDetail" },
                    },
                  },
                },
              },
            },
            "400": { description: "Invalid status transition" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden" },
            "404": { description: "Store not found" },
          },
        },
      },
      "/stores/{storeId}/archive": {
        post: {
          summary: "Archive store",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Store archived successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/StoreDetail" },
                    },
                  },
                },
              },
            },
            "400": { description: "Invalid status transition" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden" },
            "404": { description: "Store not found" },
          },
        },
      },
      "/stores/{storeId}/members": {
        get: {
          summary: "List store members",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Store members list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          items: {
                            type: "array",
                            items: { $ref: "#/components/schemas/StoreMember" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden" },
            "404": { description: "Store not found" },
          },
        },
        post: {
          summary: "Add member to store",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AddStoreMemberRequest" },
              },
            },
          },
          responses: {
            "201": {
              description: "Member added successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/StoreMember" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden" },
            "404": { description: "Store not found" },
            "409": { description: "Member already exists" },
          },
        },
      },
      "/stores/{storeId}/members/{memberId}": {
        patch: {
          summary: "Update store member role or status",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "memberId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/UpdateStoreMemberRequest",
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Member updated successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/StoreMember" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation or owner protection error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden" },
            "404": { description: "Not found" },
          },
        },
        delete: {
          summary: "Remove member from store",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "memberId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Member removed successfully",
            },
            "400": { description: "Cannot remove last owner" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden" },
            "404": { description: "Not found" },
          },
        },
      },
      "/stores/{storeId}/products": {
        get: {
          summary: "List store products with pagination and status filter",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 100, default: 25 },
            },
            {
              name: "cursor",
              in: "query",
              required: false,
              schema: { type: "string" },
            },
            {
              name: "status",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["DRAFT", "ACTIVE", "ARCHIVED"] },
            },
          ],
          responses: {
            "200": {
              description: "Paginated list of products",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          items: {
                            type: "array",
                            items: { $ref: "#/components/schemas/ProductSummary" },
                          },
                          hasMore: { type: "boolean" },
                          nextCursor: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
            "401": { description: "Authentication required" },
            "404": { description: "Store not found" },
          },
        },
        post: {
          summary: "Create product in store",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateProductRequest" },
              },
            },
          },
          responses: {
            "201": {
              description: "Product created successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/ProductDetail" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden" },
            "404": { description: "Store not found" },
            "409": { description: "Slug or SKU conflict" },
          },
        },
      },
      "/stores/{storeId}/products/{productId}": {
        get: {
          summary: "Get product details by ID",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "productId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Product details",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/ProductDetail" },
                    },
                  },
                },
              },
            },
            "401": { description: "Authentication required" },
            "404": { description: "Product not found" },
          },
        },
        patch: {
          summary: "Update product attributes",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "productId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateProductRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Product updated successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/ProductDetail" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden" },
            "404": { description: "Product not found" },
            "409": { description: "Slug conflict" },
          },
        },
      },
      "/stores/{storeId}/products/{productId}/publish": {
        post: {
          summary: "Publish product (transition to ACTIVE)",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "productId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Product published successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/ProductDetail" },
                    },
                  },
                },
              },
            },
            "400": { description: "Invalid state transition or publishability failure" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden" },
            "404": { description: "Product not found" },
          },
        },
      },
      "/stores/{storeId}/products/{productId}/unpublish": {
        post: {
          summary: "Unpublish product (transition to DRAFT)",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "productId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Product unpublished successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/ProductDetail" },
                    },
                  },
                },
              },
            },
            "400": { description: "Invalid state transition" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden" },
            "404": { description: "Product not found" },
          },
        },
      },
      "/stores/{storeId}/products/{productId}/archive": {
        post: {
          summary: "Archive product (transition to ARCHIVED)",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "productId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Product archived successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/ProductDetail" },
                    },
                  },
                },
              },
            },
            "400": { description: "Invalid state transition" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden" },
            "404": { description: "Product not found" },
          },
        },
      },
      "/stores/{storeId}/products/{productId}/variants": {
        get: {
          summary: "List variants for a product",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "productId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "List of product variants",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          items: {
                            type: "array",
                            items: { $ref: "#/components/schemas/ProductVariant" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "401": { description: "Authentication required" },
            "404": { description: "Product not found" },
          },
        },
        post: {
          summary: "Add variant to product",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "productId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateVariantRequest" },
              },
            },
          },
          responses: {
            "201": {
              description: "Variant created successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/ProductVariant" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden" },
            "404": { description: "Product not found" },
            "409": { description: "SKU conflict" },
          },
        },
      },
      "/stores/{storeId}/products/{productId}/variants/{variantId}": {
        patch: {
          summary: "Update product variant",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "productId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "variantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateVariantRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Variant updated successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/ProductVariant" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error or invalid state transition" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden" },
            "404": { description: "Variant not found" },
            "409": { description: "SKU conflict" },
          },
        },
        delete: {
          summary: "Delete product variant",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "productId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "variantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": { description: "Variant deleted successfully" },
            "400": { description: "Cannot delete last remaining variant" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden" },
            "404": { description: "Variant not found" },
          },
        },
      },
      "/stores/{storeId}/inventory": {
        get: {
          summary: "Query store inventory by variant or item",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "variantId",
              in: "query",
              required: false,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "itemId",
              in: "query",
              required: false,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "availability",
              in: "query",
              required: false,
              schema: { type: "boolean" },
            },
          ],
          responses: {
            "200": {
              description: "Inventory details or availability",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        oneOf: [
                          { $ref: "#/components/schemas/InventoryItem" },
                          { $ref: "#/components/schemas/InventoryAvailability" },
                        ],
                      },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden" },
            "404": { description: "Resource not found" },
          },
        },
      },
      "/stores/{storeId}/inventory/{variantId}": {
        get: {
          summary: "Get inventory item and availability for variant",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "variantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "availability",
              in: "query",
              required: false,
              schema: { type: "boolean" },
            },
          ],
          responses: {
            "200": {
              description: "Inventory item or availability",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        oneOf: [
                          { $ref: "#/components/schemas/InventoryItem" },
                          { $ref: "#/components/schemas/InventoryAvailability" },
                        ],
                      },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden" },
            "404": { description: "Variant inventory not found" },
          },
        },
      },
      "/stores/{storeId}/inventory/{variantId}/adjust": {
        post: {
          summary: "Adjust stock for variant",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "variantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "Idempotency-Key",
              in: "header",
              required: false,
              schema: { type: "string", maxLength: 255 },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AdjustInventoryRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Stock adjusted successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          item: { $ref: "#/components/schemas/InventoryItem" },
                          adjustment: {
                            $ref: "#/components/schemas/InventoryAdjustment",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error or invalid quantity" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden" },
            "404": { description: "Resource not found" },
            "409": { description: "Insufficient stock or idempotency conflict" },
          },
        },
      },
      "/stores/{storeId}/inventory/{variantId}/history": {
        get: {
          summary: "Get adjustment history for variant",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "variantId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 100, default: 50 },
            },
          ],
          responses: {
            "200": {
              description: "List of adjustments",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          items: {
                            type: "array",
                            items: {
                              $ref: "#/components/schemas/InventoryAdjustment",
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden" },
            "404": { description: "Resource not found" },
          },
        },
      },
      "/stores/{storeId}/inventory/items/{itemId}": {
        get: {
          summary: "Get inventory item by ID",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "itemId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Inventory item details",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/InventoryItem" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden" },
            "404": { description: "Inventory item not found" },
          },
        },
      },
      "/stores/{storeId}/inventory/reservations": {
        post: {
          summary: "Create inventory reservation",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "Idempotency-Key",
              in: "header",
              required: false,
              schema: { type: "string", maxLength: 255 },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CreateReservationRequest",
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Reservation created successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        oneOf: [
                          { $ref: "#/components/schemas/InventoryReservation" },
                          {
                            type: "object",
                            properties: {
                              reservations: {
                                type: "array",
                                items: {
                                  $ref: "#/components/schemas/InventoryReservation",
                                },
                              },
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden" },
            "404": { description: "Resource not found" },
            "409": { description: "Insufficient stock or reservation conflict" },
          },
        },
      },
      "/stores/{storeId}/inventory/reservations/{reservationId}": {
        get: {
          summary: "Get reservation by ID",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "reservationId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Reservation details",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        $ref: "#/components/schemas/InventoryReservation",
                      },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden" },
            "404": { description: "Reservation not found" },
          },
        },
      },
      "/stores/{storeId}/inventory/reservations/{reservationId}/release": {
        post: {
          summary: "Release inventory reservation",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "reservationId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Reservation released successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        $ref: "#/components/schemas/InventoryReservation",
                      },
                    },
                  },
                },
              },
            },
            "400": { description: "Invalid reservation state transition" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden" },
            "404": { description: "Reservation not found" },
          },
        },
      },
      "/stores/{storeId}/inventory/reservations/{reservationId}/finalize": {
        post: {
          summary: "Finalize/commit inventory reservation",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "reservationId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Reservation committed successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        $ref: "#/components/schemas/InventoryReservation",
                      },
                    },
                  },
                },
              },
            },
            "400": { description: "Invalid reservation state transition" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden" },
            "404": { description: "Reservation not found" },
          },
        },
      },
      "/stores/{storeId}/customers": {
        get: {
          summary: "List customers in store with pagination and filters",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "status",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["ACTIVE", "DISABLED"] },
            },
            {
              name: "search",
              in: "query",
              required: false,
              schema: { type: "string" },
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 100, default: 25 },
            },
            {
              name: "cursor",
              in: "query",
              required: false,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Customer collection",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          items: {
                            type: "array",
                            items: { $ref: "#/components/schemas/Customer" },
                          },
                          hasMore: { type: "boolean" },
                          nextCursor: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "404": { description: "Store not found" },
          },
        },
        post: {
          summary: "Create customer in store",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateCustomerRequest" },
              },
            },
          },
          responses: {
            "201": {
              description: "Customer created successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/Customer" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden - requires admin role" },
            "404": { description: "Store not found" },
            "409": { description: "Customer already exists" },
          },
        },
      },
      "/stores/{storeId}/customers/{customerId}": {
        get: {
          summary: "Get customer details with addresses",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "customerId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Customer detail with addresses",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/CustomerDetail" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "404": { description: "Customer or store not found" },
          },
        },
        patch: {
          summary: "Update customer profile",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "customerId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateCustomerRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Customer updated successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/Customer" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden - requires admin role" },
            "404": { description: "Customer or store not found" },
            "409": { description: "Duplicate email or customer" },
          },
        },
      },
      "/stores/{storeId}/customers/{customerId}/enable": {
        post: {
          summary: "Enable customer account",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "customerId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Customer enabled successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/Customer" },
                    },
                  },
                },
              },
            },
            "400": { description: "Invalid state transition" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden - requires admin role" },
            "404": { description: "Customer or store not found" },
          },
        },
      },
      "/stores/{storeId}/customers/{customerId}/disable": {
        post: {
          summary: "Disable customer account",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "customerId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Customer disabled successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/Customer" },
                    },
                  },
                },
              },
            },
            "400": { description: "Invalid state transition" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden - requires admin role" },
            "404": { description: "Customer or store not found" },
          },
        },
      },
      "/stores/{storeId}/customers/{customerId}/addresses": {
        get: {
          summary: "List customer addresses",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "customerId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "List of customer addresses",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          items: {
                            type: "array",
                            items: {
                              $ref: "#/components/schemas/CustomerAddress",
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "404": { description: "Customer or store not found" },
          },
        },
        post: {
          summary: "Create customer address",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "customerId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CreateCustomerAddressRequest",
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Customer address created successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        $ref: "#/components/schemas/CustomerAddress",
                      },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden - requires admin role" },
            "404": { description: "Customer or store not found" },
          },
        },
      },
      "/stores/{storeId}/customers/{customerId}/addresses/{addressId}": {
        get: {
          summary: "Get customer address by ID",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "customerId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "addressId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Customer address",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        $ref: "#/components/schemas/CustomerAddress",
                      },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "404": { description: "Address, customer, or store not found" },
          },
        },
        patch: {
          summary: "Update customer address",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "customerId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "addressId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/UpdateCustomerAddressRequest",
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Customer address updated successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        $ref: "#/components/schemas/CustomerAddress",
                      },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden - requires admin role" },
            "404": { description: "Address, customer, or store not found" },
          },
        },
        delete: {
          summary: "Delete customer address",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "customerId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "addressId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Customer address deleted successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          deleted: { type: "boolean" },
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden - requires admin role" },
            "404": { description: "Address, customer, or store not found" },
          },
        },
      },
      "/stores/{storeId}/customers/{customerId}/addresses/{addressId}/default": {
        post: {
          summary: "Set customer default address",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "customerId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "addressId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Default address set successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        $ref: "#/components/schemas/CustomerAddress",
                      },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden - requires admin role" },
            "404": { description: "Address, customer, or store not found" },
          },
        },
      },
      "/stores/{storeId}/carts": {
        get: {
          summary: "Get active cart for customer or guest",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "customerId",
              in: "query",
              required: false,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "guestIdentifier",
              in: "query",
              required: false,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Active cart retrieved successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/Cart" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "404": { description: "Cart or store not found" },
          },
        },
        post: {
          summary: "Create cart",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateCartRequest" },
              },
            },
          },
          responses: {
            "201": {
              description: "Cart created successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/Cart" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden - requires admin role" },
            "404": { description: "Store or customer not found" },
          },
        },
      },
      "/stores/{storeId}/carts/active": {
        get: {
          summary: "Get active cart",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "customerId",
              in: "query",
              required: false,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "guestIdentifier",
              in: "query",
              required: false,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Active cart retrieved successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/Cart" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "404": { description: "Cart or store not found" },
          },
        },
      },
      "/stores/{storeId}/carts/{cartId}": {
        get: {
          summary: "Get cart with items by ID",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "cartId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Cart retrieved successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/Cart" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "404": { description: "Cart or store not found" },
          },
        },
      },
      "/stores/{storeId}/carts/{cartId}/items": {
        get: {
          summary: "List cart items",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "cartId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Cart items retrieved successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          items: {
                            type: "array",
                            items: { $ref: "#/components/schemas/CartItem" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "404": { description: "Cart or store not found" },
          },
        },
        post: {
          summary: "Add item to cart",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "cartId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AddCartItemRequest" },
              },
            },
          },
          responses: {
            "201": {
              description: "Item added to cart successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/Cart" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation or domain error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden - requires admin role" },
            "404": { description: "Cart, variant, or store not found" },
          },
        },
        delete: {
          summary: "Clear all cart items",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "cartId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Cart cleared successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/Cart" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden - requires admin role" },
            "404": { description: "Cart or store not found" },
          },
        },
      },
      "/stores/{storeId}/carts/{cartId}/items/{itemId}": {
        get: {
          summary: "Get cart item by ID",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "cartId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "itemId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Cart item retrieved successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/CartItem" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "404": { description: "Item, cart, or store not found" },
          },
        },
        patch: {
          summary: "Update cart item quantity",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "cartId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "itemId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/UpdateCartItemQuantityRequest",
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Cart item quantity updated successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/Cart" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden - requires admin role" },
            "404": { description: "Item, cart, or store not found" },
          },
        },
        delete: {
          summary: "Remove item from cart",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "cartId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "itemId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Item removed from cart successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/Cart" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden - requires admin role" },
            "404": { description: "Item, cart, or store not found" },
          },
        },
      },
      "/stores/{storeId}/carts/{cartId}/customer": {
        post: {
          summary: "Associate customer with cart",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "cartId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AssociateCustomerRequest",
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Customer associated with cart successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/Cart" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation or cross-store error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden - requires admin role" },
            "404": { description: "Customer, cart, or store not found" },
          },
        },
      },
      "/stores/{storeId}/carts/{cartId}/clear": {
        post: {
          summary: "Clear cart items",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "cartId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Cart cleared successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/Cart" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden - requires admin role" },
            "404": { description: "Cart or store not found" },
          },
        },
      },
      "/stores/{storeId}/carts/{cartId}/complete": {
        post: {
          summary: "Transition cart to CONVERTED",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "cartId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Cart transitioned to CONVERTED successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/Cart" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation or state error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden - requires admin role" },
            "404": { description: "Cart or store not found" },
          },
        },
      },
      "/stores/{storeId}/carts/{cartId}/expire": {
        post: {
          summary: "Transition cart to EXPIRED",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "cartId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Cart transitioned to EXPIRED successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/Cart" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation or state error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden - requires admin role" },
            "404": { description: "Cart or store not found" },
          },
        },
      },
      "/stores/{storeId}/carts/{cartId}/abandon": {
        post: {
          summary: "Transition cart to ABANDONED",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "cartId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Cart transitioned to ABANDONED successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/Cart" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation or state error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden - requires admin role" },
            "404": { description: "Cart or store not found" },
          },
        },
      },
      "/stores/{storeId}/checkouts": {
        post: {
          summary: "Create a new checkout directly or from cart",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "Idempotency-Key",
              in: "header",
              required: false,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateCheckoutRequest" },
              },
            },
          },
          responses: {
            "201": {
              description: "Checkout created successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/Checkout" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation or domain error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden - requires admin role" },
            "404": { description: "Store or cart not found" },
            "409": { description: "Idempotency conflict" },
          },
        },
      },
      "/stores/{storeId}/checkouts/{checkoutId}": {
        get: {
          summary: "Get checkout details with items and addresses",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "checkoutId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Checkout retrieved successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/Checkout" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
            "401": { description: "Authentication required" },
            "404": { description: "Checkout or store not found" },
          },
        },
        patch: {
          summary: "Update checkout customer, addresses, totals, or items",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "checkoutId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateCheckoutRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Checkout updated successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/Checkout" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation or domain error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden - requires admin role" },
            "404": { description: "Checkout or store not found" },
          },
        },
      },
      "/stores/{storeId}/checkouts/{checkoutId}/cancel": {
        post: {
          summary: "Explicitly cancel an active checkout",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "storeId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "checkoutId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Checkout cancelled successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/Checkout" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation or domain error" },
            "401": { description: "Authentication required" },
            "403": { description: "Forbidden - requires admin role" },
            "404": { description: "Checkout or store not found" },
          },
        },
      },
    },
  };
}
