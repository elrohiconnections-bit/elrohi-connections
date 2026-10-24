function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function authorized(request, env) {
  const supplied = request.headers.get("X-Admin-Key") || "";
  return Boolean(env.ADMIN_KEY) && supplied === env.ADMIN_KEY;
}

async function handlePartners(request, env) {
  if (!env.DB) return json({ error: "Database binding unavailable" }, 500);

  if (request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const fullName = clean(body.full_name);
    const email = clean(body.email);
    const phone = clean(body.phone);
    const organization = clean(body.organization);
    const city = clean(body.city);
    const country = clean(body.country);
    const interest = clean(body.interest);
    const message = clean(body.message);
    const consent = body.consent ? 1 : 0;

    if (!fullName || !email || !country || !interest || !consent) {
      return json({ error: "Missing required fields" }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Invalid email" }, 400);
    }

    const submittedAt = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO partner_submissions
       (full_name, email, phone, organization, city, country, interest, message, consent, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(fullName, email, phone, organization, city, country, interest, message, consent, submittedAt)
      .run();

    return json({ ok: true }, 201);
  }

  if (request.method === "GET") {
    if (!authorized(request, env)) return json({ error: "Unauthorized" }, 401);
    const result = await env.DB.prepare(
      `SELECT id, full_name, email, phone, organization, city, country, interest, message, consent, submitted_at
       FROM partner_submissions
       ORDER BY id DESC
       LIMIT 1000`
    ).all();
    return json({ submissions: result.results || [] });
  }

  if (request.method === "DELETE") {
    if (!authorized(request, env)) return json({ error: "Unauthorized" }, 401);
    await env.DB.prepare("DELETE FROM partner_submissions").run();
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/partners") {
      return handlePartners(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
