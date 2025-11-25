const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    maxHttpBufferSize: 50 * 1024 * 1024, // 50MB for image uploads
    // Improved connection settings for stability
    pingTimeout: 60000, // 60 seconds ping timeout (default is 20s)
    pingInterval: 25000, // 25 seconds ping interval (default is 25s)
    connectTimeout: 45000, // 45 seconds connection timeout
    // Allow polling fallback for unstable connections
    transports: ["websocket", "polling"],
    // Upgrade timeout
    upgradeTimeout: 30000,
    // Allow reconnection
    allowUpgrades: true,
    // Increase per-message deflate for large payloads
    perMessageDeflate: {
      threshold: 1024, // Only compress messages larger than 1KB
      zlibDeflateOptions: {
        chunkSize: 16 * 1024,
      },
      zlibInflateOptions: {
        windowBits: 15,
      },
    },
  });

  // Log socket.io engine errors
  io.engine.on("connection_error", (err) => {
    console.error("Connection error:", err.req?.url, err.code, err.message);
  });

  // Import and setup game server
  const { setupGameServer } = require("./src/lib/game-server.js");
  setupGameServer(io);

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
