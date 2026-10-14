import {
  login,
  register,
  serializeSessionCookie,
  UserAlreadyExistsError,
} from "@shopify-clone/auth";
import { CustomerService } from "@shopify-clone/customers";
import { CartService } from "@shopify-clone/carts";
import { StoreService } from "@shopify-clone/stores";
import { getEmailService } from "@shopify-clone/email";
import {
  apiSuccess,
  customerRegisterValidator,
  handleApiError,
  resolveRequestContext,
  validateBody,
} from "@/lib/api";
import { extractGuestIdentifier } from "@/lib/storefront-auth-helpers";

const storeService = new StoreService();
const customerService = new CustomerService();
const cartService = new CartService();

interface RouteContext {
  params: Promise<{ storeSlug: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug } = await Promise.resolve(context.params);
    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);

    const body = await validateBody(req, customerRegisterValidator);

    let authResult: { user: { id: string; email: string; name: string; status: string }; session: { id: string; expiresAt: Date } };

    try {
      const fullName = [body.firstName, body.lastName].filter(Boolean).join(" ").trim() || body.email.split("@")[0] || "Customer";
      authResult = await register(ctx.db, {
        email: body.email,
        password: body.password,
        name: fullName,
      });
    } catch (err) {
      if (err instanceof UserAlreadyExistsError) {
        // Try logging in with the provided password
        authResult = await login(ctx.db, {
          email: body.email,
          password: body.password,
        });
      } else {
        throw err;
      }
    }

    // Now associate or create the customer record for this specific store
    let customer = await customerService.getCustomerByUserId(
      ctx.db,
      store.id,
      authResult.user.id
    );

    if (!customer) {
      // Check if a customer record with this email already exists (e.g. from guest checkout)
      const existingEmailCustomer = await customerService.getCustomerByEmail(
        ctx.db,
        store.id,
        body.email
      );

      if (existingEmailCustomer) {
        // Link customer to user account
        customer = await customerService.updateCustomer(
          ctx.db,
          store.id,
          existingEmailCustomer.id,
          {
            userId: authResult.user.id,
            firstName: body.firstName ?? existingEmailCustomer.firstName,
            lastName: body.lastName ?? existingEmailCustomer.lastName,
            phone: body.phone ?? existingEmailCustomer.phone,
          }
        );
      } else {
        // Create new customer record in this store
        customer = await customerService.createCustomer(ctx.db, store.id, {
          email: body.email,
          firstName: body.firstName,
          lastName: body.lastName,
          phone: body.phone,
          userId: authResult.user.id,
        });
      }
    }

    // Merge guest cart if caller has an active guest session
    const guestIdentifier = extractGuestIdentifier(req);
    if (guestIdentifier && customer) {
      try {
        await cartService.mergeCart(ctx.db, store.id, guestIdentifier, customer.id);
      } catch {
        // Proceed with registration even if cart merge fails or has no items
      }
    }

    try {
      const emailService = getEmailService();
      await emailService.sendCustomerWelcome({
        to: body.email,
        storeName: store.name,
        storeSlug,
        customerName: body.firstName,
      });
    } catch (emailErr) {
      console.error("[Customer:Register] Welcome email delivery failed:", emailErr);
    }

    const sessionCookie = serializeSessionCookie(authResult.session.id, {
      expires: authResult.session.expiresAt,
    });

    const headers = new Headers();
    headers.set("Set-Cookie", sessionCookie);

    return apiSuccess(
      {
        customer,
        user: {
          id: authResult.user.id,
          email: authResult.user.email,
          name: authResult.user.name,
        },
      },
      {
        status: 201,
        headers,
        requestId,
      }
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
