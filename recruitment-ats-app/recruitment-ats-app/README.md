# Recruitment (ATS) — AI-Powered Hiring Platform

A standalone Applicant Tracking System (ATS) with an AI-powered resume parser at its core. Drop any PDF, DOCX, or TXT resume — the app automatically extracts structured candidate data (personal info, work experience, education, skills, certifications) and computes an AI match score.

Built specifically for Oman / GCC construction-sector recruitment with Omanization tracking, OMR currency, and local branch support.

---

## ✨ Features

### 📄 AI Resume Parser (Core Feature)
- **Drag-and-drop upload** for PDF, DOCX, DOC, and TXT files
- **Animated processing pipeline** with 8 visible stages (text extraction → AI parsing → score computation → save)
- **Dual AI provider support** — works with both Anthropic Claude (`claude-haiku-4-5-20251001`) and OpenAI (`gpt-4o-mini`)
- **Regex fallback** when no API key is configured (limited accuracy but still functional)
- **Editable candidate profile** with 6 tabs: Personal, Experience, Education, Skills, AI Insights, Raw Text
- **Inline field editing** — click any field to edit, persists to localStorage
- **AI match score** (0-100) with strengths, concerns, and recommended roles

### 🎯 Full ATS Modules
- **Dashboard** — KPIs, pipeline distribution, top candidates by AI score, upcoming interviews
- **Candidates** — searchable table with stage/score filters, CSV/JSON export
- **Jobs** — create/edit job postings with salary ranges (OMR/USD/EUR/AED), branch selection, status workflow
- **Pipeline** — 6-column Kanban board (Applied → Screening → Interview → Offer → Hired / Rejected) with drag-and-drop
- **Interviews** — schedule with 6 interview types (phone, video, technical, panel, final, cultural), meeting link integration
- **Offers** — create offer letters with auto-populated candidate data, HTML preview window opens in new tab (printable)
- **Reports** — hiring funnel, AI score buckets, top 10 skills, nationality breakdown, Omanization rate, conversion metrics

### 🔒 Privacy & Storage
- **100% client-side** — all data stays in your browser's localStorage
- API keys are stored locally and only transmitted directly to your chosen AI provider
- No backend, no tracking, works offline after first load

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm

### Install & Run
```bash
npm install
npm run dev
```

The app will start on **http://localhost:5174**

### Build for Production
```bash
npm run build
npm run preview
```

The production build output is in `dist/` — host it on any static file server (Netlify, Vercel, S3, nginx, etc.).

---

## 🔑 Configuring AI

The resume parser works without an API key (using regex fallback) but produces vastly better results with one configured.

1. Click **Settings** (bottom left)
2. Paste an API key:
   - **Anthropic**: `sk-ant-...` ([get one here](https://console.anthropic.com/))
   - **OpenAI**: `sk-...` ([get one here](https://platform.openai.com/api-keys))
3. Click **Save API Key**

The app tries Anthropic first, then falls back to OpenAI if that fails.

> **Security note**: Your API key is stored in browser localStorage only. It is never sent to any server other than the AI provider you chose. Anthropic's API requires the `anthropic-dangerous-direct-browser-access` header for direct browser calls.

---

## 📁 Project Structure

```
recruitment-ats-app/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.tsx              # React entry point
    ├── App.tsx               # Main state + routing
    ├── index.css             # Tailwind + animations
    ├── lib/
    │   ├── types.ts          # TypeScript types
    │   ├── resumeParser.ts   # PDF/DOCX reading + AI extraction
    │   ├── storage.ts        # localStorage persistence
    │   └── utils.ts          # Helpers (colors, formatting)
    └── components/
        ├── Sidebar.tsx
        ├── Dashboard.tsx
        ├── ResumeParserView.tsx   # ★ Core feature
        ├── CandidatesView.tsx
        ├── JobsView.tsx
        ├── PipelineView.tsx
        ├── InterviewsView.tsx
        ├── OffersView.tsx
        ├── ReportsView.tsx
        ├── SettingsModal.tsx
        └── Toast.tsx
```

---

## 💡 Usage Tips

### First-time workflow
1. **Add an AI key** → Settings → paste key → Save
2. **Create a job posting** → Jobs → New Job → fill in details → Save
3. **Parse resumes** → Resume Parser → drop files → wait for AI extraction
4. **Link candidates to jobs** → in the parser profile header, select a job from the dropdown
5. **Move through pipeline** → Pipeline → drag cards between stages
6. **Schedule interviews** → Interviews → New Interview → select candidate + datetime
7. **Send offers** → Offers → New Offer → auto-populates from candidate data → Preview Letter

### Bulk operations
- **Export all candidates** as JSON from the parser sidebar
- **Export filtered candidates** as CSV from the Candidates view (respects active filters)

### Data backup
Since all data lives in localStorage, periodically export your candidates as JSON to back them up. To restore, you'd need to programmatically re-import (or just keep multiple browser profiles).

### Clear all data
Settings → Danger Zone → Clear All Data (requires confirmation, irreversible)

---

## 🧪 Tech Stack

- **React 18** + **TypeScript** (strict mode)
- **Vite 5** for build tooling
- **Tailwind CSS 3** for styling (DM Sans font, custom brand color `#2756e8`)
- **lucide-react** for icons
- **pdfjs-dist 3.11** for PDF text extraction (worker loaded from CDN)
- **mammoth** for DOCX text extraction
- **localStorage** for persistence (versioned with `recruitment_ats_v1` key)

---

## 🌍 Localization

The app is preconfigured for **Oman / GCC** recruitment:
- Default currency: **OMR** (3 decimal places)
- Branch options: HQ (Muscat), Sohar, Salalah, Nizwa, Sur
- Date format: `DD-MMM-YYYY` (en-GB)
- Omanization eligibility detection (Omani / GCC nationals get flagged)

To adapt for another region, edit:
- `src/components/JobsView.tsx` — branch list, currency
- `src/lib/utils.ts` — `formatCurrency` decimal places
- `src/lib/resumeParser.ts` — nationality detection keywords (regex fallback)

---

## 📝 License

This is a private project. Customize freely for your organization's needs.

---

## 🤝 Support

For issues, customizations, or feature requests, get in touch with the development team.
