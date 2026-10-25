const ADMIN_KEY_SHA256 = "2e76eae88aeb0fd2e4915852c29024510190a9ed38c121e497cbd9808c9788a3";
const MAX_RESOURCE_FILE_SIZE = 25 * 1024 * 1024;

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
const ALLOWED_DOCUMENT_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "rtf", "csv", "odt", "ods", "odp"
]);

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
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS resource_files (
    resource_id INTEGER PRIMARY KEY,
    storage_key TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    mime_type TEXT,
    file_size INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`).run();
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
    published: body.published === false || body.published === 0 || body.published === "0" || body.published === "false" ? 0 : 1,
    sort_order: Number.isFinite(sort_order) ? Math.max(-9999, Math.min(9999, sort_order)) : 0
  };

  if (!RESOURCE_CATEGORIES.has(item.category)) return { error: "Please select a valid resource category." };
  if (!RESOURCE_KINDS.has(item.resource_kind)) return { error: "Please select a valid resource type." };
  if (!item.title) return { error: "Resource title is required." };
  if (!validResourceUrl(item.url)) return { error: "Please provide a valid http(s) or site-relative resource URL." };
  return { item };
}

function safeFileName(value) {
  const name = String(value || "document").normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return name.replace(/^[-.]+|[-.]+$/g, "").slice(0, 140) || "document";
}

function fileExtension(name) {
  const match = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
}

function formatFileUrl(id) {
  return `/api/resource-files/${id}`;
}

async function handleResources(request, env, url) {
  if (!env.DB) return json({ error: "Resource database is not configured." }, 500);
  await ensureResourcesTable(env);

  if (request.method === "GET") {
    const category = clean(url.searchParams.get("category"), 60);
    if (category && !RESOURCE_CATEGORIES.has(category)) return json({ error: "Invalid resource category." }, 400);

    const adminMode = url.searchParams.get("admin") === "1";
    if (adminMode && !(await isAdmin(request))) return json({ error: "Unauthorized." }, 401);

    let sql = `SELECT r.id,r.category,r.section_no,r.resource_kind,r.title,r.description,r.url,r.button_label,r.published,r.sort_order,r.created_at,r.updated_at,
                      f.original_name,f.mime_type,f.file_size
               FROM resources r
               LEFT JOIN resource_files f ON f.resource_id = r.id`;
    const clauses = [];
    const params = [];
    if (!adminMode) clauses.push("r.published = 1");
    if (category) {
      clauses.push("r.category = ?");
      params.push(category);
    }
    if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`;
    sql += " ORDER BY r.category ASC, r.section_no ASC, r.sort_order ASC, r.id DESC";

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
    const fileRecord = await env.DB.prepare("SELECT storage_key FROM resource_files WHERE resource_id = ?").bind(id).first();
    if (fileRecord?.storage_key && env.RESOURCE_FILES) {
      await env.RESOURCE_FILES.delete(fileRecord.storage_key);
    }
    await env.DB.prepare("DELETE FROM resource_files WHERE resource_id = ?").bind(id).run();
    await env.DB.prepare("DELETE FROM resources WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  return json({ error: "Method not allowed." }, 405);
}

async function handleResourceUpload(request, env) {
  if (!env.DB) return json({ error: "Resource database is not configured." }, 500);
  if (!(await isAdmin(request))) return json({ error: "Unauthorized." }, 401);
  if (!env.RESOURCE_FILES) {
    return json({ error: "Document upload storage is not configured yet. Add an R2 binding named RESOURCE_FILES." }, 503);
  }
  await ensureResourcesTable(env);

  let form;
  try { form = await request.formData(); } catch { return json({ error: "Invalid upload form." }, 400); }

  const file = form.get("file");
  if (!file || typeof file !== "object" || typeof file.stream !== "function" || !file.name) {
    return json({ error: "Please select a document to upload." }, 400);
  }
  if (!file.size) return json({ error: "The selected document is empty." }, 400);
  if (file.size > MAX_RESOURCE_FILE_SIZE) return json({ error: "Document is too large. Maximum upload size is 25 MB." }, 413);

  const extension = fileExtension(file.name);
  if (!ALLOWED_DOCUMENT_EXTENSIONS.has(extension)) {
    return json({ error: "Unsupported document type. Upload PDF, Word, PowerPoint, Excel, text, CSV or OpenDocument files." }, 400);
  }

  const category = clean(form.get("category"), 60);
  const section_no = Number.parseInt(form.get("section_no"), 10);
  const sort_order = Number.parseInt(form.get("sort_order"), 10);
  const title = clean(form.get("title"), 180) || clean(file.name.replace(/\.[^.]+$/, ""), 180);
  const description = clean(form.get("description"), 1200);
  const button_label = clean(form.get("button_label"), 80) || "Open document";
  const publishedRaw = clean(form.get("published"), 10).toLowerCase();
  const published = ["1", "true", "yes", "on"].includes(publishedRaw) ? 1 : 0;

  if (!RESOURCE_CATEGORIES.has(category)) return json({ error: "Please select a valid resource category." }, 400);
  if (![1, 2, 3].includes(section_no)) return json({ error: "Please select a valid library section." }, 400);
  if (!title) return json({ error: "Resource title is required." }, 400);

  const safeName = safeFileName(file.name);
  const storageKey = `resources/${category}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const now = new Date().toISOString();
  let resourceId = null;

  try {
    await env.RESOURCE_FILES.put(storageKey, file.stream(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
      customMetadata: { originalName: file.name, category }
    });

    const result = await env.DB.prepare(`INSERT INTO resources
      (category,section_no,resource_kind,title,description,url,button_label,published,sort_order,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(
        category,section_no,"document",title,description,"/",button_label,published,
        Number.isFinite(sort_order) ? Math.max(-9999, Math.min(9999, sort_order)) : 0,now,now
      ).run();

    resourceId = Number(result.meta?.last_row_id);
    if (!Number.isFinite(resourceId) || resourceId < 1) throw new Error("Unable to create resource record.");

    const publicUrl = formatFileUrl(resourceId);
    await env.DB.prepare(`INSERT INTO resource_files
      (resource_id,storage_key,original_name,mime_type,file_size,created_at)
      VALUES (?,?,?,?,?,?)`).bind(
        resourceId,storageKey,file.name,file.type || "application/octet-stream",file.size,now
      ).run();
    await env.DB.prepare("UPDATE resources SET url = ? WHERE id = ?").bind(publicUrl,resourceId).run();

    return json({ ok: true, id: resourceId, url: publicUrl, file_name: file.name, file_size: file.size }, 201);
  } catch (error) {
    try { await env.RESOURCE_FILES.delete(storageKey); } catch {}
    if (resourceId) {
      try { await env.DB.prepare("DELETE FROM resource_files WHERE resource_id = ?").bind(resourceId).run(); } catch {}
      try { await env.DB.prepare("DELETE FROM resources WHERE id = ?").bind(resourceId).run(); } catch {}
    }
    return json({ error: error?.message || "Unable to upload document." }, 500);
  }
}

async function handleResourceFile(request, env, url) {
  if (!env.DB) return new Response("Not found", { status: 404 });
  if (!env.RESOURCE_FILES) return new Response("File storage is not configured.", { status: 503 });
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });

  const id = Number.parseInt(url.pathname.split("/").pop(), 10);
  if (!Number.isFinite(id) || id < 1) return new Response("Not found", { status: 404 });
  await ensureResourcesTable(env);

  const record = await env.DB.prepare(`SELECT r.title,f.storage_key,f.original_name,f.mime_type
    FROM resources r JOIN resource_files f ON f.resource_id = r.id
    WHERE r.id = ? AND r.published = 1`).bind(id).first();
  if (!record?.storage_key) return new Response("Not found", { status: 404 });

  const object = request.method === "HEAD"
    ? await env.RESOURCE_FILES.head(record.storage_key)
    : await env.RESOURCE_FILES.get(record.storage_key);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  if (!headers.has("content-type")) headers.set("content-type", record.mime_type || "application/octet-stream");
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=3600");
  const originalName = record.original_name || `${safeFileName(record.title)}.pdf`;
  headers.set("content-disposition", `inline; filename="${safeFileName(originalName)}"; filename*=UTF-8''${encodeURIComponent(originalName)}`);

  return new Response(request.method === "HEAD" ? null : object.body, { headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/partners") return handlePartners(request, env);
    if (url.pathname === "/api/resources") return handleResources(request, env, url);
    if (url.pathname === "/api/resource-upload" && request.method === "POST") return handleResourceUpload(request, env);
    if (url.pathname.startsWith("/api/resource-files/")) return handleResourceFile(request, env, url);
    return env.ASSETS.fetch(request);
  }
};
