require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");

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
  (process.env.REVIEWER_ROLE_IDS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
);

// Administracja może widzieć wszystkie podania.
const ADMIN_ROLE_IDS = new Set(
  [
    process.env.ADMIN_ROLE_ID || "",
    ...(process.env.ADMIN_ROLE_IDS || "").split(",")
  ]
    .map(s => s.trim())
    .filter(Boolean)
);

// ID ról opiekunów poszczególnych frakcji.
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
  Object.entries(ROLE_BY_FACTION)
    .filter(([, roleId]) => roleId)
    .map(([faction, roleId]) => [faction, roleId])
);

const COOKIE_SECRET = process.env.COOKIE_SECRET || "";

const SITE_DIR = __dirname;
const DATA_DIR = path.join(__dirname, "data");
const APPLICATIONS_FILE = path.join(DATA_DIR, "applications.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const SHOP_DISCORD_URL =
  process.env.SHOP_DISCORD_URL || "https://discord.gg/Sideroleplay";

fs.mkdirSync(DATA_DIR, { recursive: true });

if (!fs.existsSync(APPLICATIONS_FILE)) {
  fs.writeFileSync(APPLICATIONS_FILE, "[]", "utf8");
}

if (!fs.existsSync(ORDERS_FILE)) {
  fs.writeFileSync(ORDERS_FILE, "[]", "utf8");
}

app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: false }));

// =====================================================
// POSTGRESQL
// =====================================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false
});

async function initDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Brak DATABASE_URL w zmiennych środowiskowych.");
  }

  // =====================================================
  // ZAMÓWIENIA SKLEPU
  // =====================================================

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      number TEXT UNIQUE NOT NULL,
      discord_id TEXT NOT NULL,
      username TEXT,
      product TEXT NOT NULL,
      price TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'awaiting_payment',
      created_at TIMESTAMPTZ NOT NULL,
      paid_at TIMESTAMPTZ,
      fulfilled_at TIMESTAMPTZ,
      reviewed_by JSONB,
      note TEXT DEFAULT ''
    )
  `);

  // Jednorazowa migracja starych zamówień z orders.json.
  const countResult = await pool.query(
    "SELECT COUNT(*)::int AS count FROM orders"
  );

  if (
    countResult.rows[0].count === 0 &&
    fs.existsSync(ORDERS_FILE)
  ) {
    let oldOrders = [];

    try {
      oldOrders = JSON.parse(
        fs.readFileSync(ORDERS_FILE, "utf8")
      );
    } catch {
      oldOrders = [];
    }

    for (const order of oldOrders) {
      await pool.query(
        `
        INSERT INTO orders (
          id,
          number,
          discord_id,
          username,
          product,
          price,
          status,
          created_at,
          paid_at,
          fulfilled_at,
          reviewed_by,
          note
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (id) DO NOTHING
        `,
        [
          order.id,
          order.number,
          order.discordId,
          order.username || "",
          order.product,
          order.price,
          order.status || "awaiting_payment",
          order.createdAt,
          order.paidAt || null,
          order.fulfilledAt || null,
          order.reviewedBy
            ? JSON.stringify(order.reviewedBy)
            : null,
          order.note || ""
        ]
      );
    }

    if (oldOrders.length > 0) {
      console.log(
        `✅ Przeniesiono ${oldOrders.length} zamówień z orders.json do PostgreSQL.`
      );
    }
  }

  // =====================================================
  // PODANIA
  // =====================================================

  await pool.query(`
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      discord_id TEXT NOT NULL,
      username TEXT,
      faction TEXT NOT NULL,
      answers JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL,
      reviewed_at TIMESTAMPTZ,
      reviewed_by JSONB,
      review_note TEXT DEFAULT ''
    )
  `);

  // Jednorazowa migracja starych podań z applications.json.
  const applicationsCountResult = await pool.query(
    "SELECT COUNT(*)::int AS count FROM applications"
  );

  if (
    applicationsCountResult.rows[0].count === 0 &&
    fs.existsSync(APPLICATIONS_FILE)
  ) {
    let oldApplications = [];

    try {
      oldApplications = JSON.parse(
        fs.readFileSync(APPLICATIONS_FILE, "utf8")
      );
    } catch {
      oldApplications = [];
    }

    if (Array.isArray(oldApplications)) {
      for (const application of oldApplications) {
        if (
          !application ||
          !application.id ||
          !application.discordId ||
          !application.faction
        ) {
          continue;
        }

        await pool.query(
          `
          INSERT INTO applications (
            id,
            discord_id,
            username,
            faction,
            answers,
            status,
            created_at,
            reviewed_at,
            reviewed_by,
            review_note
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          ON CONFLICT (id) DO NOTHING
          `,
          [
            application.id,
            application.discordId,
            application.username || "",
            application.faction,
            JSON.stringify(application.answers || {}),
            application.status || "pending",
            application.createdAt || new Date().toISOString(),
            application.reviewedAt || null,
            application.reviewedBy
              ? JSON.stringify(application.reviewedBy)
              : null,
            application.reviewNote || ""
          ]
        );
      }

      if (oldApplications.length > 0) {
        console.log(
          `✅ Przeniesiono ${oldApplications.length} starych podań z applications.json do PostgreSQL.`
        );
      }
    }
  }

  console.log("✅ PostgreSQL gotowy.");
}

// =====================================================
// ORDERS FUNCTIONS
// =====================================================

function dbOrder(row) {
  return {
    id: row.id,
    number: row.number,
    discordId: row.discord_id,
    username: row.username,
    product: row.product,
    price: row.price,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    paidAt: row.paid_at
      ? new Date(row.paid_at).toISOString()
      : null,
    fulfilledAt: row.fulfilled_at
      ? new Date(row.fulfilled_at).toISOString()
      : null,
    reviewedBy: row.reviewed_by || null,
    note: row.note || ""
  };
}

async function getAllOrders() {
  const result = await pool.query(`
    SELECT *
    FROM orders
    ORDER BY created_at DESC
  `);

  return result.rows.map(dbOrder);
}

async function getOrdersForUser(discordId) {
  const result = await pool.query(
    `
    SELECT *
    FROM orders
    WHERE discord_id = $1
    ORDER BY created_at DESC
    `,
    [discordId]
  );

  return result.rows.map(dbOrder);
}

async function getOrderByNumber(number) {
  const result = await pool.query(
    `
    SELECT *
    FROM orders
    WHERE UPPER(number) = UPPER($1)
    LIMIT 1
    `,
    [number]
  );

  return result.rows[0]
    ? dbOrder(result.rows[0])
    : null;
}

async function getOrderById(id) {
  const result = await pool.query(
    `
    SELECT *
    FROM orders
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return result.rows[0]
    ? dbOrder(result.rows[0])
    : null;
}

