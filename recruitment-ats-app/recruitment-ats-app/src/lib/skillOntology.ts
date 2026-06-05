// ─────────────────────────────────────────────────────────────
// SKILL ONTOLOGY
// Maps similar / related / parent-child skills so that searching
// "Java" also surfaces "Spring Boot", "Hibernate", "Maven", etc.
//
// Each cluster has a canonical name and an array of aliases.
// Bidirectional lookup: searching ANY skill in the cluster
// expands to ALL skills in the cluster.
// ─────────────────────────────────────────────────────────────

interface SkillCluster {
  canonical: string;
  category: 'language' | 'framework' | 'database' | 'cloud' | 'devops' | 'security' | 'data' | 'frontend' | 'mobile' | 'enterprise' | 'design' | 'soft';
  aliases: string[];
}

const SKILL_CLUSTERS: SkillCluster[] = [
  // ── Languages ──
  { canonical: 'Java', category: 'language',
    aliases: ['java', 'core java', 'java 8', 'java 11', 'java 17', 'jdk', 'jee', 'j2ee', 'spring', 'spring boot', 'spring mvc', 'hibernate', 'jpa', 'maven', 'gradle', 'jsp', 'servlet'] },
  { canonical: 'Python', category: 'language',
    aliases: ['python', 'python3', 'py', 'django', 'flask', 'fastapi', 'pandas', 'numpy', 'pytorch', 'tensorflow', 'scikit-learn', 'sklearn', 'jupyter', 'pyspark'] },
  { canonical: 'JavaScript', category: 'language',
    aliases: ['javascript', 'js', 'es6', 'es2015', 'es2020', 'ecmascript', 'node', 'node.js', 'nodejs', 'npm', 'yarn'] },
  { canonical: 'TypeScript', category: 'language',
    aliases: ['typescript', 'ts', 'tsc', 'tsx'] },
  { canonical: 'C#', category: 'language',
    aliases: ['c#', 'csharp', '.net', 'dotnet', 'asp.net', 'asp .net', 'mvc', 'wpf', 'wcf', 'linq', 'entity framework', 'ef core'] },
  { canonical: 'C++', category: 'language',
    aliases: ['c++', 'cpp', 'cplusplus', 'stl', 'boost'] },
  { canonical: 'Go', category: 'language',
    aliases: ['go', 'golang', 'gin', 'gorilla'] },
  { canonical: 'PHP', category: 'language',
    aliases: ['php', 'laravel', 'symfony', 'codeigniter', 'wordpress', 'drupal'] },
  { canonical: 'Ruby', category: 'language',
    aliases: ['ruby', 'rails', 'ruby on rails', 'ror', 'sinatra'] },

  // ── Frontend ──
  { canonical: 'React', category: 'frontend',
    aliases: ['react', 'react.js', 'reactjs', 'react native', 'next.js', 'nextjs', 'redux', 'react hooks', 'jsx', 'gatsby'] },
  { canonical: 'Angular', category: 'frontend',
    aliases: ['angular', 'angularjs', 'angular 2', 'angular 14', 'angular 16', 'rxjs', 'ngrx'] },
  { canonical: 'Vue', category: 'frontend',
    aliases: ['vue', 'vue.js', 'vuejs', 'vue 3', 'nuxt', 'nuxt.js', 'vuex', 'pinia'] },
  { canonical: 'HTML/CSS', category: 'frontend',
    aliases: ['html', 'html5', 'css', 'css3', 'sass', 'scss', 'less', 'tailwind', 'tailwindcss', 'bootstrap', 'material-ui', 'mui', 'chakra'] },

  // ── Mobile ──
  { canonical: 'iOS', category: 'mobile',
    aliases: ['ios', 'swift', 'objective-c', 'xcode', 'cocoa', 'swiftui'] },
  { canonical: 'Android', category: 'mobile',
    aliases: ['android', 'kotlin', 'android studio', 'jetpack compose'] },
  { canonical: 'Cross-platform Mobile', category: 'mobile',
    aliases: ['react native', 'flutter', 'dart', 'ionic', 'xamarin', 'cordova'] },

  // ── Databases ──
  { canonical: 'SQL Database', category: 'database',
    aliases: ['sql', 'mysql', 'postgresql', 'postgres', 'mariadb', 'oracle', 'sqlserver', 'sql server', 'mssql', 'sqlite', 't-sql', 'pl/sql', 'plsql'] },
  { canonical: 'NoSQL', category: 'database',
    aliases: ['nosql', 'mongodb', 'mongo', 'dynamodb', 'cassandra', 'couchdb', 'redis', 'memcached', 'firebase', 'firestore'] },
  { canonical: 'Search Engines', category: 'database',
    aliases: ['elasticsearch', 'opensearch', 'solr', 'lucene', 'algolia'] },

  // ── Cloud ──
  { canonical: 'AWS', category: 'cloud',
    aliases: ['aws', 'amazon web services', 'ec2', 's3', 'lambda', 'rds', 'cloudformation', 'eks', 'ecs', 'cloudfront', 'route53', 'iam'] },
  { canonical: 'Azure', category: 'cloud',
    aliases: ['azure', 'microsoft azure', 'azure devops', 'aks', 'azure functions', 'cosmos db', 'azure ad'] },
  { canonical: 'GCP', category: 'cloud',
    aliases: ['gcp', 'google cloud', 'google cloud platform', 'gke', 'bigquery', 'cloud functions', 'firebase'] },

  // ── DevOps ──
  { canonical: 'Containerization', category: 'devops',
    aliases: ['docker', 'kubernetes', 'k8s', 'helm', 'docker compose', 'containerd', 'podman', 'openshift'] },
  { canonical: 'CI/CD', category: 'devops',
    aliases: ['jenkins', 'github actions', 'gitlab ci', 'circleci', 'bitbucket pipelines', 'travis', 'azure pipelines', 'ci/cd', 'continuous integration'] },
  { canonical: 'Infrastructure as Code', category: 'devops',
    aliases: ['terraform', 'ansible', 'puppet', 'chef', 'pulumi', 'cloudformation', 'iac'] },
  { canonical: 'Git', category: 'devops',
    aliases: ['git', 'github', 'gitlab', 'bitbucket', 'svn', 'version control'] },

  // ── Security / Cyber ──
  { canonical: 'SIEM/SOC', category: 'security',
    aliases: ['siem', 'soc', 'qradar', 'ibm qradar', 'splunk', 'sentinel', 'arcsight', 'logrhythm', 'security operations'] },
  { canonical: 'DAM/DLP', category: 'security',
    aliases: ['dam', 'dlp', 'guardium', 'ibm guardium', 'imperva', 'proofpoint', 'purview', 'data loss prevention'] },
  { canonical: 'WAF/Network Security', category: 'security',
    aliases: ['waf', 'f5', 'f5 waf', 'cloudflare', 'palo alto', 'fortinet', 'firewall', 'ips', 'ids', 'vpn'] },
  { canonical: 'Endpoint Security', category: 'security',
    aliases: ['edr', 'xdr', 'mcafee', 'crowdstrike', 'symantec', 'sentinelone', 'carbon black', 'sophos'] },
  { canonical: 'Vulnerability Assessment', category: 'security',
    aliases: ['vulnerability assessment', 'va', 'tenable', 'nessus', 'qualys', 'rapid7', 'penetration testing', 'pentest', 'ethical hacking'] },
  { canonical: 'IAM/PAM', category: 'security',
    aliases: ['iam', 'pam', 'pim', 'arcon', 'cyberark', 'okta', 'ping identity', 'sailpoint', 'identity management'] },

  // ── Enterprise ──
  { canonical: 'SAP', category: 'enterprise',
    aliases: ['sap', 'sap abap', 'sap fico', 'sap mm', 'sap hana', 's/4hana', 'sap fiori', 'sap bw'] },
  { canonical: 'Salesforce', category: 'enterprise',
    aliases: ['salesforce', 'sfdc', 'apex', 'visualforce', 'lightning', 'sales cloud', 'service cloud'] },
  { canonical: 'ERPNext', category: 'enterprise',
    aliases: ['erpnext', 'frappe', 'frappe framework'] },
  { canonical: 'Oracle', category: 'enterprise',
    aliases: ['oracle', 'oracle apex', 'oracle ebs', 'peoplesoft', 'oracle cloud'] },
  { canonical: 'Dynamics 365', category: 'enterprise',
    aliases: ['dynamics 365', 'd365', 'dynamics crm', 'navision', 'great plains'] },

  // ── Data ──
  { canonical: 'Data Analytics', category: 'data',
    aliases: ['analytics', 'tableau', 'power bi', 'powerbi', 'looker', 'qlik', 'qlikview', 'data studio'] },
  { canonical: 'Big Data', category: 'data',
    aliases: ['hadoop', 'spark', 'pyspark', 'hive', 'pig', 'kafka', 'flink', 'storm', 'big data'] },
  { canonical: 'Machine Learning', category: 'data',
    aliases: ['machine learning', 'ml', 'ai', 'artificial intelligence', 'deep learning', 'neural networks', 'nlp', 'computer vision', 'llm'] },

  // ── Design ──
  { canonical: 'UI/UX Design', category: 'design',
    aliases: ['figma', 'sketch', 'adobe xd', 'photoshop', 'illustrator', 'invision', 'ui/ux', 'ui', 'ux', 'wireframing'] },
  { canonical: 'CAD/Engineering', category: 'design',
    aliases: ['autocad', 'revit', 'solidworks', 'catia', 'sketchup', 'staad', 'etabs', 'primavera', 'ms project'] },

  // ── Soft Skills ──
  { canonical: 'Leadership', category: 'soft',
    aliases: ['leadership', 'team lead', 'mentoring', 'coaching', 'team management', 'people management'] },
  { canonical: 'Project Management', category: 'soft',
    aliases: ['project management', 'pmp', 'prince2', 'agile', 'scrum', 'kanban', 'waterfall', 'jira', 'confluence'] },
  { canonical: 'Communication', category: 'soft',
    aliases: ['communication', 'presentation', 'public speaking', 'stakeholder management', 'client management'] }
];

