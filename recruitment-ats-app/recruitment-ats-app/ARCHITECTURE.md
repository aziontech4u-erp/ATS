# AI-Powered ATS — Full-Stack Architecture Design

> **Status**: Architecture specification for the production-grade backend version of the Recruitment ATS.
> The existing React/Vite app implements the **client-side** version of this architecture (no backend yet).
> This document defines the path from prototype → production.

---

## 1. System Architecture Overview

### High-level component diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT (Browser / Mobile)                       │
│                                                                          │
│   ┌─────────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────────┐  │
│   │  Dashboard  │  │  Adv. Search │  │  Parser    │  │  Pipeline    │  │
│   └─────────────┘  └──────────────┘  └────────────┘  └──────────────┘  │
│                                                                          │
│   React 18 + TypeScript + Vite + Tailwind + Lucide icons               │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTPS (REST + optional GraphQL)
                                     │ JWT Bearer tokens
┌────────────────────────────────────▼────────────────────────────────────┐
│                            API GATEWAY                                   │
│                                                                          │
│   • Nginx / Traefik (reverse proxy + TLS termination)                   │
│   • Rate limiting (Redis-backed, 100 req/min per user)                  │
│   • Request logging, CORS, request-id propagation                       │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
              ▼                      ▼                      ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│  CORE API           │  │  PARSER WORKER      │  │  SEARCH WORKER      │
│  FastAPI (Python)   │  │  Celery + Python    │  │  FastAPI + Python   │
│                     │  │                     │  │                     │
│  • CRUD endpoints   │  │  • PDF/DOCX text    │  │  • Boolean parser   │
│  • Auth (JWT/OAuth) │  │    extraction       │  │  • Vector embed     │
│  • RBAC enforcement │  │  • LLM extraction   │  │  • Re-ranking       │
│  • Validation       │  │  • Dedup detection  │  │  • Aggregations     │
│  • Audit logging    │  │  • Skill ontology   │  │                     │
└──────────┬──────────┘  └──────────┬──────────┘  └──────────┬──────────┘
           │                        │                        │
    ┌──────┴────────┬───────────────┴────────────┬───────────┘
    ▼               ▼                            ▼
┌──────────┐  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐
│PostgreSQL│  │ Elasticsearch│  │      Redis       │  │    Object Store  │
│          │  │ / OpenSearch │  │                  │  │   (S3 / MinIO)   │
│ Primary  │  │              │  │ • Session cache  │  │                  │
│ data     │  │ Search index │  │ • Rate limits    │  │ • Original CVs   │
│          │  │ + embeddings │  │ • Job queue      │  │ • Generated PDFs │
└──────────┘  └──────────────┘  └──────────────────┘  └──────────────────┘
                                                              │
                                                              ▼
                                                    ┌──────────────────┐
                                                    │   LLM Provider   │
                                                    │   (Anthropic /   │
                                                    │   OpenAI / local │
                                                    │    Ollama)       │
                                                    └──────────────────┘
```

### Service responsibilities

| Service | Purpose | Tech |
|---|---|---|
| **Frontend** | UI, client-side validation, optimistic updates | React 18, TS, Vite, Tailwind |
| **API Gateway** | Reverse proxy, TLS, rate-limit, log aggregation | Nginx / Traefik |
| **Core API** | CRUD, auth, RBAC, business rules | FastAPI (Python 3.11+) |
| **Parser Worker** | Async resume parsing, LLM calls, dedup | Celery + Python |
| **Search Worker** | Boolean parse, semantic embedding, ranking | FastAPI + sentence-transformers |
| **Postgres** | Source of truth: candidates, jobs, audit logs | PostgreSQL 16 |
| **Elasticsearch** | Full-text search, faceted filters, embeddings | Elasticsearch 8 / OpenSearch 2 |
| **Redis** | Session, rate limit, job queue, caching | Redis 7 |
| **Object Store** | Raw CV files, exports, profile photos | S3 / MinIO |
| **LLM** | Resume extraction, summarization, matching | Anthropic / OpenAI / Ollama |

---

## 2. Database Schema (PostgreSQL)

### 2.1 Core tables

```sql
-- ─── TENANTS & USERS ────────────────────────────────────────────
CREATE TABLE tenants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(200) NOT NULL,
  slug            VARCHAR(60) UNIQUE NOT NULL,
  plan            VARCHAR(30) NOT NULL DEFAULT 'free',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email           CITEXT UNIQUE NOT NULL,
  full_name       VARCHAR(200) NOT NULL,
  password_hash   TEXT,                    -- nullable for OAuth-only users
  role            VARCHAR(30) NOT NULL CHECK (role IN ('admin','hr','recruiter','viewer')),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_tenant ON users(tenant_id);

