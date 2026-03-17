import { DIFFICULTY_CONFIG } from "@/engine/types";
import { dateSeed } from "@/engine/grid-utils";
import { redirect } from "next/navigation";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ difficulty: string }>;
}

export default async function DifficultyLayout({
  children,
  params,
}: LayoutProps) {
  const { difficulty } = await params;

  if (!(difficulty in DIFFICULTY_CONFIG)) {
    redirect(`/easy/${dateSeed()}`);
  }

  return <>{children}</>;
}
