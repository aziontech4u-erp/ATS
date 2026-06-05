// ─────────────────────────────────────────────────────────────
// CORE TYPES — Recruitment (ATS) Application
// ─────────────────────────────────────────────────────────────

export type Stage = 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';

export interface ParsedPersonal {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  city: string;
  country: string;
  linkedin: string;
  website: string;
  nationality: string;
  gender: string;
  date_of_birth: string;
  marital_status: string;
}

export interface ParsedSkills {
  technical: string[];
  soft: string[];
  languages: string[];
  tools: string[];
  certifications: string[];
}

export interface WorkExperience {
  company: string;
  title: string;
  start_date: string;
  end_date: string;
  duration: string;
  location: string;
  current: boolean;
  responsibilities: string[];
  achievements: string[];
}

export interface Education {
  institution: string;
  degree: string;
  field: string;
  start_year: string;
  end_year: string;
  grade: string;
  honors: string;
}

export interface Certification {
  name: string;
  issuer: string;
  year: string;
  expiry: string;
}

export interface Project {
  name: string;
  description: string;
  tech_used: string[];
  url: string;
}

export interface ParsedResume {
  personal: ParsedPersonal;
  professional_summary: string;
  current_title: string;
  total_experience_years: number;
  skills: ParsedSkills;
  work_experience: WorkExperience[];
  education: Education[];
  certifications: Certification[];
  projects: Project[];
  awards: string[];
  publications: string[];
  volunteer: string[];
  visa_status: string;
  notice_period: string;
  expected_salary: string;
  ai_score: number;
  ai_strengths: string[];
  ai_concerns: string[];
  recommended_roles: string[];
  omanization_eligible: boolean;
}

export interface Candidate extends ParsedResume {
  id: string;
  filename: string;
  fileSize: string;
  uploadedAt: string;
  stage: Stage;
  source: string;
  rawText: string;
  jobId?: string;       // Linked to a job posting
  notes?: string;
  rating?: number;      // 0-5 manual rating
}

export interface JobPosting {
  id: string;
  title: string;
  department: string;
  location: string;
  branch: string;
  employment_type: 'full_time' | 'part_time' | 'contract' | 'internship';
  openings: number;
  filled: number;
  salary_min: number;
  salary_max: number;
  currency: string;
  status: 'draft' | 'open' | 'on_hold' | 'closed';
  description: string;
  requirements: string[];
  skills_required: string[];
  posted_date: string;
  closing_date: string;
  applicant_count?: number;
}

export interface Interview {
  id: string;
  candidate_id: string;
  job_id?: string;
  type: 'phone' | 'video' | 'technical' | 'panel' | 'final' | 'cultural';
  scheduled_at: string;
  duration_minutes: number;
  location: string;
  meeting_link: string;
  interviewer: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled' | 'no_show';
  feedback?: string;
  rating?: number;
  notes?: string;
}

export interface OfferLetter {
  id: string;
  candidate_id: string;
  job_id?: string;
  position: string;
  salary: number;
  currency: string;
  start_date: string;
  expiry_date: string;
  benefits: string[];
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'withdrawn';
  sent_date: string;
  responded_date?: string;
  notes?: string;
}

export type AppView =
  | 'dashboard'
  | 'parser'
  | 'candidates'
  | 'search'
  | 'jobs'
  | 'pipeline'
  | 'interviews'
  | 'offers'
  | 'reports'
  | 'company';

export interface CompanyProfile {
  name: string;
  legalName: string;
  industry: string;
  size: string;
  website: string;
  email: string;
  phone: string;
  addressLine: string;
  city: string;
  country: string;
  taxId: string;
  logoDataUrl: string; // base64 data URL
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Recruiter' | 'Hiring Manager' | 'Viewer';
  status: 'active' | 'suspended' | 'invited';
  createdAt: string;
}

export interface NotificationPrefs {
  emailNewCandidate: boolean;
  emailInterviewReminder: boolean;
  emailOfferStatus: boolean;
  inAppMentions: boolean;
  dailyDigest: boolean;
}

export interface IntegrationConfig {
  id: string;
  name: string;
  category: 'job_board' | 'email' | 'calendar' | 'video' | 'hr' | 'storage';
  connected: boolean;
  apiKeyMasked?: string;
}

export interface AppearancePrefs {
  density: 'compact' | 'comfortable';
  accent: string;
  sidebarCollapsed: boolean;
}

export interface SecurityPrefs {
  mfaRequired: boolean;
  sessionTimeoutMinutes: number;
  passwordMinLength: number;
  ipAllowlist: string[];
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
}

export interface CompanySettings {
  profile: CompanyProfile;
  users: UserAccount[];
  notifications: NotificationPrefs;
  integrations: IntegrationConfig[];
  appearance: AppearancePrefs;
  security: SecurityPrefs;
  audit: AuditEntry[];
}

export interface AppState {
  candidates: Candidate[];
  jobs: JobPosting[];
  interviews: Interview[];
  offers: OfferLetter[];
  apiKey: string;
  activeView: AppView;
}