-- ─── CANDIDATES ─────────────────────────────────────────────────
CREATE TABLE candidates (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Identification (dedup keys)
  email                    CITEXT,
  phone_normalized         VARCHAR(20),     -- digits-only, for dedup
  full_name                VARCHAR(200) NOT NULL,
  date_of_birth            DATE,

  -- Personal info
  gender                   VARCHAR(20),
  nationality              VARCHAR(60),
  marital_status           VARCHAR(20),
  city                     VARCHAR(100),
  country                  VARCHAR(60),
  location                 VARCHAR(200),
  linkedin                 TEXT,
  website                  TEXT,

  -- Professional
  current_title            VARCHAR(200),
  current_title_normalized VARCHAR(200),    -- "Senior Developer" after canonicalization
  total_experience_years   NUMERIC(4,1) DEFAULT 0,
  professional_summary     TEXT,
  expected_salary          VARCHAR(60),
  notice_period            VARCHAR(60),
  visa_status              VARCHAR(60),

  -- AI & scoring
  ai_score                 INT CHECK (ai_score BETWEEN 0 AND 100),
  ai_summary               TEXT,
  ai_strengths             TEXT[],
  ai_concerns              TEXT[],
  recommended_roles        TEXT[],
  embedding                vector(1536),    -- pgvector for semantic search

  -- Pipeline
  stage                    VARCHAR(20) NOT NULL DEFAULT 'applied'
                             CHECK (stage IN ('applied','screening','interview','offer','hired','rejected')),
  source                   VARCHAR(50),
  manual_rating            INT CHECK (manual_rating BETWEEN 0 AND 5),
  notes                    TEXT,
  omanization_eligible     BOOLEAN DEFAULT FALSE,

  -- Linkages
  primary_job_id           UUID REFERENCES jobs(id) ON DELETE SET NULL,

  -- Provenance
  raw_text                 TEXT,
  original_filename        VARCHAR(300),
  resume_file_id           UUID,            -- references files(id)

  -- Versioning
  version                  INT NOT NULL DEFAULT 1,
  is_duplicate_of          UUID REFERENCES candidates(id),  -- soft-merge pointer

  created_by               UUID REFERENCES users(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_candidate_email_per_tenant UNIQUE (tenant_id, email)
);

CREATE INDEX idx_candidates_tenant_stage ON candidates(tenant_id, stage);
CREATE INDEX idx_candidates_phone ON candidates(tenant_id, phone_normalized)
  WHERE phone_normalized IS NOT NULL;
CREATE INDEX idx_candidates_name_trgm ON candidates USING gin (full_name gin_trgm_ops);
CREATE INDEX idx_candidates_embedding ON candidates
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ─── SKILLS, EXPERIENCES, EDUCATION (normalized) ────────────────
CREATE TABLE skills (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name  VARCHAR(100) UNIQUE NOT NULL,
  category        VARCHAR(30) NOT NULL,
  aliases         TEXT[] NOT NULL DEFAULT '{}'  -- e.g. ['react','reactjs','react.js']
);
CREATE INDEX idx_skills_aliases ON skills USING gin (aliases);

CREATE TABLE candidate_skills (
  candidate_id    UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  skill_id        UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  proficiency     INT CHECK (proficiency BETWEEN 1 AND 5),
  years_used      NUMERIC(4,1),
  is_primary      BOOLEAN DEFAULT FALSE,
  source          VARCHAR(20) DEFAULT 'ai_extracted',
  PRIMARY KEY (candidate_id, skill_id)
);

CREATE TABLE work_experiences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id    UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  company         VARCHAR(200) NOT NULL,
  title           VARCHAR(200) NOT NULL,
  location        VARCHAR(200),
  start_date      DATE,
  end_date        DATE,
  is_current      BOOLEAN DEFAULT FALSE,
  responsibilities TEXT[],
  achievements    TEXT[],
  sort_order      INT DEFAULT 0
);

