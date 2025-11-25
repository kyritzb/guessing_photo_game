const { v4: uuidv4 } = require("uuid");

const GameState = {
  LOBBY: "LOBBY",
  PLAYING: "PLAYING",
  RESULTS: "RESULTS",
  GAME_OVER: "GAME_OVER",
};

// In-memory storage for rooms
const rooms = new Map();

// Generate a 6-character room code
function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function setupGameServer(io) {
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Create a new room
    socket.on("create-room", () => {
      const roomId = generateRoomCode();
      const playerId = uuidv4();

      const room = {
        id: roomId,
        players: [
          {
            id: playerId,
            socketId: socket.id,
            name: "",
            isHost: true,
            imageCount: 0,
            score: 0,
            images: [],
          },
        ],
        gameState: GameState.LOBBY,
        currentImageIndex: 0,
        allImages: [],
        syncComplete: false,
        syncProgress: new Map(),
      };

      rooms.set(roomId, room);
      socket.join(roomId);

      console.log(`Room created: ${roomId} by player ${playerId}`);
      socket.emit("room-created", { roomId, playerId });
    });

    // Join an existing room
    socket.on("join-room", ({ roomId, name }) => {
      const room = rooms.get(roomId);
      if (!room) {
        socket.emit("error", { message: "Room not found" });
        return;
      }

      if (room.gameState !== GameState.LOBBY) {
        socket.emit("error", { message: "Game already in progress" });
        return;
      }

      const playerId = uuidv4();
      const player = {
        id: playerId,
        socketId: socket.id,
        name: name || "",
        isHost: false,
        imageCount: 0,
        score: 0,
        images: [],
      };

      room.players.push(player);
      socket.join(roomId);

      console.log(`Player ${playerId} (${name}) joined room ${roomId}`);
      socket.emit("joined-room", { roomId, playerId });
      io.to(roomId).emit("room-updated", { room: sanitizeRoom(room) });
    });

    // Reconnect to existing room
    socket.on("reconnect-to-room", ({ roomId, playerId }) => {
      const room = rooms.get(roomId);
      if (!room) {
        console.log(`Reconnect failed: Room ${roomId} not found`);
        return;
      }

      const player = room.players.find((p) => p.id === playerId);
      if (!player) {
        console.log(`Reconnect failed: Player ${playerId} not found in room ${roomId}`);
        return;
      }

      // Update socket ID
      player.socketId = socket.id;
      socket.join(roomId);

      console.log(`Player ${playerId} reconnected to room ${roomId}`);

      // Send reconnection data
      const reconnectData = {
        roomId,
        playerId,
        room: sanitizeRoom(room),
        gameState: room.gameState,
      };

      if (room.gameState === GameState.PLAYING && room.allImages.length > 0) {
        reconnectData.currentImage = room.allImages[room.currentImageIndex]?.image;
        reconnectData.imageIndex = room.currentImageIndex;
        reconnectData.totalImages = room.allImages.length;
        reconnectData.players = room.players.map((p) => ({ id: p.id, name: p.name }));
      }

      socket.emit("reconnected", reconnectData);
    });

    // Update player name
    socket.on("update-name", ({ roomId, name }) => {
      const room = rooms.get(roomId);
      if (!room) return;

      const player = room.players.find((p) => p.socketId === socket.id);
      if (player) {
        player.name = name;
        io.to(roomId).emit("room-updated", { room: sanitizeRoom(room) });
      }
    });

    // Submit images
    socket.on("submit-images", ({ roomId, images }, callback) => {
      const room = rooms.get(roomId);
      if (!room) {
        callback?.({ error: "Room not found" });
        return;
      }

      const player = room.players.find((p) => p.socketId === socket.id);
      if (!player) {
        callback?.({ error: "Player not found" });
        return;
      }

      player.images = images;
      player.imageCount = images.length;

      console.log(`Player ${player.name} submitted ${images.length} images`);
      callback?.({ success: true });
      io.to(roomId).emit("room-updated", { room: sanitizeRoom(room) });

      // Check if all players have submitted images
      const allReady = room.players.every((p) => p.imageCount === 10);
      if (allReady) {
        console.log("All players ready, starting sync...");
        startImageSync(io, room);
      }
    });

    // Images synced acknowledgment
    socket.on("images-synced", ({ roomId, batchIndex }) => {
      const room = rooms.get(roomId);
      if (!room) return;

      const player = room.players.find((p) => p.socketId === socket.id);
      if (!player) return;

      if (!room.syncProgress.has(player.id)) {
        room.syncProgress.set(player.id, new Set());
      }
      room.syncProgress.get(player.id).add(batchIndex);

      // Calculate and broadcast sync progress
      const totalImages = room.allImages.length;
      const playerProgress = room.players.map((p) => {
        const synced = room.syncProgress.get(p.id)?.size || 0;
        return {
          id: p.id,
          name: p.name,
          synced,
          total: totalImages,
        };
      });

      const totalSynced = playerProgress.reduce((sum, p) => sum + p.synced, 0);
      const totalRequired = totalImages * room.players.length;
      const progress = Math.round((totalSynced / totalRequired) * 100);

      io.to(roomId).emit("sync-progress", { progress, playerProgress });

      // Check if sync is complete
      const allSynced = room.players.every((p) => {
        const synced = room.syncProgress.get(p.id)?.size || 0;
        return synced >= totalImages;
      });

      if (allSynced && !room.syncComplete) {
        room.syncComplete = true;
        io.to(roomId).emit("sync-complete");
        io.to(roomId).emit("room-updated", { room: sanitizeRoom(room) });
        console.log("All images synced for room", roomId);
      }
    });

    // Start game
    socket.on("start-game", ({ roomId }, callback) => {
      const room = rooms.get(roomId);
      if (!room) {
        callback?.({ error: "Room not found" });
        return;
      }

      const player = room.players.find((p) => p.socketId === socket.id);
      if (!player?.isHost) {
        callback?.({ error: "Only the host can start the game" });
        return;
      }

      if (!room.syncComplete) {
        callback?.({ error: "Images not synced yet" });
        return;
      }

      room.gameState = GameState.PLAYING;
      room.currentImageIndex = 0;
      room.guesses = new Map();

      // Reset scores
      room.players.forEach((p) => (p.score = 0));

      console.log(`Game started in room ${roomId}`);
      callback?.({ success: true });

      // Send first round
      sendRound(io, room);
    });

    // Submit guess
    socket.on("submit-guess", ({ roomId, imageIndex, guessedPlayerId }) => {
      const room = rooms.get(roomId);
      if (!room) return;

      const player = room.players.find((p) => p.socketId === socket.id);
      if (!player) return;

      if (!room.guesses.has(imageIndex)) {
        room.guesses.set(imageIndex, new Map());
      }
      room.guesses.get(imageIndex).set(player.id, guessedPlayerId);

      console.log(`Player ${player.name} guessed ${guessedPlayerId} for image ${imageIndex}`);
      socket.emit("guess-submitted");

      // Check if all players have guessed
      const roundGuesses = room.guesses.get(imageIndex);
      if (roundGuesses.size >= room.players.length) {
        processRoundResults(io, room);
      }
    });

    // New game
    socket.on("new-game", ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room) return;

      const player = room.players.find((p) => p.socketId === socket.id);
      if (!player?.isHost) return;

      // Reset for new game
      room.gameState = GameState.LOBBY;
      room.currentImageIndex = 0;
      room.allImages = [];
      room.syncComplete = false;
      room.syncProgress = new Map();
      room.guesses = new Map();

      room.players.forEach((p) => {
        p.score = 0;
        p.imageCount = 0;
        p.images = [];
      });

      console.log(`New game started in room ${roomId}`);
      io.to(roomId).emit("new-game-started", { room: sanitizeRoom(room) });
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);

      // Find and update player status
      for (const [roomId, room] of rooms.entries()) {
        const playerIndex = room.players.findIndex((p) => p.socketId === socket.id);
        if (playerIndex !== -1) {
          const player = room.players[playerIndex];
          console.log(`Player ${player.name} disconnected from room ${roomId}`);

          // Don't remove immediately - allow for reconnection
          // After 5 minutes, clean up if not reconnected
          setTimeout(() => {
            const currentRoom = rooms.get(roomId);
            if (currentRoom) {
              const currentPlayer = currentRoom.players.find((p) => p.id === player.id);
              if (currentPlayer && currentPlayer.socketId === socket.id) {
                // Player didn't reconnect, remove them
                currentRoom.players = currentRoom.players.filter((p) => p.id !== player.id);
                io.to(roomId).emit("player-left", { playerId: player.id, playerName: player.name });
                io.to(roomId).emit("room-updated", { room: sanitizeRoom(currentRoom) });

                // If no players left, delete room
                if (currentRoom.players.length === 0) {
                  rooms.delete(roomId);
                  console.log(`Room ${roomId} deleted - no players`);
                } else if (player.isHost) {
                  // Assign new host
                  currentRoom.players[0].isHost = true;
                  io.to(roomId).emit("room-updated", { room: sanitizeRoom(currentRoom) });
                }
              }
            }
          }, 5 * 60 * 1000); // 5 minutes

          break;
        }
      }
    });
  });
}