async function createOrder(order) {
  const result = await pool.query(
    `
    INSERT INTO orders (
      id,
      number,
      discord_id,
      username,
      product,
      price,
      status,
      created_at,
      paid_at,
      fulfilled_at,
      reviewed_by,
      note
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    RETURNING *
    `,
    [
      order.id,
      order.number,
      order.discordId,
      order.username,
      order.product,
      order.price,
      order.status,
      order.createdAt,
      order.paidAt,
      order.fulfilledAt,
      order.reviewedBy
        ? JSON.stringify(order.reviewedBy)
        : null,
      order.note || ""
    ]
  );

  return dbOrder(result.rows[0]);
}

async function updateOrder(order) {
  const result = await pool.query(
    `
    UPDATE orders
    SET
      status = $2,
      paid_at = $3,
      fulfilled_at = $4,
      reviewed_by = $5,
      note = $6
    WHERE id = $1
    RETURNING *
    `,
    [
      order.id,
      order.status,
      order.paidAt || null,
      order.fulfilledAt || null,
      order.reviewedBy
        ? JSON.stringify(order.reviewedBy)
        : null,
      order.note || ""
    ]
  );

  return result.rows[0]
    ? dbOrder(result.rows[0])
    : null;
}

// =====================================================
// APPLICATION FUNCTIONS — POSTGRESQL
// =====================================================

function dbApplication(row) {
  return {
    id: row.id,
    discordId: row.discord_id,
    username: row.username,
    faction: row.faction,
    answers: row.answers || {},
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    reviewedAt: row.reviewed_at
      ? new Date(row.reviewed_at).toISOString()
      : null,
    reviewedBy: row.reviewed_by || null,
    reviewNote: row.review_note || ""
  };
}

async function getAllApplications() {
  const result = await pool.query(`
    SELECT *
    FROM applications
    ORDER BY created_at DESC
  `);

  return result.rows.map(dbApplication);
}

