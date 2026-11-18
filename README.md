# Plan Hai Group

Panel de trabajo de la implementación de marca, LinkedIn y sitio web de Hai Group, hecho por [agustín.design](https://agustindesign.cl).

Sitio: https://agustin0707.github.io/plan-hai-group/

## Cómo funciona

- **Notion es la única fuente.** Las tareas viven en la base "Tareas" de la página Hai Group. Los pagos y la disponibilidad viven en una página privada ("Plan Hai Group · privado").
- **La web es estática** (GitHub Pages). No guarda montos, llaves ni datos personales: todo llega desde Notion después de escribir la clave de acceso.
- **Una función de Supabase hace de puente.** Guarda la llave de Notion como secreto, pide la clave de acceso en cada llamada y solo permite editar páginas de esas tres bases.

```
GitHub Pages  →  función plan-hai (Supabase)  →  API de Notion
   (pública)        (guarda la llave)             (tus bases)
```

## Puesta en marcha (una sola vez)

### 1. Crear la integración de Notion

1. Entra a https://www.notion.so/profile/integrations y toca **Nueva integración**.
2. Nombre: `Plan Hai Group`. Tipo: **Interna**. Espacio de trabajo: el tuyo.
3. En Capacidades deja marcado leer, actualizar e insertar contenido.
4. Copia el **Secreto interno de integración**. No lo pegues en ningún archivo de este repositorio.

### 2. Darle acceso a las páginas

1. En Notion abre la página **Hai Group** (la que contiene la base Tareas), toca `•••` arriba a la derecha, luego **Conexiones** y elige `Plan Hai Group`.
2. Repite lo mismo en la página **Plan Hai Group · privado** (Pagos y Disponibilidad).

### 3. Crear la función en Supabase

Puedes usar el mismo proyecto de Supabase del portafolio.

1. En el panel de Supabase entra a **Edge Functions** y toca **Deploy a new function**, luego **Via Editor**.
2. Nombre: `plan-hai`.
3. Borra el código de ejemplo y pega todo el contenido de [`supabase/functions/plan-hai/index.ts`](supabase/functions/plan-hai/index.ts).
4. Toca **Deploy function**.
5. En la configuración de la función desactiva **Enforce JWT verification** (la protege la clave de acceso) y guarda.

### 4. Guardar los secretos

En **Edge Functions → Secrets** agrega:

| Nombre | Valor |
|---|---|
| `NOTION_TOKEN` | El secreto de la integración del paso 1 |
| `PLAN_KEY` | La clave de acceso que vas a escribir en la web. Usa una frase larga que no uses en otro lado |

Opcional: `ALLOWED_ORIGINS` si algún día la web vive en otro dominio (por defecto acepta `https://agustin0707.github.io` y `localhost:8000`).

### 5. Conectar la web

1. Copia la URL de la función. Tiene esta forma: `https://<proyecto>.supabase.co/functions/v1/plan-hai`.
2. Pégala en [`assets/js/config.js`](assets/js/config.js), en `API_URL`, y sube el cambio.
3. Abre el sitio y entra con la clave de `PLAN_KEY`. El navegador la recuerda hasta que toques **Salir**.

## Uso

| Vista | Para qué |
|---|---|
| Hoy | Próximo hito, foco del día, próximos 7 días, avance por módulo, ruta del proyecto y carga por semana |
| Tareas | Captura rápida, vistas rápidas (atrasadas, esta semana, prioritarias, hitos), búsqueda y filtro por módulo |
| Calendario | Mes con tus vacaciones y viajes marcados. Arrastra una tarea a otro día para moverla |
| Pagos | Boletas, retención y lo que te llega. Cambia el estado de cada boleta y queda en Notion |
| Propuesta | Lo acordado con Hai Group, sin montos |

Atajos: `N` nueva tarea, `/` buscar, `1` a `5` cambiar de vista, `R` actualizar desde Notion, `Esc` cerrar, `Cmd + Enter` guardar. En el calendario, las flechas cambian de mes.

Cada cambio se ve al instante y se guarda en Notion en segundo plano. Si algo falla, vuelve atrás y avisa. Casi todo se puede deshacer desde el aviso. El panel vuelve a leer Notion cada minuto y cada vez que vuelves a la pestaña.

## Probar en local

```bash
python3 -m http.server 8000
```

Abre `http://localhost:8000`. Con `config.js` apuntando a la función, funciona igual que el sitio publicado.

## Archivos

```
index.html                          estructura de las cinco vistas
assets/css/app.css                  sistema visual: C · Índice con el teal de Hai Group
assets/js/app.js                    lógica del panel
assets/js/config.js                 URL de la función
assets/img/                         logo de Hai Group, isotipo en línea y favicon
supabase/functions/plan-hai/        función puente con Notion
```
