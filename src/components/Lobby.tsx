"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageSelector } from "./ImageSelector";
import type { Room, SyncProgress } from "@/types/game";
import type { Socket } from "socket.io-client";
import { saveGameSession } from "@/hooks/useSocket";

interface LobbyProps {
  socket: Socket;
  roomId: string;
  playerId: string;
  room: Room;
  onImagesCached?: (images: string[]) => void;
}

// Cache for synced images (stored outside component to persist across re-renders)
const imageCacheMap = new Map<string, string[]>();


export function Lobby({ socket, roomId, playerId, room, onImagesCached }: LobbyProps) {
  const [name, setName] = useState("");
  const [nameSubmitted, setNameSubmitted] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [imagesSubmitted, setImagesSubmitted] = useState(false);
  const [isSubmittingName, setIsSubmittingName] = useState(false);
  const [isStartingGame, setIsStartingGame] = useState(false);
  
  // Sync progress state
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncComplete, setSyncComplete] = useState(room.syncComplete || false);
  const syncedImagesRef = useRef<string[]>([]);
  
  const currentPlayer = room.players.find((p) => p.id === playerId);
  const isHost = currentPlayer?.isHost || false;
  const allPlayersReady = room.players.every((p) => p.imageCount === 10) && room.players.length >= 1;

  // Save session for reconnection support
  useEffect(() => {
    if (roomId && playerId) {
      saveGameSession(roomId, playerId);
    }
  }, [roomId, playerId]);

  useEffect(() => {
    if (currentPlayer?.name) {
      setName(currentPlayer.name);
      setNameSubmitted(true);
      setIsSubmittingName(false);
    }
    if (currentPlayer?.imageCount === 10) {
      setImagesSubmitted(true);
    }
  }, [currentPlayer]);

  // Update sync complete from room state
  useEffect(() => {
    if (room.syncComplete) {
      setSyncComplete(true);
      setIsSyncing(false);
    }
  }, [room.syncComplete]);

  // Handle image sync events
  useEffect(() => {
    if (!socket) return;

    const handleImageBatch = ({ batchIndex, totalBatches, image }: { batchIndex: number; totalBatches: number; image: string }) => {
      console.log(`Received image batch ${batchIndex + 1}/${totalBatches}`);
      setIsSyncing(true);
      
      // Store the image
      if (!syncedImagesRef.current[batchIndex]) {
        syncedImagesRef.current[batchIndex] = image;
        
        // Track if we've already acknowledged this batch
        let acknowledged = false;
        const acknowledge = () => {
          if (!acknowledged) {
            acknowledged = true;
            console.log(`Acknowledging image batch ${batchIndex + 1}/${totalBatches}`);
            socket.emit("images-synced", { roomId, batchIndex });
          }
        };
        
        // Pre-load the image to ensure it's cached in browser
        const img = new Image();
        img.onload = acknowledge;
        img.onerror = acknowledge;
        img.src = image;
        
        // Failsafe: acknowledge after timeout even if image callbacks don't fire
        // This prevents sync from stalling if image loading hangs
        setTimeout(acknowledge, 3000);
      } else {
        // Already have this image, but still acknowledge in case server missed it
        console.log(`Re-acknowledging existing image batch ${batchIndex + 1}/${totalBatches}`);
        socket.emit("images-synced", { roomId, batchIndex });
      }
    };

    const handleSyncProgress = (progress: SyncProgress) => {
      setSyncProgress(progress);
    };

    const handleSyncComplete = () => {
      console.log("All images synced!");
      setSyncComplete(true);
      setIsSyncing(false);
      
      // Store in cache map for game use
      imageCacheMap.set(roomId, [...syncedImagesRef.current]);
      onImagesCached?.(syncedImagesRef.current);
    };

    socket.on("sync-image-batch", handleImageBatch);
    socket.on("sync-progress", handleSyncProgress);
    socket.on("sync-complete", handleSyncComplete);

    return () => {
      socket.off("sync-image-batch", handleImageBatch);
      socket.off("sync-progress", handleSyncProgress);
      socket.off("sync-complete", handleSyncComplete);
    };
  }, [socket, roomId, onImagesCached]);

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      setIsSubmittingName(true);
      socket.emit("update-name", { roomId, name: name.trim() });
      setNameSubmitted(true);
    }
  };

  const handleImagesSelected = (images: string[]) => {
    setSelectedImages(images);
    if (images.length === 10) {
      console.log("Submitting 10 images to server...");
      socket.emit("submit-images", { roomId, images }, (response: { success?: boolean; error?: string }) => {
        if (response?.success) {
          console.log("Images submitted successfully");
          setImagesSubmitted(true);
        } else if (response?.error) {
          console.error("Error submitting images:", response.error);
          alert("Failed to submit images: " + response.error);
        }
      });
    }
  };

  const handleStartGame = () => {
    if (allPlayersReady && syncComplete) {
      console.log("Emitting start-game event");
      setIsStartingGame(true);
      socket.emit("start-game", { roomId }, (response: { success?: boolean; error?: string }) => {
        if (response?.error) {
          console.error("Error starting game:", response.error);
          alert("Failed to start game: " + response.error);
          setIsStartingGame(false);
        }
      });
    }
  };

  // Show name input if player hasn't set name yet
  if (!nameSubmitted || !currentPlayer?.name) {
    return (
      <Card className="w-full max-w-md mx-auto fun-card overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500" />
        <CardHeader className="text-center pt-8">
          <CardTitle className="text-2xl title-gradient">What&apos;s Your Name?</CardTitle>
          <CardDescription>Choose a fun name for the game!</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleNameSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                maxLength={20}
                autoFocus
                className="h-14 text-lg border-2 focus:border-primary"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-14 text-lg fun-button bg-gradient-to-r from-purple-600 to-pink-600" 
              disabled={!name.trim()}
            >
              {isSubmittingName ? "Saving..." : "Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  // Show image selector if images not yet submitted
  if (!imagesSubmitted && selectedImages.length < 10) {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-4">
        <Card className="fun-card overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-green-500 via-blue-500 to-purple-500" />
          <CardHeader className="text-center pt-8">
            <CardTitle className="text-2xl title-gradient">Select Your Photos</CardTitle>
            <CardDescription className="text-lg">
              Choose 10 of your favorite photos. The other players will try to guess which ones are yours!
            </CardDescription>
          </CardHeader>
        </Card>
        <ImageSelector onImagesSelected={handleImagesSelected} maxImages={10} />
      </div>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto fun-card overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500" />
      
      <CardHeader className="text-center pt-8">
        <CardTitle className="text-2xl title-gradient">Game Lobby</CardTitle>
        <CardDescription className="space-y-2">
          <p>Share this code with friends:</p>
          <p className="room-code text-3xl">{roomId}</p>
        </CardDescription>
        <div className="mt-4 p-3 rounded-xl bg-muted/50 text-sm text-muted-foreground">
          {!allPlayersReady 
            ? "Waiting for all players to select their images..."
            : isSyncing 
              ? "Syncing game images..."
              : syncComplete 
                ? "Ready to start!"
                : "Preparing game..."}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Sync Progress Section */}
        {(isSyncing || (allPlayersReady && !syncComplete)) && (
          <div className="space-y-4 p-5 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="font-bold">Syncing Images</span>
              <span className="font-mono font-bold text-primary">
                {syncProgress?.progress || 0}%
              </span>
            </div>
            
            {/* Overall progress bar */}
            <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full progress-bar-glow transition-all duration-300 ease-out"
                style={{ width: `${syncProgress?.progress || 0}%` }}
              />
            </div>
            
            {/* Per-player progress */}
            {syncProgress?.playerProgress && (
              <div className="space-y-2 mt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Player Progress:</p>
                {syncProgress.playerProgress.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 text-sm">
                    <span className="w-24 truncate font-medium">{p.name}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-200"
                        style={{ width: `${(p.synced / p.total) * 100}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground font-mono text-xs">
                      {p.synced}/{p.total}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sync Complete indicator */}
        {syncComplete && allPlayersReady && (
          <div className="flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 text-green-700 dark:text-green-300 rounded-xl">
            <span className="font-bold">All images synced! Ready to play!</span>
          </div>
        )}

        {/* Players list */}
        <div className="space-y-3">
          <h3 className="font-bold text-lg">Players ({room.players.length})</h3>
          <div className="space-y-2">
            {room.players.map((player, index) => {
              const playerSync = syncProgress?.playerProgress.find(p => p.id === player.id);
              const isFullySynced = playerSync && playerSync.synced >= playerSync.total;
              
              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all animate-bounce-in stagger-item ${
                    player.id === playerId 
                      ? "bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 border-purple-300" 
                      : "bg-card border-border"
                  }`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <span className="flex items-center gap-3">
                    <span className="font-medium">
                      {player.name}
                      {player.isHost && <span className="ml-2 text-xs bg-yellow-200 dark:bg-yellow-800 px-2 py-0.5 rounded-full">Host</span>}
                      {player.id === playerId && <span className="ml-2 text-xs bg-primary/20 px-2 py-0.5 rounded-full">You</span>}
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    {player.imageCount === 10 ? (
                      <>
                        <span className="text-sm bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-1 rounded-full">
                          10 photos
                        </span>
                        {isSyncing && playerSync && (
                          <span className={`text-sm px-2 py-1 rounded-full ${
                            isFullySynced 
                              ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' 
                              : 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300'
                          }`}>
                            {isFullySynced ? 'Synced' : `${playerSync.synced}/${playerSync.total}`}
                          </span>
                        )}
                        {syncComplete && <span className="text-sm bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded-full">Ready</span>}
                      </>
                    ) : (
                      <span className="text-sm bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 px-2 py-1 rounded-full">
                        {player.imageCount}/10
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action section */}
        <div className="pt-4">
          {isHost && (
            <Button
              onClick={handleStartGame}
              disabled={!allPlayersReady || !syncComplete || isStartingGame}
              className="w-full h-16 text-xl fun-button bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-lg shadow-green-500/30"
              size="lg"
            >
            {isStartingGame 
              ? "Starting..." 
              : !allPlayersReady 
                ? "Waiting for players..." 
                : !syncComplete 
                  ? "Syncing images..." 
                  : "Start Game"}
            </Button>
          )}

          {!isHost && (
            <div className="text-center p-5 rounded-xl bg-muted/50">
              <div className="flex items-center justify-center gap-3 text-muted-foreground">
                {syncComplete ? (
                  <p className="font-medium">Waiting for host to start the game...</p>
                ) : allPlayersReady ? (
                  <>
                    <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
                    <p className="font-medium">Syncing images, please wait...</p>
                  </>
                ) : (
                  <p className="font-medium">Waiting for all players to upload photos...</p>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Export the cache for use in GameRound
export function getCachedImages(roomId: string): string[] {
  return imageCacheMap.get(roomId) || [];
}