async function getApplicationsForUser(discordId) {
  const result = await pool.query(
    `
    SELECT *
    FROM applications
    WHERE discord_id = $1
    ORDER BY created_at DESC
    `,
    [discordId]
  );

  return result.rows.map(dbApplication);
}

async function getApplicationById(id) {
  const result = await pool.query(
    `
    SELECT *
    FROM applications
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return result.rows[0]
    ? dbApplication(result.rows[0])
    : null;
}

async function createApplication(application) {
  const result = await pool.query(
    `
    INSERT INTO applications (
      id,
      discord_id,
      username,
      faction,
      answers,
      status,
      created_at,
      reviewed_at,
      reviewed_by,
      review_note
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING *
    `,
    [
      application.id,
      application.discordId,
      application.username,
      application.faction,
      JSON.stringify(application.answers || {}),
      application.status || "pending",
      application.createdAt,
      application.reviewedAt || null,
      application.reviewedBy
        ? JSON.stringify(application.reviewedBy)
        : null,
      application.reviewNote || ""
    ]
  );

  return dbApplication(result.rows[0]);
}

async function updateApplication(application) {
  const result = await pool.query(
    `
    UPDATE applications
    SET
      status = $2,
      reviewed_at = $3,
      reviewed_by = $4,
      review_note = $5
    WHERE id = $1
    RETURNING *
    `,
    [
      application.id,
      application.status,
      application.reviewedAt || null,
      application.reviewedBy
        ? JSON.stringify(application.reviewedBy)
        : null,
      application.reviewNote || ""
    ]
  );

  return result.rows[0]
    ? dbApplication(result.rows[0])
    : null;
}

// =====================================================
// HELPERS
// =====================================================

function makeOrderNumber() {
  return `SR-${Math.floor(100000 + Math.random() * 900000)}`;
}

function requiredConfig() {
  const missing = [];

  if (!CLIENT_ID) missing.push("DISCORD_CLIENT_ID");
  if (!CLIENT_SECRET) missing.push("DISCORD_CLIENT_SECRET");
  if (!COOKIE_SECRET) missing.push("COOKIE_SECRET");

  return missing;
}

function sign(value) {
  return crypto
    .createHmac("sha256", COOKIE_SECRET)
    .update(value)
    .digest("base64url");
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

  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(
      Buffer.from(sig),
      Buffer.from(expected)
    )
  ) {
    return null;
  }

  return payload;
}

function setCookie(res, name, value, maxAge) {
  const secure =
    process.env.NODE_ENV === "production"
      ? "; Secure"
      : "";

  res.setHeader(
    "Set-Cookie",
    `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
  );
}

function clearCookie(res, name) {
  res.setHeader(
    "Set-Cookie",
    `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

function getCookie(req, name) {
  const raw = req.headers.cookie || "";

  const part = raw
    .split(";")
    .map(x => x.trim())
    .find(x => x.startsWith(name + "="));

  return part
    ? decodeURIComponent(part.slice(name.length + 1))
    : null;
}

function getUser(req) {
  const signed = verifySigned(
    getCookie(req, "siderp_session")
  );

  if (!signed) return null;

  try {
    const user = JSON.parse(
      Buffer.from(signed, "base64url").toString("utf8")
    );

    if (!user.id) return null;

    return user;
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const user = getUser(req);

  if (!user) {
    return res.status(401).json({
      success: false,
      error: "Musisz zalogować się przez Discord."
    });
  }

  req.user = user;
  next();
}

// =====================================================
// DISCORD
// =====================================================

const usedOAuthCodes = new Set();

async function discordTokenExchange(code) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: `${BASE_URL}/auth/callback`
  });

  const r = await fetch(
    "https://discord.com/api/v10/oauth2/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded"
      },
      body
    }
  );

  if (r.status === 429) {
    const retryAfter = r.headers.get("retry-after");

    console.error(
      `Discord token exchange rate-limited. Retry-After: ${retryAfter}`
    );
  }

  if (!r.ok) {
    throw new Error(
      `Discord token exchange failed: ${r.status}`
    );
  }

  return r.json();
}

async function discordUser(accessToken) {
  const r = await fetch(
    "https://discord.com/api/v10/users/@me",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!r.ok) {
    throw new Error(
      `Discord user request failed: ${r.status}`
    );
  }

  return r.json();
}

async function discordMember(userId) {
  if (!GUILD_ID || !BOT_TOKEN) return null;

  try {
    const r = await fetch(
      `https://discord.com/api/v10/guilds/${encodeURIComponent(
        GUILD_ID
      )}/members/${encodeURIComponent(userId)}`,
      {
        headers: {
          Authorization: `Bot ${BOT_TOKEN}`
        }
      }
    );

    if (!r.ok) return null;

    return await r.json();
  } catch {
    return null;
  }
}

async function accessForUser(userId) {
  const member = await discordMember(userId);

  const roles =
    member && Array.isArray(member.roles)
      ? member.roles
      : [];

  const isAdmin = roles.some(
    role =>
      ADMIN_ROLE_IDS.has(role) ||
      REVIEWER_ROLE_IDS.has(role)
  );

  const factions = [];

  for (const [
    faction,
    roleId
  ] of FACTION_REVIEWER_ROLE_IDS.entries()) {
    if (roles.includes(roleId)) {
      factions.push(faction);
    }
  }

  return {
    isAdmin,
    factions,
    roles
  };
}

async function reviewerStatus(userId) {
  const access = await accessForUser(userId);

  return (
    access.isAdmin ||
    access.factions.length > 0
  );
}

async function requireReviewer(req, res, next) {
  const user = getUser(req);

  if (!user) {
    return res.status(401).json({
      success: false,
      error: "Musisz zalogować się przez Discord."
    });
  }

  const access = await accessForUser(user.id);

  if (
    !access.isAdmin &&
    access.factions.length === 0
  ) {
    return res.status(403).json({
      success: false,
      error: "Nie masz uprawnień opiekuna frakcji."
    });
  }

  req.user = user;
  req.access = access;

  next();
}

// =====================================================
// OAUTH2
// =====================================================

app.get("/auth/login", (req, res) => {
  const missing = requiredConfig();

  if (missing.length) {
    return res
      .status(500)
      .send(
        `Brak konfiguracji serwera: ${missing.join(", ")}`
      );
  }

  const state =
    crypto.randomBytes(32).toString("base64url");

  setCookie(
    res,
    "siderp_oauth_state",
    makeSigned(state),
    600
  );

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: `${BASE_URL}/auth/callback`,
    response_type: "code",
    scope: "identify",
    state
  });

  res.redirect(
    `https://discord.com/oauth2/authorize?${params.toString()}`
  );
});

