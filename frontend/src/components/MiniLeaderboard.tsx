import type { FlashcardEnd } from "@shared/types";
type FlashcardEndProps = {
  results: FlashcardEnd;
};
export function MiniLeaderboard({ results }: FlashcardEndProps) {
  return (
    <div className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50 flex-1 max-w-md">
      <h3 className="text-xl font-semibold mb-3 text-blue-800">
        Fastest Correct Answers
      </h3>
      <div className="space-y-2">
        {results.fastestPlayers.map((player, index) => (
          <div
            key={index}
            className="flex justify-between items-center p-2 bg-white rounded border"
          >
            <span className="font-medium">{player.player}</span>
            <span className="text-sm text-gray-600">
              {(Number(player.time) / 1000).toFixed(3)}s
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
