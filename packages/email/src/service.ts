import { Resend } from "resend";
import {
  resolveEmailConfig,
  type EmailConfig,
  type EmailDeliveryMode,
} from "./config.js";
import {
  MissingEmailProviderConfigurationError,
} from "./errors.js";
import {
  renderCustomerWelcomeEmail,
  renderMerchantPasswordResetEmail,
  renderOrderCancelledEmail,
  renderOrderConfirmationEmail,
  renderOrderFulfillmentEmail,
  renderPasswordChangedEmail,
  renderRefundConfirmationEmail,
  renderStaffInvitationAcceptedEmail,
  renderStaffInvitationEmail,
  renderStaffInvitationRevokedEmail,
  renderStorefrontPasswordResetEmail,
  type OrderCancelledProps,
  type OrderConfirmationProps,
  type OrderFulfillmentProps,
  type RefundConfirmationProps,
  type RenderedEmail,
} from "./templates/index.js";
import {
  buildMerchantDashboardUrl,
  buildMerchantPasswordResetUrl,
  buildStaffInvitationUrl,
  buildStorefrontAccountUrl,
  buildStorefrontPasswordResetUrl,
} from "./url-builder.js";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
  templateName?: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  mode: EmailDeliveryMode;
}

export interface CapturedEmail extends SendEmailOptions {
  sentAt: Date;
  id: string;
}

/**
 * Sanitizes an email address for safe logging without exposing full user identity.
 * Example: "aashif@example.com" -> "a***f@example.com"
 */