app.get("/auth/callback", async (req, res) => {
  try {
    const stateCookie = verifySigned(
      getCookie(req, "siderp_oauth_state")
    );

    clearCookie(res, "siderp_oauth_state");

    if (
      !stateCookie ||
      !req.query.state ||
      !crypto.timingSafeEqual(
        Buffer.from(stateCookie),
        Buffer.from(String(req.query.state))
      )
    ) {
      return res
        .status(400)
        .send("Nieprawidłowy OAuth state.");
    }

    if (!req.query.code) {
      return res
        .status(400)
        .send("Brak kodu OAuth.");
    }

    const code = String(req.query.code);

    if (usedOAuthCodes.has(code)) {
      return res
        .status(400)
        .send(
          "Ten kod logowania został już użyty."
        );
    }

    usedOAuthCodes.add(code);

    setTimeout(
      () => usedOAuthCodes.delete(code),
      5 * 60 * 1000
    );

    const token =
      await discordTokenExchange(code);

    const dUser =
      await discordUser(token.access_token);

    const user = {
      id: dUser.id,
      username: dUser.username,
      globalName:
        dUser.global_name ||
        dUser.username,
      avatar: dUser.avatar
        ? `https://cdn.discordapp.com/avatars/${dUser.id}/${dUser.avatar}.png?size=128`
        : `https://cdn.discordapp.com/embed/avatars/${Number(
            dUser.discriminator || 0
          ) % 5}.png`
    };

    setCookie(
      res,
      "siderp_session",
      makeSigned(
        Buffer.from(
          JSON.stringify(user)
        ).toString("base64url")
      ),
      60 * 60 * 24 * 7
    );

    res.redirect("/podania.html");
  } catch (err) {
    console.error(err);

    res
      .status(500)
      .send(
        "Logowanie przez Discord nie powiodło się."
      );
  }
});

app.get("/auth/logout", (req, res) => {
  clearCookie(res, "siderp_session");
  res.redirect("/");
});

// =====================================================
// AUTH API
// =====================================================

