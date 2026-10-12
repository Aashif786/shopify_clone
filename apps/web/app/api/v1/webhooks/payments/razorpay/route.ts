import { handleRazorpayWebhook } from "./handler";

export async function POST(req: Request) {
  return handleRazorpayWebhook(req);
}
