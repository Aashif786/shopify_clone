import { redirect } from "next/navigation";

interface StoreCollectionsPageProps {
  params: Promise<{ storeSlug: string }>;
}

export default async function StoreCollectionsPage({
  params,
}: StoreCollectionsPageProps) {
  const { storeSlug } = await params;
  redirect(`/stores/${encodeURIComponent(storeSlug)}/products`);
}
