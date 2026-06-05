// ─────────────────────────────────────────────────────────────
// RESUME PARSER ENGINE
// Handles PDF/DOCX/TXT extraction + AI-powered structured parsing
//
// pdf.js and mammoth are loaded LAZILY (from CDN for pdf.js, dynamic
// import for mammoth) so they don't block initial app render. This
// avoids CJS-interop crashes from `pdfjs-dist` blowing up the whole
// app on module load.
// ─────────────────────────────────────────────────────────────

import type { ParsedResume, Certification, WorkExperience, Education } from './types';

// ─── LAZY LOADERS ────────────────────────────────────────────

// Tell TS about the global injected by pdf.js's UMD bundle
declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

const PDFJS_VERSION = '3.11.174';
const PDFJS_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

let pdfjsPromise: Promise<any> | null = null;

function loadPdfJs(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('pdf.js needs window'));
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfjsPromise) return pdfjsPromise;

  pdfjsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${PDFJS_BASE}/pdf.min.js`;
    script.onload = () => {
      const lib = window.pdfjsLib;
      if (lib && lib.GlobalWorkerOptions) {
        lib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.js`;
        resolve(lib);
      } else {
        reject(new Error('pdf.js loaded but missing GlobalWorkerOptions'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load pdf.js from CDN'));
    document.head.appendChild(script);
  });
  return pdfjsPromise;
}

async function loadMammoth(): Promise<any> {
  // mammoth's ESM/CJS interop in Vite resolves through `.default`
  const mod: any = await import('mammoth');
  return mod.default ?? mod;
}

// ─── FILE READING ────────────────────────────────────────────

export async function readFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return readPDF(file);
  if (ext === 'doc' || ext === 'docx') return readDOCX(file);
  return readTXT(file);
}

async function readPDF(file: File): Promise<string> {
  let pdfjsLib: any;
  try {
    pdfjsLib = await loadPdfJs();
  } catch (err) {
    console.warn('pdf.js unavailable, using byte-extraction fallback', err);
    return readPDFFallback(file);
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          let lastY = -999;
          let line = '';
          for (const item of content.items as any[]) {
            if (Math.abs(item.transform[5] - lastY) > 3) {
              fullText += line + '\n';
              line = '';
            }
            line += (line ? ' ' : '') + item.str;
            lastY = item.transform[5];
          }
          if (line) fullText += line + '\n';
        }
        resolve(fullText.trim());
      } catch (err) {
        console.warn('PDF read failed', err);
        resolve('');
      }
    };
    reader.onerror = () => resolve('');
    reader.readAsArrayBuffer(file);
  });
}

// Naïve byte-level PDF text extraction (used if CDN load fails)
async function readPDFFallback(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const arr = new Uint8Array(e.target!.result as ArrayBuffer);
        let text = '';
        for (let i = 0; i < arr.length; i++) {
          if (arr[i] >= 32 && arr[i] < 127) text += String.fromCharCode(arr[i]);
          else if (arr[i] === 10 || arr[i] === 13) text += '\n';
        }
        resolve(text.replace(/\s{4,}/g, '\n').trim());
      } catch {
        resolve('');
      }
    };
    reader.onerror = () => resolve('');
    reader.readAsArrayBuffer(file);
  });
}

async function readDOCX(file: File): Promise<string> {
  let mammoth: any;
  try {
    mammoth = await loadMammoth();
  } catch (err) {
    console.warn('mammoth unavailable', err);
    return '';
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const result = await mammoth.extractRawText({
          arrayBuffer: e.target!.result as ArrayBuffer
        });
        resolve(result.value || '');
      } catch (err) {
        console.warn('DOCX read failed', err);
        resolve('');
      }
    };
    reader.onerror = () => resolve('');
    reader.readAsArrayBuffer(file);
  });
}

async function readTXT(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target!.result as string) || '');
    reader.onerror = () => resolve('');
    reader.readAsText(file);
  });
}

// ─── AI EXTRACTION ───────────────────────────────────────────