CREATE TABLE educations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id    UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  institution     VARCHAR(300),
  degree          VARCHAR(100),
  field_of_study  VARCHAR(200),
  start_year      INT,
  end_year        INT,
  grade           VARCHAR(40),
  honors          VARCHAR(200)
);

CREATE TABLE certifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id    UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  name            VARCHAR(300) NOT NULL,
  issuer          VARCHAR(200),
  issue_year      INT,
  expiry_year     INT
);

-- ─── JOBS, INTERVIEWS, OFFERS ───────────────────────────────────
CREATE TABLE jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title           VARCHAR(200) NOT NULL,
  department      VARCHAR(100),
  location        VARCHAR(100),
  branch          VARCHAR(50),
  employment_type VARCHAR(20),
  openings        INT DEFAULT 1,
  filled          INT DEFAULT 0,
  salary_min      NUMERIC(12,3),
  salary_max      NUMERIC(12,3),
  currency        VARCHAR(8) DEFAULT 'OMR',
  status          VARCHAR(20) DEFAULT 'draft',
  description     TEXT,
  requirements    TEXT[],
  skills_required UUID[] DEFAULT '{}',          -- references skills(id)
  job_embedding   vector(1536),                 -- pgvector for matching
  posted_date     DATE,
  closing_date    DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_jobs_tenant_status ON jobs(tenant_id, status);

CREATE TABLE interviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id    UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id          UUID REFERENCES jobs(id) ON DELETE SET NULL,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  duration_min    INT DEFAULT 60,
  type            VARCHAR(30),
  status          VARCHAR(20) DEFAULT 'scheduled',
  location        VARCHAR(300),
  meeting_link    TEXT,
  interviewer     VARCHAR(200),
  feedback        TEXT,
  rating          INT CHECK (rating BETWEEN 0 AND 5)
);

CREATE TABLE offers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id    UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id          UUID REFERENCES jobs(id) ON DELETE SET NULL,
  position        VARCHAR(200) NOT NULL,
  salary          NUMERIC(12,3) NOT NULL,
  currency        VARCHAR(8) DEFAULT 'OMR',
  start_date      DATE,
  expiry_date     DATE,
  benefits        TEXT[],
  status          VARCHAR(20) DEFAULT 'draft',
  sent_at         TIMESTAMPTZ,
  responded_at    TIMESTAMPTZ
);

-- ─── FILES ──────────────────────────────────────────────────────
CREATE TABLE files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  candidate_id    UUID REFERENCES candidates(id) ON DELETE CASCADE,
  filename        VARCHAR(300) NOT NULL,
  content_type    VARCHAR(100),
  file_size       BIGINT,
  storage_key     TEXT NOT NULL,             -- S3 object key
  uploaded_by     UUID REFERENCES users(id),
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version         INT DEFAULT 1
);

-- ─── DEDUP & MERGE TRACKING ─────────────────────────────────────
CREATE TABLE duplicate_candidates (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_id         UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  duplicate_id       UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  confidence         NUMERIC(3,2) NOT NULL,
  reasons            TEXT[] NOT NULL,
  status             VARCHAR(20) DEFAULT 'pending'
                       CHECK (status IN ('pending','merged','dismissed','kept_both')),
  resolved_by        UUID REFERENCES users(id),
  resolved_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (primary_id, duplicate_id)
);

