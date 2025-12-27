import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../socket";
import type { Lobby, Player } from "@shared/types";

// Keeps lobby instnance updated, redirecting to home if lobby ever doesnt exist
export function useLobbyData(code: string | undefined) {
  const navigate = useNavigate();
  const [lobby, setLobby] = useState<Lobby | null | undefined>(undefined);

  useEffect(() => {
    if (!code) return;

    // Ensure code is uppercase before fetching
    const normalizedCode = code.toUpperCase();
    if (code !== normalizedCode) return; // Fixes race condition

    const handleLobbyData = (lobbyData: Lobby | null) => {
      setLobby(lobbyData);
      if (lobbyData === null) {
        navigate("/", { replace: true, state: { notFound: true } });
      }
    };

    const handleLobbyUpdated = (updatedLobby: Lobby) => {
      if (!updatedLobby) {
        navigate("/", { replace: true, state: { notFound: true } });
      } else {
        setLobby(updatedLobby);
      }
    };

    const handlePlayersUpdated = (players: Player[]) => {
      setLobby((prev) => {
        if (!prev) return prev;
        return { ...prev, players };
      });
    };

    socket.emit("getLobby", code);
    socket.on("lobbyData", handleLobbyData);
    socket.on("lobbyUpdated", handleLobbyUpdated);
    socket.on("playersUpdated", handlePlayersUpdated);

    return () => {
      socket.off("lobbyData", handleLobbyData);
      socket.off("lobbyUpdated", handleLobbyUpdated);
      socket.off("playersUpdated", handlePlayersUpdated);
    };
  }, [code, navigate]);

  return lobby;
}
