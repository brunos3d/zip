import { type Difficulty, DIFFICULTY_CONFIG, buildSeed } from "@/engine/types";
import { dateSeed } from "@/engine/grid-utils";
import { redirect } from "next/navigation";
import { GameProvider } from "@/state/game-context";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ difficulty: string; seed: string }>;
}

export default async function SeedLayout({ children, params }: LayoutProps) {
  const { difficulty, seed } = await params;

  if (!(difficulty in DIFFICULTY_CONFIG)) {
    redirect(`/easy/${dateSeed()}`);
  }

  const diff = difficulty as Difficulty;
  const fullSeed = buildSeed(diff, parseInt(seed, 10) || 1);

  return (
    <GameProvider difficulty={diff} seed={fullSeed}>
      {children}
    </GameProvider>
  );
}
