"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const STORAGE_KEY = "guessing_game_session";

interface GameSession {
  roomId: string;
  playerId: string;
  timestamp: number;
}

export function saveGameSession(roomId: string, playerId: string) {
  const session: GameSession = {
    roomId,
    playerId,
    timestamp: Date.now(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (e) {
    console.error("Failed to save game session:", e);
  }
}

export function getGameSession(): GameSession | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    const session = JSON.parse(stored) as GameSession;
    
    // Session expires after 2 hours
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    if (Date.now() - session.timestamp > TWO_HOURS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    
    return session;
  } catch (e) {
    console.error("Failed to get game session:", e);
    return null;
  }
}

export function clearGameSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Failed to clear game session:", e);
  }
}

interface UseSocketReturn {
  socket: Socket | null;
  connected: boolean;
  reconnecting: boolean;
  connectionAttempts: number;
}

export function useSocket(): UseSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = io({
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = socketInstance;
    setSocket(socketInstance);

    socketInstance.on("connect", () => {
      console.log("Socket connected:", socketInstance.id);
      setConnected(true);
      setReconnecting(false);
      setConnectionAttempts(0);

      // Try to reconnect to existing game session
      const session = getGameSession();
      if (session) {
        console.log("Found existing session, attempting reconnect...");
        socketInstance.emit("reconnect-to-room", {
          roomId: session.roomId,
          playerId: session.playerId,
        });
      }
    });

    socketInstance.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      setConnected(false);
      if (reason !== "io client disconnect") {
        setReconnecting(true);
      }
    });

    socketInstance.on("reconnect_attempt", (attempt) => {
      console.log("Reconnection attempt:", attempt);
      setConnectionAttempts(attempt);
      setReconnecting(true);
    });

    socketInstance.on("reconnect", () => {
      console.log("Socket reconnected");
      setReconnecting(false);
      setConnectionAttempts(0);

      // Try to reconnect to existing game session
      const session = getGameSession();
      if (session) {
        console.log("Reconnecting to existing session...");
        socketInstance.emit("reconnect-to-room", {
          roomId: session.roomId,
          playerId: session.playerId,
        });
      }
    });

    socketInstance.on("reconnect_failed", () => {
      console.log("Reconnection failed");
      setReconnecting(false);
    });

    socketInstance.on("connect_error", (error) => {
      console.error("Connection error:", error.message);
    });

    return () => {
      socketInstance.disconnect();
      socketRef.current = null;
    };
  }, []);

  return { socket, connected, reconnecting, connectionAttempts };
}

