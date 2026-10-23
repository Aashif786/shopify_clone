import { createPasswordResetToken } from "@shopify-clone/auth";
import { getEmailService } from "@shopify-clone/email";
import { StoreService } from "@shopify-clone/stores";
import { CustomerService } from "@shopify-clone/customers";
import {
  apiSuccess,
  forgotPasswordValidator,
  handleApiError,
  resolveRequestContext,
  validateBody,
} from "@/lib/api";

const storeService = new StoreService();
const customerService = new CustomerService();

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

    const validated = await validateBody(req, forgotPasswordValidator);
    const token = await createPasswordResetToken(ctx.db, validated.email);

    if (token) {
      try {
        const customer = await customerService.getCustomerByEmail(
          ctx.db,
          store.id,
          validated.email
        );

        const emailService = getEmailService();
        await emailService.sendStorefrontPasswordReset({
          to: validated.email,
          token,
          storeName: store.name,
          storeSlug,
          customerName: customer?.firstName || undefined,
        });
      } catch (emailErr) {
        console.error("[Auth:StorefrontForgotPassword] Email delivery failed:", emailErr);
      }
    }

    return apiSuccess(
      {
        message: "If an account exists with that email, password reset instructions have been sent.",
      },
      {
        status: 200,
        requestId,
      }
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