app.get("/api/me", async (req, res) => {
  const user = getUser(req);

  if (!user) {
    return res.json({
      loggedIn: false
    });
  }

  const access =
    await accessForUser(user.id);

  res.json({
    loggedIn: true,
    user,
    isReviewer:
      access.isAdmin ||
      access.factions.length > 0,
    isAdmin: access.isAdmin,
    reviewerFactions: access.factions
  });
});

// =====================================================
// FACTIONS
// =====================================================

const FACTIONS = {
  lssd: {
    name: "Los Santos Sheriff Department",
    icon: "fa-solid fa-star"
  },

  lspd: {
    name: "Los Santos Police Department",
    icon: "fa-solid fa-handcuffs"
  },

  ems: {
    name: "Emergency Medical Services",
    icon: "fa-solid fa-truck-medical"
  },

  lsc: {
    name: "Los Santos Customs",
    icon: "fa-solid fa-wrench"
  },

  exotic: {
    name: "Exotic Customs",
    icon: "fa-solid fa-screwdriver-wrench"
  },

  doj: {
    name: "Department of Justice",
    icon: "fa-solid fa-building-columns"
  },

  crime: {
    name: "Organizacja Przestępcza",
    icon: "fa-solid fa-crown"
  },

  opiekun: {
    name: "Opiekun Crime",
    icon: "fa-solid fa-user-secret"
  },

  administracja: {
    name: "Administracja",
    icon: "fa-solid fa-user-shield"
  },

  ped: {
    name: "Ped",
    icon: "fa-solid fa-user"
  }
};

app.get("/api/factions", (req, res) => {
  res.json(FACTIONS);
});

// =====================================================
// APPLICATION API
// =====================================================

app.get(
  "/api/my-applications",
  requireAuth,
  async (req, res) => {
    try {
      const apps =
        await getApplicationsForUser(
          req.user.id
        );

      res.json(apps);
    } catch (err) {
      console.error(
        "MY APPLICATIONS:",
        err
      );

      res.status(500).json({
        success: false,
        error:
          "Nie udało się pobrać podań."
      });
    }
  }
);

app.post(
  "/api/applications",
  requireAuth,
  async (req, res) => {
    try {
      const {
        faction,
        ...answers
      } = req.body || {};

      if (
        !faction ||
        typeof faction !== "string"
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Nie wybrano frakcji."
        });
      }

      const application = {
        id: crypto.randomUUID(),
        discordId: req.user.id,
        username:
          req.user.globalName ||
          req.user.username,
        faction,
        answers,
        status: "pending",
        createdAt:
          new Date().toISOString(),
        reviewedAt: null,
        reviewedBy: null,
        reviewNote: ""
      };

      const savedApplication =
        await createApplication(
          application
        );

      res.json({
        success: true,
        application: {
          id: savedApplication.id,
          status:
            savedApplication.status
        }
      });
    } catch (err) {
      console.error(
        "CREATE APPLICATION:",
        err
      );

      res.status(500).json({
        success: false,
        error:
          "Nie udało się wysłać podania."
      });
    }
  }
);

// =====================================================
// SHOP ORDERS
// =====================================================

app.get(
  "/api/my-orders",
  requireAuth,
  async (req, res) => {
    try {
      const orders =
        await getOrdersForUser(
          req.user.id
        );

      res.json({
        success: true,
        orders,
        shopDiscordUrl:
          SHOP_DISCORD_URL
      });
    } catch (err) {
      console.error(
        "MY ORDERS:",
        err
      );

      res.status(500).json({
        success: false,
        error:
          "Nie udało się pobrać zamówień."
      });
    }
  }
);

// Publiczny feed ostatnich opłaconych/zrealizowanych zakupów.
app.get(
  "/api/shop/recent",
  async (req, res) => {
    try {
      const orders =
        (await getAllOrders())
          .filter(
            o =>
              o.status === "paid" ||
              o.status === "fulfilled"
          )
          .slice(0, 6)
          .map(o => ({
            id: o.id,
            username:
              o.username || "Gracz",
            product:
              o.product || "Zakup",
            createdAt: o.createdAt,
            status: o.status
          }));

      res.json({
        success: true,
        orders
      });
    } catch (err) {
      console.error(
        "SHOP RECENT:",
        err
      );

      res.status(500).json({
        success: false,
        error:
          "Nie udało się pobrać ostatnich zakupów."
      });
    }
  }
);

// =====================================================
// SERVER STATUS
// =====================================================