-- ─── AUDIT LOG ──────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  user_id         UUID REFERENCES users(id),
  action          VARCHAR(50) NOT NULL,    -- 'candidate.create','candidate.update', etc.
  entity_type     VARCHAR(50) NOT NULL,
  entity_id       UUID,
  changes_json    JSONB,                    -- {before:{}, after:{}}
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_tenant_created ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
```

### 2.2 Extensions required

```sql
CREATE EXTENSION IF NOT EXISTS citext;        -- case-insensitive emails
CREATE EXTENSION IF NOT EXISTS pg_trgm;       -- fuzzy text search
CREATE EXTENSION IF NOT EXISTS vector;        -- pgvector for embeddings
```

---

## 3. REST API Design

### 3.1 Conventions

- **Base URL**: `/api/v1`
- **Auth**: `Authorization: Bearer <JWT>` on every request
- **Pagination**: `?page=1&page_size=50` (max 200)
- **Sorting**: `?sort=ai_score&order=desc`
- **Errors**: RFC 7807 problem details

```json
{
  "type": "/errors/validation",
  "title": "Validation failed",
  "status": 422,
  "detail": "email format invalid",
  "instance": "/api/v1/candidates",
  "errors": { "email": ["must be a valid email address"] }
}
```

### 3.2 Candidate endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/candidates` | List with filters & pagination |
| `POST` | `/candidates` | Create candidate (manual) |
| `GET` | `/candidates/{id}` | Get full profile |
| `PATCH` | `/candidates/{id}` | Partial update |
| `DELETE` | `/candidates/{id}` | Soft delete |
| `POST` | `/candidates/upload` | Upload + parse resume (single) |
| `POST` | `/candidates/bulk-upload` | Upload many resumes (multipart) |
| `POST` | `/candidates/{id}/merge/{other_id}` | Merge duplicate |
| `GET` | `/candidates/{id}/duplicates` | Find duplicates of this candidate |
| `POST` | `/candidates/{id}/summarize` | Trigger AI re-summary |

#### Example: Create candidate

```http
POST /api/v1/candidates HTTP/1.1
Content-Type: application/json
Authorization: Bearer eyJ...

{
  "full_name": "Manu Harsh",
  "email": "manu@example.com",
  "phone": "+91 9306711727",
  "current_title": "Security Consultant",
  "total_experience_years": 5,
  "skills": ["IBM QRadar", "Splunk", "SIEM/SOC"],
  "stage": "applied"
}
```

**Response 201:**
```json
{
  "id": "01HQAB...UUID",
  "full_name": "Manu Harsh",
  "email": "manu@example.com",
  ...,
  "ai_score": null,
  "embedding": null,
  "_links": {
    "self": "/api/v1/candidates/01HQAB...",
    "duplicates": "/api/v1/candidates/01HQAB.../duplicates"
  }
}
```

If `email` already exists, the API returns a `409 Conflict` with a pointer to the existing candidate.

### 3.3 Search endpoint

```http
POST /api/v1/candidates/search
Content-Type: application/json

{
  "query": "python AND (django OR flask) NOT junior",
  "filters": {
    "skills": ["Python", "Django"],
    "skills_semantic": true,
    "nationality": "Indian",
    "experience_min": 3,
    "experience_max": 10,
    "stages": ["applied", "screening"],
    "score_min": 70
  },
  "page": 1,
  "page_size": 50,
  "sort": "relevance"
}
```

**Response 200:**
```json
{
  "total": 142,
  "page": 1,
  "page_size": 50,
  "results": [
    {
      "candidate": {...},
      "relevance_score": 0.92,
      "matched_terms": ["python","django"],
      "matched_skills": ["Django (≈ Python)"],
      "highlights": {
        "current_title": "Senior <em>Python</em> Developer",
        "professional_summary": "...building <em>Django</em> REST APIs..."
      }
    }
  ],
  "facets": {
    "nationality": [{"value":"Indian","count":89},{"value":"Filipino","count":23}],
    "experience_buckets": [{"value":"3-5","count":45},{"value":"5-10","count":76}]
  }
}
```

### 3.4 Jobs, Interviews, Offers

Standard CRUD on `/jobs`, `/interviews`, `/offers` mirroring the candidate pattern.

### 3.5 AI matching endpoint

```http
POST /api/v1/jobs/{job_id}/match-candidates
```

**Response:**
```json
{
  "job_id": "...",
  "matches": [
    {
      "candidate_id": "...",
      "match_percent": 87,
      "matched_skills": ["Python", "AWS", "Docker"],
      "missing_skills": ["Kubernetes", "Terraform"],
      "experience_fit": "exact",
      "explanation": "Strong technical fit with 6 of 8 required skills..."
    }
  ]
}
```

---

## 4. AI Integration Flow

### 4.1 Resume Upload → Stored Candidate

