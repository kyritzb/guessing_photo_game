"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Socket } from "socket.io-client";

interface GameRoundProps {
  socket: Socket;
  roomId: string;
  image: string;
  imageIndex: number;
  totalImages: number;
  players: Array<{ id: string; name: string }>;
  onGuessSubmitted: () => void;
}

const PLAYER_COLORS = [
  "from-purple-500 to-pink-500",
  "from-blue-500 to-cyan-500",
  "from-green-500 to-emerald-500",
  "from-orange-500 to-amber-500",
  "from-red-500 to-rose-500",
  "from-indigo-500 to-violet-500",
  "from-teal-500 to-green-500",
  "from-pink-500 to-rose-500",
];


export function GameRound({
  socket,
  roomId,
  image,
  imageIndex,
  totalImages,
  players,
  onGuessSubmitted,
}: GameRoundProps) {
  const [hasGuessed, setHasGuessed] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset state when a new round starts (imageIndex changes)
  useEffect(() => {
    setHasGuessed(false);
    setSelectedPlayerId(null);
    setIsImageLoaded(false);
  }, [imageIndex]);

  // Handle image loading - check if already loaded (cached) or wait for load event
  useEffect(() => {
    setIsImageLoaded(false);
    
    // Check if image is already loaded (e.g., from cache)
    if (imgRef.current?.complete && imgRef.current?.naturalHeight !== 0) {
      setIsImageLoaded(true);
      return;
    }

    // Fallback: show image after a short delay even if onLoad doesn't fire
    const timeout = setTimeout(() => {
      setIsImageLoaded(true);
    }, 500);

    return () => clearTimeout(timeout);
  }, [image]);

  const handleGuess = (guessedPlayerId: string) => {
    if (!hasGuessed) {
      setSelectedPlayerId(guessedPlayerId);
      socket.emit("submit-guess", { roomId, imageIndex, guessedPlayerId });
      setHasGuessed(true);
      onGuessSubmitted();
    }
  };

  const progress = ((imageIndex + 1) / totalImages) * 100;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      <Card className="fun-card overflow-hidden">
        {/* Progress bar at top */}
        <div className="h-2 bg-muted">
          <div 
            className="h-full progress-bar-glow transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl title-gradient">
              Round {imageIndex + 1} of {totalImages}
            </CardTitle>
            <div className="flex items-center gap-2">
              {[...Array(totalImages)].map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full transition-all ${
                    i < imageIndex 
                      ? "bg-green-500" 
                      : i === imageIndex 
                        ? "bg-primary animate-pulse scale-125" 
                        : "bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
          </div>
          <p className="text-muted-foreground">
            Whose photo is this?
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Image container */}
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden border-4 border-primary/20 shadow-lg shadow-primary/10">
            {!isImageLoaded && (
              <div className="absolute inset-0 bg-muted flex items-center justify-center">
                <div className="text-center space-y-3">
                  <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mx-auto" />
                  <p className="text-muted-foreground">Loading image...</p>
                </div>
              </div>
            )}
            <img
              ref={imgRef}
              src={image}
              alt="Guess whose image this is!"
              className={`w-full h-full object-contain transition-opacity duration-300 ${isImageLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setIsImageLoaded(true)}
              onError={() => setIsImageLoaded(true)} // Show anyway on error
            />
            
            {/* Decorative corners */}
            <div className="absolute top-2 left-2 w-6 h-6 border-t-4 border-l-4 border-primary/50 rounded-tl-lg" />
            <div className="absolute top-2 right-2 w-6 h-6 border-t-4 border-r-4 border-primary/50 rounded-tr-lg" />
            <div className="absolute bottom-2 left-2 w-6 h-6 border-b-4 border-l-4 border-primary/50 rounded-bl-lg" />
            <div className="absolute bottom-2 right-2 w-6 h-6 border-b-4 border-r-4 border-primary/50 rounded-br-lg" />
          </div>

          {/* Player selection buttons */}
          <div className="space-y-3">
            <p className="text-center font-medium text-lg">
              {hasGuessed ? "Your guess is locked in!" : "Tap to guess the owner"}
            </p>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {players.map((player, index) => {
                const isSelected = selectedPlayerId === player.id;
                const colorClass = PLAYER_COLORS[index % PLAYER_COLORS.length];
                
                return (
                  <Button
                    key={player.id}
                    onClick={() => handleGuess(player.id)}
                    disabled={hasGuessed}
                    variant="outline"
                    className={`
                      h-16 text-lg font-bold relative overflow-hidden transition-all duration-200
                      ${!hasGuessed && `player-button bg-gradient-to-r ${colorClass} text-white border-0 hover:scale-105 hover:shadow-lg`}
                      ${hasGuessed && isSelected && `bg-gradient-to-r ${colorClass} text-white border-0 opacity-100`}
                      ${hasGuessed && !isSelected && "opacity-50 bg-muted"}
                    `}
                    loading={isSelected && hasGuessed}
                  >
                    <span className="truncate">{player.name}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Waiting indicator */}
          {hasGuessed && (
            <div className="text-center p-4 rounded-xl bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30">
              <div className="flex items-center justify-center gap-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-3 h-3 rounded-full bg-primary animate-bounce"
                      style={{ animationDelay: `${i * 0.1}s` }}
                    />
                  ))}
                </div>
                <p className="text-muted-foreground font-medium">
                  Waiting for other players to guess...
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
