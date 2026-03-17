import { redirect } from "next/navigation";
import { parseSeed } from "@/engine/types";
import { dateSeed } from "@/engine/grid-utils";

interface PageProps {
  searchParams: Promise<{ seed?: string }>;
}

export default async function Home({ searchParams }: PageProps) {
  const { seed: seedParam } = await searchParams;

  // Handle legacy ?seed= URLs (e.g. ?seed=easy-042)
  if (seedParam) {
    try {
      const { difficulty, number: num } = parseSeed(seedParam);
      redirect(`/${difficulty}/${num}`);
    } catch {
      // fall through to default
    }
  }

  redirect(`/easy/${dateSeed()}`);
}