// ─── BUILD INDEX ─────────────────────────────────────────────
// alias (lowercased) → cluster
const ALIAS_INDEX = new Map<string, SkillCluster>();
for (const cluster of SKILL_CLUSTERS) {
  for (const alias of cluster.aliases) {
    ALIAS_INDEX.set(alias.toLowerCase(), cluster);
  }
}

// ─── PUBLIC API ──────────────────────────────────────────────

/** Returns the cluster a skill belongs to, or null. */
export function findCluster(skill: string): SkillCluster | null {
  return ALIAS_INDEX.get(skill.toLowerCase().trim()) || null;
}

/** Normalizes a skill to its canonical form ("sr. dev" → "Senior Developer"). */
export function canonicalize(skill: string): string {
  const cluster = findCluster(skill);
  return cluster ? cluster.canonical : skill.trim();
}

/** Returns ALL aliases for a skill (for semantic search expansion). */
export function expandSkill(skill: string): string[] {
  const cluster = findCluster(skill);
  if (!cluster) return [skill.toLowerCase().trim()];
  return cluster.aliases;
}

/** True if two skills belong to the same cluster (semantically similar). */
export function areSimilar(a: string, b: string): boolean {
  const ca = findCluster(a);
  const cb = findCluster(b);
  if (!ca || !cb) return a.toLowerCase().trim() === b.toLowerCase().trim();
  return ca.canonical === cb.canonical;
}

