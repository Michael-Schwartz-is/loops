import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Bindings } from "./types.js";
import projects from "./routes/projects.js";
import script from "./routes/script.js";
import code from "./routes/code.js";
import logs from "./routes/logs.js";
import events from "./routes/events.js";
import debug from "./routes/debug.js";

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors({
  origin: (origin) => origin || "*",
  credentials: true,
}));

app.get("/", (c) => c.json({ service: "loops", status: "ok" }));

app.route("/", projects);
app.route("/", script);
app.route("/", code);
app.route("/", logs);
app.route("/", events);
app.route("/", debug);

export default app;
