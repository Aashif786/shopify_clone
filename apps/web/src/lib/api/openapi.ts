export function getOpenApiDocument(): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: "Shopify-like Commerce Platform API",
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
          name: "shopify_clone_session",
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
    },
  };
}
