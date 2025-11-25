"use client";

import { useState, useEffect } from "react";
import { useSocket, saveGameSession } from "@/hooks/useSocket";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lobby } from "@/components/Lobby";
import { GameRound } from "@/components/GameRound";
import { RoundResults } from "@/components/RoundResults";
import { GameOver } from "@/components/GameOver";
import { GameState } from "@/types/game";
import type { Room } from "@/types/game";

export default function Home() {
  const { socket, connected, reconnecting, connectionAttempts } = useSocket();
  const [roomId, setRoomId] = useState<string>("");
  const [playerId, setPlayerId] = useState<string>("");
  const [room, setRoom] = useState<Room | null>(null);
  const [currentImage, setCurrentImage] = useState<string>("");
  const [currentPlayers, setCurrentPlayers] = useState<Array<{ id: string; name: string }>>([]);
  const [imageIndex, setImageIndex] = useState(0);
  const [totalImages, setTotalImages] = useState(10);
  const [roundResults, setRoundResults] = useState<any>(null);
  const [gameOver, setGameOver] = useState<any>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);

  useEffect(() => {
    if (!socket) return;

    socket.on("room-created", ({ roomId: rid, playerId: pid }) => {
      console.log("Room created:", rid, "Player ID:", pid);
      setRoomId(rid);
      setPlayerId(pid);
      setIsCreatingRoom(false);
      saveGameSession(rid, pid);
    });

    socket.on("joined-room", ({ roomId: rid, playerId: pid }) => {
      console.log("Joined room:", rid, "Player ID:", pid);
      setRoomId(rid);
      setPlayerId(pid);
      setIsJoiningRoom(false);
      saveGameSession(rid, pid);
    });

    // Handle reconnection to existing game
    socket.on("reconnected", ({ roomId: rid, playerId: pid, room: r, gameState, currentImage: img, imageIndex: idx, totalImages: total, players }) => {
      console.log("Reconnected to room:", rid, "Player ID:", pid, "State:", gameState);
      setRoomId(rid);
      setPlayerId(pid);
      setRoom(r);
      saveGameSession(rid, pid);
      
      // Restore game state if game was in progress
      if (gameState === GameState.PLAYING && img) {
        setCurrentImage(img);
        setImageIndex(idx);
        setTotalImages(total);
        setCurrentPlayers(players);
      }
    });

    socket.on("room-updated", ({ room: r }) => {
      console.log("Room updated:", r);
      setRoom(r);
    });

    socket.on("all-ready", ({ room: r }) => {
      setRoom(r);
    });

    socket.on("round-started", ({ image, imageIndex: idx, totalImages: total, players }) => {
      console.log("Round started! Image index:", idx, "of", total);
      console.log("Players:", players);
      setCurrentImage(image);
      setImageIndex(idx);
      setTotalImages(total);
      setCurrentPlayers(players);
      setRoundResults(null);
      setGameOver(null);
      // Also update room state to PLAYING in case room-updated arrives late
      setRoom((prevRoom) => {
        if (prevRoom) {
          return { ...prevRoom, gameState: GameState.PLAYING };
        }
        return prevRoom;
      });
    });

    socket.on("guess-submitted", () => {
      // Individual guess feedback can be handled here
    });

    socket.on("round-results", (results) => {
      setRoundResults(results);
    });

    socket.on("game-over", (data) => {
      setGameOver(data);
    });

    socket.on("new-game-started", ({ room: r }) => {
      setRoom(r);
      setRoundResults(null);
      setGameOver(null);
      setCurrentImage("");
    });

    socket.on("player-left", ({ playerId: pid, playerName }) => {
      console.log("Player left:", playerName, pid);
      // Optionally show a notification
    });

    socket.on("error", ({ message }) => {
      console.error("Socket error:", message);
      alert(message);
      setIsCreatingRoom(false);
      setIsJoiningRoom(false);
    });

    return () => {
      socket.off("room-created");
      socket.off("joined-room");
      socket.off("reconnected");
      socket.off("room-updated");
      socket.off("all-ready");
      socket.off("round-started");
      socket.off("guess-submitted");
      socket.off("round-results");
      socket.off("game-over");
      socket.off("new-game-started");
      socket.off("player-left");
      socket.off("error");
    };
  }, [socket]);

  const handleCreateRoom = () => {
    if (!socket) {
      console.error("Socket not initialized");
      alert("Connecting to server... Please wait a moment and try again.");
      return;
    }
    if (!connected) {
      console.error("Socket not connected");
      alert("Not connected to server. Please wait a moment and try again.");
      return;
    }
    console.log("Creating room...");
    setIsCreatingRoom(true);
    socket.emit("create-room");
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const code = formData.get("code") as string;
    const name = formData.get("name") as string;

    if (!socket) {
      alert("Connecting to server... Please wait a moment and try again.");
      return;
    }
    if (!connected) {
      alert("Not connected to server. Please wait a moment and try again.");
      return;
    }
    if (!code || !name) {
      alert("Please enter both room code and your name.");
      return;
    }
    console.log("Joining room:", code.toUpperCase());
    setIsJoiningRoom(true);
    socket.emit("join-room", { roomId: code.toUpperCase(), name });
  };

  if (!socket || !connected) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md fun-card">
          <CardContent className="pt-8 space-y-4">
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-3">
                <div className="animate-spin w-6 h-6 border-3 border-primary border-t-transparent rounded-full" />
                <p className="text-lg font-medium">
                  {reconnecting ? "Reconnecting..." : "Connecting to game server..."}
                </p>
              </div>
            </div>
            {connectionAttempts > 0 && (
              <div className="text-center">
                <div className="inline-flex items-center gap-2 bg-muted px-4 py-2 rounded-full">
                  <span className="text-sm text-muted-foreground">
                    Attempt {connectionAttempts} of 20
                  </span>
                </div>
              </div>
            )}
            {socket && !connected && !reconnecting && (
              <p className="text-center text-sm text-muted-foreground">
                Make sure the server is running on port 3000
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show reconnection banner while in game
  const reconnectionBanner = reconnecting && roomId ? (
    <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-yellow-400 to-amber-400 text-amber-900 py-3 px-4 text-center text-sm z-50 shadow-lg">
      <div className="flex items-center justify-center gap-3">
        <div className="animate-spin w-5 h-5 border-2 border-amber-900 border-t-transparent rounded-full" />
        <span className="font-medium">Reconnecting... ({connectionAttempts}/20)</span>
      </div>
    </div>
  ) : null;

  if (room && roomId && playerId) {
    const currentPlayer = room.players.find((p) => p.id === playerId);
    const isHost = currentPlayer?.isHost || false;

    // Game Over Screen
    if (gameOver) {
      return (
        <div className="min-h-screen p-4 pt-8">
          {reconnectionBanner}
          <GameOver
            socket={socket!}
            roomId={roomId}
            winner={gameOver.winner}
            finalScores={gameOver.finalScores}
            isHost={isHost}
            currentPlayerId={playerId}
            onNewGame={() => {
              setGameOver(null);
              setRoundResults(null);
            }}
          />
        </div>
      );
    }

    // Round Results Screen
    if (roundResults) {
      return (
        <div className="min-h-screen p-4 pt-8">
          {reconnectionBanner}
          <RoundResults
            correctOwner={roundResults.correctOwner}
            results={roundResults.results}
            scores={roundResults.scores}
            isLastRound={roundResults.isLastRound}
            currentPlayerId={playerId}
          />
        </div>
      );
    }

    // Playing Game
    if (room.gameState === GameState.PLAYING && currentImage) {
      return (
        <div className="min-h-screen p-4 pt-8">
          {reconnectionBanner}
          <GameRound
            socket={socket!}
            roomId={roomId}
            image={currentImage}
            imageIndex={imageIndex}
            totalImages={totalImages}
            players={currentPlayers}
            onGuessSubmitted={() => {
              // Handle guess submission feedback
            }}
          />
        </div>
      );
    }

    // Lobby / Image Selection
    return (
      <div className="min-h-screen p-4 pt-8">
        {reconnectionBanner}
        <Lobby socket={socket!} roomId={roomId} playerId={playerId} room={room} />
      </div>
    );
  }

  // Home Screen - Create or Join Room
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <Card className="fun-card overflow-hidden relative">
          {/* Rainbow top border */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-pink-500 via-purple-500 via-blue-500 via-green-500 to-yellow-500" />
          
          <CardHeader className="text-center pb-4 pt-8">
            <CardTitle className="text-4xl title-gradient font-black">
              Guess The Photo
            </CardTitle>
            <CardDescription className="text-lg mt-2">
              Create or join a room to start playing with friends
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6 pb-8">
            <Button 
              onClick={handleCreateRoom} 
              className="w-full h-14 text-lg fun-button bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-purple-500/30" 
              size="lg" 
              loading={isCreatingRoom}
            >
              {isCreatingRoom ? "Creating Room..." : "Create Room"}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t-2 border-dashed border-muted-foreground/30" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-4 text-sm uppercase text-muted-foreground font-medium">
                  Or Join a Game
                </span>
              </div>
            </div>

            <form onSubmit={handleJoinRoom} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code" className="text-sm font-medium">
                  Room Code
                </Label>
                <Input
                  id="code"
                  name="code"
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  className="uppercase text-center text-xl font-mono tracking-widest h-14 border-2 focus:border-primary"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  Your Name
                </Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Enter your name"
                  maxLength={20}
                  className="h-12 border-2 focus:border-primary"
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-14 text-lg fun-button bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg shadow-blue-500/30" 
                size="lg" 
                loading={isJoiningRoom}
              >
                {isJoiningRoom ? "Joining..." : "Join Room"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* How to play hint */}
        <div className="text-center text-sm text-muted-foreground">
          <p>Upload photos • Guess whose photo it is • Win points!</p>
        </div>
      </div>
    </div>
  );
}