const EXTRACTION_PROMPT = (text: string) => `Extract ALL information from this resume/CV. Return ONLY valid JSON, no markdown, no explanation.

{
  "personal":{"full_name":"","email":"","phone":"","location":"","city":"","country":"","linkedin":"","website":"","nationality":"","gender":"","date_of_birth":"","marital_status":""},
  "professional_summary":"","current_title":"","total_experience_years":0,
  "skills":{"technical":[],"soft":[],"languages":[],"tools":[],"certifications":[]},
  "work_experience":[{"company":"","title":"","start_date":"","end_date":"","duration":"","location":"","current":false,"responsibilities":[],"achievements":[]}],
  "education":[{"institution":"","degree":"","field":"","start_year":"","end_year":"","grade":"","honors":""}],
  "certifications":[{"name":"","issuer":"","year":"","expiry":""}],
  "projects":[{"name":"","description":"","tech_used":[],"url":""}],
  "awards":[],"publications":[],"volunteer":[],
  "visa_status":"","notice_period":"","expected_salary":"",
  "ai_score":0,"ai_strengths":[],"ai_concerns":[],"recommended_roles":[],"omanization_eligible":false
}
Rules: ai_score=0-100 (completeness+depth+relevance). omanization_eligible=true if Omani/GCC national. Extract every responsibility and achievement. Use "" or [] for missing fields.
Resume: ${text.slice(0, 7500)}`;

export async function parseResume(
  text: string,
  filename: string,
  apiKey: string
): Promise<ParsedResume> {
  // Try AI extraction first if key provided
  if (apiKey && text.length > 60) {
    try {
      let raw: string | null = null;

      // Try Anthropic first
      try {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 4000,
            messages: [{ role: 'user', content: EXTRACTION_PROMPT(text) }]
          })
        });
        const d = await r.json();
        raw = d.content?.[0]?.text || null;
      } catch (err) {
        console.warn('Anthropic call failed', err);
      }

      // Fall back to OpenAI
      if (!raw) {
        try {
          const r = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + apiKey
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              max_tokens: 3500,
              messages: [{ role: 'user', content: EXTRACTION_PROMPT(text) }]
            })
          });
          const d = await r.json();
          raw = d.choices?.[0]?.message?.content || null;
        } catch (err) {
          console.warn('OpenAI call failed', err);
        }
      }

      if (raw) {
        const clean = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const parsed = JSON.parse(clean) as ParsedResume;
        return normalizeParsed(parsed);
      }
    } catch (err) {
      console.warn('AI extraction failed, using regex fallback', err);
    }
  }

  return regexFallback(text, filename);
}

function normalizeParsed(p: any): ParsedResume {
  return {
    personal: {
      full_name: p.personal?.full_name || '',
      email: p.personal?.email || '',
      phone: p.personal?.phone || '',
      location: p.personal?.location || '',
      city: p.personal?.city || '',
      country: p.personal?.country || '',
      linkedin: p.personal?.linkedin || '',
      website: p.personal?.website || '',
      nationality: p.personal?.nationality || '',
      gender: p.personal?.gender || '',
      date_of_birth: p.personal?.date_of_birth || '',
      marital_status: p.personal?.marital_status || ''
    },
    professional_summary: p.professional_summary || '',
    current_title: p.current_title || '',
    total_experience_years: Number(p.total_experience_years) || 0,
    skills: {
      technical: Array.isArray(p.skills?.technical) ? p.skills.technical : [],
      soft: Array.isArray(p.skills?.soft) ? p.skills.soft : [],
      languages: Array.isArray(p.skills?.languages) ? p.skills.languages : [],
      tools: Array.isArray(p.skills?.tools) ? p.skills.tools : [],
      certifications: Array.isArray(p.skills?.certifications) ? p.skills.certifications : []
    },
    work_experience: Array.isArray(p.work_experience) ? p.work_experience : [],
    education: Array.isArray(p.education) ? p.education : [],
    certifications: Array.isArray(p.certifications) ? p.certifications : [],
    projects: Array.isArray(p.projects) ? p.projects : [],
    awards: Array.isArray(p.awards) ? p.awards : [],
    publications: Array.isArray(p.publications) ? p.publications : [],
    volunteer: Array.isArray(p.volunteer) ? p.volunteer : [],
    visa_status: p.visa_status || '',
    notice_period: p.notice_period || '',
    expected_salary: p.expected_salary || '',
    ai_score: Math.max(0, Math.min(100, Number(p.ai_score) || 60)),
    ai_strengths: Array.isArray(p.ai_strengths) ? p.ai_strengths : [],
    ai_concerns: Array.isArray(p.ai_concerns) ? p.ai_concerns : [],
    recommended_roles: Array.isArray(p.recommended_roles) ? p.recommended_roles : [],
    omanization_eligible: Boolean(p.omanization_eligible)
  };
}

// ─── REGEX FALLBACK (when no API key) ───────────────────────
// Section-aware parser. Walks the CV by detecting headers like
// "Skills", "Experience", "Education", "Certifications", "Summary"
// and extracts items under each. Then a second pass cleans line
// fragments and groups multi-line work-experience entries.

