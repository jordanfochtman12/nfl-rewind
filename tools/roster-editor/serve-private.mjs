import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const host = "127.0.0.1";
const port = Number(process.env.ROSTER_EDITOR_PORT ?? 8126);
const configuredPassword = process.env.ROSTER_EDITOR_PASSWORD;
const password = configuredPassword || randomBytes(18).toString("base64url");
const pagePath = fileURLToPath(new URL("./standalone.html", import.meta.url));
const page = await readFile(pagePath);
const reviewPath = fileURLToPath(new URL("./rating-review.html", import.meta.url));
const reviewPage = await readFile(reviewPath);
const sessions = new Map();
const attempts = new Map();

const loginPage = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#090c12"><title>Developer sign in · NFL Rewind</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;background:radial-gradient(ellipse at 50% 0,#23304a,transparent 60%),#090c12;color:#f3f6fa;font:16px system-ui,-apple-system,"Segoe UI",sans-serif}.card{width:min(100%,420px);padding:24px;border:1px solid #344154;border-radius:18px;background:#111722;box-shadow:0 18px 60px #0008}.eyebrow{color:#f5c451;font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}h1{margin:8px 0;font-size:27px}.hint{color:#aeb9c8;font-size:14px;line-height:1.5}label{display:block;margin:22px 0 7px;color:#aeb9c8;font-size:12px;font-weight:700}input{width:100%;height:50px;padding:0 13px;border:1px solid #46556b;border-radius:10px;background:#080d14;color:white;font:inherit}button{width:100%;height:48px;margin-top:13px;border:0;border-radius:10px;background:linear-gradient(135deg,#f8d77b,#d5a83d);color:#17130b;font:700 15px system-ui;cursor:pointer}.error{min-height:20px;margin-top:9px;color:#ffabb3;font-size:13px}</style><main class="card"><div class="eyebrow">NFL Rewind · developer tool</div><h1>Roster Edit Desk</h1><p class="hint">Enter the private access code to open the roster and draft class editor.</p><form id="login"><label for="password">Access code</label><input id="password" name="password" type="password" autocomplete="current-password" required autofocus><button>Open editor</button><div id="error" class="error" role="alert"></div></form></main><script>document.getElementById("login").addEventListener("submit",async e=>{e.preventDefault();const error=document.getElementById("error");error.textContent="";try{const r=await fetch("/login",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams(new FormData(e.currentTarget))});if(r.ok){location.replace(new URLSearchParams(location.search).get("next")==="review"?"/review":"/editor");return}error.textContent=r.status===429?"Too many attempts. Wait a minute and try again.":"That access code did not match. Try again."}catch{error.textContent="Could not reach the sign-in service. Reload and try again."}});</script></html>`;

function respond(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    ...headers,
  });
  res.end(body);
}

function sessionFrom(req) {
  const cookie = req.headers.cookie ?? "";
  const id = cookie.match(/(?:^|;\s*)roster_editor_session=([a-f0-9]+)/)?.[1];
  const expires = id && sessions.get(id);
  if (!expires || expires < Date.now()) {
    if (id) sessions.delete(id);
    return false;
  }
  return true;
}

const server = createServer((req, res) => {
  const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1");
  if (req.method === "GET" && requestUrl.pathname === "/") {
    respond(res, 200, loginPage, { "Content-Type": "text/html; charset=utf-8" });
    return;
  }

  if (req.method === "POST" && req.url === "/login") {
    const client = req.headers["cf-connecting-ip"] ?? req.socket.remoteAddress ?? "unknown";
    const recent = (attempts.get(client) ?? []).filter((time) => Date.now() - time < 60_000);
    if (recent.length >= 10) {
      attempts.set(client, recent);
      respond(res, 429, "Too many attempts", { "Content-Type": "text/plain; charset=utf-8" });
      return;
    }
    recent.push(Date.now());
    attempts.set(client, recent);

    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2048) req.destroy();
    });
    req.on("end", () => {
      const supplied = new URLSearchParams(body).get("password") ?? "";
      const provided = Buffer.from(supplied);
      const expected = Buffer.from(password);
      const valid = provided.length === expected.length && timingSafeEqual(provided, expected);
      if (!valid) {
        respond(res, 401, "Invalid access code", { "Content-Type": "text/plain; charset=utf-8" });
        return;
      }
      const id = randomBytes(24).toString("hex");
      sessions.set(id, Date.now() + 12 * 60 * 60 * 1000);
      respond(res, 204, "", {
        "Set-Cookie": `roster_editor_session=${id}; Path=/; Max-Age=43200; HttpOnly; Secure; SameSite=Strict`,
      });
    });
    return;
  }

  if (req.method === "GET" && req.url === "/editor") {
    if (!sessionFrom(req)) {
      respond(res, 302, "", { Location: "/" });
      return;
    }
    respond(res, 200, page, { "Content-Type": "text/html; charset=utf-8", "Content-Length": page.length });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/review") {
    if (!sessionFrom(req)) {
      respond(res, 302, "", { Location: "/?next=review" });
      return;
    }
    respond(res, 200, reviewPage, { "Content-Type": "text/html; charset=utf-8", "Content-Length": reviewPage.length });
    return;
  }

  respond(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
});

server.listen(port, host, () => {
  console.log(`Private editor: https://<tunnel-host>/`);
  console.log(configuredPassword ? "Password: supplied via environment" : `Password: ${password}`);
  console.log("The password opens a 12-hour read-only editor session. Press Ctrl+C to stop.");
});
