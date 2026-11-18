// =======================================================
// PLAN HAI GROUP · PUENTE CON NOTION (SUPABASE EDGE FUNCTION)
// =======================================================
// La web (GitHub Pages) no puede guardar la llave de Notion porque es pública.
// Esta función la guarda como secreto y expone solo lo que el panel necesita:
// leer tareas, pagos y disponibilidad, y editar tareas y el estado de las boletas.
//
// Secretos (Supabase > Edge Functions > Secrets):
//   NOTION_TOKEN     llave de la integración interna de Notion
//   PLAN_KEY         clave de acceso que pide la web (elígela tú)
//   ALLOWED_ORIGINS  opcional, orígenes permitidos separados por coma
//
// Desactiva "Enforce JWT verification" en esta función: la protege PLAN_KEY.

const NOTION = "https://api.notion.com/v1";
const VERSION = "2022-06-28";

// IDs de las bases de Notion (no son secretos: sin la llave no sirven de nada)
const DB = {
  tareas: Deno.env.get("NOTION_DB_TAREAS") ?? "27aee5ab67d247919e33b97704bdf718",
  pagos: Deno.env.get("NOTION_DB_PAGOS") ?? "41c48517558b818692cef3ad79150e20",
  disponibilidad: Deno.env.get("NOTION_DB_DISPONIBILIDAD") ?? "41c48517558b81748adad2091dae7114",
};

const ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://agustin0707.github.io,http://localhost:8000,http://127.0.0.1:8000").split(",").map((s) => s.trim());

