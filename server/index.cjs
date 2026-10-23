
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

dotenv.config();

const app = express();
const PORT = process.env.PORT || process.env.SERVER_PORT || 3001;

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  ...(process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(",").map((url) => url.trim())
    : []),
];

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        /\.vercel\.app$/.test(new URL(origin).hostname)
      ) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
  })
);

app.use(express.json({ limit: "1mb" }));

const dbPath =
  process.env.DATABASE_PATH || path.join(__dirname, "lifeos.db");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'Medium'
      CHECK(priority IN ('Low', 'Medium', 'High')),
    done INTEGER NOT NULL DEFAULT 0 CHECK(done IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    due_at TEXT,
    completed INTEGER NOT NULL DEFAULT 0
      CHECK(completed IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    room TEXT NOT NULL DEFAULT 'Home',
    type TEXT NOT NULL DEFAULT 'other',
    is_on INTEGER NOT NULL DEFAULT 0
      CHECK(is_on IN (0, 1))
  );

  CREATE TABLE IF NOT EXISTS activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

function recordActivity(action, details) {
  db.prepare(
    "INSERT INTO activity (action, details) VALUES (?, ?)"
  ).run(action, details);
}

function seedIfEmpty(table, rows, insertSql) {
  if (db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count) {
    return;
  }

  const insert = db.prepare(insertSql);
  const seed = db.transaction((items) => {
    for (const item of items) insert.run(...item);
  });

  seed(rows);
}

seedIfEmpty(
  "tasks",
  [
    ["Complete data science assignment", "High", 0],
    ["Review today's priorities", "Medium", 0],
    ["Organize project workspace", "Low", 1],
  ],
  "INSERT INTO tasks (title, priority, done) VALUES (?, ?, ?)"
);

seedIfEmpty(
  "reminders",
  [
    ["Review today's priorities", null],
    ["Take a short break", null],
  ],
  "INSERT INTO reminders (title, due_at) VALUES (?, ?)"
);

seedIfEmpty(
  "devices",
  [
    ["Living room light", "Living room", "light", 1],
    ["Bedroom light", "Bedroom", "light", 0],
    ["Smart speaker", "Living room", "speaker", 1],
    ["Desk lamp", "Study", "light", 0],
  ],
  "INSERT INTO devices (name, room, type, is_on) VALUES (?, ?, ?, ?)"
);

const taskById = db.prepare("SELECT * FROM tasks WHERE id = ?");
const reminderById = db.prepare("SELECT * FROM reminders WHERE id = ?");
const deviceById = db.prepare("SELECT * FROM devices WHERE id = ?");

function validId(req, res) {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid ID." });
    return null;
  }

  return id;
}

function requiredText(value) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= 200
  );
}

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "Alexa+ LifeOS API",
    database: "connected",
    timestamp: new Date().toISOString(),
  });
});

// Tasks
app.get("/api/tasks", (_req, res) => {
  res.json(db.prepare("SELECT * FROM tasks ORDER BY id DESC").all());
});

app.post("/api/tasks", (req, res) => {
  const { title, priority = "Medium" } = req.body ?? {};

  if (!requiredText(title)) {
    return res.status(400).json({
      error: "A title of 1–200 characters is required.",
    });
  }

  if (!["Low", "Medium", "High"].includes(priority)) {
    return res.status(400).json({
      error: "Priority must be Low, Medium, or High.",
    });
  }

  const result = db
    .prepare("INSERT INTO tasks (title, priority) VALUES (?, ?)")
    .run(title.trim(), priority);

  const task = taskById.get(result.lastInsertRowid);
  recordActivity("task.created", task.title);

  res.status(201).json(task);
});

app.patch("/api/tasks/:id", (req, res) => {
  const id = validId(req, res);
  if (id === null) return;

  const current = taskById.get(id);
  if (!current) {
    return res.status(404).json({ error: "Task not found." });
  }

  const { title, priority, done } = req.body ?? {};

  if (title !== undefined && !requiredText(title)) {
    return res.status(400).json({ error: "Invalid title." });
  }

  if (
    priority !== undefined &&
    !["Low", "Medium", "High"].includes(priority)
  ) {
    return res.status(400).json({ error: "Invalid priority." });
  }

  if (done !== undefined && typeof done !== "boolean") {
    return res.status(400).json({ error: "done must be true or false." });
  }

  db.prepare(
    "UPDATE tasks SET title = ?, priority = ?, done = ? WHERE id = ?"
  ).run(
    title === undefined ? current.title : title.trim(),
    priority === undefined ? current.priority : priority,
    done === undefined ? current.done : Number(done),
    id
  );

  const updated = taskById.get(id);
  recordActivity("task.updated", updated.title);

  res.json(updated);
});

