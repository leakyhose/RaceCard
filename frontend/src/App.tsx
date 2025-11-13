import { useState, useEffect } from "react"
import { socket } from "./socket"
import type { Lobby } from "../../shared/types"

export default function App() {
  const [nickname, setNickname] = useState("")
  const [codeInput, setCodeInput] = useState("")
  const [lobby, setLobby] = useState<Lobby | null>(null)

  useEffect(() => {
    socket.on("lobbyUpdated", (lobby) => {
      setLobby(lobby)
    })

    return () => {
      socket.off("lobbyUpdated")
    }
  }, [])

  const handleCreateLobby = () => {
    if (!nickname) return
    console.log(nickname)
    socket.emit("createLobby", nickname)
  }

  const handleJoinLobby = () => {
    if (!nickname || !codeInput) return
    socket.emit("joinLobby", codeInput, nickname)
  }

  if (!lobby) {
    return (
      <div>
        <h1>Flashcard Lobby Test</h1>

        <input
          value={nickname}
          onChange={(name) => setNickname(name.target.value)}
        />

        <div>
          <button onClick={handleCreateLobby}>Create Lobby</button>
        </div>

        <div>
          <input
            placeholder="Lobby code"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
          />
          <button onClick={handleJoinLobby}>Join Lobby</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Lobby Code: {lobby.code}</h2>
      <h3>Players:</h3>
      <ul>
        {lobby.players.map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>
    </div>
  )
}
