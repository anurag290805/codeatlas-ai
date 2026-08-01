# CodeAtlas AI

CodeAtlas AI is an AI-powered GitHub repository analysis platform for semantic code search, grounded answers, source citations, and dependency-graph exploration.

It combines FastAPI, Tree-sitter, Sentence Transformers, ChromaDB, SQLite, and Ollama to provide a local-first code intelligence workflow without paid AI APIs.

## Features

- Import public GitHub repositories.
- Parse Python, JavaScript, and TypeScript with Tree-sitter.
- Extract classes, functions, methods, interfaces, enums, and arrow functions.
- Generate local Sentence Transformer embeddings.
- Store and search vectors with ChromaDB.
- Ask natural-language questions with retrieval-augmented generation.
- Return file- and line-level citations.
- Build dependency graphs for files, symbols, imports, and relationships.
- Run Ollama externally on the host or another accessible machine.

## Architecture

```text
GitHub Repository
        │
        ▼
Repository Import
        │
        ├──────────────► Dependency Graph
        ▼
Tree-sitter Parser
        │
        ▼
Sentence Transformers
        │
        ▼
      ChromaDB
        │
        ▼
     Retriever
        │
        ▼
      Ollama
        │
        ▼
Grounded Answer + Citations
```

API routes handle HTTP concerns. Core modules implement parsing, embeddings, retrieval, vector storage, LLM access, and graph construction. SQLite stores application metadata, while ChromaDB stores searchable vectors.

## Repository Structure

```text
codeatlas-ai/
├── backend/
│   ├── app/
│   │   ├── api/              # FastAPI routers
│   │   ├── core/             # Parser, embeddings, retrieval, LLM, graph
│   │   ├── db/               # SQLite and CRUD helpers
│   │   ├── models/           # Database and API schemas
│   │   └── main.py           # Application factory and middleware
│   ├── tests/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
├── frontend/                 # Web client
├── docker-compose.yml
└── README.md
```

## Requirements

- Python 3.11
- Git
- Docker and Docker Compose (optional)
- Ollama installed and running outside Docker
- At least 8 GB RAM recommended for local embedding and LLM workloads

## Local Installation

```bash
git clone https://github.com/your-org/codeatlas-ai.git
cd codeatlas-ai
python3.11 -m venv backend/.venv
source backend/.venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt
```

On Windows PowerShell:

```powershell
py -3.11 -m venv backend\.venv
backend\.venv\Scripts\Activate.ps1
```

Install Ollama separately, then start it and pull the configured model:

```bash
ollama serve
ollama pull llama3.2:1b
```

Ollama is intentionally not installed in the CodeAtlas Docker image.

## Configuration

```bash
cp backend/.env.example backend/.env
```

Important variables:

| Variable | Default | Description |
| --- | --- | --- |
| `APP_NAME` | `CodeAtlas AI` | Application name. |
| `DEBUG` | `True` | Development diagnostics. Use `False` in production. |
| `DATABASE_URL` | `sqlite:///./codeatlas.db` | SQLAlchemy database URL. |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server URL. |
| `OLLAMA_MODEL` | `llama3.2:1b` | Generation model. |
| `EMBEDDING_MODEL` | `BAAI/bge-small-en-v1.5` | Local embedding model. |
| `CHROMA_DB_PATH` | `./data/chroma` | ChromaDB persistence path. |
| `LOG_LEVEL` | `INFO` | Application log level. |

Do not commit `.env` files, credentials, databases, vector stores, or model caches.

## Running the Backend

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API is available at `http://localhost:8000`.

## Docker Usage

Build and start the backend from the project root:

```bash
docker compose up --build
```

Run in the background:

```bash
docker compose up -d
```

View logs and stop the service:

```bash
docker compose logs -f backend
docker compose down
```

The Compose setup exposes port `8000`, persists SQLite, ChromaDB, repositories, and logs, mounts `backend/app` for development, connects to host Ollama through `host.docker.internal`, and runs the container as a non-root user.

## API Documentation

When the backend is running:

- Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- OpenAPI schema: [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json)

### System

```text
GET /health
GET /version
```

### Repository

```text
POST   /repositories
GET    /repositories
GET    /repositories/{repository_id}
GET    /repositories/{repository_id}/status
POST   /repositories/{repository_id}/update
POST   /repositories/{repository_id}/reindex
DELETE /repositories/{repository_id}
GET    /repositories/health/check
```

### Query

```text
POST /query
POST /query/stream
POST /repositories/{repository_id}/query
GET  /query/health
```

### Graph

```text
GET /repositories/{repository_id}/graph
GET /repositories/{repository_id}/graph/statistics
GET /repositories/{repository_id}/graph/nodes
GET /repositories/{repository_id}/graph/nodes/{node_id}
GET /repositories/{repository_id}/graph/edges
GET /repositories/{repository_id}/graph/neighbors/{node_id}
GET /repositories/{repository_id}/graph/path
GET /repositories/{repository_id}/graph/health
```

## Project Workflow

1. A user submits a public GitHub repository URL.
2. The repository manager validates and clones it.
3. Tree-sitter discovers semantic code chunks and citation metadata.
4. Sentence Transformers creates local embedding vectors.
5. ChromaDB stores vectors and searchable metadata.
6. The graph builder extracts repository relationships.
7. The retriever embeds a question, searches, filters, deduplicates, reranks, and assembles context.
8. Ollama generates an answer grounded in the retrieved context.
9. The API returns the answer with citations and response metadata.

## Development

Run tests:

```bash
pytest -q
```

Run coverage:

```bash
pytest --cov=backend/app --cov-report=term-missing
```

Tests should isolate Ollama, embedding, vector-store, filesystem, and Git operations with deterministic fixtures or mocks.

## Design Principles

- Local-first AI with no required paid provider.
- Strong separation between HTTP, orchestration, domain, and persistence layers.
- Deterministic citations for trustworthy answers.
- Explicit validation and typed service contracts.
- Lazy model loading for lightweight startup.
- Repository-scoped search to prevent context leakage.
- Graceful partial-failure handling during indexing and retrieval.

## Roadmap

- Add Go, Rust, Java, and C# parsing.
- Improve call-graph and cross-file reference resolution.
- Add incremental indexing using file checksums and Git commits.
- Add background queues for large repositories.
- Add hybrid lexical and semantic retrieval.
- Improve interactive graph visualization.
- Add multi-user workspaces and access controls.
- Add metrics, tracing, and production deployment manifests.

## License

This project is distributed under the license included in [`LICENSE`](LICENSE).