app.delete("/api/tasks/:id", (req, res) => {
  const id = validId(req, res);
  if (id === null) return;

  const task = taskById.get(id);
  if (!task) {
    return res.status(404).json({ error: "Task not found." });
  }

  db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
  recordActivity("task.deleted", task.title);

  res.json({ success: true, id });
});

// Reminders
app.get("/api/reminders", (_req, res) => {
  res.json(db.prepare("SELECT * FROM reminders ORDER BY id DESC").all());
});

app.post("/api/reminders", (req, res) => {
  const { title, due_at = null } = req.body ?? {};

  if (!requiredText(title)) {
    return res.status(400).json({
      error: "A reminder title is required.",
    });
  }

  if (
    due_at !== null &&
    (typeof due_at !== "string" || due_at.length > 100)
  ) {
    return res.status(400).json({ error: "Invalid due_at value." });
  }

  const result = db
    .prepare("INSERT INTO reminders (title, due_at) VALUES (?, ?)")
    .run(title.trim(), due_at);

  const reminder = reminderById.get(result.lastInsertRowid);
  recordActivity("reminder.created", reminder.title);

  res.status(201).json(reminder);
});

app.patch("/api/reminders/:id", (req, res) => {
  const id = validId(req, res);
  if (id === null) return;

  const current = reminderById.get(id);
  if (!current) {
    return res.status(404).json({ error: "Reminder not found." });
  }

  const { title, due_at, completed } = req.body ?? {};

  if (title !== undefined && !requiredText(title)) {
    return res.status(400).json({ error: "Invalid title." });
  }

  if (completed !== undefined && typeof completed !== "boolean") {
    return res.status(400).json({
      error: "completed must be true or false.",
    });
  }

  if (
    due_at !== undefined &&
    due_at !== null &&
    (typeof due_at !== "string" || due_at.length > 100)
  ) {
    return res.status(400).json({ error: "Invalid due_at value." });
  }

  db.prepare(
    "UPDATE reminders SET title = ?, due_at = ?, completed = ? WHERE id = ?"
  ).run(
    title === undefined ? current.title : title.trim(),
    due_at === undefined ? current.due_at : due_at,
    completed === undefined ? current.completed : Number(completed),
    id
  );

  const updated = reminderById.get(id);
  recordActivity("reminder.updated", updated.title);

  res.json(updated);
});

app.delete("/api/reminders/:id", (req, res) => {
  const id = validId(req, res);
  if (id === null) return;

  const reminder = reminderById.get(id);
  if (!reminder) {
    return res.status(404).json({ error: "Reminder not found." });
  }

  db.prepare("DELETE FROM reminders WHERE id = ?").run(id);
  recordActivity("reminder.deleted", reminder.title);

  res.json({ success: true, id });
});

// Simulated smart-home devices
app.get("/api/devices", (_req, res) => {
  res.json(db.prepare("SELECT * FROM devices ORDER BY id").all());
});

app.patch("/api/devices/:id", (req, res) => {
  const id = validId(req, res);
  if (id === null) return;

  const device = deviceById.get(id);
  if (!device) {
    return res.status(404).json({ error: "Device not found." });
  }

  const { is_on } = req.body ?? {};

  if (typeof is_on !== "boolean") {
    return res.status(400).json({
      error: "is_on must be true or false.",
    });
  }

  db.prepare("UPDATE devices SET is_on = ? WHERE id = ?")
    .run(Number(is_on), id);

  const updated = deviceById.get(id);
  recordActivity(
    "device.toggled",
    `${updated.name}: ${is_on ? "on" : "off"}`
  );

  res.json(updated);
});

// Activity history
app.get("/api/activity", (_req, res) => {
  res.json(
    db.prepare("SELECT * FROM activity ORDER BY id DESC LIMIT 100").all()
  );
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Alexa+ LifeOS API listening on port ${PORT}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