const SECTION_PATTERNS = {
  summary: /^(profile|summary|professional\s*summary|objective|about\s*me|career\s*objective)\s*:?$/i,
  experience: /^(professional\s*experience|work\s*experience|employment\s*history|experience|career\s*history|work\s*history)\s*:?$/i,
  education: /^(education|academic\s*qualifications?|qualifications?|academics)\s*:?$/i,
  skills: /^(skills|technical\s*skills|skills\s*\/\s*competencies|competencies|core\s*competencies|technical\s*competencies|key\s*skills)\s*:?$/i,
  certifications: /^(certifications?|certificates|professional\s*certifications)\s*:?$/i,
  languages: /^(languages?|language\s*proficiency)\s*:?$/i,
  projects: /^(projects?|key\s*projects|notable\s*projects)\s*:?$/i,
  awards: /^(awards|honors?|achievements|recognition)\s*:?$/i,
  personal: /^(personal\s*info|personal\s*information|personal\s*details|contact|contact\s*info)\s*:?$/i
};

interface Sections {
  [key: string]: string[];
}

function splitIntoSections(lines: string[]): Sections {
  const sections: Sections = {
    header: [], summary: [], experience: [], education: [],
    skills: [], certifications: [], languages: [], projects: [],
    awards: [], personal: []
  };
  let current = 'header';
  for (const raw of lines) {
    const line = raw.replace(/\s{2,}/g, ' ').trim();
    if (!line) continue;
    let matched = false;
    for (const [key, pattern] of Object.entries(SECTION_PATTERNS)) {
      if (pattern.test(line)) {
        current = key;
        matched = true;
        break;
      }
    }
    if (!matched) {
      sections[current].push(line);
    }
  }
  return sections;
}