function maskEmailForLogging(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || !local) return "***@***";
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export class EmailService {
  private readonly config: EmailConfig;
  private readonly resendClient?: Resend;
  private capturedEmails: CapturedEmail[] = [];

  constructor(customConfig?: Partial<EmailConfig>) {
    const baseConfig = resolveEmailConfig();
    this.config = {
      ...baseConfig,
      ...customConfig,
    };

    if (this.config.mode === "resend") {
      if (!this.config.apiKey) {
        throw new MissingEmailProviderConfigurationError("RESEND_API_KEY");
      }
      this.resendClient = new Resend(this.config.apiKey);
    }
  }

  public getConfig(): Readonly<EmailConfig> {
    return { ...this.config };
  }

  /**
   * Retrieves emails captured in development or test mode.
   */
  public getCapturedEmails(): CapturedEmail[] {
    return [...this.capturedEmails];
  }

  /**
   * Returns the last captured email, or undefined if none captured.
   */
  public getLastCapturedEmail(): CapturedEmail | undefined {
    return this.capturedEmails[this.capturedEmails.length - 1];
  }

  /**
   * Clears the captured emails array (useful between tests).
   */
  public clearCapturedEmails(): void {
    this.capturedEmails = [];
  }

  /**
   * Core dispatch method. Dispatches through Resend SDK or captures in memory.
   */
  public async sendEmail(options: SendEmailOptions): Promise<EmailSendResult> {
    const fromAddress = options.from || this.config.fromEmail;
    const replyToAddress = options.replyTo || this.config.replyToEmail;
    const maskedTo = maskEmailForLogging(options.to);

    // 1. In Test or Development Mode (without live Resend credentials)
    if (this.config.mode === "test" || this.config.mode === "development" || !this.resendClient) {
      const mockId = `sim_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const record: CapturedEmail = {
        ...options,
        from: fromAddress,
        replyTo: replyToAddress,
        id: mockId,
        sentAt: new Date(),
      };
      this.capturedEmails.push(record);

      if (this.config.mode === "development") {
        console.log(
          `[EmailService:DevSimulation] Template: "${options.templateName || "custom"}" | To: ${maskedTo} | Subject: "${options.subject}"`
        );
      }

      return {
        success: true,
        messageId: mockId,
        mode: this.config.mode,
      };
    }

    // 2. Production Resend Delivery Mode
    let timeoutHandle: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        const timeoutErr = new Error(`Email provider timed out after ${this.config.timeoutMs}ms.`);
        timeoutErr.name = "TimeoutError";
        reject(timeoutErr);
      }, this.config.timeoutMs);
    });

    try {
      try {
        const sendPromise = this.resendClient.emails.send({
          from: fromAddress,
          to: [options.to],
          subject: options.subject,
          html: options.html,
          text: options.text,
          replyTo: replyToAddress,
        });

        const response = await Promise.race([sendPromise, timeoutPromise]);
        clearTimeout(timeoutHandle);

        if (!response || response.error) {
          const safeMessage = response?.error?.message || "Unknown error from email provider";
          console.error(
            `[EmailService:Error] Delivery failed | Template: ${options.templateName || "custom"} | To: ${maskedTo} | Reason: ${safeMessage}`
          );
          return {
            success: false,
            error: safeMessage,
            mode: "resend",
          };
        }

        const messageId = response.data?.id;
        console.log(
          `[EmailService:Sent] Provider accepted email | Template: ${options.templateName || "custom"} | To: ${maskedTo} | ID: ${messageId}`
        );

        return {
          success: true,
          messageId,
          mode: "resend",
        };
      } catch (sendErr: unknown) {
        clearTimeout(timeoutHandle);
        throw sendErr;
      }
    } catch (err: unknown) {
      const isTimeout =
        err instanceof Error &&
        (err.name === "TimeoutError" ||
          err.name === "AbortError" ||
          err.message?.toLowerCase().includes("timeout") ||
          err.message?.toLowerCase().includes("aborted"));

      const safeErrorMessage = isTimeout
        ? `Email provider timed out after ${this.config.timeoutMs}ms.`
        : err instanceof Error
        ? err.message
        : "Failed to dispatch email via Resend.";

      console.error(
        `[EmailService:Exception] Delivery exception | Template: ${options.templateName || "custom"} | To: ${maskedTo} | Error: ${safeErrorMessage}`
      );

      return {
        success: false,
        error: safeErrorMessage,
        mode: "resend",
      };
    }
  }

  // --- High-Level Flow Helpers ---

  /**
   * Merchant Password Reset Flow
   */
  public async sendMerchantPasswordReset(params: {
    to: string;
    token: string;
    name?: string;
  }): Promise<EmailSendResult> {
    const resetUrl = buildMerchantPasswordResetUrl(this.config.appUrl, params.token);
    const rendered: RenderedEmail = renderMerchantPasswordResetEmail({
      to: params.to,
      recipientName: params.name,
      resetUrl,
    });

    return this.sendEmail({
      to: params.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateName: "merchant_password_reset",
    });
  }

  /**
   * Storefront Customer Password Reset Flow
   */
  public async sendStorefrontPasswordReset(params: {
    to: string;
    token: string;
    storeName: string;
    storeSlug: string;
    customerName?: string;
  }): Promise<EmailSendResult> {
    const resetUrl = buildStorefrontPasswordResetUrl(
      this.config.appUrl,
      params.storeSlug,
      params.token
    );
    const rendered: RenderedEmail = renderStorefrontPasswordResetEmail({
      to: params.to,
      recipientName: params.customerName,
      storeName: params.storeName,
      storeSlug: params.storeSlug,
      resetUrl,
    });

    return this.sendEmail({
      to: params.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateName: "storefront_password_reset",
    });
  }

  /**
   * Staff Invitation Flow
   */
  public async sendStaffInvitation(params: {
    to: string;
    token: string;
    storeName: string;
    inviterName: string;
    role: string;
    expiresAt: Date | string;
  }): Promise<EmailSendResult> {
    const inviteUrl = buildStaffInvitationUrl(this.config.appUrl, params.token);
    const rendered: RenderedEmail = renderStaffInvitationEmail({
      to: params.to,
      inviteUrl,
      storeName: params.storeName,
      inviterName: params.inviterName,
      role: params.role,
      expiresAt: params.expiresAt,
    });

    return this.sendEmail({
      to: params.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateName: "staff_invitation",
    });
  }

  /**
   * Staff Invitation Accepted Flow
   */
  public async sendStaffInvitationAccepted(params: {
    to: string;
    storeName: string;
    role: string;
  }): Promise<EmailSendResult> {
    const dashboardUrl = buildMerchantDashboardUrl(this.config.appUrl);
    const rendered: RenderedEmail = renderStaffInvitationAcceptedEmail({
      to: params.to,
      storeName: params.storeName,
      role: params.role,
      dashboardUrl,
    });

    return this.sendEmail({
      to: params.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateName: "staff_invitation_accepted",
    });
  }

  /**
   * Staff Invitation Revoked Flow
   */
  public async sendStaffInvitationRevoked(params: {
    to: string;
    storeName: string;
  }): Promise<EmailSendResult> {
    const rendered: RenderedEmail = renderStaffInvitationRevokedEmail({
      to: params.to,
      storeName: params.storeName,
    });

    return this.sendEmail({
      to: params.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateName: "staff_invitation_revoked",
    });
  }

  /**
   * Password Changed Notification Flow
   */
  public async sendPasswordChangedNotification(params: {
    to: string;
    name?: string;
    changedAt?: Date | string;
  }): Promise<EmailSendResult> {
    const rendered: RenderedEmail = renderPasswordChangedEmail({
      to: params.to,
      recipientName: params.name,
      changedAt: params.changedAt,
    });

    return this.sendEmail({
      to: params.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateName: "password_changed",
    });
  }

  /**
   * Customer Registration Welcome Flow
   */
  public async sendCustomerWelcome(params: {
    to: string;
    storeName: string;
    storeSlug: string;
    customerName?: string;
  }): Promise<EmailSendResult> {
    const accountUrl = buildStorefrontAccountUrl(this.config.appUrl, params.storeSlug);
    const rendered: RenderedEmail = renderCustomerWelcomeEmail({
      to: params.to,
      storeName: params.storeName,
      storeSlug: params.storeSlug,
      accountUrl,
      recipientName: params.customerName,
    });

    return this.sendEmail({
      to: params.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateName: "customer_welcome",
    });
  }

  /**
   * Customer Order Confirmation Flow
   */
  public async sendOrderConfirmation(
    props: OrderConfirmationProps,
  ): Promise<EmailSendResult> {
    const rendered = renderOrderConfirmationEmail(props);
    return this.sendEmail({
      to: props.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateName: "order_confirmation",
    });
  }

  /**
   * Customer Order Fulfillment Flow
   */
  public async sendOrderFulfillment(
    props: OrderFulfillmentProps,
  ): Promise<EmailSendResult> {
    const rendered = renderOrderFulfillmentEmail(props);
    return this.sendEmail({
      to: props.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateName: "order_fulfillment",
    });
  }

  /**
   * Customer Order Cancellation Flow
   */
  public async sendOrderCancelled(
    props: OrderCancelledProps,
  ): Promise<EmailSendResult> {
    const rendered = renderOrderCancelledEmail(props);
    return this.sendEmail({
      to: props.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateName: "order_cancelled",
    });
  }

  /**
   * Customer Refund Confirmation Flow
   */
  public async sendRefundConfirmation(
    props: RefundConfirmationProps,
  ): Promise<EmailSendResult> {
    const rendered = renderRefundConfirmationEmail(props);
    return this.sendEmail({
      to: props.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateName: "refund_confirmation",
    });
  }
}

/**
 * Global singleton instance for application use.
 */
let defaultEmailService: EmailService | null = null;

export function getEmailService(): EmailService {
  if (!defaultEmailService) {
    defaultEmailService = new EmailService();
  }
  return defaultEmailService;
}

/**
 * Resets the default email service instance (useful in tests).
 */
export function resetEmailService(customInstance?: EmailService): void {
  defaultEmailService = customInstance ?? null;
}
