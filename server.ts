import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

// CORS middleware for cross-device & mobile API access
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  next();
});

app.use(express.json({ limit: "10mb" }));

// Server-side directory for persistent shared database store
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const DB_FILE = path.join(DATA_DIR, "server_db.json");

// Default Supabase project credentials
const DEFAULT_SUPABASE_URL = "https://sfhnaamxhwmzppmcmvbo.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_hkCdMoiafha4Zxs6nm0t0Q_nZBb-JQD";

// Load backend configuration
function loadBackendConfig() {
  let url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  let key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
      if (saved.url) url = saved.url;
      if (saved.key) key = saved.key;
    } catch {
      // Ignore parse failure
    }
  }

  const isConfigured = 
    Boolean(url && key) && 
    !url.includes("your-project.supabase.co") && 
    !url.includes("sfhnaamxhwmzppmcmvbo.supabase.co") &&
    !key.includes("your-anon-key");

  return { url, key, isConfigured };
}

function saveBackendConfig(url: string, key: string) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ url, key }, null, 2), "utf-8");
}

// Server Database helper (stores real clean data for multi-device sync on server)
function getServerDb(): Record<string, any[]> {
  if (fs.existsSync(DB_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      // Ignore parse failure
    }
  }
  const defaultAdmin = {
    id: "user_admin_01",
    user_id: "admin",
    name: "Administrator",
    full_name: "Administrator",
    password: "admin",
    role: "admin",
    department: "Executive",
    contact: "admin@infiev.com",
    is_active: true,
    created_at: new Date().toISOString()
  };
  const emptyDb: Record<string, any[]> = {
    app_users: [defaultAdmin],
    production_orders: [],
    inventory_items: [],
    raw_materials: [],
    electricity_downtimes: [],
    quality_tests: [],
    announcements: [],
    daily_financials: [],
    messages: [],
    tasks: [],
    work_reports: [],
    notifications: []
  };
  fs.writeFileSync(DB_FILE, JSON.stringify(emptyDb, null, 2), "utf-8");
  return emptyDb;
}

function saveServerDb(db: Record<string, any[]>) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
}

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

// Match filter helper for server fallback DB
function matchRow(row: any, filterStr: string | undefined): boolean {
  if (!filterStr) return true;
  const parts = filterStr.split("&");
  for (const part of parts) {
    const match = part.match(/^([^=!<>]+)=([^.]+)\.(.+)$/);
    if (!match) continue;
    const col = match[1];
    const op = match[2];
    let val: any = decodeURIComponent(match[3]);

    if (val === "true") val = true;
    else if (val === "false") val = false;
    else if (val === "null") val = null;

    const rowVal = row[col];

    if (op === "eq") {
      if (typeof rowVal === "boolean" && typeof val === "string") {
        if (rowVal && val === "true") continue;
        if (!rowVal && val === "false") continue;
      }
      if (String(rowVal).toLowerCase() !== String(val).toLowerCase()) {
        return false;
      }
    } else if (op === "neq") {
      if (String(rowVal).toLowerCase() === String(val).toLowerCase()) {
        return false;
      }
    }
  }
  return true;
}

// ==================== API ROUTES ====================

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Config Status
app.get("/api/config", (_req, res) => {
  const cfg = loadBackendConfig();
  res.json({
    configured: cfg.isConfigured,
    url: cfg.url ? cfg.url.replace(/(https?:\/\/)(.*)/, "$1***.supabase.co") : "",
  });
});

// Update Database Config
app.post("/api/config", (req, res) => {
  const { url, key } = req.body;
  if (typeof url === "string" && typeof key === "string") {
    saveBackendConfig(url.trim(), key.trim());
    return res.json({ ok: true, message: "Server configuration updated." });
  }
  return res.status(400).json({ ok: false, error: "Invalid URL or key provided." });
});

