import { redirect } from "next/navigation";

interface StorefrontPageProps {
  params: Promise<{ storeSlug: string }>;
}

export default async function StorefrontRootPage({
  params,
}: StorefrontPageProps) {
  const { storeSlug } = await params;
  redirect(`/stores/${encodeURIComponent(storeSlug)}/products`);
}