function regexFallback(text: string, filename: string): ParsedResume {
  // Pre-clean PDF extraction artifacts (collapses "I B M" → "IBM", "Hello   World" → "Hello World")
  const cleaned = text
    // Strip PDF bullet symbols (●▪◦►▶ and the common \uf0b7 PDF bullet character)
    .replace(/[\u2022\u25AA\u25E6\u25BA\u25B6\u2605\uf0b7▪◦►▶★]/g, ' ')
    .replace(/(\w)\s{2,3}(\w)/g, (_m, a, b) => a + ' ' + b)
    .replace(/\b([A-Z])\s+([A-Z])\s+([A-Z])\b/g, '$1$2$3') // "I B M" → "IBM"
    .replace(/\s+,/g, ',') // " ," → ","
    .replace(/  +/g, ' '); // collapse multiple spaces

  const lines = cleaned.split('\n').map((l) => l.trim()).filter(Boolean);
  const tl = cleaned.toLowerCase();

  // ─── CONTACT INFO ───
  const emailMatch = cleaned.match(/[\w.+\-]+\s*\.?\s*@\s*[\w\-]+\s*\.\s*[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0].replace(/\s+/g, '').replace(/^\.+/, '').replace(/^[\w.+\-]*\./, (m) => m.replace(/^\./, '')) : '';
  const cleanEmail = email.replace(/^\./, '').replace(/[^\w.+\-@]/g, '');
  // Better phone pattern: at least 7 digits, may include +, spaces, dashes, parens
  const phoneMatch = cleaned.match(/[\+]?[\d][\d\s\-().]{6,18}\d/);
  const liMatch = cleaned.match(/linkedin\.com\/in\/[\w\-]+/i);
  const webMatch = cleaned.match(/https?:\/\/(?!www\.linkedin)[\w.\-]+\.\w{2,}[^\s]*/);
  const dobMatch = cleaned.match(/\b(\d{2}[-/]\d{2}[-/]\d{4})\b/);

  // ─── NAME ─── (multi-strategy extraction)
  // Reject patterns that aren't names: section headers, all-caps words, filenames, common roles
  const NAME_REJECT = /\b(work|experience|education|skills?|profile|summary|objective|certifications?|projects?|languages?|references?|hobbies|interests|career|professional|personal|info|details|contact|achievements|awards|publications|volunteer|address|phone|email|linkedin|born|dob|date|of|birth|nationality|gender|marital|status|resume|cv|curriculum|vitae|ibm|guardium|gaurdium|tcs|infosys|wipro|accenture)\b/i;

  const looksLikeName = (s: string): boolean => {
    const candidate = s.replace(/\s{2,}/g, ' ').trim();
    if (!candidate) return false;
    // Length and word count
    if (candidate.length < 4 || candidate.length > 40) return false;
    const words = candidate.split(/\s+/);
    if (words.length < 2 || words.length > 4) return false;
    // Each word should start with a capital and contain mostly letters (allow apostrophe/hyphen)
    if (!words.every((w) => /^[A-Z][a-zA-Z'\-]{1,20}$/.test(w))) return false;
    // Reject if it contains digits, brackets, or punctuation other than . - '
    if (/[@\d()[\]{}|/\\#$%^&*=+]/.test(candidate)) return false;
    // Reject if it contains forbidden words anywhere
    if (NAME_REJECT.test(candidate)) return false;
    // Reject if any word is in ALL CAPS and 4+ letters (e.g. "WORK EXPERIENCE")
    if (words.some((w) => w === w.toUpperCase() && w.length >= 4)) return false;
    return true;
  };

  let name = '';

  // Strategy 1: First 8 lines, look for a clean name
  for (const l of lines.slice(0, 8)) {
    if (looksLikeName(l)) {
      name = l.replace(/\s{2,}/g, ' ').trim();
      break;
    }
  }

  // Strategy 2: Look just above/around the email line — names usually sit right next to contact info
  if (!name && cleanEmail) {
    const emailLineIdx = lines.findIndex((l) => l.toLowerCase().includes(cleanEmail.toLowerCase().split('@')[0].slice(0, 8)));
    if (emailLineIdx > 0) {
      for (let i = Math.max(0, emailLineIdx - 4); i < emailLineIdx; i++) {
        if (looksLikeName(lines[i])) {
          name = lines[i].replace(/\s{2,}/g, ' ').trim();
          break;
        }
      }
    }
  }

  // Strategy 3: Derive from email local-part (e.g. "manu.jishu@gmail.com" → "Manu Jishu")
  if (!name && cleanEmail) {
    const localPart = cleanEmail.split('@')[0];
    const parts = localPart
      .split(/[._\-]/)
      .filter((p) => p.length >= 2 && /^[a-zA-Z]+$/.test(p))
      .slice(0, 3);
    if (parts.length >= 2) {
      const candidate = parts.map((p) => p[0].toUpperCase() + p.slice(1).toLowerCase()).join(' ');
      if (looksLikeName(candidate)) name = candidate;
    }
  }

  // Strategy 4: Derive from filename
  if (!name) {
    const fromFile = filename
      .replace(/\.(pdf|doc|docx|txt|rtf)$/i, '')
      .replace(/\[[^\]]*\]/g, ' ') // strip [7y 0m] markers
      .replace(/[_\-]+/g, ' ')
      .replace(/\b(resume|cv|curriculum|vitae|ibm|guardium|gaurdium|profile)\b/gi, ' ')
      .replace(/\d+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    // Try to find a name-shaped substring inside the cleaned filename
    const fileWords = fromFile.split(' ').filter(Boolean);
    for (let len = Math.min(3, fileWords.length); len >= 2; len--) {
      for (let i = 0; i <= fileWords.length - len; i++) {
        const cand = fileWords
          .slice(i, i + len)
          .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
        if (looksLikeName(cand)) {
          name = cand;
          break;
        }
      }
      if (name) break;
    }
    if (!name) name = fromFile || 'Unknown';
  }

  // ─── SECTIONS ───
  const sections = splitIntoSections(lines);

  // ─── TITLE ─── (line near the top after name, OR right after name in header)
  let title = '';
  const headerLines = sections.header;
  const titleKw = [
    'engineer', 'developer', 'manager', 'analyst', 'designer', 'officer',
    'director', 'specialist', 'consultant', 'lead', 'coordinator', 'executive',
    'administrator', 'architect', 'scientist', 'supervisor', 'technician'
  ];
  for (const l of headerLines.slice(0, 6)) {
    if (
      l !== name &&
      titleKw.some((t) => l.toLowerCase().includes(t)) &&
      l.length < 60 &&
      !/@|\d{4}|http/i.test(l)
    ) {
      title = l;
      break;
    }
  }

  // ─── SUMMARY ─── (take the actual summary section, or the long objective paragraph)
  let summary = sections.summary.join(' ').trim();
  if (!summary) {
    // Fallback: scan ALL sections for the longest paragraph that looks like an objective
    const candidates: string[] = [];
    for (const sectionLines of Object.values(sections)) {
      for (const l of sectionLines) {
        if (
          l.length > 100 &&
          /\b(seeking|experience|professional|skilled|passionate|i am|looking for|cyber security|my core|opportunit)\b/i.test(l)
        ) {
          candidates.push(l);
        }
      }
    }
    // Also stitch consecutive lines from header/languages sections (since objectives often have no header)
    for (const sectionKey of ['header', 'languages', 'personal']) {
      const sectionLines = sections[sectionKey] || [];
      let buffer = '';
      for (const l of sectionLines) {
        if (l.length > 60) buffer += (buffer ? ' ' : '') + l;
        else if (buffer && l.length > 20) buffer += ' ' + l;
      }
      if (buffer.length > 150 && /\b(seeking|experience|professional|skilled|passionate|i am|looking for|cyber|opportunit)\b/i.test(buffer)) {
        candidates.push(buffer);
      }
    }
    // Pick the longest candidate
    summary = candidates.sort((a, b) => b.length - a.length)[0] || '';
  }
  // Cap summary at 600 chars
  if (summary.length > 600) summary = summary.slice(0, 600) + '...';

  // ─── SKILLS / TOOLS / CERTS (section-driven) ───
  const skillLines = sections.skills;

  // Skills section often has lines like "SIEM/SOC: IBM QRadar, Dnife, Splunk"
  // Extract items after colon, comma-split, semicolon-split, slash-split
  const extractItemsFromLine = (line: string): string[] => {
    let body = line;
    // Strip leading bullets/dashes
    body = body.replace(/^[\s•▪◦►▶★*\-–—·]+/, '').trim();
    // Take everything after ":" if present
    const colonIdx = body.indexOf(':');
    if (colonIdx > -1 && colonIdx < 30) body = body.slice(colonIdx + 1);
    return body
      .split(/[,;|]|\s\/\s|\s-\s/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2 && s.length < 60 && !/^(and|or|etc|the)$/i.test(s));
  };

  const skillsRaw: string[] = [];
  for (const line of skillLines) {
    skillsRaw.push(...extractItemsFromLine(line));
  }
  // Dedupe (case-insensitive)
  const dedupe = (arr: string[]): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of arr) {
      const k = item.toLowerCase().trim();
      if (k && !seen.has(k)) {
        seen.add(k);
        out.push(item.trim());
      }
    }
    return out;
  };
  const allSkills = dedupe(skillsRaw);

  // Bucket skills into technical / tools / soft
  const SOFT_KEYWORDS = [
    'leadership', 'management', 'communication', 'teamwork', 'collaboration',
    'analytical', 'creative', 'agile', 'scrum', 'problem solving', 'problem-solving',
    'time management', 'presentation', 'negotiation', 'mentoring', 'critical thinking',
    'decision making', 'adaptability', 'interpersonal'
  ];
  const TOOL_KEYWORDS = [
    'qradar', 'guardium', 'splunk', 'tenable', 'tanable', 'mcafee', 'proofpoint',
    'purview', 'f5', 'arcon', 'aws', 'azure', 'gcp', 'docker', 'kubernetes',
    'jenkins', 'jira', 'sap', 'salesforce', 'figma', 'photoshop', 'autocad',
    'revit', 'primavera', 'ms project', 'tableau', 'power bi', 'powerbi',
    'sharepoint', 'office 365', 'wireshark', 'nessus', 'metasploit',
    'crowdstrike', 'sentinel', 'symantec', 'fortinet', 'cisco', 'palo alto'
  ];
  const TECH_KEYWORDS = [
    'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'react', 'angular',
    'vue', 'node', 'express', 'django', 'flask', 'sql', 'mysql', 'postgresql',
    'mongodb', 'redis', 'git', 'linux', 'html', 'css', 'php', 'ruby', 'swift',
    'kotlin', 'tensorflow', 'pytorch', 'vbscript', 'xml', 'json', 'rest',
    'soap', 'graphql', 'core java', 'spring', 'hibernate', '.net', 'siem',
    'soc', 'dam', 'dlp', 'waf', 'hids', 'va', 'ids', 'ips', 'firewall',
    'vpn', 'pim', 'pam', 'edr', 'xdr'
  ];

  const isTool = (s: string) =>
    TOOL_KEYWORDS.some((t) => s.toLowerCase().includes(t));
  const isSoft = (s: string) =>
    SOFT_KEYWORDS.some((t) => s.toLowerCase().includes(t));
  const isTech = (s: string) =>
    TECH_KEYWORDS.some((t) => s.toLowerCase().includes(t));

  const technical: string[] = [];
  const tools: string[] = [];
  const soft: string[] = [];

  for (const s of allSkills) {
    if (isTool(s)) tools.push(s);
    else if (isSoft(s)) soft.push(s);
    else if (isTech(s)) technical.push(s);
    else technical.push(s); // default unknown items to technical
  }

  // Also do a text-wide scan to catch tools/tech mentioned anywhere in the CV
  for (const kw of TOOL_KEYWORDS) {
    if (tl.includes(kw) && !tools.some((t) => t.toLowerCase().includes(kw))) {
      tools.push(kw.replace(/\b\w/g, (c) => c.toUpperCase()));
    }
  }
  for (const kw of TECH_KEYWORDS) {
    if (tl.includes(kw) && !technical.some((t) => t.toLowerCase().includes(kw))) {
      // Avoid duplicating things already in tools
      if (!tools.some((t) => t.toLowerCase().includes(kw))) {
        technical.push(kw.toUpperCase().length <= 4 ? kw.toUpperCase() : kw.replace(/\b\w/g, (c) => c.toUpperCase()));
      }
    }
  }
  for (const kw of SOFT_KEYWORDS) {
    if (tl.includes(kw) && !soft.some((t) => t.toLowerCase().includes(kw))) {
      soft.push(kw.replace(/\b\w/g, (c) => c.toUpperCase()));
    }
  }

  // ─── CERTIFICATIONS ─── (section-driven)
  const certificationItems: Certification[] = [];
  const skillsSectionCerts: string[] = [];
  for (const line of sections.certifications) {
    const items = extractItemsFromLine(line);
    for (const item of items) {
      if (item.length > 3) {
        // Try to detect issuer (often the first word like "AWS", "IBM", "Microsoft")
        const issuerMatch = item.match(/^(IBM|AWS|Microsoft|Cisco|Google|Oracle|Red\s*Hat|CompTIA|EC[-\s]?Council|PMI|CISCO|VMware)/i);
        const yearMatch = item.match(/\b(19|20)\d{2}\b/);
        certificationItems.push({
          name: item.replace(/\b(19|20)\d{2}\b/, '').trim(),
          issuer: issuerMatch ? issuerMatch[1] : '',
          year: yearMatch ? yearMatch[0] : '',
          expiry: ''
        });
        skillsSectionCerts.push(item);
      }
    }
  }

  // ─── LANGUAGES ─── (section-driven; fallback to dictionary scan)
  const LANG_DICT = [
    'english', 'arabic', 'french', 'hindi', 'urdu', 'tagalog', 'malayalam',
    'tamil', 'telugu', 'bengali', 'marathi', 'gujarati', 'punjabi',
    'german', 'spanish', 'mandarin', 'chinese', 'swahili', 'japanese', 'korean',
    'italian', 'portuguese', 'russian', 'dutch', 'turkish', 'persian', 'farsi'
  ];
  let languages: string[] = [];
  // Only accept short language-like lines (filters out paragraphs that got mis-bucketed)
  for (const line of sections.languages) {
    // Skip lines that are clearly not language lists (too long, contains verbs, has too many words)
    if (line.length > 80) continue;
    if (/\b(seeking|experience|implementation|operations|investigation|coding|analysis|security|server|cyber|provide|opportunit)\b/i.test(line)) continue;
    languages.push(
      ...line
        .split(/[,;|/]/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 2 && s.length < 30 && /^[a-zA-Z\s\-()]+$/.test(s))
    );
  }
  // Always also scan with dictionary (catches languages mentioned inline)
  for (const lang of LANG_DICT) {
    const cap = lang[0].toUpperCase() + lang.slice(1);
    if (new RegExp('\\b' + lang + '\\b', 'i').test(cleaned) && !languages.some((l) => l.toLowerCase() === lang)) {
      languages.push(cap);
    }
  }
  languages = dedupe(languages);

  // ─── EDUCATION ─── (section-driven)
  const education: Education[] = [];
  let eduBuffer = '';
  for (const line of sections.education) {
    eduBuffer += ' ' + line;
  }
  // Find education entries by year ranges like "2016-2020"
  const eduMatches = eduBuffer.matchAll(/(\d{4})\s*[-–to]+\s*(\d{4}|present)/gi);
  for (const m of eduMatches) {
    const idx = m.index ?? 0;
    const context = eduBuffer.slice(idx, idx + 220);
    education.push({
      institution: extractInstitution(context),
      degree: extractDegree(context),
      field: extractField(context),
      start_year: m[1],
      end_year: m[2],
      grade: '',
      honors: ''
    });
  }
  // Fallback if no year ranges
  if (education.length === 0) {
    const eduKw = [
      'bachelor', 'master', 'phd', 'mba', 'b.sc', 'm.sc', 'b.a', 'm.a',
      'b.tech', 'm.tech', 'diploma', 'degree', 'university', 'college',
      'institute', 'school of'
    ];
    for (const l of sections.education.slice(0, 6)) {
      if (eduKw.some((k) => l.toLowerCase().includes(k))) {
        education.push({
          institution: l,
          degree: '',
          field: '',
          start_year: '',
          end_year: '',
          grade: '',
          honors: ''
        });
      }
    }
  }

  // ─── WORK EXPERIENCE ─── (most complex; parse company + dates + bullets)
  const work_experience: WorkExperience[] = parseExperience(sections.experience);

  // ─── EXPERIENCE YEARS ─── (compute from work_experience or year scan)
  let expY = 0;
  if (work_experience.length > 0) {
    const years = work_experience
      .map((w) => parseInt(w.start_date.match(/\d{4}/)?.[0] || '0'))
      .filter(Boolean);
    if (years.length) expY = Math.min(new Date().getFullYear() - Math.min(...years), 40);
  }
  if (expY === 0) {
    // Look for explicit "X years experience" or "X+ years"
    const yrMatch = cleaned.match(/\b(\d{1,2})\+?\s*(years?|yrs?)\s*(of\s*)?(experience|exp)/i);
    if (yrMatch) expY = parseInt(yrMatch[1]);
  }
  if (expY === 0) {
    const yms = cleaned.match(/\b(199\d|20[012]\d)\b/g) || [];
    const yrs = [...new Set(yms.map(Number))].sort();
    expY = yrs.length >= 2 ? Math.min(new Date().getFullYear() - yrs[0], 40) : 0;
  }

  // ─── LOCATION ─── (from header or experience)
  let location = '';
  let city = '';
  let country = '';
  const locMatch = cleaned.match(/\b(Mumbai|Delhi|Bangalore|Chennai|Pune|Hyderabad|Kolkata|Muscat|Salalah|Sohar|Nizwa|Sur|Riyadh|Jeddah|Dubai|Abu\s*Dhabi|Doha|Manama|Kuwait|Cairo)\b[,\s]*([A-Z][a-z]+)?/i);
  if (locMatch) {
    city = locMatch[1];
    country = locMatch[2] || '';
    location = locMatch[0];
  }

  // ─── OMANIZATION / NATIONALITY ─── (use word boundaries to avoid false positives)
  const omanRx = /\b(oman|omani|muscat|salalah|sohar|nizwa)\b/i;
  const gccRx = /\b(saudi|emirati|kuwaiti|bahraini|qatari|uae|ksa|gcc national)\b/i;
  const isO = omanRx.test(cleaned);
  const isG = gccRx.test(cleaned);
  // Don't override detected country from CV unless empty
  if (!country) country = isO ? 'Oman' : isG ? 'GCC' : '';

  // ─── AI SCORE ───
  const score = Math.min(
    92,
    35 +
      (name && name !== 'Unknown' ? 5 : 0) +
      (cleanEmail ? 5 : 0) +
      (phoneMatch ? 4 : 0) +
      Math.min((technical.length + tools.length) * 2, 22) +
      Math.min(work_experience.length * 4, 16) +
      Math.min(expY, 10) +
      (education.length ? 5 : 0) +
      (certificationItems.length ? 4 : 0) +
      (languages.length * 2) +
      (liMatch ? 3 : 0) +
      (summary ? 3 : 0)
  );

  return {
    personal: {
      full_name: name,
      email: cleanEmail,
      phone: phoneMatch?.[0]?.trim() || '',
      location,
      city,
      country,
      linkedin: liMatch?.[0] || '',
      website: webMatch?.[0] || '',
      nationality: isO ? 'Omani' : isG ? 'GCC National' : '',
      gender: '',
      date_of_birth: dobMatch?.[1] || '',
      marital_status: ''
    },
    professional_summary: summary,
    current_title: title || (work_experience[0]?.title || ''),
    total_experience_years: expY,
    skills: {
      technical: dedupe(technical),
      soft: dedupe(soft),
      languages,
      tools: dedupe(tools),
      certifications: skillsSectionCerts
    },
    work_experience,
    education,
    certifications: certificationItems,
    projects: [],
    awards: sections.awards.slice(0, 5),
    publications: [],
    volunteer: [],
    visa_status: '',
    notice_period: '',
    expected_salary: '',
    ai_score: score,
    ai_strengths: [
      ...technical.slice(0, 2),
      ...tools.slice(0, 2),
      ...(expY > 3 ? [`${expY}+ years experience`] : [])
    ].slice(0, 4),
    ai_concerns: ['Parsed without AI — add an OpenAI/Anthropic key in Settings for deeper extraction'],
    recommended_roles: title ? [title] : (work_experience[0]?.title ? [work_experience[0].title] : []),
    omanization_eligible: isO || isG
  };
}

// ─── EXPERIENCE PARSER ──────────────────────────────────────
// Group experience-section lines into companies. Heuristics:
// - A line containing a date range (e.g. "Jan 2020 - Present") OR
//   matching "Company Name ( Month YYYY ... )" starts a new entry.
// - Lines starting with bullets are responsibilities.

function parseExperience(lines: string[]): WorkExperience[] {
  if (!lines.length) return [];

  const DATE_RX = /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}|\d{1,2}[\/\-]\d{4}|\d{4})\s*[-–to]+\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}|\d{1,2}[\/\-]\d{4}|\d{4}|Present|Current|present|current)/i;
  // company-with-paren-date pattern: "MITS Global Consulting ( May 2025 to Present Mumbai, India)"
  const COMPANY_PAREN_RX = /^(.{2,80})\s*\(\s*(.+?)\s*\)\s*$/;

  type Block = { header: string; dateLine?: string; role?: string; bullets: string[] };
  const blocks: Block[] = [];
  let current: Block | null = null;

  const isBullet = (l: string) => /^[•▪◦►▶★*\-–—·]/.test(l) || /^\s/.test(l);
  const titleKw = [
    'engineer', 'developer', 'manager', 'analyst', 'designer', 'officer',
    'director', 'specialist', 'consultant', 'lead', 'coordinator', 'executive',
    'administrator', 'architect', 'scientist', 'supervisor', 'technician'
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Pattern A: "Company Name ( Date - Date Location )"
    const parenMatch = line.match(COMPANY_PAREN_RX);
    if (parenMatch && DATE_RX.test(parenMatch[2])) {
      if (current) blocks.push(current);
      current = { header: parenMatch[1].trim(), dateLine: parenMatch[2], bullets: [] };
      continue;
    }

    // Pattern B: Plain date-range line (with possible company on same line)
    if (DATE_RX.test(line) && !isBullet(line) && line.length < 120) {
      if (current) blocks.push(current);
      current = { header: line.replace(DATE_RX, '').replace(/[()|,\-–]+$/, '').trim() || line, dateLine: line, bullets: [] };
      continue;
    }

    if (!current) {
      // Skip until we find a recognizable entry
      // But also try: if this line looks like a clear company header followed by next line being a role
      continue;
    }

    // First non-bullet line after a header is likely the job title
    if (!current.role && !isBullet(line) && titleKw.some((k) => line.toLowerCase().includes(k)) && line.length < 80) {
      current.role = line;
      continue;
    }

    // Otherwise treat as bullet/responsibility
    const cleaned = line.replace(/^[•▪◦►▶★*\-–—·]+\s*/, '').trim();
    if (cleaned.length > 4 && cleaned.length < 400) {
      current.bullets.push(cleaned);
    }
  }
  if (current) blocks.push(current);

  // Convert blocks to WorkExperience
  return blocks.map((b) => {
    const dateMatch = (b.dateLine || '').match(DATE_RX);
    const start = dateMatch?.[1] || '';
    const end = dateMatch?.[2] || '';
    const isPresent = /present|current/i.test(end);

    // Try to pull location out of dateLine like "May 2025 to Present Mumbai, India"
    const locMatch = (b.dateLine || '').match(/\b(Mumbai|Delhi|Bangalore|Chennai|Pune|Hyderabad|Kolkata|Noida|Muscat|Salalah|Sohar|Riyadh|Dubai|Abu\s*Dhabi|Doha|Cairo|London|New\s*York|San\s*Francisco)[a-z,\s]*\b/i);

    return {
      company: b.header.replace(/[*•]+/g, '').trim(),
      title: b.role || '',
      start_date: start,
      end_date: isPresent ? '' : end,
      current: isPresent,
      duration: '',
      location: locMatch?.[0]?.trim() || '',
      responsibilities: b.bullets.slice(0, 12),
      achievements: []
    };
  }).filter((w) => w.company.length > 2);
}

function extractInstitution(text: string): string {
  const m = text.match(/([A-Z][\w\s.,&'-]+(?:school|college|university|institute|polytechnic)[\w\s.,&'-]*)/i);
  return m ? m[1].trim().slice(0, 100) : text.slice(0, 80).trim();
}
function extractDegree(text: string): string {
  const m = text.match(/(bachelor[\w\s.]*|master[\w\s.]*|phd|mba|b\.?tech|m\.?tech|b\.?sc|m\.?sc|b\.?a|m\.?a|diploma|10th|12th|computer\s*science)[^,;]*/i);
  return m ? m[0].trim() : '';
}
function extractField(text: string): string {
  const m = text.match(/in\s+([A-Z][\w\s&]+?)(?:[,;\.]|$)/);
  return m ? m[1].trim() : '';
}

// ─── PROCESSING STEPS (for UI feedback) ──────────────────────

export const PROCESSING_STEPS = [
  'Reading file format & encoding',
  'Extracting text layer (PDF/DOCX)',
  'Detecting content structure',
  'AI: parsing personal information',
  'AI: extracting work experience',
  'AI: extracting education & skills',
  'AI: computing match score & insights',
  'Saving to ATS candidate database'
];