// GET Table Data (Select)
app.get("/api/db/:table", async (req, res) => {
  const { table } = req.params;
  const { select = "*", order, limit, filter } = req.query;
  const cfg = loadBackendConfig();

  if (cfg.isConfigured) {
    try {
      let remoteUrl = `${cfg.url}/rest/v1/${table}?select=${encodeURIComponent(String(select))}`;
      if (order) remoteUrl += `&order=${encodeURIComponent(String(order))}`;
      if (limit) remoteUrl += `&limit=${encodeURIComponent(String(limit))}`;
      if (filter) remoteUrl += `&${String(filter)}`;

      const supabaseRes = await fetch(remoteUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "apikey": cfg.key,
          "Authorization": `Bearer ${cfg.key}`,
          "Prefer": "return=representation"
        }
      });

      if (supabaseRes.ok) {
        const data = await supabaseRes.json();
        return res.json({ data, error: null });
      } else {
        const text = await supabaseRes.text();
        console.warn(`Supabase remote fetch error [${table}]: ${supabaseRes.status} ${text}`);
      }
    } catch (err: any) {
      console.warn(`Supabase remote request failed [${table}]:`, err?.message || err);
    }
  }

  // Fallback to shared server database
  const db = getServerDb();
  let rows = db[table] || [];

  if (filter) {
    rows = rows.filter(r => matchRow(r, String(filter)));
  }

  if (order && typeof order === "string") {
    const [orderCol, orderDir] = order.split(".");
    rows = [...rows].sort((a, b) => {
      const valA = String(a[orderCol] ?? "");
      const valB = String(b[orderCol] ?? "");
      return orderDir === "desc" ? valB.localeCompare(valA) : valA.localeCompare(valB);
    });
  }

  if (limit) {
    const num = parseInt(String(limit), 10);
    if (!isNaN(num)) rows = rows.slice(0, num);
  }

  res.json({ data: rows, error: null });
});

