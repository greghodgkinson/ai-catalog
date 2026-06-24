# Prolifics AI Catalog

The master catalog and governance hub for every AI agent, tool, and assembly built at Prolifics.

## What it is

A single place to discover, govern, and share the agentic portfolio:

- **Dashboard** — live counts of toolkits, agents, tools, consumers, personas, and total AI capability calls
- **Toolkit browser** — searchable card grid with tag filtering and sort
- **Toolkit detail** — assemblies, agents, tools, token usage history, git provenance, spec download
- **Consumers & Personas, Agents, Tools** — cross-toolkit browse views
- **Executive summary** (`/executive`) — CEO-facing page with timeline, domain coverage, and top capabilities; print-friendly

Published automatically by the [toolkit-workbench](../toolkit-workbench) push action.

---

## Local development

**Backend (FastAPI + SQLite)**

```bash
cd api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8300 --reload
```

**Frontend (React + Vite)**

```bash
cd ui
npm install
npm run dev          # dev server at http://localhost:5300
```

The Vite dev server proxies `/api` to `http://localhost:8300`.

---

## Deploy

### Prerequisites

- [flyctl](https://fly.io/docs/flyctl/install/) installed and authenticated (`flyctl auth login`)
- `CATALOG_API_KEY` environment variable set — this becomes the shared secret toolkits must include in pushes

### First-time deploy

```bash
CATALOG_API_KEY=your-secret-key ./deploy.sh
```

`deploy.sh` will:
1. Create the Fly app `prolifics-ai-catalog` if it doesn't exist
2. Create a 1 GB persistent volume for the SQLite database (survives redeploys)
3. Set the `CATALOG_API_KEY` secret on Fly
4. Build and deploy the Docker image (Node → React build, Python → FastAPI runtime)

The app runs at **https://prolifics-ai-catalog.fly.dev** in the Johannesburg region (`jnb`).

### Subsequent deploys

```bash
flyctl deploy
```

### Toolkit-workbench configuration

In the workbench Catalog tab for any toolkit, set:
- **Catalog URL** → `https://prolifics-ai-catalog.fly.dev`
- **API Key** → the value you set as `CATALOG_API_KEY`

Then click **Test Connection** to verify, and **Publish to Catalog** to push.

---

## Architecture

```
ai-catalog/
├── api/                  FastAPI backend
│   ├── migrations/       SQL schema (V1__initial_schema.sql)
│   ├── routers/
│   │   ├── push.py       POST /api/catalog/push  (ingest from workbench)
│   │   └── catalog.py    GET  /api/catalog/*      (read API)
│   ├── database.py       aiosqlite + WAL mode
│   └── main.py           app entrypoint; serves React SPA in production
├── ui/                   React + TypeScript + Tailwind + Vite
│   └── src/
│       ├── pages/        Home, Toolkits, ToolkitDetail, Consumers,
│       │                 Agents, Tools, Executive
│       └── components/   Nav, CountUp, TagChip, SearchBar
├── Dockerfile            Multi-stage: node build → python runtime
├── fly.toml              Fly.io configuration
└── deploy.sh             Bootstrap + deploy script
```

The SQLite database lives at `$DATA_DIR/catalog.db` (default `~/.ai-catalog/catalog.db` locally, `/data/catalog.db` on Fly).

---

## Security note

`CATALOG_API_KEY` is a single shared secret for push authentication. All read endpoints are open (catalog is intended to be internally visible). Never commit the key — pass it as a Fly secret or environment variable only.
