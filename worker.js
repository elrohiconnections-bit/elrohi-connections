const ADMIN_KEY_SHA256 = "2e76eae88aeb0fd2e4915852c29024510190a9ed38c121e497cbd9808c9788a3";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function clean(value, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function sha256Hex(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function isAdmin(request) {
  const supplied = request.headers.get("X-Admin-Key") || "";
  if (!supplied) return false;
  return (await sha256Hex(supplied)) === ADMIN_KEY_SHA256;
}

async function handlePartners(request, env) {
  if (!env.DB) return json({ error: "Partner database is not configured." }, 500);

  if (request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid form submission." }, 400);
    }

    const item = {
      full_name: clean(body.full_name, 120),
      email: clean(body.email, 180).toLowerCase(),
      phone: clean(body.phone, 60),
      organization: clean(body.organization, 180),
      city: clean(body.city, 120),
      country: clean(body.country, 120),
      interest: clean(body.interest, 180),
      message: clean(body.message, 1500),
      consent: body.consent ? 1 : 0
    };

    if (!item.full_name || !item.email || !item.country || !item.interest || !item.consent) {
      return json({ error: "Please complete all required fields." }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)) {
      return json({ error: "Please provide a valid email address." }, 400);
    }

    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO partner_submissions
       (full_name,email,phone,organization,city,country,interest,message,consent,submitted_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      item.full_name,
      item.email,
      item.phone,
      item.organization,
      item.city,
      item.country,
      item.interest,
      item.message,
      item.consent,
      now
    ).run();

    return json({ ok: true }, 201);
  }

  if (request.method === "GET") {
    if (!(await isAdmin(request))) return json({ error: "Unauthorized." }, 401);
    const { results = [] } = await env.DB.prepare(
      `SELECT id,full_name,email,phone,organization,city,country,interest,message,submitted_at
       FROM partner_submissions
       ORDER BY id DESC
       LIMIT 1000`
    ).all();
    return json({ items: results });
  }

  if (request.method === "DELETE") {
    if (!(await isAdmin(request))) return json({ error: "Unauthorized." }, 401);
    await env.DB.prepare("DELETE FROM partner_submissions").run();
    return json({ ok: true });
  }

  return json({ error: "Method not allowed." }, 405);
}

const RESOURCE_CATEGORIES = new Set(["mentorship-guide", "family-support", "leadership-stem"]);
const RESOURCE_KINDS = new Set(["document", "video", "link"]);

async function ensureResourcesTable(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    section_no INTEGER NOT NULL DEFAULT 1,
    resource_kind TEXT NOT NULL DEFAULT 'document',
    title TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    button_label TEXT,
    published INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_resources_library
    ON resources(category, published, section_no, sort_order, id)`).run();
}

function validResourceUrl(value) {
  if (!value) return false;
  if (value.startsWith("/")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function resourceFromBody(body) {
  const category = clean(body.category, 60);
  const resource_kind = clean(body.resource_kind, 20);
  const section_no = Number.parseInt(body.section_no, 10);
  const sort_order = Number.parseInt(body.sort_order, 10);
  const item = {
    category,
    section_no: [1, 2, 3].includes(section_no) ? section_no : 1,
    resource_kind,
    title: clean(body.title, 180),
    description: clean(body.description, 1200),
    url: clean(body.url, 1000),
    button_label: clean(body.button_label, 80),
    published: body.published === false || body.published === 0 || body.published === "0" ? 0 : 1,
    sort_order: Number.isFinite(sort_order) ? Math.max(-9999, Math.min(9999, sort_order)) : 0
  };

  if (!RESOURCE_CATEGORIES.has(item.category)) return { error: "Please select a valid resource category." };
  if (!RESOURCE_KINDS.has(item.resource_kind)) return { error: "Please select a valid resource type." };
  if (!item.title) return { error: "Resource title is required." };
  if (!validResourceUrl(item.url)) return { error: "Please provide a valid http(s) or site-relative resource URL." };
  return { item };
}

async function handleResources(request, env, url) {
  if (!env.DB) return json({ error: "Resource database is not configured." }, 500);
  await ensureResourcesTable(env);

  if (request.method === "GET") {
    const category = clean(url.searchParams.get("category"), 60);
    if (category && !RESOURCE_CATEGORIES.has(category)) return json({ error: "Invalid resource category." }, 400);

    const adminMode = url.searchParams.get("admin") === "1";
    if (adminMode && !(await isAdmin(request))) return json({ error: "Unauthorized." }, 401);

    let sql = `SELECT id,category,section_no,resource_kind,title,description,url,button_label,published,sort_order,created_at,updated_at
               FROM resources`;
    const clauses = [];
    const params = [];
    if (!adminMode) clauses.push("published = 1");
    if (category) {
      clauses.push("category = ?");
      params.push(category);
    }
    if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`;
    sql += " ORDER BY category ASC, section_no ASC, sort_order ASC, id DESC";

    const statement = env.DB.prepare(sql);
    const { results = [] } = params.length ? await statement.bind(...params).all() : await statement.all();
    return json({ items: results });
  }

  if (!(await isAdmin(request))) return json({ error: "Unauthorized." }, 401);

  if (request.method === "POST") {
    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid resource data." }, 400); }
    const parsed = resourceFromBody(body);
    if (parsed.error) return json({ error: parsed.error }, 400);
    const item = parsed.item;
    const now = new Date().toISOString();
    const result = await env.DB.prepare(`INSERT INTO resources
      (category,section_no,resource_kind,title,description,url,button_label,published,sort_order,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(
        item.category,item.section_no,item.resource_kind,item.title,item.description,item.url,item.button_label,
        item.published,item.sort_order,now,now
      ).run();
    return json({ ok: true, id: result.meta?.last_row_id || null }, 201);
  }

  if (request.method === "PUT") {
    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid resource data." }, 400); }
    const id = Number.parseInt(body.id, 10);
    if (!Number.isFinite(id) || id < 1) return json({ error: "A valid resource ID is required." }, 400);
    const parsed = resourceFromBody(body);
    if (parsed.error) return json({ error: parsed.error }, 400);
    const item = parsed.item;
    const now = new Date().toISOString();
    await env.DB.prepare(`UPDATE resources SET
      category=?, section_no=?, resource_kind=?, title=?, description=?, url=?, button_label=?, published=?, sort_order=?, updated_at=?
      WHERE id=?`).bind(
        item.category,item.section_no,item.resource_kind,item.title,item.description,item.url,item.button_label,
        item.published,item.sort_order,now,id
      ).run();
    return json({ ok: true });
  }

  if (request.method === "DELETE") {
    const id = Number.parseInt(url.searchParams.get("id"), 10);
    if (!Number.isFinite(id) || id < 1) return json({ error: "A valid resource ID is required." }, 400);
    await env.DB.prepare("DELETE FROM resources WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  return json({ error: "Method not allowed." }, 405);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/partners") return handlePartners(request, env);
    if (url.pathname === "/api/resources") return handleResources(request, env, url);
    return env.ASSETS.fetch(request);
  }
};