function startImageSync(io, room) {
  // Combine all images with owner info and shuffle
  room.allImages = [];
  room.players.forEach((player) => {
    player.images.forEach((image) => {
      room.allImages.push({
        image,
        ownerId: player.id,
        ownerName: player.name,
      });
    });
  });

  // Shuffle images
  for (let i = room.allImages.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [room.allImages[i], room.allImages[j]] = [room.allImages[j], room.allImages[i]];
  }

  console.log(`Syncing ${room.allImages.length} images to all players`);

  // Send images in batches to all players
  room.allImages.forEach((imageData, index) => {
    setTimeout(() => {
      io.to(room.id).emit("sync-image-batch", {
        batchIndex: index,
        totalBatches: room.allImages.length,
        image: imageData.image,
      });
    }, index * 100); // Stagger sends to avoid overwhelming
  });
}

function sendRound(io, room) {
  const currentImage = room.allImages[room.currentImageIndex];
  if (!currentImage) return;

  const players = room.players.map((p) => ({ id: p.id, name: p.name }));

  io.to(room.id).emit("round-started", {
    image: currentImage.image,
    imageIndex: room.currentImageIndex,
    totalImages: room.allImages.length,
    players,
  });
}

function processRoundResults(io, room) {
  const imageIndex = room.currentImageIndex;
  const currentImage = room.allImages[imageIndex];
  const roundGuesses = room.guesses.get(imageIndex);

  const results = [];
  room.players.forEach((player) => {
    const guessedPlayerId = roundGuesses.get(player.id);
    const guessedCorrectly = guessedPlayerId === currentImage.ownerId;

    if (guessedCorrectly) {
      player.score += 100;
    }

    results.push({
      playerId: player.id,
      name: player.name,
      score: guessedCorrectly ? 100 : 0,
      guessedCorrectly,
    });
  });

  const scores = room.players.map((p) => ({
    id: p.id,
    name: p.name,
    score: p.score,
  }));

  const isLastRound = imageIndex >= room.allImages.length - 1;

  io.to(room.id).emit("round-results", {
    correctOwner: { id: currentImage.ownerId, name: currentImage.ownerName },
    results,
    scores,
    isLastRound,
  });

  // Move to next round or end game
  setTimeout(() => {
    if (isLastRound) {
      // Game over
      room.gameState = GameState.GAME_OVER;
      const sortedScores = [...scores].sort((a, b) => b.score - a.score);
      io.to(room.id).emit("game-over", {
        winner: sortedScores[0],
        finalScores: sortedScores,
      });
    } else {
      // Next round
      room.currentImageIndex++;
      sendRound(io, room);
    }
  }, 4000); // 4 seconds to show results
}

function sanitizeRoom(room) {
  return {
    id: room.id,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      imageCount: p.imageCount,
      score: p.score,
    })),
    gameState: room.gameState,
    currentImageIndex: room.currentImageIndex,
    syncComplete: room.syncComplete,
  };
}

module.exports = { setupGameServer };