app.get(
  "/api/server-status",
  async (req, res) => {
    const base = String(
      process.env.FIVEM_SERVER_URL || ""
    ).replace(/\/$/, "");

    if (!base) {
      return res.json({
        online: false,
        players: 0
      });
    }

    try {
      const response =
        await fetch(
          `${base}/players.json`,
          {
            signal:
              AbortSignal.timeout(2500),
            headers: {
              "User-Agent":
                "SideRP-Shop/1.0"
            }
          }
        );

      if (!response.ok) {
        return res.json({
          online: false,
          players: 0
        });
      }

      const players =
        await response.json();

      res.json({
        online: true,
        players:
          Array.isArray(players)
            ? players.length
            : 0
      });
    } catch {
      res.json({
        online: false,
        players: 0
      });
    }
  }
);

// =====================================================
// CREATE ORDER
// =====================================================

app.post(
  "/api/orders",
  requireAuth,
  async (req, res) => {
    try {
      const product = String(
        req.body?.product || ""
      )
        .trim()
        .slice(0, 160);

      const price = String(
        req.body?.price || ""
      )
        .trim()
        .slice(0, 40);

      if (!product || !price) {
        return res.status(400).json({
          success: false,
          error:
            "Brak produktu lub ceny."
        });
      }

      let number;

      while (true) {
        number = makeOrderNumber();

        const existing =
          await getOrderByNumber(
            number
          );

        if (!existing) break;
      }

      const order = {
        id: crypto.randomUUID(),
        number,
        discordId: req.user.id,
        username:
          req.user.globalName ||
          req.user.username,
        product,
        price,
        status:
          "awaiting_payment",
        createdAt:
          new Date().toISOString(),
        paidAt: null,
        fulfilledAt: null,
        reviewedBy: null,
        note: ""
      };

      const savedOrder =
        await createOrder(order);

      res.json({
        success: true,
        order: savedOrder,
        shopDiscordUrl:
          SHOP_DISCORD_URL
      });
    } catch (err) {
      console.error(
        "CREATE ORDER:",
        err
      );

      res.status(500).json({
        success: false,
        error:
          "Nie udało się utworzyć zamówienia."
      });
    }
  }
);

// =====================================================
// REVIEWER ORDERS
// =====================================================

app.get(
  "/api/reviewer/orders",
  requireReviewer,
  async (req, res) => {
    if (!req.access.isAdmin) {
      return res.status(403).json({
        success: false,
        error:
          "Tylko administrator może zarządzać zamówieniami sklepu."
      });
    }

    try {
      res.json({
        success: true,
        orders:
          await getAllOrders()
      });
    } catch (err) {
      console.error(
        "REVIEWER ORDERS:",
        err
      );

      res.status(500).json({
        success: false,
        error:
          "Nie udało się pobrać zamówień."
      });
    }
  }
);

app.patch(
  "/api/reviewer/orders/:id",
  requireReviewer,
  async (req, res) => {
    if (!req.access.isAdmin) {
      return res.status(403).json({
        success: false,
        error:
          "Tylko administrator może zarządzać zamówieniami sklepu."
      });
    }

    try {
      const order =
        await getOrderById(
          req.params.id
        );

      if (!order) {
        return res.status(404).json({
          success: false,
          error:
            "Nie znaleziono zamówienia."
        });
      }

      const status = String(
        req.body?.status || ""
      ).toLowerCase();

      if (
        ![
          "awaiting_payment",
          "paid",
          "fulfilled",
          "rejected"
        ].includes(status)
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Nieprawidłowy status zamówienia."
        });
      }

      order.status = status;

      order.note =
        typeof req.body?.note ===
        "string"
          ? req.body.note.slice(
              0,
              1000
            )
          : order.note || "";

      order.reviewedBy = {
        id: req.user.id,
        username:
          req.user.globalName ||
          req.user.username
      };

      if (
        status === "paid" &&
        !order.paidAt
      ) {
        order.paidAt =
          new Date().toISOString();
      }

      if (
        status === "fulfilled" &&
        !order.fulfilledAt
      ) {
        order.fulfilledAt =
          new Date().toISOString();
      }

      const savedOrder =
        await updateOrder(order);

      res.json({
        success: true,
        order: savedOrder
      });
    } catch (err) {
      console.error(
        "UPDATE ORDER:",
        err
      );

      res.status(500).json({
        success: false,
        error:
          "Nie udało się zaktualizować zamówienia."
      });
    }
  }
);

