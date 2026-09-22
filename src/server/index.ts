import { createServer as createHttpServer } from "http";
import { createApp } from "./app.js";
import { ensureDebitNoteLogo } from "./services/logo.js";

const PORT = parseInt(process.env.PORT || "3000", 10);

ensureDebitNoteLogo();

const tryListen = (port: number) => {
  createApp().then((app) => {
    const server = createHttpServer(app);

    const shutdown = () => {
      console.log("Shutting down gracefully...");
      server.close(() => {
        console.log("Server closed.");
        process.exit(0);
      });
      setTimeout(() => {
        console.error("Forced shutdown after timeout.");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);

    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        const fallbackPort = port + 1;
        console.warn(`Port ${port} is already in use. Trying ${fallbackPort} instead.`);
        tryListen(fallbackPort);
        return;
      }
      console.error("Failed to start server:", err);
      process.exit(1);
    });
    server.listen(port, "0.0.0.0", () => {
      const addr = server.address();
      const actualPort = typeof addr === "object" && addr ? addr.port : port;
      console.log(`Server running at http://0.0.0.0:${actualPort} on ${process.env.NODE_ENV || "development"} mode.`);
    });
  });
};

tryListen(PORT);
