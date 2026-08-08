require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.get('/api/server/online', async (req, res) => {
    try {
        const response = await fetch('http://93.95.119.135:20519/players.json');

        if (!response.ok) {
            throw new Error('FiveM server offline');
        }

        const players = await response.json();

        res.json({
            online: Array.isArray(players) ? players.length : 0
        });
    } catch (error) {
        res.json({
            online: 0
        });
    }
});
app.disable("x-powered-by");
app.set("trust proxy", 1);

const PORT = Number(process.env.PORT || 37033);
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || "";
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "";
const GUILD_ID = process.env.DISCORD_GUILD_ID || "";
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || "";
const REVIEWER_ROLE_IDS = new Set(
  (process.env.REVIEWER_ROLE_IDS || "").split(",").map(s => s.trim()).filter(Boolean)
);

// Administracja może widzieć wszystkie podania.
// Możesz wkleić jedno ID w ADMIN_ROLE_ID albo kilka w ADMIN_ROLE_IDS.
const ADMIN_ROLE_IDS = new Set(
  [process.env.ADMIN_ROLE_ID || "", ...(process.env.ADMIN_ROLE_IDS || "").split(",")]
    .map(s => s.trim())
    .filter(Boolean)
);

// Prosta konfiguracja: w .env wklejasz tylko ID roli przy każdej frakcji.
// Dzięki temu nie musisz pamiętać żadnego formatu typu faction:role.
const ROLE_BY_FACTION = {
  lssd: process.env.ROLE_LSSD_ID || "",
  lspd: process.env.ROLE_LSPD_ID || "",
  ems: process.env.ROLE_EMS_ID || "",
  lsc: process.env.ROLE_LSC_ID || "",
  exotic: process.env.ROLE_EXOTIC_ID || "",
  doj: process.env.ROLE_DOJ_ID || "",
  crime: process.env.ROLE_CRIME_ID || "",
  ped: process.env.ROLE_PED_ID || ""
};


const FACTION_REVIEWER_ROLE_IDS = new Map(
  Object.entries(ROLE_BY_FACTION).filter(([, roleId]) => roleId).map(([faction, roleId]) => [faction, roleId])
);
const COOKIE_SECRET = process.env.COOKIE_SECRET || "";

const SITE_DIR = path.join(__dirname, "fuegorp.pl");
const DATA_DIR = path.join(__dirname, "data");
const APPLICATIONS_FILE = path.join(DATA_DIR, "applications.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const SHOP_DISCORD_URL = process.env.SHOP_DISCORD_URL || "https://discord.gg/Sideroleplay";

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(APPLICATIONS_FILE)) fs.writeFileSync(APPLICATIONS_FILE, "[]", "utf8");
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, "[]", "utf8");

app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: false }));

function requiredConfig() {
  const missing = [];
  if (!CLIENT_ID) missing.push("DISCORD_CLIENT_ID");
  if (!CLIENT_SECRET) missing.push("DISCORD_CLIENT_SECRET");
  if (!COOKIE_SECRET) missing.push("COOKIE_SECRET");
  return missing;
}

function sign(value) {
  return crypto.createHmac("sha256", COOKIE_SECRET).update(value).digest("base64url");
}

function makeSigned(value) {
  return `${value}.${sign(value)}`;
}

function verifySigned(value) {
  if (!value) return null;
  const i = value.lastIndexOf(".");
  if (i < 1) return null;
  const payload = value.slice(0, i);
  const sig = value.slice(i + 1);
  const expected = sign(payload);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return payload;
}

function setCookie(res, name, value, maxAge) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie",
    `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
  );
}

function clearCookie(res, name) {
  res.setHeader("Set-Cookie", `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function getCookie(req, name) {
  const raw = req.headers.cookie || "";
  const part = raw.split(";").map(x => x.trim()).find(x => x.startsWith(name + "="));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : null;
}

function getUser(req) {
  const signed = verifySigned(getCookie(req, "siderp_session"));
  if (!signed) return null;
  try {
    const user = JSON.parse(Buffer.from(signed, "base64url").toString("utf8"));
    if (!user.id) return null;
    return user;
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const user = getUser(req);
  if (!user) return res.status(401).json({ success: false, error: "Musisz zalogować się przez Discord." });
  req.user = user;
  next();
}

async function discordTokenExchange(code) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: `${BASE_URL}/auth/callback`
  });

  const r = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!r.ok) throw new Error(`Discord token exchange failed: ${r.status}`);
  return r.json();
}

