"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CelebrationBurst } from "@/components/effects/Confetti";
import type { Socket } from "socket.io-client";

interface GameOverProps {
  socket: Socket;
  roomId: string;
  winner: { id: string; name: string; score: number };
  finalScores: Array<{ id: string; name: string; score: number }>;
  isHost: boolean;
  onNewGame: () => void;
  currentPlayerId?: string;
}

export function GameOver({
  socket,
  roomId,
  winner,
  finalScores,
  isHost,
  onNewGame,
  currentPlayerId,
}: GameOverProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showCelebration, setShowCelebration] = useState(true);

  const isWinner = currentPlayerId === winner.id;

  const handleNewGame = () => {
    setIsLoading(true);
    socket.emit("new-game", { roomId });
    onNewGame();
  };

  // Crown animation for winner
  const [crownBounce, setCrownBounce] = useState(true);
  useEffect(() => {
    const interval = setInterval(() => {
      setCrownBounce(prev => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {showCelebration && <CelebrationBurst />}
      
      <div className="w-full max-w-2xl mx-auto space-y-4">
        <Card className="fun-card overflow-hidden">
          <CardHeader className="relative pb-2">
            {/* Rainbow top border */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500" />
            
            <CardTitle className="text-4xl text-center pt-4">
              <span className="title-gradient">Game Over!</span>
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-8">
            {/* Winner showcase */}
            <div className="relative">
              {/* Spotlight effect */}
              <div className="absolute inset-0 bg-gradient-radial from-yellow-200/50 via-transparent to-transparent dark:from-yellow-500/20 rounded-2xl" />
              
              <div className="relative text-center p-8 winner-podium rounded-2xl">
                <p className="text-lg text-amber-800 dark:text-amber-200 font-medium mb-1">
                  Winner
                </p>
                
                <p className="text-5xl font-black text-amber-900 dark:text-amber-100 mb-4 animate-pulse">
                  {winner.name}
                </p>
                
                <div className="inline-flex items-center gap-2 bg-amber-800/20 px-6 py-3 rounded-full">
                  <span className="text-3xl font-bold text-amber-900 dark:text-amber-100">
                    {winner.score} points
                  </span>
                </div>

                {isWinner && (
                  <p className="mt-4 text-xl font-bold text-amber-800">
                    That&apos;s YOU! Congratulations!
                  </p>
                )}
              </div>
            </div>

            {/* Final standings */}
            <div className="space-y-4">
              <h3 className="font-bold text-xl text-center">Final Standings</h3>
              
              <div className="space-y-3">
                {finalScores.map((score, index) => (
                  <div
                    key={score.id}
                    className={`flex items-center justify-between p-5 rounded-xl transition-all animate-bounce-in stagger-item ${
                      index === 0 
                        ? "bg-gradient-to-r from-yellow-200 to-amber-200 dark:from-yellow-800/50 dark:to-amber-800/50 border-3 border-yellow-400 shadow-lg shadow-yellow-500/30" 
                        : index === 1 
                          ? "bg-gradient-to-r from-gray-200 to-slate-200 dark:from-gray-700/50 dark:to-slate-700/50 border-2 border-gray-400"
                          : index === 2
                            ? "bg-gradient-to-r from-orange-200 to-amber-200 dark:from-orange-800/50 dark:to-amber-800/50 border-2 border-orange-400"
                            : "bg-card border border-border"
                    }`}
                    style={{ animationDelay: `${index * 0.15}s` }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-2xl font-bold text-muted-foreground w-10">
                        #{index + 1}
                      </div>
                      <div>
                        <span className={`text-xl font-bold ${index === 0 ? "text-amber-900 dark:text-amber-100" : ""}`}>
                          {score.name}
                        </span>
                        {score.id === currentPlayerId && (
                          <span className="ml-2 text-sm bg-primary/20 px-2 py-0.5 rounded-full">
                            You
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={`text-2xl font-black ${
                      index === 0 ? "text-amber-700 dark:text-amber-300" : "text-foreground"
                    }`}>
                      {score.score} pts
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-4">
              {isHost ? (
                <Button 
                  onClick={handleNewGame} 
                  className="w-full h-14 text-xl fun-button bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" 
                  size="lg" 
                  loading={isLoading}
                >
                  {isLoading ? "Starting..." : "Play Again"}
                </Button>
              ) : (
                <div className="text-center p-4 rounded-xl bg-muted/50">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                    <p>Waiting for host to start a new game...</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
