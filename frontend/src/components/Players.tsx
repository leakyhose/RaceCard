import type { Player } from "@shared/types";
import { socket } from "../socket";

interface PlayersProps {
  players: Player[];
  gameStatus: string;
  isLeader: boolean;
  leader: string;
}

export function Players({
  players,
  gameStatus,
  isLeader,
  leader,
}: PlayersProps) {
  const handleUpdateLeader = (nextLeaderId: string) => {
    if (!isLeader) {
      return;
    }
    socket.emit("updateLeader", nextLeaderId);
  };

  const isOngoing = gameStatus === "ongoing";

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-light-vanilla pt-5 pl-2 pr-6 relative">
      {players.findIndex(p => p.id === leader) !== -1 && (
        <div 
          className="absolute -right-0.5 text-xs z-10"
          style={{
            top: `${(players.findIndex(p => p.id === leader) * 56) + (players.findIndex(p => p.id === leader) * 8) + 20 + 20}px`
          }}
        >
          👑
        </div>
      )}
      <ul className="flex-1 overflow-y-auto overflow-x-hidden space-y-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:absolute [&::-webkit-scrollbar-track]:bg-vanilla [&::-webkit-scrollbar-thumb]:bg-coffee [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-vanilla">
        {players.map((player) => {
          const hasMiniStatus = isOngoing && player.miniStatus !== null;

          const hasCorrectAnswer = player.isCorrect === true;

          return (
            <li
              key={player.id}
              className={`rounded-lg border-2 border-coffee flex w-full group relative h-14 hover:shadow-sm transition-all ${
                hasCorrectAnswer
                  ? "bg-mint/40"
                  : hasMiniStatus
                    ? "bg-terracotta/20"
                    : "bg-vanilla/80"
              }`}
            >
              <div
                className={`flex w-full overflow-hidden rounded-lg ${isLeader && player.id != socket.id ? "cursor-pointer" : ""}`}
                onClick={() => isLeader && handleUpdateLeader(player.id)}
              >
                <div className="flex-1 flex flex-col justify-center overflow-hidden px-3 py-1">
                  {hasMiniStatus ? (
                    <>
                      <div className="truncate leading-tight text-coffee">
                        {player.name}
                      </div>

                      <div className="text-sm truncate leading-tight text-coffee font-bold">
                        {typeof player.miniStatus === "number"
                          ? `${(Number(player.miniStatus) / 1000).toFixed(3)}s`
                          : player.miniStatus}
                      </div>
                    </>
                  ) : (
                    <div className="truncate">
                      <div className="truncate leading-tight text-coffee">
                        {player.name}
                      </div>
                    </div>
                  )}
                </div>

                <div className="w-14 shrink-0 flex items-center justify-center font-bold text-base text-coffee/80">
                  {gameStatus === "waiting" || gameStatus === "finished" ? (
                    <div className="w-16 shrink-0 flex items-center justify-center">
                      {" "}
                      {player.wins}{" "}
                    </div>
                  ) : (
                    <div className="w-16 shrink-0 flex items-center justify-center">
                      {" "}
                      {player.score}{" "}
                    </div>
                  )}
                </div>
              </div>
              {isLeader && player.id != socket.id && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-terracotta text-vanilla font-bold tracking-wider text-sm rounded-lg">
                  Promote
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
