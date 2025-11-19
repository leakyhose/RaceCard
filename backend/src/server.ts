import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

import type {
  ServerToClientEvents,
  ClientToServerEvents,
  Lobby,
} from "@shared/types.js";

import {
  createLobby,
  getLobbyByCode,
  getLobbyBySocket,
  addPlayerToLobby,
  updateFlashcard,
  updateSettings,
  removePlayerFromLobby,
  updateLeader,
  wipeMiniStatus,
} from "./lobbyManager.js";

import {
  startGame,
  shuffleGameCards,
  setRoundStart,
  getCurrentQuestion,
  validateAnswer,
  getRoundResults,
  advanceToNextFlashcard,
  endGame,
  allPlayersAnsweredCorrectly,
} from "./gameManager.js";

const app = express();
const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: "*" },
});

// Store callbacks for active rounds to enable event-driven early ending
const activeRounds = new Map<string, { 
  endRound: () => void;
  roundStartTime: number;
  roundEnded: boolean;
}>();

// NOTE: THERE ARE SOME INCONSISTENCIES WITH FUNCTIONS TAKING IN CODE OR LOBBY ID, 
// MAKE SURE THEY MATCH THE ONES IN THE MANAGER FILES
io.on("connection", (socket) => {
  console.log(`connected to: ${socket.id}`);

  // Creates lobby
  socket.on("createLobby", (nickname) => {
    const lobby = createLobby(socket.id, nickname);
    socket.join(lobby.code);
    socket.emit("lobbyUpdated", lobby);
  });

  // Joins a lobby
  socket.on("joinLobby", (code, nickname) => {
    const lobby = addPlayerToLobby(code, socket.id, nickname);
    if (!lobby) {
      console.log(`Failed to join lobby ${code}: lobby not found`);
      return;
    }
    socket.join(code);
    io.to(code).emit("lobbyUpdated", lobby);
  });

  // Loads flashcards
  socket.on("updateFlashcard", (cards) => {
    const lobby = updateFlashcard(socket.id, cards);
    if (!lobby) {
      console.log(`Failed to update flashcards`);
      return;
    }
    io.to(lobby.code).emit("lobbyUpdated", lobby);
  });

  // Updates settings
  socket.on("updateSettings", (settings) => {
    const lobby = updateSettings(socket.id, settings);
    if (!lobby) {
      console.log(`Failed to update settings`);
      return;
    }
    io.to(lobby.code).emit("lobbyUpdated", lobby);
  });
  
  // Updates leader
  socket.on("updateLeader", (nextLeaderId) => {
    const lobby = updateLeader(nextLeaderId);
    if (!lobby) {
      console.log(`Failed to update leader`);
      return;
    }
    io.to(lobby.code).emit("lobbyUpdated", lobby);
  });

  // Gets lobby data, used to check when lobby exists too when null is emitted
  socket.on("getLobby", (code) => {
    const lobby = getLobbyByCode(code);
    socket.emit("lobbyData", lobby || null);
  });

  // Handles disconnection
  socket.on("disconnect", () => {
    const lobby = removePlayerFromLobby(socket.id);
    if (!lobby) return;
    io.to(lobby.code).emit("lobbyUpdated", lobby);
  });

  // Starts game, and gameplay loop 
  socket.on("startGame", () => {
    const lobby = startGame(socket.id);
    if (!lobby) {
      console.log("Failed to start game: lobby not found");
      return;
    }

    lobby.status = "starting";
    io.to(lobby.code).emit("lobbyUpdated", lobby);

    // Start countdown
    let countdown = 3;
    io.to(lobby.code).emit("startCountdown", countdown);
    countdown--;

    // Shuffle cards asynchronously during countdown
    shuffleGameCards(lobby.code);

    const countdownInterval = setInterval(() => {
      if (countdown >= 1) {
        io.to(lobby.code).emit("startCountdown", countdown);
        countdown--;
      } else {
        clearInterval(countdownInterval);

        // Set status to ongoing before starting game loop
        lobby.status = "ongoing";
        io.to(lobby.code).emit("lobbyUpdated", lobby);

        const runGameplayLoop = (lobbyCode: string) => {
          const currentQuestion = getCurrentQuestion(lobbyCode);
          if (!currentQuestion) {
            const finalLobby = getLobbyByCode(lobbyCode);
            if (finalLobby) {
              finalLobby.status = "finished";
              io.to(lobbyCode).emit("lobbyUpdated", finalLobby);
              endGame(lobbyCode);
            }
            return;
          }

          // Set round start time when emitting question
          setRoundStart(lobbyCode);
          io.to(lobbyCode).emit("newFlashcard", currentQuestion);

          const roundStartTime = Date.now();
          const ROUND_DURATION = 10000;
          let roundEnded = false;

          // Ends round, is also called when everyone answers correctly
          const endRound = () => {
            if (roundEnded) return;
            roundEnded = true;
            activeRounds.delete(lobbyCode); // Clean up

            const results = getRoundResults(lobbyCode);
            if (results) {
              io.to(lobbyCode).emit("endFlashcard", results);
            }
            
            const lobby = wipeMiniStatus(lobbyCode);
            if (lobby) io.to(lobbyCode).emit("lobbyUpdated", lobby);
            
            // Wait 5 seconds to show results
            setTimeout(() => {
              const nextQuestion = advanceToNextFlashcard(lobbyCode);

              if (nextQuestion) {
                // Continue to next round
                runGameplayLoop(lobbyCode);
              } else {
                // Game over
                const finalLobby = getLobbyByCode(lobbyCode);
                if (finalLobby) {
                  finalLobby.status = "finished";
                  io.to(lobbyCode).emit("lobbyUpdated", finalLobby);
                  endGame(lobbyCode);
                }
              }
            }, 3000);
          };

          // Store round info, callback endRound is called if answers are given faster than round
          activeRounds.set(lobbyCode, { endRound, roundStartTime, roundEnded });

          setTimeout(() => {
            endRound();
          }, ROUND_DURATION);
        };

        runGameplayLoop(lobby.code);
      }
    }, 1000);
  });

  socket.on("answer", (text) => {
    const result = validateAnswer(socket.id, text);
    if (!result) return;
    if (result.isCorrect){
      socket.emit("correctGuess", result.timeTaken);
    }
    io.to(result.lobby.code).emit("lobbyUpdated", result.lobby);

    // Check if all players have answered correctly
    const roundInfo = activeRounds.get(result.lobby.code);
    if (roundInfo && !roundInfo.roundEnded && allPlayersAnsweredCorrectly(result.lobby.code)) {
      const elapsedTime = Date.now() - roundInfo.roundStartTime;
      const ROUND_DURATION = 10000;
      const MIN_DELAY_AFTER_ALL_ANSWERED = 1000;
      const timeUntilEnd = ROUND_DURATION - elapsedTime;
      const delay = Math.min(timeUntilEnd, MIN_DELAY_AFTER_ALL_ANSWERED);
      
      setTimeout(() => roundInfo.endRound(), delay);
    }
  });
});
httpServer.listen(3000, () => console.log("Server running on :3000"));
