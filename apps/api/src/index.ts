import dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import aiRouter from "./routes/ai";
import menuRouter from "./routes/menu";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is required. Add it to apps/api/.env before starting the API.");
  process.exit(1);
}

const app = express();
const port = Number(process.env.PORT ?? 3001);
const corsOrigin = process.env.CORS_ORIGIN ?? "*";

app.use(cors({ origin: corsOrigin === "*" ? true : corsOrigin }));
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

app.use("/api/menu", menuRouter);
app.use("/api/ai", aiRouter);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

app.listen(port, () => {
  console.log(`The Intelligent Bistro API is running at http://localhost:${port}`);
});