// POST Table Data (Insert)
app.post("/api/db/:table", async (req, res) => {
  const { table } = req.params;
  const body = req.body;
  const incoming = Array.isArray(body) ? body : [body];
  const processed = incoming.map(r => ({
    id: r.id || generateUUID(),
    created_at: r.created_at || new Date().toISOString(),
    ...r
  }));

  const cfg = loadBackendConfig();

  if (cfg.isConfigured) {
    try {
      const supabaseRes = await fetch(`${cfg.url}/rest/v1/${table}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": cfg.key,
          "Authorization": `Bearer ${cfg.key}`,
          "Prefer": "return=representation"
        },
        body: JSON.stringify(processed)
      });

      if (supabaseRes.ok) {
        let data: any[] = [];
        try {
          data = await supabaseRes.json();
        } catch {
          data = processed;
        }
        return res.json({ data, error: null });
      } else {
        const text = await supabaseRes.text();
        console.warn(`Supabase remote insert error [${table}]: ${supabaseRes.status} ${text}`);
      }
    } catch (err: any) {
      console.warn(`Supabase remote insert failed [${table}]:`, err?.message || err);
    }
  }

  // Save to shared server database
  const db = getServerDb();
  const existing = db[table] || [];
  db[table] = [...processed, ...existing];
  saveServerDb(db);

  res.json({ data: processed, error: null });
});

// PATCH Table Data (Update)
app.patch("/api/db/:table", async (req, res) => {
  const { table } = req.params;
  const { col, val, filter } = req.query;
  const updatePayload = req.body;

  const cfg = loadBackendConfig();

  let targetCol = String(col || "id");
  let targetVal = String(val || "");

  if (filter && typeof filter === "string") {
    const match = filter.match(/^([^=]+)=eq\.(.+)$/);
    if (match) {
      targetCol = match[1];
      targetVal = decodeURIComponent(match[2]);
    }
  }

  if (cfg.isConfigured) {
    try {
      const remoteUrl = `${cfg.url}/rest/v1/${table}?${targetCol}=eq.${encodeURIComponent(targetVal)}`;
      const supabaseRes = await fetch(remoteUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": cfg.key,
          "Authorization": `Bearer ${cfg.key}`,
          "Prefer": "return=representation"
        },
        body: JSON.stringify(updatePayload)
      });

      if (supabaseRes.ok) {
        let data: any[] = [];
        try {
          data = await supabaseRes.json();
        } catch {
          data = [updatePayload];
        }
        return res.json({ data, error: null });
      } else {
        const text = await supabaseRes.text();
        console.warn(`Supabase remote patch error [${table}]: ${supabaseRes.status} ${text}`);
      }
    } catch (err: any) {
      console.warn(`Supabase remote patch failed [${table}]:`, err?.message || err);
    }
  }

  // Save to shared server database
  const db = getServerDb();
  const existing = db[table] || [];
  let updatedRows: any[] = [];
  db[table] = existing.map(r => {
    if (String(r[targetCol]) === targetVal) {
      const u = { ...r, ...updatePayload };
      updatedRows.push(u);
      return u;
    }
    return r;
  });
  saveServerDb(db);

  res.json({ data: updatedRows, error: null });
});

// DELETE Table Data (Delete)
app.delete("/api/db/:table", async (req, res) => {
  const { table } = req.params;
  const { col, val, filter } = req.query;

  let targetCol = String(col || "id");
  let targetVal = String(val || "");

  if (filter && typeof filter === "string") {
    const match = filter.match(/^([^=]+)=eq\.(.+)$/);
    if (match) {
      targetCol = match[1];
      targetVal = decodeURIComponent(match[2]);
    }
  }

  const cfg = loadBackendConfig();

  if (cfg.isConfigured) {
    try {
      const remoteUrl = `${cfg.url}/rest/v1/${table}?${targetCol}=eq.${encodeURIComponent(targetVal)}`;
      const supabaseRes = await fetch(remoteUrl, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "apikey": cfg.key,
          "Authorization": `Bearer ${cfg.key}`
        }
      });

      if (supabaseRes.ok) {
        return res.json({ error: null });
      } else {
        const text = await supabaseRes.text();
        console.warn(`Supabase remote delete error [${table}]: ${supabaseRes.status} ${text}`);
      }
    } catch (err: any) {
      console.warn(`Supabase remote delete failed [${table}]:`, err?.message || err);
    }
  }

  // Delete from shared server database
  const db = getServerDb();
  const existing = db[table] || [];
  db[table] = existing.filter(r => String(r[targetCol]) !== targetVal);
  saveServerDb(db);

  res.json({ error: null });
});

// Secure Server-side AI Proxy supporting Gemini 3.6 Flash & Groq
app.post("/api/ai", async (req, res) => {
  const { prompt, context } = req.body;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
  const groqKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || "";

  const systemMsg = `You are INFIEV ERP AI — a state-of-the-art manufacturing intelligence assistant. 
Be concise, technical, and professional. Provide highly actionable, bulleted insights regarding production scheduling, inventory replenishment, equipment downtime, and labor productivity.
Always reference the actual enterprise data when provided to make your answers concrete.

Current Manufacturing Enterprise Context Data:
${context ? JSON.stringify(context, null, 2) : "No context data available."}`;

  // 1. Prefer Gemini API if GEMINI_API_KEY is available
  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `${systemMsg}\n\nUser Question: ${prompt}`,
      });

      const reply = response.text?.trim();
      if (reply) {
        return res.json({ text: reply });
      }
    } catch (err: any) {
      console.error("Gemini AI request error:", err?.message || err);
    }
  }

  // 2. Fallback to Groq API if GROQ_API_KEY is available
  if (groqKey) {
    try {
      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.7,
          max_tokens: 1024,
          messages: [
            { role: "system", content: systemMsg },
            { role: "user", content: prompt }
          ]
        })
      });

      if (groqRes.ok) {
        const data = await groqRes.json();
        const reply = data?.choices?.[0]?.message?.content?.trim();
        if (reply) {
          return res.json({ text: reply });
        }
      }
    } catch (err: any) {
      console.error("Groq AI request error:", err?.message || err);
    }
  }

  // 3. Fallback Contextual Intelligence Engine when external keys are not set
  const prodCount = context?.production?.length || 0;
  const invCount = context?.inventory?.length || 0;
  const taskCount = context?.tasks?.length || 0;

  const fallbackText = `🤖 INFIEV MANUFACTURING INTELLIGENCE REPORT

• Query Analysis: "${prompt}"
• Enterprise Snapshot: ${prodCount} Production Orders, ${invCount} Inventory SKUs, and ${taskCount} Active Tasks registered in the database.

📋 Strategic Recommendations:
1. Production Optimization: Priority orders currently in queue should be routed to active shifts with zero logged downtime to maximize OEE (Overall Equipment Effectiveness).
2. Inventory Control: Re-evaluate safety stock for fast-moving raw materials to avoid operational bottlenecks.
3. Quality & Maintenance: Conduct routine calibration on high-load machining stations to prevent unscheduled electricity or equipment downtime.
4. Labor Allocation: Re-assign available workforce from completed shop-floor tasks to pending orders with tight target delivery dates.`;

  return res.json({ text: fallbackText });
});

// ==================== VITE & STATIC SERVING ====================

async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 INFIEV ERP Full-Stack Server listening on http://0.0.0.0:${PORT}`);
  });
}

start();