async function discordUser(accessToken) {
  const r = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!r.ok) throw new Error(`Discord user request failed: ${r.status}`);
  return r.json();
}

async function discordMember(userId) {
  if (!GUILD_ID || !BOT_TOKEN) return null;
  try {
    const r = await fetch(
      `https://discord.com/api/v10/guilds/${encodeURIComponent(GUILD_ID)}/members/${encodeURIComponent(userId)}`,
      { headers: { Authorization: `Bot ${BOT_TOKEN}` } }
    );
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function accessForUser(userId) {
  const member = await discordMember(userId);
  const roles = member && Array.isArray(member.roles) ? member.roles : [];
  const isAdmin = roles.some(role => ADMIN_ROLE_IDS.has(role) || REVIEWER_ROLE_IDS.has(role));
  const factions = [];
  for (const [faction, roleId] of FACTION_REVIEWER_ROLE_IDS.entries()) {
    if (roles.includes(roleId)) factions.push(faction);
  }
  return { isAdmin, factions, roles };
}

async function reviewerStatus(userId) {
  const access = await accessForUser(userId);
  return access.isAdmin || access.factions.length > 0;
}

async function requireReviewer(req, res, next) {
  const user = getUser(req);
  if (!user) return res.status(401).json({ success: false, error: "Musisz zalogować się przez Discord." });
  const access = await accessForUser(user.id);
  if (!access.isAdmin && access.factions.length === 0) {
    return res.status(403).json({ success: false, error: "Nie masz uprawnień opiekuna frakcji." });
  }
  req.user = user;
  req.access = access;
  next();
}

function readApplications() {
  try {
    return JSON.parse(fs.readFileSync(APPLICATIONS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeApplications(apps) {
  const tmp = APPLICATIONS_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(apps, null, 2), "utf8");
  fs.renameSync(tmp, APPLICATIONS_FILE);
}

function readOrders() {
  try { return JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8")); } catch { return []; }
}
function writeOrders(orders) {
  const tmp = ORDERS_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(orders, null, 2), "utf8");
  fs.renameSync(tmp, ORDERS_FILE);
}
function makeOrderNumber(orders) {
  let number; do { number = `SR-${Math.floor(100000 + Math.random() * 900000)}`; } while (orders.some(o => o.number === number)); return number;
}

// OAuth2
app.get("/auth/login", (req, res) => {
  const missing = requiredConfig();
  if (missing.length) return res.status(500).send(`Brak konfiguracji serwera: ${missing.join(", ")}`);

  const state = crypto.randomBytes(32).toString("base64url");
  setCookie(res, "siderp_oauth_state", makeSigned(state), 600);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: `${BASE_URL}/auth/callback`,
    response_type: "code",
    scope: "identify",
    state
  });

  res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

app.get("/auth/callback", async (req, res) => {
  try {
    const stateCookie = verifySigned(getCookie(req, "siderp_oauth_state"));
    clearCookie(res, "siderp_oauth_state");

    if (!stateCookie || !req.query.state || !crypto.timingSafeEqual(
      Buffer.from(stateCookie), Buffer.from(String(req.query.state))
    )) {
      return res.status(400).send("Nieprawidłowy OAuth state.");
    }

    if (!req.query.code) return res.status(400).send("Brak kodu OAuth.");

    const token = await discordTokenExchange(String(req.query.code));
    const dUser = await discordUser(token.access_token);

    const user = {
      id: dUser.id,
      username: dUser.username,
      globalName: dUser.global_name || dUser.username,
      avatar: dUser.avatar
        ? `https://cdn.discordapp.com/avatars/${dUser.id}/${dUser.avatar}.png?size=128`
        : `https://cdn.discordapp.com/embed/avatars/${Number(dUser.discriminator || 0) % 5}.png`
    };

    setCookie(
      res,
      "siderp_session",
      makeSigned(Buffer.from(JSON.stringify(user)).toString("base64url")),
      60 * 60 * 24 * 7
    );

    res.redirect("/podania.html");
  } catch (err) {
    console.error(err);
    res.status(500).send("Logowanie przez Discord nie powiodło się.");
  }
});

app.get("/auth/logout", (req, res) => {
  clearCookie(res, "siderp_session");
  res.redirect("/");
});

// Auth API
app.get("/api/me", async (req, res) => {
  const user = getUser(req);
  if (!user) return res.json({ loggedIn: false });

  const access = await accessForUser(user.id);
  res.json({
    loggedIn: true,
    user,
    isReviewer: access.isAdmin || access.factions.length > 0,
    isAdmin: access.isAdmin,
    reviewerFactions: access.factions
  });
});

// Static factions — no external factions API/database needed.
const FACTIONS = {
  lssd: { name: "Los Santos Sheriff Department", icon: "fa-solid fa-star" },
  lspd: { name: "Los Santos Police Department", icon: "fa-solid fa-handcuffs" },
  ems: { name: "Emergency Medical Services", icon: "fa-solid fa-truck-medical" },
  lsc: { name: "Los Santos Customs", icon: "fa-solid fa-wrench" },
  exotic: { name: "Exotic Customs", icon: "fa-solid fa-screwdriver-wrench" },
  doj: { name: "Department of Justice", icon: "fa-solid fa-building-columns" },
  crime: { name: "Organizacja Przestępcza", icon: "fa-solid fa-crown" },
  opiekun: { name: "Opiekun Crime", icon: "fa-solid fa-user-secret" },
  administracja: { name: "Administracja", icon: "fa-solid fa-user-shield" },
  ped: { name: "Ped", icon: "fa-solid fa-user" }
};

app.get("/api/factions", (req, res) => {
  res.json(FACTIONS);
});

// Application API
app.get("/api/my-applications", requireAuth, (req, res) => {
  const apps = readApplications()
    .filter(a => a.discordId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(apps);
});

app.post("/api/applications", requireAuth, (req, res) => {
  const { faction, ...answers } = req.body || {};
  if (!faction || typeof faction !== "string") {
    return res.status(400).json({ success: false, error: "Nie wybrano frakcji." });
  }

  const apps = readApplications();
  const application = {
    id: crypto.randomUUID(),
    discordId: req.user.id,
    username: req.user.globalName || req.user.username,
    faction,
    answers,
    status: "pending",
    createdAt: new Date().toISOString()
  };

  apps.push(application);
  writeApplications(apps);
  res.json({ success: true, application: { id: application.id, status: application.status } });
});

// Shop orders — manualne płatności przez Discord.
app.get("/api/my-orders", requireAuth, (req, res) => {
  const orders = readOrders().filter(o => o.discordId === req.user.id).sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
  res.json({ success:true, orders, shopDiscordUrl: SHOP_DISCORD_URL });
});

// Publiczny feed ostatnich opłaconych/zrealizowanych zakupów.
// Nie zwracamy Discord ID ani innych prywatnych danych.
app.get("/api/shop/recent", (req, res) => {
  const orders = readOrders()
    .filter(o => o.status === "paid" || o.status === "fulfilled")
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6)
    .map(o => ({
      id: o.id,
      username: o.username || "Gracz",
      product: o.product || "Zakup",
      createdAt: o.createdAt,
      status: o.status
    }));

  res.json({ success: true, orders });
});

app.get("/api/server-status", async (req, res) => {
  const base = String(process.env.FIVEM_SERVER_URL || "").replace(/\/$/, "");
  if (!base) return res.json({ online: false, players: 0 });

  try {
    const response = await fetch(`${base}/players.json`, {
      signal: AbortSignal.timeout(2500),
      headers: { "User-Agent": "SideRP-Shop/1.0" }
    });
    if (!response.ok) return res.json({ online: false, players: 0 });
    const players = await response.json();
    res.json({ online: true, players: Array.isArray(players) ? players.length : 0 });
  } catch {
    res.json({ online: false, players: 0 });
  }
});

app.post("/api/orders", requireAuth, (req, res) => {
  const product = String(req.body?.product || "").trim().slice(0,160);
  const price = String(req.body?.price || "").trim().slice(0,40);
  if (!product || !price) return res.status(400).json({success:false,error:"Brak produktu lub ceny."});
  const orders = readOrders();
  const order = { id:crypto.randomUUID(), number:makeOrderNumber(orders), discordId:req.user.id, username:req.user.globalName || req.user.username, product, price, status:"awaiting_payment", createdAt:new Date().toISOString(), paidAt:null, fulfilledAt:null, reviewedBy:null, note:"" };
  orders.push(order); writeOrders(orders);
  res.json({success:true, order, shopDiscordUrl:SHOP_DISCORD_URL});
});

app.get("/api/reviewer/orders", requireReviewer, (req,res) => {
  if (!req.access.isAdmin) return res.status(403).json({success:false,error:"Tylko administrator może zarządzać zamówieniami sklepu."});
  res.json({success:true,orders:readOrders().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))});
});

app.patch("/api/reviewer/orders/:id", requireReviewer, (req,res) => {
  if (!req.access.isAdmin) return res.status(403).json({success:false,error:"Tylko administrator może zarządzać zamówieniami sklepu."});
  const orders=readOrders(); const order=orders.find(o=>o.id===req.params.id);
  if(!order) return res.status(404).json({success:false,error:"Nie znaleziono zamówienia."});
  const status=String(req.body?.status||"").toLowerCase();
  if(!["awaiting_payment","paid","fulfilled","rejected"].includes(status)) return res.status(400).json({success:false,error:"Nieprawidłowy status zamówienia."});
  order.status=status; order.note=typeof req.body?.note==="string"?req.body.note.slice(0,1000):order.note||"";
  order.reviewedBy={id:req.user.id,username:req.user.globalName||req.user.username};
  if(status==="paid"&&!order.paidAt) order.paidAt=new Date().toISOString();
  if(status==="fulfilled"&&!order.fulfilledAt) order.fulfilledAt=new Date().toISOString();
  writeOrders(orders); res.json({success:true,order});
});

// Faction reviewer / management API.
app.get("/api/reviewer/applications", requireReviewer, (req, res) => {
  let apps = readApplications();

  if (!req.access.isAdmin) {
    apps = apps.filter(a => req.access.factions.includes(a.faction));
  }

  apps.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({
    success: true,
    applications: apps,
    access: {
      isAdmin: req.access.isAdmin,
      factions: req.access.factions
    }
  });
});

app.patch("/api/reviewer/applications/:id", requireReviewer, (req, res) => {
  const apps = readApplications();
  const application = apps.find(a => a.id === req.params.id);
  if (!application) return res.status(404).json({ success: false, error: "Nie znaleziono podania." });

  const canReview = req.access.isAdmin || req.access.factions.includes(application.faction);
  if (!canReview) return res.status(403).json({ success: false, error: "Nie masz dostępu do tej frakcji." });

  const status = String(req.body?.status || "").toLowerCase();
  if (!['pending', 'accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, error: "Nieprawidłowy status." });
  }

  application.status = status;
  application.reviewedAt = new Date().toISOString();
  application.reviewedBy = {
    id: req.user.id,
    username: req.user.globalName || req.user.username
  };
  application.reviewNote = typeof req.body?.note === "string" ? req.body.note.slice(0, 2000) : "";

  writeApplications(apps);
  res.json({ success: true, application });
});

// Profil gracza działa lokalnie — bez połączenia z FiveM/ESX.
app.get("/api/player/data", requireAuth, (req, res) => {
  const apps = readApplications()
    .filter(a => a.discordId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({
    success: true,
    user: req.user,
    stats: {
      total: apps.length,
      accepted: apps.filter(a => a.status === "accepted").length,
      pending: apps.filter(a => a.status === "pending").length,
      rejected: apps.filter(a => a.status === "rejected").length
    },
    latestApplication: apps[0] || null
  });
});

// Diagnostics for the local setup (does not expose secrets).
app.get("/api/setup-status", async (req, res) => {
  const user = getUser(req);
  const config = {
    oauthConfigured: Boolean(CLIENT_ID && CLIENT_SECRET && COOKIE_SECRET && CLIENT_SECRET !== "NOWY_CLIENT_SECRET"),
    guildConfigured: Boolean(GUILD_ID),
    botConfigured: Boolean(BOT_TOKEN && BOT_TOKEN !== "NOWY_TOKEN_BOTA"),
    baseUrl: BASE_URL,
    guildId: GUILD_ID || null
  };
  let access = null;
  if (user) access = await accessForUser(user.id);
  res.json({ success: true, config, loggedIn: Boolean(user), access: access ? { isAdmin: access.isAdmin, factions: access.factions } : null });
});

// Static website
app.use(express.static(SITE_DIR, {
  extensions: ["html"],
  index: "index.html"
}));

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/auth/")) {
    return res.status(404).json({ error: "Not found" });
  }
  res.sendFile(path.join(SITE_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`SideRP running at ${BASE_URL}`);
  if (!CLIENT_ID || !CLIENT_SECRET || !COOKIE_SECRET) {
    console.warn("Uzupełnij .env przed użyciem logowania Discord.");
  }
  if (CLIENT_SECRET === "NOWY_CLIENT_SECRET" || BOT_TOKEN === "NOWY_TOKEN_BOTA") {
    console.warn("Uwaga: w .env są jeszcze przykładowe wartości sekretów Discord.");
  }
});