```
┌────────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────┐
│  Client    │      │   API        │      │   Worker     │      │   LLM    │
│            │      │   Gateway    │      │  (Celery)    │      │ Provider │
└─────┬──────┘      └──────┬───────┘      └──────┬───────┘      └────┬─────┘
      │                    │                     │                    │
      │ POST /upload (PDF) │                     │                    │
      ├──────────────────► │                     │                    │
      │                    │                     │                    │
      │                    │ 1. Save file to S3  │                    │
      │                    │ 2. Enqueue job      │                    │
      │                    ├────────────────────►│                    │
      │ 202 Accepted       │                     │                    │
      │ {job_id, status}   │                     │                    │
      │◄──────────────────┤                     │                    │
      │                    │                     │ 3. Pull from queue │
      │                    │                     │                    │
      │                    │                     │ 4. Extract text    │
      │                    │                     │  (pdfminer/mammoth)│
      │                    │                     │                    │
      │                    │                     │ 5. Call LLM        │
      │                    │                     ├───────────────────►│
      │                    │                     │                    │
      │                    │                     │  JSON candidate    │
      │                    │                     │◄───────────────────┤
      │                    │                     │                    │
      │                    │                     │ 6. Generate        │
      │                    │                     │    embeddings      │
      │                    │                     ├───────────────────►│
      │                    │                     │◄───────────────────┤
      │                    │                     │                    │
      │                    │                     │ 7. Run dedup       │
      │                    │                     │ 8. INSERT in PG    │
      │                    │                     │ 9. Index in ES     │
      │                    │                     │ 10. Audit log      │
      │                    │                     │                    │
      │ GET /jobs/{job_id} │                     │                    │
      ├──────────────────► │                     │                    │
      │ {status:"done",    │                     │                    │
      │  candidate_id:...} │                     │                    │
      │◄──────────────────┤                     │                    │
```

### 4.2 LLM prompts

The parser calls the LLM (Claude Haiku 4.5 or GPT-4o-mini) with **two separate prompts**:

**Prompt 1 — Structured extraction** (JSON mode)
```
Extract all information from this resume.
Return ONLY valid JSON matching schema:
{personal: {full_name, email, phone, ...}, work_experience: [...], ...}

Resume:
<<extracted_text>>
```

**Prompt 2 — Summary & insights**
```
Given this resume, produce:
- 3-5 bullet professional summary
- Top 5 strengths
- Top 3 concerns or gaps
- Recommended job titles for this candidate

Resume:
<<extracted_text>>
```

Both prompts are cached by `sha256(extracted_text)` in Redis for 24h to avoid duplicate LLM spend.

### 4.3 Semantic skill matching

Embeddings (`text-embedding-3-small` for OpenAI or local `sentence-transformers/all-MiniLM-L6-v2`) are generated for:
- Each **candidate**: concatenation of title + summary + skills
- Each **job**: title + requirements + skills_required

Stored in `vector(1536)` columns. Matching uses cosine similarity via pgvector:

```sql
SELECT id, full_name, 1 - (embedding <=> $job_embedding) AS similarity
FROM candidates
WHERE tenant_id = $tenant_id
ORDER BY embedding <=> $job_embedding
LIMIT 50;
```

### 4.4 Cost controls

| Strategy | Saving |
|---|---|
| Cache LLM outputs by resume hash | ~70% repeat saves |
| Use Haiku/Mini for extraction, Sonnet/4o only for explanation | ~85% cost reduction |
| Skip re-embedding if candidate text unchanged | ~95% on edits |
| Local Ollama for non-prod & dev environments | 100% on dev |

---

## 5. Deduplication Strategy

```
┌──────────────────────────────────────────────────────────┐
│             NEW CANDIDATE ARRIVES                         │
└──────────────────────┬───────────────────────────────────┘
                       │
            ┌──────────▼──────────┐
            │ Layer 1: Exact email│  ← confidence 1.00
            │ match?              │
            └──────────┬──────────┘
                       │ no
            ┌──────────▼──────────┐
            │ Layer 2: Phone      │  ← confidence 0.95
            │ (digits-only) match?│
            └──────────┬──────────┘
                       │ no
            ┌──────────▼──────────┐
            │ Layer 3: Name + DOB │  ← confidence 0.90
            │ match (fuzzy)?      │
            └──────────┬──────────┘
                       │ no
            ┌──────────▼──────────┐
            │ Layer 4: Fuzzy name │  ← confidence 0.70-0.85
            │ similarity ≥ 0.85?  │
            └──────────┬──────────┘
                       │ no
            ┌──────────▼──────────┐
            │ Layer 5: Embedding  │  ← confidence 0.65-0.85
            │ similarity ≥ 0.92?  │
            └──────────┬──────────┘
                       │
              ┌────────┴────────┐
              ▼                 ▼
       NO DUPLICATE       ADD TO duplicate_candidates
       INSERT new         table with confidence + reasons
                          Notify user for review
```