app.delete(
  "/api/reviewer/orders/:id",
  requireReviewer,
  async (req, res) => {
    if (!req.access.isAdmin) {
      return res.status(403).json({
        success: false,
        error:
          "Tylko administrator może usuwać zamówienia."
      });
    }

    try {
      const order =
        await getOrderById(
          req.params.id
        );

      if (!order) {
        return res.status(404).json({
          success: false,
          error:
            "Nie znaleziono zamówienia."
        });
      }

      await pool.query(
        "DELETE FROM orders WHERE id = $1",
        [req.params.id]
      );

      res.json({
        success: true,
        deletedId:
          req.params.id
      });
    } catch (err) {
      console.error(
        "DELETE ORDER:",
        err
      );

      res.status(500).json({
        success: false,
        error:
          "Nie udało się usunąć zamówienia."
      });
    }
  }
);

// =====================================================
// DISCORD BOT - SHOP ORDER API
// =====================================================

app.get(
  "/api/bot/orders/:number",
  async (req, res) => {
    const configuredSecret =
      String(
        process.env.SIDERP_API_SECRET ||
          ""
      );

    const auth =
      String(
        req.headers.authorization ||
          ""
      );

    const suppliedSecret =
      auth.startsWith("Bearer ")
        ? auth.slice(7)
        : "";

    if (!configuredSecret) {
      return res.status(500).json({
        success: false,
        error:
          "Brak SIDERP_API_SECRET na stronie."
      });
    }

    if (
      suppliedSecret !==
      configuredSecret
    ) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized"
      });
    }

    const number = String(
      req.params.number || ""
    )
      .trim()
      .toUpperCase();

    if (!/^SR-\d{6}$/.test(number)) {
      return res.status(400).json({
        success: false,
        error:
          "Nieprawidłowy numer zamówienia."
      });
    }

    const order =
      await getOrderByNumber(
        number
      );

    if (!order) {
      return res.status(404).json({
        success: false,
        error:
          "Nie znaleziono zamówienia."
      });
    }

    return res.json({
      success: true,
      order: {
        id: order.id,
        number: order.number,
        discordId:
          order.discordId,
        username:
          order.username,
        product:
          order.product,
        price:
          order.price,
        status:
          order.status,
        createdAt:
          order.createdAt,
        paidAt:
          order.paidAt || null,
        fulfilledAt:
          order.fulfilledAt || null,
        note:
          order.note || ""
      }
    });
  }
);

// =====================================================
// FACTION REVIEWER / APPLICATIONS
// =====================================================

app.get(
  "/api/reviewer/applications",
  requireReviewer,
  async (req, res) => {
    try {
      let apps =
        await getAllApplications();

      if (!req.access.isAdmin) {
        apps = apps.filter(
          a =>
            req.access.factions.includes(
              a.faction
            )
        );
      }

      apps.sort(
        (a, b) =>
          new Date(b.createdAt) -
          new Date(a.createdAt)
      );

      res.json({
        success: true,
        applications: apps,
        access: {
          isAdmin:
            req.access.isAdmin,
          factions:
            req.access.factions
        }
      });
    } catch (err) {
      console.error(
        "REVIEWER APPLICATIONS:",
        err
      );

      res.status(500).json({
        success: false,
        error:
          "Nie udało się pobrać podań."
      });
    }
  }
);

app.patch(
  "/api/reviewer/applications/:id",
  requireReviewer,
  async (req, res) => {
    try {
      const application =
        await getApplicationById(
          req.params.id
        );

      if (!application) {
        return res.status(404).json({
          success: false,
          error:
            "Nie znaleziono podania."
        });
      }

      const canReview =
        req.access.isAdmin ||
        req.access.factions.includes(
          application.faction
        );

      if (!canReview) {
        return res.status(403).json({
          success: false,
          error:
            "Nie masz dostępu do tej frakcji."
        });
      }

      const status =
        String(
          req.body?.status || ""
        ).toLowerCase();

      if (
        ![
          "pending",
          "accepted",
          "rejected"
        ].includes(status)
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Nieprawidłowy status."
        });
      }

      application.status =
        status;

      application.reviewedAt =
        new Date().toISOString();

      application.reviewedBy = {
        id: req.user.id,
        username:
          req.user.globalName ||
          req.user.username
      };

      application.reviewNote =
        typeof req.body?.note ===
        "string"
          ? req.body.note.slice(
              0,
              2000
            )
          : "";

      const savedApplication =
        await updateApplication(
          application
        );

      res.json({
        success: true,
        application:
          savedApplication
      });
    } catch (err) {
      console.error(
        "UPDATE APPLICATION:",
        err
      );

      res.status(500).json({
        success: false,
        error:
          "Nie udało się zaktualizować podania."
      });
    }
  }
);