/** Categorize a skill into one of the buckets. Returns 'other' if unknown. */
export function categorizeSkill(skill: string): string {
  const cluster = findCluster(skill);
  return cluster ? cluster.category : 'other';
}

/** Returns canonical names of all clusters in a category (for filter dropdowns). */
export function skillsByCategory(category: SkillCluster['category']): string[] {
  return SKILL_CLUSTERS.filter((c) => c.category === category).map((c) => c.canonical);
}

/** Normalizes a job title using common abbreviations. */
export function normalizeJobTitle(title: string): string {
  const t = title.trim();
  return t
    .replace(/\bsr\.?\b/gi, 'Senior')
    .replace(/\bjr\.?\b/gi, 'Junior')
    .replace(/\bdev\b/gi, 'Developer')
    .replace(/\beng\b/gi, 'Engineer')
    .replace(/\bmgr\b/gi, 'Manager')
    .replace(/\bsre\b/gi, 'Site Reliability Engineer')
    .replace(/\bqa\b/gi, 'QA')
    .replace(/\bba\b/gi, 'Business Analyst')
    .replace(/\bvp\b/gi, 'Vice President')
    .replace(/\bceo\b/gi, 'CEO')
    .replace(/\bcto\b/gi, 'CTO')
    .replace(/\bcfo\b/gi, 'CFO')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Total cluster count (useful for UI). */
export const SKILL_CLUSTER_COUNT = SKILL_CLUSTERS.length;
