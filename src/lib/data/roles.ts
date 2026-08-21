import type { RoleTarget } from "@/lib/types";

/**
 * Career archetypes. `targets` is the *target skill vector* — the mastery level
 * (0–1) a competent practitioner in this role is expected to have. Subtracting
 * the learner's own vector from this yields the skill gap.
 */
export const ROLES: RoleTarget[] = [
  {
    id: "ml-engineer",
    title: "Machine Learning Engineer",
    domain: "Machine Learning",
    blurb:
      "Builds, trains and ships production ML systems — from feature pipelines to deployed, monitored models.",
    keywords: [
      "machine learning engineer", "ml engineer", "ml", "machine learning",
      "deep learning", "model training", "ai engineer", "neural networks",
    ],
    targets: [
      { skillId: "python", weight: 0.9 },
      { skillId: "statistics", weight: 0.8 },
      { skillId: "math-linalg", weight: 0.7 },
      { skillId: "data-wrangling", weight: 0.85 },
      { skillId: "eda", weight: 0.7 },
      { skillId: "ml-fundamentals", weight: 0.95 },
      { skillId: "supervised", weight: 0.9 },
      { skillId: "unsupervised", weight: 0.7 },
      { skillId: "feature-eng", weight: 0.85 },
      { skillId: "model-eval", weight: 0.9 },
      { skillId: "deep-learning", weight: 0.8 },
      { skillId: "mlops", weight: 0.8 },
      { skillId: "docker", weight: 0.7 },
      { skillId: "sql", weight: 0.6 },
      { skillId: "git", weight: 0.6 },
    ],
  },
  {
    id: "data-scientist",
    title: "Data Scientist",
    domain: "Data",
    blurb:
      "Turns messy data into decisions — statistical modelling, experimentation and communicating insight to stakeholders.",
    keywords: [
      "data scientist", "data science", "analytics", "statistics",
      "experimentation", "insights", "ab testing",
    ],
    targets: [
      { skillId: "python", weight: 0.85 },
      { skillId: "sql", weight: 0.85 },
      { skillId: "statistics", weight: 0.95 },
      { skillId: "data-wrangling", weight: 0.9 },
      { skillId: "eda", weight: 0.9 },
      { skillId: "data-viz", weight: 0.8 },
      { skillId: "ml-fundamentals", weight: 0.8 },
      { skillId: "supervised", weight: 0.75 },
      { skillId: "model-eval", weight: 0.8 },
      { skillId: "experimentation", weight: 0.85 },
      { skillId: "communication", weight: 0.8 },
      { skillId: "feature-eng", weight: 0.7 },
    ],
  },
  {
    id: "data-analyst",
    title: "Data Analyst",
    domain: "Data",
    blurb:
      "Answers business questions with SQL, dashboards and clear analysis. The fastest on-ramp into a data career.",
    keywords: [
      "data analyst", "business analyst", "dashboard", "reporting",
      "excel", "tableau", "power bi", "bi analyst",
    ],
    targets: [
      { skillId: "sql", weight: 0.95 },
      { skillId: "data-wrangling", weight: 0.8 },
      { skillId: "data-viz", weight: 0.9 },
      { skillId: "bi-tools", weight: 0.9 },
      { skillId: "statistics", weight: 0.7 },
      { skillId: "eda", weight: 0.8 },
      { skillId: "python", weight: 0.6 },
      { skillId: "communication", weight: 0.85 },
      { skillId: "analytics", weight: 0.8 },
    ],
  },
  {
    id: "ai-engineer",
    title: "AI / LLM Application Engineer",
    domain: "Machine Learning",
    blurb:
      "Builds products on top of foundation models — prompting, RAG, agents, evaluation and production LLM systems.",
    keywords: [
      "llm", "genai", "generative ai", "ai engineer", "rag", "agents",
      "prompt engineering", "chatbot", "openai", "claude", "langchain",
    ],
    targets: [
      { skillId: "python", weight: 0.85 },
      { skillId: "backend", weight: 0.75 },
      { skillId: "nlp", weight: 0.7 },
      { skillId: "transformers", weight: 0.75 },
      { skillId: "llm-apps", weight: 0.95 },
      { skillId: "rag", weight: 0.9 },
      { skillId: "model-eval", weight: 0.75 },
      { skillId: "docker", weight: 0.6 },
      { skillId: "cloud", weight: 0.6 },
      { skillId: "typescript", weight: 0.5 },
      { skillId: "git", weight: 0.6 },
    ],
  },
  {
    id: "frontend-engineer",
    title: "Frontend Engineer",
    domain: "Web Development",
    blurb:
      "Crafts fast, accessible, delightful interfaces with modern JavaScript frameworks and design fundamentals.",
    keywords: [
      "frontend", "front end", "react", "web developer", "ui developer",
      "javascript developer", "nextjs", "css",
    ],
    targets: [
      { skillId: "html-css", weight: 0.9 },
      { skillId: "javascript", weight: 0.9 },
      { skillId: "typescript", weight: 0.8 },
      { skillId: "react", weight: 0.95 },
      { skillId: "nextjs", weight: 0.75 },
      { skillId: "ui-design", weight: 0.75 },
      { skillId: "testing", weight: 0.65 },
      { skillId: "git", weight: 0.7 },
      { skillId: "backend", weight: 0.45 },
    ],
  },
  {
    id: "fullstack-engineer",
    title: "Full-Stack Engineer",
    domain: "Web Development",
    blurb:
      "Owns features end to end — interface, API, data model and deployment.",
    keywords: [
      "full stack", "fullstack", "web developer", "software engineer",
      "mern", "backend and frontend", "app developer",
    ],
    targets: [
      { skillId: "html-css", weight: 0.75 },
      { skillId: "javascript", weight: 0.85 },
      { skillId: "typescript", weight: 0.75 },
      { skillId: "react", weight: 0.8 },
      { skillId: "nextjs", weight: 0.7 },
      { skillId: "backend", weight: 0.9 },
      { skillId: "databases", weight: 0.8 },
      { skillId: "sql", weight: 0.75 },
      { skillId: "auth", weight: 0.7 },
      { skillId: "testing", weight: 0.7 },
      { skillId: "docker", weight: 0.6 },
      { skillId: "git", weight: 0.75 },
      { skillId: "system-design", weight: 0.6 },
    ],
  },
  {
    id: "backend-engineer",
    title: "Backend Engineer",
    domain: "Web Development",
    blurb:
      "Designs the services, data models and APIs that everything else depends on.",
    keywords: [
      "backend", "back end", "api developer", "server", "microservices",
      "distributed systems", "java developer", "go developer",
    ],
    targets: [
      { skillId: "prog-basics", weight: 0.85 },
      { skillId: "backend", weight: 0.95 },
      { skillId: "databases", weight: 0.9 },
      { skillId: "sql", weight: 0.85 },
      { skillId: "system-design", weight: 0.85 },
      { skillId: "auth", weight: 0.75 },
      { skillId: "testing", weight: 0.75 },
      { skillId: "docker", weight: 0.7 },
      { skillId: "dsa", weight: 0.7 },
      { skillId: "observability", weight: 0.6 },
    ],
  },
  {
    id: "devops-engineer",
    title: "DevOps / Platform Engineer",
    domain: "Cloud & DevOps",
    blurb:
      "Makes shipping safe and boring — infrastructure, pipelines, containers and observability.",
    keywords: [
      "devops", "sre", "platform engineer", "infrastructure", "kubernetes",
      "aws", "cloud engineer", "terraform", "ci cd",
    ],
    targets: [
      { skillId: "cli", weight: 0.9 },
      { skillId: "docker", weight: 0.9 },
      { skillId: "kubernetes", weight: 0.85 },
      { skillId: "cloud", weight: 0.9 },
      { skillId: "cicd", weight: 0.85 },
      { skillId: "iac", weight: 0.8 },
      { skillId: "observability", weight: 0.8 },
      { skillId: "git", weight: 0.8 },
      { skillId: "sec-fundamentals", weight: 0.6 },
    ],
  },
  {
    id: "data-engineer",
    title: "Data Engineer",
    domain: "Data",
    blurb:
      "Builds the pipelines and warehouses that every analyst and model depends on.",
    keywords: [
      "data engineer", "etl", "pipeline", "airflow", "spark", "warehouse",
      "dbt", "big data",
    ],
    targets: [
      { skillId: "python", weight: 0.85 },
      { skillId: "sql", weight: 0.95 },
      { skillId: "data-eng", weight: 0.95 },
      { skillId: "warehousing", weight: 0.85 },
      { skillId: "spark", weight: 0.75 },
      { skillId: "docker", weight: 0.7 },
      { skillId: "cloud", weight: 0.75 },
      { skillId: "databases", weight: 0.8 },
      { skillId: "cicd", weight: 0.6 },
    ],
  },
  {
    id: "security-engineer",
    title: "Security Engineer",
    domain: "Security",
    blurb:
      "Finds and closes weaknesses across applications, infrastructure and process.",
    keywords: [
      "security", "cyber security", "appsec", "penetration testing",
      "infosec", "ethical hacking", "cryptography",
    ],
    targets: [
      { skillId: "cli", weight: 0.85 },
      { skillId: "sec-fundamentals", weight: 0.95 },
      { skillId: "appsec", weight: 0.9 },
      { skillId: "cryptography", weight: 0.7 },
      { skillId: "backend", weight: 0.7 },
      { skillId: "cloud", weight: 0.7 },
      { skillId: "prog-basics", weight: 0.75 },
    ],
  },
  {
    id: "product-manager",
    title: "Technical Product Manager",
    domain: "Product & Career",
    blurb:
      "Decides what to build and why — grounded in data, users and technical feasibility.",
    keywords: [
      "product manager", "pm", "product owner", "product management",
      "roadmap", "strategy",
    ],
    targets: [
      { skillId: "product-sense", weight: 0.95 },
      { skillId: "analytics", weight: 0.85 },
      { skillId: "experimentation", weight: 0.8 },
      { skillId: "sql", weight: 0.7 },
      { skillId: "communication", weight: 0.9 },
      { skillId: "data-viz", weight: 0.65 },
      { skillId: "system-design", weight: 0.5 },
    ],
  },
  {
    id: "cs-interview",
    title: "Software Engineering Interview Prep",
    domain: "Product & Career",
    blurb:
      "A focused track for landing the offer — algorithms, system design and behavioural rounds.",
    keywords: [
      "interview", "faang", "coding interview", "leetcode", "placement",
      "get a job", "crack the interview",
    ],
    targets: [
      { skillId: "dsa", weight: 0.95 },
      { skillId: "interview-prep", weight: 0.95 },
      { skillId: "system-design", weight: 0.8 },
      { skillId: "prog-basics", weight: 0.85 },
      { skillId: "communication", weight: 0.7 },
      { skillId: "databases", weight: 0.6 },
    ],
  },
];

export const ROLE_BY_ID: Record<string, RoleTarget> = Object.fromEntries(
  ROLES.map((r) => [r.id, r]),
);