### Auto-merge rules

When the user confirms a merge:
- **Primary record** (older `created_at`) keeps its ID
- **Per-field rule**: longer/non-empty value wins
- **Arrays** (skills, experience): union with deduplication
- **Stage**: pick the further-along stage
- **AI score**: max of both
- Original duplicate is soft-deleted with `is_duplicate_of = primary_id`

---

## 6. Search Architecture (Elasticsearch)

### 6.1 Index mapping

```json
{
  "mappings": {
    "properties": {
      "tenant_id": { "type": "keyword" },
      "full_name": { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
      "email": { "type": "keyword" },
      "current_title": { "type": "text", "analyzer": "english" },
      "current_title_normalized": { "type": "keyword" },
      "skills": { "type": "keyword" },        // for faceting
      "skills_text": { "type": "text" },       // for full-text query
      "professional_summary": { "type": "text", "analyzer": "english" },
      "nationality": { "type": "keyword" },
      "gender": { "type": "keyword" },
      "experience_years": { "type": "integer" },
      "ai_score": { "type": "integer" },
      "stage": { "type": "keyword" },
      "embedding": {
        "type": "dense_vector",
        "dims": 1536,
        "index": true,
        "similarity": "cosine"
      },
      "work_companies": { "type": "keyword" },
      "education_institutions": { "type": "text" }
    }
  }
}
```

### 6.2 Boolean query → ES translation

Client sends:
```
python AND (django OR flask) NOT junior
```

Server translates to Elasticsearch DSL:
```json
{
  "query": {
    "bool": {
      "filter": [{ "term": { "tenant_id": "..." } }],
      "must": [
        { "multi_match": { "query": "python", "fields": ["skills_text","professional_summary","current_title"] } },
        { "bool": {
            "should": [
              { "multi_match": { "query": "django", "fields": ["skills_text","professional_summary"] } },
              { "multi_match": { "query": "flask", "fields": ["skills_text","professional_summary"] } }
            ],
            "minimum_should_match": 1
        }}
      ],
      "must_not": [
        { "multi_match": { "query": "junior", "fields": ["current_title","professional_summary"] } }
      ]
    }
  },
  "aggs": {
    "by_nationality": { "terms": { "field": "nationality" } },
    "by_experience": { "range": { "field": "experience_years", "ranges": [
      {"to":3},{"from":3,"to":7},{"from":7}
    ]}}
  }
}
```

### 6.3 Hybrid ranking

Final relevance = `0.4 * BM25_score + 0.3 * vector_similarity + 0.2 * ai_score_normalized + 0.1 * recency_decay`

---

## 7. Role-Based Access Control (RBAC)

| Role | Candidates | Jobs | Interviews | Offers | Users | Audit |
|---|---|---|---|---|---|---|
| **Admin** | CRUD | CRUD | CRUD | CRUD | CRUD | Read |
| **HR Manager** | CRUD | CRUD | CRUD | CRUD | Read | Read |
| **Recruiter** | CRUD (own) | Read | CRUD (own) | Create + Read (own) | — | Read (own) |
| **Viewer** | Read | Read | Read | Read | — | — |

Enforcement: FastAPI dependency injection checks user's role + tenant on every request. Row-level security in Postgres via `tenant_id = current_setting('app.current_tenant')`.

---

## 8. Deployment Strategy

### 8.1 Docker Compose (development)