// =====================================================
// PLAYER PROFILE
// =====================================================

app.get(
  "/api/player/data",
  requireAuth,
  async (req, res) => {
    try {
      const apps =
        await getApplicationsForUser(
          req.user.id
        );

      res.json({
        success: true,
        user: req.user,

        stats: {
          total: apps.length,

          accepted:
            apps.filter(
              a =>
                a.status ===
                "accepted"
            ).length,

          pending:
            apps.filter(
              a =>
                a.status ===
                "pending"
            ).length,

          rejected:
            apps.filter(
              a =>
                a.status ===
                "rejected"
            ).length
        },

        latestApplication:
          apps[0] || null
      });
    } catch (err) {
      console.error(
        "PLAYER DATA:",
        err
      );

      res.status(500).json({
        success: false,
        error:
          "Nie udało się pobrać danych gracza."
      });
    }
  }
);

// =====================================================
// SETUP STATUS
// =====================================================

app.get(
  "/api/setup-status",
  async (req, res) => {
    const user =
      getUser(req);

    const config = {
      oauthConfigured:
        Boolean(
          CLIENT_ID &&
          CLIENT_SECRET &&
          COOKIE_SECRET &&
          CLIENT_SECRET !==
            "NOWY_CLIENT_SECRET"
        ),

      guildConfigured:
        Boolean(GUILD_ID),

      botConfigured:
        Boolean(
          BOT_TOKEN &&
          BOT_TOKEN !==
            "NOWY_TOKEN_BOTA"
        ),

      baseUrl:
        BASE_URL,

      guildId:
        GUILD_ID || null
    };

    let access = null;

    if (user) {
      access =
        await accessForUser(
          user.id
        );
    }

    res.json({
      success: true,
      config,
      loggedIn:
        Boolean(user),
      access: access
        ? {
            isAdmin:
              access.isAdmin,
            factions:
              access.factions
          }
        : null
    });
  }
);

// =====================================================
// DISCORD IP TEST
// =====================================================

app.get(
  "/api/debug/discord-ip-test",
  async (req, res) => {
    try {
      const r =
        await fetch(
          "https://discord.com/api/v10/oauth2/token",
          {
            method: "HEAD"
          }
        );

      const headers = {};

      r.headers.forEach(
        (value, key) => {
          headers[key] =
            value;
        }
      );

      res.json({
        status:
          r.status,

        statusText:
          r.statusText,

        retryAfter:
          r.headers.get(
            "retry-after"
          ) || null,

        headers
      });
    } catch (err) {
      res.status(500).json({
        error:
          String(err)
      });
    }
  }
);

// =====================================================
// STATIC WEBSITE
// =====================================================

app.use(
  express.static(SITE_DIR, {
    extensions: ["html"],
    index: "index.html"
  })
);

app.get("*", (req, res) => {
  if (
    req.path.startsWith("/api/") ||
    req.path.startsWith("/auth/")
  ) {
    return res
      .status(404)
      .json({
        error:
          "Not found"
      });
  }

  res.sendFile(
    path.join(
      SITE_DIR,
      "index.html"
    )
  );
});

// =====================================================
// START
// =====================================================

async function startServer() {
  try {
    await initDatabase();

    app.listen(
      PORT,
      () => {
        console.log(
          `SideRP running at ${BASE_URL}`
        );

        if (
          !CLIENT_ID ||
          !CLIENT_SECRET ||
          !COOKIE_SECRET
        ) {
          console.warn(
            "Uzupełnij .env przed użyciem logowania Discord."
          );
        }

        if (
          CLIENT_SECRET ===
            "NOWY_CLIENT_SECRET" ||
          BOT_TOKEN ===
            "NOWY_TOKEN_BOTA"
        ) {
          console.warn(
            "Uwaga: w .env są jeszcze przykładowe wartości sekretów Discord."
          );
        }
      }
    );
  } catch (err) {
    console.error(
      "❌ DATABASE ERROR:",
      err
    );

    process.exit(1);
  }
}

startServer();
