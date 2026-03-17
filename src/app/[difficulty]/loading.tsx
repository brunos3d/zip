import PuzzleLoading from "@/components/puzzle-loading";

export default function Loading() {
  return (
    <div className="flex flex-col items-center min-h-dvh bg-[#F8F9FA] select-none">
      <PuzzleLoading />
    </div>
  );
}
