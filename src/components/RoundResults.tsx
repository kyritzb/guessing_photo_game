"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Confetti, WrongAnswerEffect } from "@/components/effects/Confetti";

interface RoundResultsProps {
  correctOwner: { id: string; name: string } | null;
  results: Array<{
    playerId: string;
    name: string;
    score: number;
    guessedCorrectly: boolean;
  }>;
  scores: Array<{ id: string; name: string; score: number }>;
  isLastRound?: boolean;
  currentPlayerId?: string;
}

export function RoundResults({
  correctOwner,
  results,
  scores,
  isLastRound,
  currentPlayerId,
}: RoundResultsProps) {
  const [countdown, setCountdown] = useState(4);
  const [showEffect, setShowEffect] = useState(true);

  // Check if the current player got it right
  const currentPlayerResult = useMemo(() => {
    return results.find(r => r.playerId === currentPlayerId);
  }, [results, currentPlayerId]);

  const didCurrentPlayerWin = currentPlayerResult?.guessedCorrectly ?? false;

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    
    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  // Show loading state when countdown reaches 0 (waiting for server)
  const isWaitingForServer = countdown <= 0;

  return (
    <>
      {/* Show effects based on whether player got it right */}
      {showEffect && didCurrentPlayerWin && <Confetti particleCount={80} duration={2500} />}
      {showEffect && !didCurrentPlayerWin && currentPlayerResult && <WrongAnswerEffect duration={1500} />}
      
      <div className="w-full max-w-2xl mx-auto space-y-4">
        <Card className="fun-card overflow-hidden">
          <CardHeader className="relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500" />
            <CardTitle className="text-2xl title-gradient">
              Round Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Owner reveal */}
            <div className="text-center p-6 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 relative overflow-hidden">
              <div className="absolute inset-0 opacity-20">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="sparkle"
                    style={{
                      left: `${20 + i * 15}%`,
                      top: `${30 + (i % 3) * 20}%`,
                      animationDelay: `${i * 0.3}s`,
                    }}
                  />
                ))}
              </div>
              <p className="text-lg font-medium text-muted-foreground">The image belonged to:</p>
              <p className="text-3xl font-bold mt-2 animate-bounce-in title-gradient">
                {correctOwner?.name || "Unknown"}
              </p>
            </div>

            {/* Results list */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Player Results</h3>
              {results.map((result, index) => (
                <div
                  key={result.playerId}
                  className={`flex items-center justify-between p-4 rounded-xl transition-all animate-bounce-in stagger-item ${
                    result.guessedCorrectly 
                      ? "correct-answer" 
                      : "wrong-answer"
                  }`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <span className="font-medium">
                    {result.name}
                  </span>
                  <span className={`font-bold text-lg ${
                    result.guessedCorrectly 
                      ? "text-green-600 dark:text-green-400" 
                      : "text-red-500 dark:text-red-400"
                  }`}>
                    {result.guessedCorrectly ? `✓ Correct! +${result.score}` : "✗ Wrong"}
                  </span>
                </div>
              ))}
            </div>

            {/* Scores leaderboard */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Leaderboard</h3>
              <div className="space-y-2">
                {scores
                  .sort((a, b) => b.score - a.score)
                  .map((score, index) => (
                    <div
                      key={score.id}
                      className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all animate-bounce-in stagger-item ${
                        index === 0 
                          ? "bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 border-yellow-400" 
                          : index === 1 
                            ? "bg-gradient-to-r from-gray-100 to-slate-100 dark:from-gray-800/50 dark:to-slate-800/50 border-gray-400"
                            : index === 2
                              ? "bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 border-orange-400"
                              : "bg-card border-border"
                      }`}
                      style={{ animationDelay: `${(index + results.length) * 0.1}s` }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold w-8">
                          #{index + 1}
                        </span>
                        <span className="font-medium">{score.name}</span>
                      </div>
                      <span className="score-badge">
                        {score.score} pts
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Countdown */}
            <div className="text-center py-4">
              {isWaitingForServer ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="animate-spin w-5 h-5 border-3 border-primary border-t-transparent rounded-full" />
                  <p className="text-muted-foreground font-medium">
                    {isLastRound ? "Loading final results..." : "Loading next round..."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-muted-foreground">
                    {isLastRound ? "Final results in" : "Next round in"}
                  </p>
                  <div className="text-5xl font-bold animate-pulse-glow inline-block px-6 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                    {countdown}
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
