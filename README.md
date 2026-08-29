# PathFinder — personalised learning paths

PathFinder takes a learning goal and turns it into a practical sequence of
courses, projects, and checkpoints. It looks at the learner's current skills,
fills the important gaps first, and explains why each item was selected.

The main idea is simple: finding resources is easy; deciding what to do next,
and in what order, is the harder part.

**Live app:** <https://pathfinder-nine-theta.vercel.app>

**Repository:** <https://github.com/kamalkoranga/round2-pathfinder>

---

## Table of contents

- [What it does](#what-it-does)
- [Quick start](#quick-start)
- [Architecture](#architecture)
- [The recommendation engine](#the-recommendation-engine)
- [Where the model fits](#where-the-model-fits)
- [Project structure](#project-structure)
- [Deployment](#deployment)
- [Design decisions](#design-decisions)
- [Limitations](#limitations)

---

## What it does

| Requirement | Where it lives |
|---|---|
| Conversational interface for describing goals in natural language | `/` → `src/components/ChatIntake.tsx`, `POST /api/intake` |
| Learner profiling engine (interests, level, completed courses, objectives) | `src/lib/store.ts`, `/profile`, `src/lib/engine/gap.ts` |
| Recommendation engine for courses, projects and resources | `src/lib/engine/recommend.ts`, `/explore` |
| Learning path generator with prerequisites and milestones | `src/lib/engine/path.ts`, `/path` |
| AI assistant that explains recommendations and answers queries | `POST /api/explain`, `POST /api/ask`, `/assistant` |
| Dashboard: progress, skill development, milestones, next actions | `/dashboard`, `src/components/SkillRadar.tsx` |

A couple of things that are easy to miss:

- **Deadline feasibility** — if the requested deadline does not fit the current
  plan, the app works out the weekly hours needed and offers a quick adjustment.
- **Current role vs. target role** — someone saying "I'm a backend developer
  moving into ML" gets credit for their backend skills instead of being treated
  as a beginner.

Feedback also changes the rest of the plan, rather than only hiding the item
that was disliked.

---

## Quick start

Requires **Node 20+**.

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:3000>.

### Optional: enable the model layer

PathFinder runs **fully without an API key** — the whole recommendation engine
is local and deterministic. A key upgrades the language layer only.

```bash
cp .env.example .env.local
```

Then set **either** provider in `.env.local`:

```
GEMINI_API_KEY=...          # https://aistudio.google.com/apikey
```

```
ANTHROPIC_API_KEY=sk-ant-... # https://console.anthropic.com/settings/keys
```

If both are set, `AI_PROVIDER=gemini|anthropic` decides; otherwise whichever key
is present wins. Models default to `gemini-3.6-flash` and `claude-opus-5`,
overridable with `GEMINI_MODEL` / `ANTHROPIC_MODEL`.

> **Gemini free tier is ~20 requests per day, per model.** That is enough to try
> the app but not to demo it repeatedly. The quota is per *model*, so switching
> `GEMINI_MODEL` gives a fresh bucket; enabling billing removes the cap. When the
> quota is hit, every route falls back to the local engine and says so rather
> than erroring.

|  | No key | With a key |
|---|---|---|
| Skill-gap analysis, ranking, path generation, adaptation | Full | Full |
| Goal understanding from free text | Rule-based extractor | Model, structured output |
| Recommendation explanations | Deterministic templates | Model, grounded in the score breakdown |
| Open-ended Q&A tutor | Canned answers for common questions | Full streaming conversation |

The sidebar shows which mode is active ("Gemini assistant live", "Claude
assistant live", or "Offline engine mode"). `GET /api/status` reports it too.

### Other commands

```bash
npm run build && npm start
```

```bash
npm run typecheck
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser  ·  Next.js App Router (React 19, Tailwind v4)          │
│                                                                  │
│  /            conversational intake                              │
│  /dashboard   progress · skill radar · milestones · next actions │
│  /path        milestone roadmap, prerequisite-ordered            │
│  /explore     personalised catalog search                        │
│  /assistant   streaming Q&A tutor                                │
│  /profile     learner profiling engine surface                   │
│                                                                  │
│  State: Zustand + localStorage  (no account, no database)        │
└───────────────┬──────────────────────────────────────────────────┘
                │  profile + feedback
                ▼
┌──────────────────────────────────────────────────────────────────┐
│  RECOMMENDATION ENGINE  (pure TypeScript, runs client + server)  │
│                                                                  │
│  vectorize.ts  TF-IDF vector space · cosine retrieval            │
│  gap.ts        learner vector − target vector = skill gap        │
│  recommend.ts  6-component weighted ranking                      │
│  path.ts       set cover → prerequisite closure → topo sort      │
│  adapt.ts      online preference model from feedback             │
└───────────────┬──────────────────────────────────────────────────┘
                │  scored results + gaps + path as context
                ▼
┌──────────────────────────────────────────────────────────────────┐
│  Route handlers  →  Gemini  or  Claude  (provider-swappable)     │
│                                                                  │
│  /api/intake   structured output (Zod) → learner profile         │
│  /api/explain  natural-language rationale from score breakdown   │
│  /api/ask      streaming tutor grounded in the learner's plan    │
│  Every route falls back to the local engine on any failure.      │
└──────────────────────────────────────────────────────────────────┘
```

**The engine is the product; the model is the interface to it.** That separation is
deliberate — it makes recommendations reproducible, debuggable, explainable and
cheap, and it means an API outage degrades the experience instead of breaking it.

---

## The recommendation engine

### 1. Representation

A **skill taxonomy** of 55 skills across 8 domains, each with explicit
`parents` — this is the prerequisite DAG.

Two vectors over that taxonomy:

- **Learner vector** — fuses self-assessment, credit from completed resources
  (scaled by teaching depth), and a floor propagated down the prerequisite chain
  from anything they claim. Claiming Transformers implies you hold Python.
- **Target vector** — the role archetype's expected mastery per skill, plus its
  transitive prerequisites at 70% weight, plus any extra stated interests.

### 2. Skill-gap analysis

```
gap      = target − current                    (positive components only)
priority = 0.5·gap + 0.3·target + 0.2·foundationBonus
```

`foundationBonus` counts how many *other needed skills* depend on this one. This
term is what stops the planner recommending Transformers to someone who cannot
yet write a for-loop — foundations inherit urgency from everything above them.

### 3. Retrieval

A TF-IDF vector space over the catalog (title and tags upweighted, sub-linear TF
damping, smoothed IDF, L2-normalised) scored by cosine similarity against a
query fusing the learner's raw goal text, their resolved role, and their stated
interests.

Role matching combines the same cosine with an exact keyword-phrase bonus,
because role names are short high-precision signals that pure TF-IDF underweights.

One bug worth noting: the stemmer turns `learning` into `learn`, which
caused generic phrases such as "I want to learn X" to match the Machine Learning
role. The role matcher now uses a domain-specific stopword list (`STOPWORDS` in
`vectorize.ts`).

### 4. Ranking

Six interpretable components, weighted:

| Component | Weight | Meaning |
|---|---|---|
| `gapCoverage` | **0.34** | How much prioritised gap it closes (saturating) |
| `relevance` | 0.24 | TF-IDF cosine against the goal |
| `levelFit` | 0.16 | Difficulty vs learner level — *one step above is optimal* |
| `styleFit` | 0.10 | Learning-format preference |
| `quality` | 0.10 | Rating + popularity prior |
| `feedbackAdj` | 0.06 | Learned from thumbs up/down |

Unmet prerequisites apply a proportional penalty rather than a hard filter — the
planner would rather *schedule the prerequisite first* than discard a good target.

Every component is retained on the result, surfaced in the UI under **"Why this?"**,
and handed to the model as grounding. There is no unexplainable number anywhere.

### 5. Path generation — four stages

1. **SELECT** — greedy marginal-gain set cover. Each round picks the resource
   maximising *gap-weight closed per √hour*, against a simulated mastery vector
   that updates as items are chosen. Stops at 85% gap coverage.
2. **CLOSE** — for anything whose prerequisites the learner lacks, recursively
   pull in the best resource teaching each missing prerequisite.
3. **ORDER** — Kahn's topological sort over the resulting dependency DAG. Ties
   broken by difficulty then score, keeping foundations early and depth late.
   Cycles are appended rather than silently dropped.
4. **GROUP** — slice the ordered steps into 2–5 hour-balanced milestones, named
   from the skills they unlock and time-boxed against `hoursPerWeek`.

### 6. Adaptation

Feedback is treated as evidence about **attributes**, not just one item.
Rejecting two advanced courses as "too hard" shifts the learner's *effective
level* down, which changes `levelFit` for the entire catalog and regenerates the
path. Liking projects lifts every project.

- Exponential recency decay (~1 month half-life)
- Bounded per-attribute adjustments so no single rating can dominate
- Every adjustment produces a human-readable note shown on `/path` and `/dashboard`

---

## Where the model fits

Because the engine is local, the model is genuinely swappable. `src/lib/ai/provider.ts`
defines the three capabilities the app needs, and `src/lib/ai/providers/`
implements them for **Gemini** (`@google/genai`) and **Claude**
(`@anthropic-ai/sdk`). Adding a third provider means one file.

| Capability | Used by | Gemini | Claude |
|---|---|---|---|
| `extract` — structured JSON | `/api/intake` | `responseMimeType` + `responseJsonSchema` | `messages.parse()` + `zodOutputFormat` |
| `complete` — one-shot text | `/api/explain` | `models.generateContent` | `messages.stream().finalMessage()` |
| `stream` — token deltas | `/api/ask` | `models.generateContentStream` | `messages.stream()` |

**`POST /api/intake`** turns free-form text into a validated profile. The
result is parsed with Zod, and skill and role ids are checked against the
taxonomy before they reach the recommendation engine.

**`POST /api/explain`** gets the six score components and turns them into
a short explanation.

**`POST /api/ask`** is the streaming tutor. It gets the learner profile,
current gaps, generated path, and feedback adjustments as context.

Engineering notes:

- The intake JSON Schema for Gemini is hand-written rather than derived from Zod:
  Gemini supports a documented *subset* of JSON Schema and expresses nullables as
  `anyOf`, not the `type: [..., "null"]` union `z.toJSONSchema` emits.
- Provider SDKs are imported lazily, so the unused vendor is never loaded.
- Streaming responses fail *during iteration*, not at call time, so `/api/ask`
  catches inside the stream and emits a useful local answer if nothing streamed yet.
- Prompts tell the model to stick to the courses, scores, and skills
  provided by the app.

---

## Project structure

```
src/
├── app/
│   ├── page.tsx              landing + conversational intake
│   ├── dashboard/            progress, radar, milestones, next actions
│   ├── path/                 milestone roadmap
│   ├── explore/              personalised catalog search
│   ├── assistant/            streaming Q&A
│   ├── profile/              learner profiling surface
│   └── api/{intake,explain,ask,status}/
├── components/
│   ├── ChatIntake.tsx        conversational profiling flow
│   ├── ResourceCard.tsx      card + feedback + score breakdown
│   ├── SkillRadar.tsx        radar chart + gap bars
│   ├── PageShell.tsx  Nav.tsx  ui.tsx  icons.tsx
└── lib/
    ├── data/{skills,roles,catalog}.ts    taxonomy · archetypes · 79 resources
    ├── engine/{vectorize,gap,recommend,path,adapt}.ts
    ├── ai/{client,prompts,fallback}.ts
    ├── store.ts  useDerived.ts  schema.ts  types.ts  utils.ts
```

Nothing derived is ever persisted. Gaps, ranking and the path are recomputed
from the profile on demand, so they cannot drift out of sync with it.

---

## Deployment

### Vercel (how the live app is deployed)

1. Push to GitHub.
2. Import the repo at [vercel.com/new](https://vercel.com/new). Next.js is
   detected automatically — no build configuration needed.
3. Add `GEMINI_API_KEY` (or `ANTHROPIC_API_KEY`) under **Settings → Environment
   Variables**, scoped to Production. It stays server-side: every model call goes
   through a route handler, so the key is never shipped to the browser.
4. Deploy.

> `next.config.ts` gates `output: "standalone"` on the `VERCEL` env var. The
> standalone bundle is what the Dockerfile copies, but Vercel runs its own file
> tracing and fails the build with a missing `next-server.js.nft.json` if it is
> set. Both paths are verified.

The app deploys without any environment variable at all and works in engine mode.

### Any Node host

```bash
npm ci && npm run build && npm start
```

Serves on `$PORT` (default 3000). No database, no external service, no
migrations — learner state is client-side.

### Docker

```bash
docker build -t pathfinder . && docker run -p 3000:3000 pathfinder
```

---

## Design decisions

**Why a local engine instead of asking an LLM for the path?**
The path needs to be predictable. If an LLM generated the whole thing, the
result could change between runs, include resources that are not in the
catalog, or put prerequisites in the wrong order.

Here retrieval, scoring, and sequencing are deterministic. The model is used
for the parts where natural language is actually useful: understanding the
initial goal, explaining a recommendation, and answering questions.

**Why no database?**
The learner record is small and belongs to the learner. localStorage means zero
setup, zero PII on a server, one-click deploy, and a working private profile the
moment the page opens. The state shape in `src/lib/store.ts` maps directly onto a
`users` table when multi-device sync is wanted.

**Why a synthetic catalog?**
The 79 catalog entries are synthetic, but they have the fields a real catalog
would need: provider, level, estimated hours, rating, skills, and prerequisites.
That keeps the project self-contained.

The engine is not tied to these particular rows, so a live catalog could be
plugged in through `src/lib/data/catalog.ts`.

**Why show the score breakdown?**
The six components make it possible to see why an item ranked where it did.
That also makes the feedback controls more useful: the learner can disagree
with the recommendation, and the system can adjust future rankings.

---

## Limitations

There are a few important limitations:

- **The catalog is synthetic.** Realistic in structure, but these are not live
  course listings and carry no URLs — I would rather ship no link than a
  fabricated one.
- **Retrieval is lexical, not neural.** TF-IDF cosine handles paraphrase poorly
  compared to a real embedding model. It was chosen so the engine runs offline
  and deterministically; `scoreResourcesAgainstQuery` is the single seam where an
  embedding index would drop in.
- **Skill mastery is self-reported.** The assessment resources in the catalog are
  placeholders — real graded assessments feeding measured mastery back into the
  learner vector is the obvious next step.
- **Feedback adaptation is a bounded heuristic**, not a trained bandit. With real
  usage data, the six ranking weights should be *learned* rather than hand-set.
- **No multi-device sync.** State is per-browser by design; see above.
- **Gemini is the verified path; Claude is not.** All three call sites were
  exercised end to end against the live Gemini API. The Claude implementation is
  written against the documented SDK API and typechecks against its real types,
  but the credential available while building was a proxy key that returns 401,
  so it was only exercised through its fallback path.
- **Gemini free tier allows ~20 requests/day per model**, which is a real
  constraint when demoing. Falls back to the local engine when exhausted.
- **`gemini-3.7-flash` returns 503 under load.** The default is `gemini-3.6-flash`
  for that reason; override with `GEMINI_MODEL` if you want the newer flagship.