const CATEGORIAS = [
  "Preparación", "Coordinación con cliente", "Cotización / Honorarios", "Propuesta", "Descubrimiento",
  "Marca", "LinkedIn", "Sitio web", "Agentes", "Campañas", "Google Ads",
];
const ESTADO_A_NOTION: Record<string, string> = { pendiente: "Pendiente", en_curso: "En curso", bloqueado: "Bloqueado", hecho: "Hecho" };
const ESTADO_DESDE_NOTION: Record<string, string> = { "Pendiente": "pendiente", "En curso": "en_curso", "Bloqueado": "bloqueado", "Hecho": "hecho", "URGENTE": "pendiente" };
const ESTADOS_PAGO = ["por emitir", "emitida", "pagada"];

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// --- 1. UTILIDADES ---
function cors(origin: string | null): Record<string, string> {
  const allow = origin && ORIGINS.includes(origin) ? origin : ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "content-type, x-plan-key",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// Comparación en tiempo constante para que la clave no se pueda adivinar midiendo tiempos
function sameKey(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

const norm = (id: string) => id.replace(/-/g, "").toLowerCase();
const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{32}$/i.test(v.replace(/-/g, ""));
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const text = (v: unknown, max: number) => String(v ?? "").slice(0, max);
const today = () => new Date().toISOString().slice(0, 10);

async function notion(path: string, method = "GET", body?: unknown) {
  const token = Deno.env.get("NOTION_TOKEN");
  if (!token) throw new HttpError(500, "Falta el secreto NOTION_TOKEN");
  const r = await fetch(NOTION + path, {
    method,
    headers: { "Authorization": "Bearer " + token, "Notion-Version": VERSION, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(r.status === 404 ? 404 : 502, j.message || "Notion respondió con un error");
  return j;
}

async function queryAll(db: string) {
  const out: any[] = [];
  let cursor: string | undefined;
  do {
    const j = await notion(`/databases/${db}/query`, "POST", cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 });
    out.push(...j.results);
    cursor = j.has_more ? j.next_cursor : undefined;
  } while (cursor);
  return out;
}

// Solo se pueden editar páginas que viven en la base esperada
async function assertIn(id: string, db: string) {
  const page = await notion(`/pages/${id}`);
  if (!page.parent || norm(page.parent.database_id ?? "") !== norm(db)) throw new HttpError(403, "Esa página no es de esta base");
  return page;
}

const plain = (rt: any[] | undefined) => (rt ?? []).map((t) => t.plain_text).join("");

// --- 2. MAPEO NOTION → PANEL ---
function tarea(p: any) {
  const pr = p.properties;
  const estado = pr["Estado"]?.select?.name ?? "Pendiente";
  return {
    id: norm(p.id),
    title: plain(pr["Tarea"]?.title),
    date: pr["Fecha objetivo"]?.date?.start?.slice(0, 10) ?? null,
    module: pr["Categoría"]?.select?.name ?? "Coordinación con cliente",
    status: ESTADO_DESDE_NOTION[estado] ?? "pendiente",
    priority: !!pr["Prioritaria"]?.checkbox || estado === "URGENTE",
    milestone: !!pr["Hito"]?.checkbox,
    notes: plain(pr["Notas"]?.rich_text),
    owner: pr["Responsable"]?.select?.name ?? "",
    url: p.url,
    edited: p.last_edited_time,
  };
}

function pago(p: any) {
  const pr = p.properties;
  return {
    id: norm(p.id),
    mes: plain(pr["Clave"]?.rich_text),
    label: plain(pr["Mes"]?.title),
    bruto: pr["Bruto"]?.number ?? 0,
    tasa: pr["Retención %"]?.number ?? 0,
    estado: pr["Estado"]?.select?.name ?? "por emitir",
    deposito: plain(pr["Depósito estimado"]?.rich_text),
    pagadaEl: pr["Pagada el"]?.date?.start ?? null,
  };
}

function periodo(p: any) {
  const pr = p.properties;
  const d = pr["Fechas"]?.date;
  return { id: norm(p.id), label: plain(pr["Nombre"]?.title), kind: pr["Tipo"]?.select?.name ?? "viaje", start: d?.start ?? null, end: d?.end ?? d?.start ?? null };
}

// --- 3. MAPEO PANEL → NOTION ---
function propsTarea(t: Record<string, unknown>) {
  const p: Record<string, unknown> = {};
  if ("title" in t) {
    const v = text(t.title, 200).trim();
    if (!v) throw new HttpError(400, "La tarea necesita un nombre");
    p["Tarea"] = { title: [{ text: { content: v } }] };
  }
  if ("date" in t) {
    if (t.date !== null && !isDate(t.date)) throw new HttpError(400, "Fecha inválida");
    p["Fecha objetivo"] = t.date ? { date: { start: t.date } } : { date: null };
  }
  if ("module" in t) {
    if (!CATEGORIAS.includes(String(t.module))) throw new HttpError(400, "Categoría inválida");
    p["Categoría"] = { select: { name: t.module } };
  }
  if ("status" in t) {
    const s = ESTADO_A_NOTION[String(t.status)];
    if (!s) throw new HttpError(400, "Estado inválido");
    p["Estado"] = { select: { name: s } };
  }
  if ("priority" in t) p["Prioritaria"] = { checkbox: !!t.priority };
  if ("milestone" in t) p["Hito"] = { checkbox: !!t.milestone };
  if ("notes" in t) {
    const v = text(t.notes, 2000);
    p["Notas"] = { rich_text: v ? [{ text: { content: v } }] : [] };
  }
  return p;
}

// --- 4. RUTAS ---
async function handle(req: Request) {
  if (req.method === "GET") {
    const [t, p, d] = await Promise.all([queryAll(DB.tareas), queryAll(DB.pagos), queryAll(DB.disponibilidad)]);
    return {
      tasks: t.filter((x) => !x.archived).map(tarea).filter((x) => x.title),
      pagos: p.map(pago).filter((x) => x.mes).sort((a, b) => a.mes.localeCompare(b.mes)),
      periodos: d.map(periodo).filter((x) => x.start),
      at: new Date().toISOString(),
    };
  }
  if (req.method !== "POST") throw new HttpError(405, "Método no permitido");
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") throw new HttpError(400, "Cuerpo inválido");

  switch (body.op) {
    case "update": {
      if (!isId(body.id)) throw new HttpError(400, "id inválido");
      await assertIn(body.id, DB.tareas);
      const page = await notion(`/pages/${body.id}`, "PATCH", { properties: propsTarea(body.patch ?? {}) });
      return { task: tarea(page) };
    }
    case "create": {
      const t = body.task ?? {};
      const props = propsTarea({ status: "pendiente", module: "Coordinación con cliente", priority: false, milestone: false, notes: "", date: today(), ...t });
      props["Responsable"] = { select: { name: "Agustín" } };
      const page = await notion(`/pages`, "POST", { parent: { database_id: DB.tareas }, properties: props });
      return { task: tarea(page) };
    }
    case "archive":
    case "restore": {
      if (!isId(body.id)) throw new HttpError(400, "id inválido");
      await assertIn(body.id, DB.tareas);
      const page = await notion(`/pages/${body.id}`, "PATCH", { archived: body.op === "archive" });
      return { task: tarea(page) };
    }
    case "pago": {
      if (!isId(body.id)) throw new HttpError(400, "id inválido");
      if (!ESTADOS_PAGO.includes(body.estado)) throw new HttpError(400, "Estado de boleta inválido");
      await assertIn(body.id, DB.pagos);
      const page = await notion(`/pages/${body.id}`, "PATCH", {
        properties: {
          "Estado": { select: { name: body.estado } },
          "Pagada el": body.estado === "pagada" ? { date: { start: today() } } : { date: null },
        },
      });
      return { pago: pago(page) };
    }
    default:
      throw new HttpError(400, "Operación desconocida");
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  const key = Deno.env.get("PLAN_KEY") ?? "";
  if (!key || !sameKey(req.headers.get("x-plan-key") ?? "", key)) return json({ error: "Clave incorrecta" }, 401, origin);
  try {
    return json(await handle(req), 200, origin);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json({ error: e instanceof Error ? e.message : "Error" }, status, origin);
  }
});