```yaml
version: '3.9'
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: ats
      POSTGRES_PASSWORD: dev
    volumes: ['./data/pg:/var/lib/postgresql/data']
    ports: ['5432:5432']

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.13.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - ES_JAVA_OPTS=-Xms1g -Xmx1g
    ports: ['9200:9200']

  redis:
    image: redis:7-alpine
    ports: ['6379:6379']

  minio:
    image: minio/minio
    command: server /data --console-address ':9001'
    environment:
      MINIO_ROOT_USER: minio
      MINIO_ROOT_PASSWORD: minio123
    ports: ['9000:9000', '9001:9001']

  api:
    build: ./api
    depends_on: [postgres, redis, elasticsearch, minio]
    environment:
      DATABASE_URL: postgresql://postgres:dev@postgres:5432/ats
      REDIS_URL: redis://redis:6379
      ES_URL: http://elasticsearch:9200
      S3_ENDPOINT: http://minio:9000
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    ports: ['8000:8000']

  worker:
    build: ./api
    command: celery -A app.worker worker --loglevel=info
    depends_on: [api, redis]

  frontend:
    build: ./frontend
    ports: ['5173:5173']
```

### 8.2 Production deployment (cloud-ready)

```
                      ┌──────────────┐
                      │ CloudFlare   │ ← TLS, DDoS, WAF
                      └──────┬───────┘
                             │
              ┌──────────────▼────────────────┐
              │   Kubernetes (EKS/GKE/AKS)    │
              │                                │
              │  ┌──────┐ ┌──────┐ ┌──────┐  │
              │  │ API  │ │Worker│ │Front │  │ ← Auto-scaled
              │  │ x3-N │ │ x2-N │ │ x2-N │  │   pods
              │  └──┬───┘ └──┬───┘ └──────┘  │
              └─────┼────────┼────────────────┘
                    │        │
       ┌────────────┼────────┴───────────┐
       ▼            ▼                    ▼
  ┌─────────┐ ┌──────────┐  ┌──────────────┐
  │   RDS   │ │Opensearch│  │ ElastiCache  │
  │postgres │ │  AWS ES  │  │    Redis     │
  └─────────┘ └──────────┘  └──────────────┘
                                  │
                                  ▼
                            ┌──────────┐
                            │    S3    │
                            └──────────┘
```

| Layer | Production choice |
|---|---|
| Compute | EKS / GKE with cluster autoscaling |
| Database | RDS Postgres 16 (multi-AZ, daily snapshots) |
| Search | Amazon OpenSearch Service (3 nodes) |
| Cache | ElastiCache Redis (cluster mode) |
| Storage | S3 with lifecycle: hot 30d → IA → Glacier 1y |
| LLM | Anthropic API (prod) + Ollama (dev/staging) |
| Monitoring | Datadog / Grafana Cloud + Sentry |
| CI/CD | GitHub Actions → ArgoCD |
| Secrets | AWS Secrets Manager |

### 8.3 Scaling targets

- 10,000 candidates → no special config (default Postgres + 1 ES node)
- 100,000 candidates → ES sharded 3 ways, Postgres read replicas
- 1,000,000+ candidates → partitioned `candidates` table by tenant, dedicated ES cluster

---

## 9. Data Quality & Governance

### 9.1 Validation rules

| Field | Rule |
|---|---|
| `email` | RFC 5322 + DNS MX check (async) |
| `phone` | E.164 normalization via `phonenumbers` library |
| `date_of_birth` | Must be 18+ years before today |
| `nationality` | ISO 3166-1 country code lookup |
| `salary_min/max` | min ≤ max, both ≥ 0 |
| `stage` transitions | Enforced state machine (no skipping interview → hired) |

### 9.2 Audit log captures

```json
{
  "action": "candidate.update",
  "entity_id": "01HQAB...",
  "user_id": "01HQU...",
  "changes": {
    "stage": { "before": "screening", "after": "interview" },
    "ai_score": { "before": null, "after": 87 }
  },
  "ip_address": "203.0.113.42",
  "created_at": "2026-06-03T14:32:01Z"
}
```

Retention: 7 years for compliance, archived to S3 Glacier after 90 days.

---

## 10. Localization (Oman / GCC)

