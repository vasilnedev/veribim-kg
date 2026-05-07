# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VeriBIM-KG is a knowledge graph platform for construction project compliance. It connects BIM models and technical documentation (PDFs) to a semantic Neo4j knowledge graph, enabling compliance verification and LLM-powered querying. The system is governed by an ISO 19650 / IFC-aligned ontology defined in `ONTOLOGY.md`.

Three pipelines:
- **doc2kg** — PDF documents → labeled text → Neo4j graph (mature)
- **ifc2kg** — IFC BIM files → Neo4j graph (stub)
- **rag** — GraphRAG chat over the knowledge graph (stub)

## Development Commands

### Start Infrastructure

```bash
# Base services (Neo4j, MinIO, Redis, Ollama) — always required
docker compose -f compose.dev-base.yml up -d

# Start individual pipelines
docker compose -f compose.dev-doc2kg.yml up -d
docker compose -f compose.dev-ifc2kg.yml up -d
docker compose -f compose.dev-rag.yml up -d
```

### Backend (e.g. doc2kg-backend)

```bash
cd doc2kg-backend
npm run dev          # Express server with Nodemon hot-reload
npm run graphworker  # BullMQ background worker for graph generation
npm run bullboard    # Queue monitoring UI (separate process)
```

### Frontend (e.g. doc2kg-frontend)

```bash
cd doc2kg-frontend
npm run dev      # Vite dev server
npm run build    # TypeScript compile + Vite build
npm run lint     # ESLint
npm run preview  # Preview production build
```

There is no test suite — testing is manual via the UI and API endpoints.

## Architecture

All services sit behind **base-app** (Express reverse proxy on port 80). Each backend registers its routes dynamically and connects to the shared data layer.

**Shared data layer:**
- **Neo4j** (bolt: 7687) — graph database, auth disabled in dev
- **MinIO** (9000) — object storage for PDFs, extracted text, images, JSON
- **Redis** (6379) — BullMQ persistence
- **Ollama** (11434) — local LLM for embeddings (`embeddinggemma`) and text generation (`llama3.1:8b`)

### doc2kg Pipeline (the only mature pipeline)

**Backend** (`doc2kg-backend/src/`):
- `index.js` — Express + Socket.io server entry point
- `routes.js` — auto-discovers and registers handlers from `requestHandlers/{method}/*.js`
- `requestHandlers/` — one file per endpoint; exports a `documentation` object with `{method, path, description, body}`
- `dataProviders/Neo4j.js` — `withNeo4j(handler)` HOF that wraps handlers with session lifecycle
- `dataProviders/MinIO.js` — object storage abstractions
- `bullmqQueues/graphWorker.js` — background job: reads labeled text from MinIO → calls `text2graphJSON` → writes nodes/links to Neo4j
- `text2graph/text2graphJSON.js` — core logic: parses labeled plaintext into `{nodes, links}` graph structure
- `LLMembedding/generateEmbedding.js` — calls Ollama embedding API
- `pdf_extraction/*.py` — Python subprocesses for PDF text/image extraction

**Frontend** (`doc2kg-frontend/src/`):
- Tab-based progressive workflow: Explorer → Ranges → Editor → Graph
- `App.tsx` — 5-tab layout entry point
- React Query for server state; Socket.io for real-time progress events from async jobs
- Reagraph for graph visualization; CodeMirror for label editing; Fabric.js for canvas (PDF page view)

**Key data flow:**

```
Upload PDF → postDocument handler
  → Python extracts text/images → MinIO storage
  → Ollama generates embedding → Neo4j (:Document) node
  
User labels text in Editor tab
  → PUT /document/{id}/plaintext → MinIO

User triggers graph generation
  → PUT /document/{id}/graph/generate → BullMQ job enqueued
  → graphWorker: text2graphJSON → Ollama embeddings → Neo4j nodes+rels
  → Socket.io progress events → Frontend graph view
```

## Key Conventions

### Route auto-discovery

Handler files in `requestHandlers/{method}/{path}.js` are auto-loaded by `routes.js`. Dollar signs in filenames become Express route parameters: `getDocument$Id.js` → `GET /document/:id`. If a handler's `documentation.body` string contains `"pdf file"`, Multer middleware is automatically attached.

### Labeled text format (for `text2graphJSON`)

```
(:Label {"key": "value"})
Content line one
Content line two

  (:ChildLabel {"key": "value"})
  Child content (indented 2 spaces = child node)
```

- Blocks separated by 2+ blank lines become separate nodes
- First line must be `(:Label {properties})` — standard Cypher-style syntax
- 2-space indentation encodes parent–child hierarchy
- `References` and `Definitions` label types auto-split on newlines into individual child nodes

### Ontology conventions (ONTOLOGY.md)

Taxonomic sub-types are stored as **boolean node properties**, not Neo4j labels:
- e.g. `source_legal: true`, `subject_performance: true`, `phase_construction: true`

This keeps the label space small (`Document`, `Section`, `Requirement`, etc.) while enabling fine-grained Cypher `WHERE` filtering. Always follow this pattern when adding new classification dimensions. Read `ONTOLOGY.md` in full before modifying the graph schema.

### config.json

All service connection details are centralized in `doc2kg-backend/src/config.json`. Docker service hostnames (`neo4j-main`, `minio`, `redis`, `ollama`) are used — not `localhost`. Credentials are dev defaults only.

## Important Files

| File | Purpose |
|------|---------|
| `ONTOLOGY.md` | Full graph schema spec (v2.0) — read before any schema work |
| `AIinstructions.txt` | Additional dev guidance for AI-assisted development |
| `doc2kg-backend/src/text2graph/text2graphJSON.js` | Core parsing logic for labeled text → graph |
| `doc2kg-frontend/UsersGuide.md` | End-user workflow documentation |
