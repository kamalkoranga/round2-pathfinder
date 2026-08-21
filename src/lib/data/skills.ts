import type { Skill } from "@/lib/types";

/**
 * Skill taxonomy. `parents` encodes the conventional learning order and is what
 * the path planner uses to topologically sort prerequisites.
 */
export const SKILLS: Skill[] = [
  // ---- Programming foundations -------------------------------------------
  { id: "prog-basics", name: "Programming Fundamentals", domain: "Foundations" },
  { id: "python", name: "Python", domain: "Foundations", parents: ["prog-basics"] },
  { id: "javascript", name: "JavaScript", domain: "Foundations", parents: ["prog-basics"] },
  { id: "typescript", name: "TypeScript", domain: "Foundations", parents: ["javascript"] },
  { id: "sql", name: "SQL", domain: "Foundations", parents: ["prog-basics"] },
  { id: "git", name: "Git & Version Control", domain: "Foundations", parents: ["prog-basics"] },
  { id: "dsa", name: "Data Structures & Algorithms", domain: "Foundations", parents: ["prog-basics"] },
  { id: "cli", name: "Command Line & Shell", domain: "Foundations" },

  // ---- Math & statistics ---------------------------------------------------
  { id: "math-linalg", name: "Linear Algebra", domain: "Mathematics" },
  { id: "math-calculus", name: "Calculus", domain: "Mathematics" },
  { id: "statistics", name: "Statistics & Probability", domain: "Mathematics" },
  { id: "optimization", name: "Optimization", domain: "Mathematics", parents: ["math-calculus", "math-linalg"] },

  // ---- Data ----------------------------------------------------------------
  { id: "data-wrangling", name: "Data Wrangling", domain: "Data", parents: ["python"] },
  { id: "data-viz", name: "Data Visualization", domain: "Data", parents: ["data-wrangling"] },
  { id: "eda", name: "Exploratory Data Analysis", domain: "Data", parents: ["data-wrangling", "statistics"] },
  { id: "data-eng", name: "Data Engineering & Pipelines", domain: "Data", parents: ["python", "sql"] },
  { id: "spark", name: "Distributed Data (Spark)", domain: "Data", parents: ["data-eng"] },
  { id: "warehousing", name: "Data Warehousing", domain: "Data", parents: ["sql", "data-eng"] },
  { id: "bi-tools", name: "BI & Dashboarding", domain: "Data", parents: ["data-viz", "sql"] },

  // ---- Machine learning ----------------------------------------------------
  { id: "ml-fundamentals", name: "Machine Learning Fundamentals", domain: "Machine Learning", parents: ["statistics", "python"] },
  { id: "supervised", name: "Supervised Learning", domain: "Machine Learning", parents: ["ml-fundamentals"] },
  { id: "unsupervised", name: "Unsupervised Learning", domain: "Machine Learning", parents: ["ml-fundamentals"] },
  { id: "feature-eng", name: "Feature Engineering", domain: "Machine Learning", parents: ["ml-fundamentals", "eda"] },
  { id: "model-eval", name: "Model Evaluation", domain: "Machine Learning", parents: ["ml-fundamentals"] },
  { id: "deep-learning", name: "Deep Learning", domain: "Machine Learning", parents: ["supervised", "math-linalg"] },
  { id: "cnn", name: "Computer Vision", domain: "Machine Learning", parents: ["deep-learning"] },
  { id: "nlp", name: "Natural Language Processing", domain: "Machine Learning", parents: ["deep-learning"] },
  { id: "transformers", name: "Transformers & Attention", domain: "Machine Learning", parents: ["nlp"] },
  { id: "llm-apps", name: "LLM Application Development", domain: "Machine Learning", parents: ["transformers", "python"] },
  { id: "rag", name: "Retrieval-Augmented Generation", domain: "Machine Learning", parents: ["llm-apps"] },
  { id: "mlops", name: "MLOps & Model Deployment", domain: "Machine Learning", parents: ["ml-fundamentals", "docker"] },
  { id: "rl", name: "Reinforcement Learning", domain: "Machine Learning", parents: ["deep-learning", "optimization"] },

  // ---- Web development -----------------------------------------------------
  { id: "html-css", name: "HTML & CSS", domain: "Web Development" },
  { id: "react", name: "React", domain: "Web Development", parents: ["javascript", "html-css"] },
  { id: "nextjs", name: "Next.js", domain: "Web Development", parents: ["react"] },
  { id: "ui-design", name: "UI & Interaction Design", domain: "Web Development", parents: ["html-css"] },
  { id: "backend", name: "Backend & APIs", domain: "Web Development", parents: ["prog-basics"] },
  { id: "auth", name: "Authentication & Security", domain: "Web Development", parents: ["backend"] },
  { id: "testing", name: "Automated Testing", domain: "Web Development", parents: ["prog-basics"] },
  { id: "system-design", name: "System Design", domain: "Web Development", parents: ["backend", "databases"] },
  { id: "databases", name: "Databases & Modelling", domain: "Web Development", parents: ["sql"] },

  // ---- Cloud & platform ----------------------------------------------------
  { id: "docker", name: "Containers & Docker", domain: "Cloud & DevOps", parents: ["cli"] },
  { id: "kubernetes", name: "Kubernetes", domain: "Cloud & DevOps", parents: ["docker"] },
  { id: "cloud", name: "Cloud Platforms", domain: "Cloud & DevOps", parents: ["cli"] },
  { id: "cicd", name: "CI/CD Automation", domain: "Cloud & DevOps", parents: ["git", "docker"] },
  { id: "iac", name: "Infrastructure as Code", domain: "Cloud & DevOps", parents: ["cloud"] },
  { id: "observability", name: "Monitoring & Observability", domain: "Cloud & DevOps", parents: ["cloud"] },

  // ---- Product & professional ---------------------------------------------
  { id: "product-sense", name: "Product Thinking", domain: "Product & Career" },
  { id: "analytics", name: "Product Analytics", domain: "Product & Career", parents: ["statistics"] },
  { id: "experimentation", name: "A/B Testing & Experimentation", domain: "Product & Career", parents: ["statistics"] },
  { id: "communication", name: "Technical Communication", domain: "Product & Career" },
  { id: "interview-prep", name: "Interview Preparation", domain: "Product & Career", parents: ["dsa"] },

  // ---- Security ------------------------------------------------------------
  { id: "sec-fundamentals", name: "Security Fundamentals", domain: "Security", parents: ["cli"] },
  { id: "appsec", name: "Application Security", domain: "Security", parents: ["sec-fundamentals", "backend"] },
  { id: "cryptography", name: "Applied Cryptography", domain: "Security", parents: ["sec-fundamentals"] },
];

export const SKILL_BY_ID: Record<string, Skill> = Object.fromEntries(
  SKILLS.map((s) => [s.id, s]),
);

export const SKILL_DOMAINS = Array.from(new Set(SKILLS.map((s) => s.domain)));

export function skillName(id: string): string {
  return SKILL_BY_ID[id]?.name ?? id;
}

/** All transitive prerequisite skills of `id`, nearest first. */
export function prerequisiteChain(id: string, seen = new Set<string>()): string[] {
  const skill = SKILL_BY_ID[id];
  if (!skill?.parents) return [];
  const out: string[] = [];
  for (const parent of skill.parents) {
    if (seen.has(parent)) continue;
    seen.add(parent);
    out.push(parent, ...prerequisiteChain(parent, seen));
  }
  return out;
}