| Feature | Implementation |
|---|---|
| Nationality filters | Pre-seeded list (Indian, Pakistani, Filipino, Bangladeshi, Egyptian, Omani, Sri Lankan, Nepalese) |
| Visa status | Enum: `resident`, `sponsored`, `free_visa`, `tourist`, `none` |
| Omanization scoring | Auto-flag if `nationality == 'Omani'`, eligibility scoring per job |
| Currency | OMR default, 3 decimal places, configurable per tenant |
| Date format | DD-MMM-YYYY (en-GB) |
| Branches | Muscat HQ + Sohar, Salalah, Nizwa, Sur |
| RTL support | Arabic UI (future), bilingual labels in offer letters |

---

## 11. Optional / Future Enhancements

### 11.1 WhatsApp integration

Send candidate messages via WhatsApp Business API:
```
POST /api/v1/candidates/{id}/whatsapp
{ "template": "interview_invitation", "params": { "date": "...", "time": "..." } }
```

### 11.2 Email parsing automation

- Forward CV emails to `careers@yourcompany.com`
- IMAP listener (Gmail/Outlook) pulls new messages
- Attachments → parser worker → candidates table
- Subject line tags map to job (`[REQ-1234] CV - John Doe` → job_id 1234)

### 11.3 Resume version tracking

When a candidate sends an updated CV, store as new `files` row with `version+1`. Diff view in UI highlights what changed (new role, new skills).

### 11.4 Bulk operations

- **Bulk CV upload**: `/api/v1/candidates/bulk-upload` accepts up to 100 files; returns job_id; client polls for completion
- **Bulk stage move**: drag a multi-select in pipeline view
- **Bulk export**: 10k candidates → background job → email link to S3-signed URL

---

## 12. Migration Path from Current App

The existing React/Vite app already implements:
- ✅ Resume parsing (client-side + AI fallback)
- ✅ Boolean + semantic search (client-side, in-memory)
- ✅ Duplicate detection (4 layers)
- ✅ Skill ontology
- ✅ CRUD for candidates/jobs/interviews/offers
- ✅ Bulk upload with dedup
- ✅ Excel/PDF/CSV export

**To upgrade to full-stack:**

1. **Stage 1 — API parity** (2–3 weeks): Build FastAPI with same data shapes, swap localStorage calls for `fetch('/api/v1/...')`
2. **Stage 2 — Search infrastructure** (1 week): Add Elasticsearch + sync trigger from Postgres → ES on candidate write
3. **Stage 3 — Worker queue** (1 week): Move parsing to Celery; client gets `job_id`, polls
4. **Stage 4 — Auth & RBAC** (1 week): JWT + role enforcement
5. **Stage 5 — Production deployment** (1 week): Docker compose → K8s

Total: **~6–8 weeks** for one engineer.

---

## Appendix A: Sample LLM JSON Schema

```typescript
interface LLMExtractionOutput {
  personal: {
    full_name: string;
    email: string;
    phone: string;
    date_of_birth?: string;       // YYYY-MM-DD
    nationality?: string;
    location?: string;
  };
  professional_summary: string;
  current_title: string;
  total_experience_years: number;
  skills: {
    technical: string[];
    tools: string[];
    soft: string[];
    languages: string[];
  };
  work_experience: Array<{
    company: string;
    title: string;
    start_date: string;
    end_date?: string;
    is_current: boolean;
    responsibilities: string[];
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field: string;
    start_year: number;
    end_year: number;
  }>;
  certifications: Array<{
    name: string;
    issuer: string;
    year: number;
  }>;
  ai_score: number;               // 0–100
  ai_strengths: string[];
  ai_concerns: string[];
  recommended_roles: string[];
}
```

---

## Appendix B: Tech-stack rationale

| Choice | Why |
|---|---|
| **FastAPI** over Django/Flask | Best async perf, native pydantic validation, OpenAPI auto-docs |
| **PostgreSQL** over MySQL/Mongo | ACID, JSONB flexibility, pgvector for embeddings, mature ecosystem |
| **Elasticsearch** over Postgres FTS | Faceting, fuzzy match, hybrid vector search, scale |
| **Celery + Redis** over RQ/Dramatiq | Mature, retry semantics, monitoring (Flower) |
| **Claude Haiku + GPT-4o-mini** | Cost-efficient for high-volume extraction, swap to Sonnet for accuracy-critical |
| **React + Vite** over Next.js | App is a dashboard (no SEO needed); Vite dev experience is unmatched |

---

**End of architecture specification.**
