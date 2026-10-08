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
            status: { type: "string", enum: ["ACTIVE", "SUSPENDED", "INACTIVE"] },
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
    },
  };
}
