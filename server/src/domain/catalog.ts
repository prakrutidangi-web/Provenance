/**
 * Kernelcraft's catalog: online courses for engineers (a fictional advertiser).
 *
 * The server is the source of truth for prices: orders are priced here, never
 * from numbers the browser sends. Courses are digital, so there's no shipping
 * and each can be bought once per order.
 */
export type TrackId = "ai" | "frontend" | "backend" | "data" | "devops" | "security" | "mobile" | "career";

export interface Track {
  id: TrackId;
  name: string;
  blurb: string;
  accent: string; // cover accent color
}

export interface Instructor {
  name: string;
  title: string;
}

export interface Product {
  id: string;
  kind: "course" | "plan";
  name: string;
  subtitle: string;
  code: string; // course code shown on the cover, e.g. KC-201
  track: TrackId;
  level: "Beginner" | "Intermediate" | "Advanced" | "All levels";
  durationMin: number;
  lessons: number;
  instructor: Instructor;
  priceCents: number;
  compareAtCents?: number;
  badge?: "Bestseller" | "New" | "Sale" | "Updated";
  updated: string;
  snippet: string[]; // a few lines of code for the cover art
  outcomes: string[];
  syllabus: { title: string; lessons: number }[];
}

export const CURRENCY = "USD";

export const TRACKS: Track[] = [
  { id: "ai", name: "AI Engineering", blurb: "RAG, agents, evals and shipping LLM features", accent: "#ff6b3d" },
  { id: "frontend", name: "Frontend", blurb: "TypeScript, React and interfaces for AI apps", accent: "#4da3ff" },
  { id: "backend", name: "Backend & Systems", blurb: "Design, databases and distributed systems", accent: "#3fcf8e" },
  { id: "data", name: "Data", blurb: "Pipelines and real-time analytics", accent: "#c792ea" },
  { id: "devops", name: "DevOps & Cloud", blurb: "Containers, CI/CD, infrastructure and observability", accent: "#ffcb6b" },
  { id: "security", name: "Security", blurb: "Application security, auth and securing LLM apps", accent: "#ff6f91" },
  { id: "mobile", name: "Mobile", blurb: "Native and cross-platform apps", accent: "#7aa8ff" },
  { id: "career", name: "Career", blurb: "Growing from senior to staff and beyond", accent: "#b48cff" },
];

const I = {
  maya: { name: "Maya Okafor", title: "Staff ML Engineer" },
  dev: { name: "Dev Raman", title: "Principal Engineer, Search" },
  lena: { name: "Lena Brandt", title: "Engineering Manager, AI Platform" },
  sam: { name: "Sam Whitfield", title: "Senior Frontend Engineer" },
  ines: { name: "Inés Navarro", title: "Staff Engineer, Web Performance" },
  tomas: { name: "Tomás Reyes", title: "Distinguished Engineer" },
  priya: { name: "Priya Shah", title: "Database Reliability Engineer" },
  kofi: { name: "Kofi Mensah", title: "Data Platform Lead" },
  hana: { name: "Hana Kim", title: "Platform Engineer" },
  arjun: { name: "Arjun Mehta", title: "Research Engineer, Applied ML" },
  claire: { name: "Claire Dubois", title: "Design Systems Lead" },
  marcus: { name: "Marcus Bell", title: "Staff Backend Engineer" },
  yuki: { name: "Yuki Tanaka", title: "Analytics Engineering Lead" },
  olu: { name: "Olu Adeyemi", title: "Site Reliability Engineer" },
  rosa: { name: "Rosa Lindqvist", title: "Application Security Engineer" },
  ben: { name: "Ben Carter", title: "Mobile Tech Lead" },
  nadia: { name: "Nadia Haddad", title: "Principal Engineer" },
};

export const PRODUCTS: Product[] = [
  // ---------------------------------------------------------------- AI
  {
    id: "production-rag", kind: "course", code: "KC-301", track: "ai", level: "Intermediate",
    name: "Production RAG", subtitle: "Retrieval-augmented generation that holds up under real traffic",
    durationMin: 280, lessons: 38, instructor: I.maya,
    priceCents: 12900, badge: "Bestseller", updated: "Sep 2026",
    snippet: ["const hits = await index.query(", "  embed(question), { topK: 20 }", ");", "const context = rerank(question, hits)", "  .slice(0, 5);"],
    outcomes: ["Chunk, embed and index documents the right way for your data", "Combine vector and keyword search with reranking", "Measure retrieval quality with offline evals", "Cut latency and cost with caching and smaller models"],
    syllabus: [{ title: "Why naive RAG fails", lessons: 4 }, { title: "Chunking and embeddings", lessons: 7 }, { title: "Hybrid search and reranking", lessons: 8 }, { title: "Evaluating retrieval", lessons: 6 }, { title: "Latency, cost and caching", lessons: 7 }, { title: "Shipping to production", lessons: 6 }],
  },
  {
    id: "llm-evals", kind: "course", code: "KC-305", track: "ai", level: "Intermediate",
    name: "Evaluating LLM Apps", subtitle: "Build eval suites that catch regressions before your users do",
    durationMin: 210, lessons: 29, instructor: I.lena,
    priceCents: 9900, badge: "New", updated: "Sep 2026",
    snippet: ["for (const c of dataset) {", "  const out = await app(c.input);", "  score(out, c.expected, [", "    faithfulness, relevance,", "  ]);", "}"],
    outcomes: ["Design golden datasets from real user traffic", "Write model-graded and deterministic checks", "Run evals in CI and block bad prompt changes", "Track quality over time in dashboards"],
    syllabus: [{ title: "What to measure", lessons: 5 }, { title: "Building datasets", lessons: 6 }, { title: "Graders and rubrics", lessons: 7 }, { title: "Evals in CI", lessons: 5 }, { title: "Online monitoring", lessons: 6 }],
  },
  {
    id: "ai-agents", kind: "course", code: "KC-320", track: "ai", level: "Advanced",
    name: "Building AI Agents with Tool Use", subtitle: "Design reliable agents that call tools, recover from errors and know when to stop",
    durationMin: 340, lessons: 44, instructor: I.dev,
    priceCents: 14900, badge: "Updated", updated: "Aug 2026",
    snippet: ["while (!done) {", "  const step = await model.next(ctx);", "  if (step.tool) {", "    ctx.push(await run(step.tool));", "  } else done = true;", "}"],
    outcomes: ["Model tools with strict schemas", "Build planning and retry loops that converge", "Add guardrails, budgets and human approval", "Trace and debug multi-step runs"],
    syllabus: [{ title: "The agent loop", lessons: 6 }, { title: "Designing tools", lessons: 8 }, { title: "Planning and memory", lessons: 9 }, { title: "Failure handling", lessons: 8 }, { title: "Safety and approvals", lessons: 6 }, { title: "Observability for agents", lessons: 7 }],
  },
  {
    id: "prompting-for-devs", kind: "course", code: "KC-110", track: "ai", level: "Beginner",
    name: "Prompt Engineering for Developers", subtitle: "Structured prompts, outputs you can parse, and fewer surprises",
    durationMin: 120, lessons: 18, instructor: I.lena,
    priceCents: 4900, badge: "Bestseller", updated: "Jul 2026",
    snippet: ["const res = await llm.generate({", "  system: rules,", "  messages,", "  schema: TicketSummary,", "});"],
    outcomes: ["Write prompts that are testable and versioned", "Get structured JSON out reliably", "Use few-shot examples well", "Know when to fine-tune instead"],
    syllabus: [{ title: "Prompt anatomy", lessons: 4 }, { title: "Structured outputs", lessons: 5 }, { title: "Examples and context", lessons: 5 }, { title: "Prompts as code", lessons: 4 }],
  },

  // ---------------------------------------------------------------- Frontend
  {
    id: "typescript-deep-dive", kind: "course", code: "KC-204", track: "frontend", level: "Intermediate",
    name: "TypeScript Deep Dive", subtitle: "Generics, inference and type-level patterns you'll actually use",
    durationMin: 300, lessons: 41, instructor: I.sam,
    priceCents: 8900, badge: "Bestseller", updated: "Jun 2026",
    snippet: ["type Event<T extends string> = {", "  name: T;", "  props: Props[T];", "};", "track<'Purchase'>(e);"],
    outcomes: ["Read and write advanced generics", "Model APIs with discriminated unions", "Validate at runtime without duplicating types", "Speed up large codebases' type-checking"],
    syllabus: [{ title: "Inference, for real", lessons: 7 }, { title: "Generics", lessons: 9 }, { title: "Unions and narrowing", lessons: 8 }, { title: "Runtime validation", lessons: 7 }, { title: "Scaling a codebase", lessons: 10 }],
  },
  {
    id: "react-performance", kind: "course", code: "KC-212", track: "frontend", level: "Advanced",
    name: "React Performance", subtitle: "Find and fix slow renders with the profiler, not guesswork",
    durationMin: 230, lessons: 32, instructor: I.ines,
    priceCents: 9900, updated: "May 2026",
    snippet: ["const rows = useMemo(", "  () => virtualize(items, view),", "  [items, view]", ");"],
    outcomes: ["Profile renders and read flame graphs", "Fix re-render cascades", "Virtualize long lists", "Measure Core Web Vitals in the field"],
    syllabus: [{ title: "Measuring first", lessons: 6 }, { title: "Rendering model", lessons: 7 }, { title: "State and memoization", lessons: 8 }, { title: "Big lists and data", lessons: 6 }, { title: "Field metrics", lessons: 5 }],
  },
  {
    id: "streaming-ui", kind: "course", code: "KC-218", track: "frontend", level: "Intermediate",
    name: "Streaming UIs for AI Apps", subtitle: "Token streaming, partial JSON and interfaces that feel instant",
    durationMin: 150, lessons: 22, instructor: I.sam,
    priceCents: 7900, badge: "New", updated: "Sep 2026",
    snippet: ["for await (const chunk of stream) {", "  setText((t) => t + chunk.delta);", "}"],
    outcomes: ["Stream tokens over SSE and fetch", "Render partial structured output", "Handle cancel, retry and errors", "Design chat UX people trust"],
    syllabus: [{ title: "Streaming protocols", lessons: 5 }, { title: "Rendering partial output", lessons: 6 }, { title: "Interruptions and errors", lessons: 5 }, { title: "Chat UX patterns", lessons: 6 }],
  },

  // ---------------------------------------------------------------- Backend
  {
    id: "system-design", kind: "course", code: "KC-401", track: "backend", level: "Advanced",
    name: "System Design for Product Engineers", subtitle: "Make the trade-offs behind systems that scale, and explain them",
    durationMin: 420, lessons: 52, instructor: I.tomas,
    priceCents: 14900, badge: "Bestseller", updated: "Aug 2026",
    snippet: ["POST /events  -> 202 Accepted", "  -> kafka.topic('events')", "  -> dedupe(event_id)", "  -> clickhouse.insert()"],
    outcomes: ["Estimate load and storage on a napkin", "Choose between consistency models", "Design idempotent, retry-safe APIs", "Scale reads and writes independently"],
    syllabus: [{ title: "Back-of-envelope math", lessons: 6 }, { title: "Data models and storage", lessons: 10 }, { title: "Queues and async work", lessons: 9 }, { title: "Consistency and idempotency", lessons: 9 }, { title: "Caching", lessons: 8 }, { title: "Case studies", lessons: 10 }],
  },
  {
    id: "postgres-performance", kind: "course", code: "KC-330", track: "backend", level: "Intermediate",
    name: "Postgres Performance Tuning", subtitle: "Indexes, query plans and the settings that matter",
    durationMin: 260, lessons: 35, instructor: I.priya,
    priceCents: 10900, updated: "Jul 2026",
    snippet: ["EXPLAIN (ANALYZE, BUFFERS)", "SELECT source, count(DISTINCT user_id)", "FROM touches", "WHERE occurred_at > now() - '7d'", "GROUP BY source;"],
    outcomes: ["Read EXPLAIN ANALYZE output fluently", "Pick the right index type", "Find and fix slow queries in production", "Tune vacuum, memory and connections"],
    syllabus: [{ title: "How Postgres executes a query", lessons: 7 }, { title: "Indexing", lessons: 9 }, { title: "Query patterns", lessons: 8 }, { title: "Operations", lessons: 11 }],
  },
  {
    id: "event-driven-kafka", kind: "course", code: "KC-410", track: "backend", level: "Advanced",
    name: "Event-Driven Systems with Kafka", subtitle: "Design streams, consumers and exactly-once-ish pipelines",
    durationMin: 310, lessons: 40, instructor: I.tomas,
    priceCents: 12900, updated: "Jun 2026",
    snippet: ["consumer.run({", "  eachMessage: async ({ message }) => {", "    await handle(decode(message));", "  },", "});"],
    outcomes: ["Partition topics for ordering and scale", "Write idempotent consumers", "Handle replays and backfills", "Monitor lag and recover from failures"],
    syllabus: [{ title: "Logs, not queues", lessons: 6 }, { title: "Producers and partitions", lessons: 8 }, { title: "Consumers", lessons: 9 }, { title: "Delivery guarantees", lessons: 8 }, { title: "Running Kafka", lessons: 9 }],
  },

  // ---------------------------------------------------------------- Data
  {
    id: "clickhouse-analytics", kind: "course", code: "KC-350", track: "data", level: "Intermediate",
    name: "Real-Time Analytics with ClickHouse", subtitle: "Sub-second queries over billions of events",
    durationMin: 240, lessons: 31, instructor: I.kofi,
    priceCents: 11900, badge: "New", updated: "Sep 2026",
    snippet: ["CREATE MATERIALIZED VIEW daily", "ENGINE = SummingMergeTree", "AS SELECT toDate(ts) AS day,", "  source, uniq(user_id) AS users", "FROM events GROUP BY day, source;"],
    outcomes: ["Choose table engines and sort keys", "Build materialized rollups", "Ingest from Kafka", "Keep dashboards fast as data grows"],
    syllabus: [{ title: "Columnar thinking", lessons: 5 }, { title: "Table engines", lessons: 7 }, { title: "Materialized views", lessons: 7 }, { title: "Ingestion", lessons: 6 }, { title: "Production ops", lessons: 6 }],
  },
  {
    id: "python-data-pipelines", kind: "course", code: "KC-240", track: "data", level: "Beginner",
    name: "Data Pipelines in Python", subtitle: "From messy CSVs to reliable, scheduled pipelines",
    durationMin: 200, lessons: 28, instructor: I.kofi,
    priceCents: 8900, compareAtCents: 11900, badge: "Sale", updated: "Apr 2026",
    snippet: ["@task(retries=3)", "def load(rows: list[Order]):", "    validate(rows)", "    warehouse.upsert(rows)"],
    outcomes: ["Extract, validate and load data safely", "Make jobs idempotent and retryable", "Schedule and monitor pipelines", "Test data transformations"],
    syllabus: [{ title: "Pipeline basics", lessons: 6 }, { title: "Validation", lessons: 6 }, { title: "Orchestration", lessons: 8 }, { title: "Testing and monitoring", lessons: 8 }],
  },

  // ---------------------------------------------------------------- DevOps
  {
    id: "terraform-aws", kind: "course", code: "KC-260", track: "devops", level: "Intermediate",
    name: "Terraform on AWS", subtitle: "Infrastructure as code your whole team can change safely",
    durationMin: 270, lessons: 36, instructor: I.hana,
    priceCents: 9900, compareAtCents: 12900, badge: "Sale", updated: "Jul 2026",
    snippet: ['resource "aws_ecs_service" "api" {', "  desired_count = 3", "  launch_type   = \"FARGATE\"", "}"],
    outcomes: ["Structure modules and environments", "Manage state and locking", "Review plans safely in CI", "Migrate click-ops infrastructure to code"],
    syllabus: [{ title: "Terraform fundamentals", lessons: 7 }, { title: "Modules", lessons: 8 }, { title: "State", lessons: 7 }, { title: "CI/CD for infra", lessons: 7 }, { title: "Real AWS stacks", lessons: 7 }],
  },
  {
    id: "observability-otel", kind: "course", code: "KC-270", track: "devops", level: "Intermediate",
    name: "Observability with OpenTelemetry", subtitle: "Traces, metrics and logs that answer real questions",
    durationMin: 190, lessons: 26, instructor: I.hana,
    priceCents: 8900, updated: "Aug 2026",
    snippet: ["const span = tracer.startSpan('ingest');", "span.setAttribute('batch.size', n);", "// ...", "span.end();"],
    outcomes: ["Instrument services with OpenTelemetry", "Correlate traces, logs and metrics", "Build SLOs and alerts people trust", "Debug latency across services"],
    syllabus: [{ title: "Signals and semantics", lessons: 5 }, { title: "Tracing", lessons: 7 }, { title: "Metrics and SLOs", lessons: 7 }, { title: "Logs and correlation", lessons: 7 }],
  },

  // ---------------------------------------------------------------- More AI
  {
    id: "fine-tuning-llms", kind: "course", code: "KC-340", track: "ai", level: "Advanced",
    name: "Fine-Tuning Open LLMs", subtitle: "LoRA, data curation and knowing when not to fine-tune",
    durationMin: 250, lessons: 32, instructor: I.arjun,
    priceCents: 13900, badge: "New", updated: "Sep 2026",
    snippet: ["trainer = SFTTrainer(", "  model, train_ds,", "  peft_config=LoraConfig(r=16),", ")", "trainer.train()"],
    outcomes: ["Decide between prompting, RAG and fine-tuning with data", "Curate and clean instruction datasets", "Train LoRA adapters on a single GPU", "Evaluate and serve your fine-tuned model"],
    syllabus: [{ title: "When fine-tuning pays off", lessons: 4 }, { title: "Building the dataset", lessons: 7 }, { title: "LoRA and QLoRA", lessons: 8 }, { title: "Evaluation", lessons: 6 }, { title: "Serving adapters", lessons: 7 }],
  },
  {
    id: "multimodal-apps", kind: "course", code: "KC-342", track: "ai", level: "Intermediate",
    name: "Multimodal AI Apps", subtitle: "Build features that see, read and listen",
    durationMin: 190, lessons: 26, instructor: I.maya,
    priceCents: 10900, updated: "Aug 2026",
    snippet: ["const res = await llm.generate({", "  input: [image, question],", "});", "const text = await transcribe(audio);"],
    outcomes: ["Extract structured data from screenshots and PDFs", "Add speech input and output to an app", "Handle image inputs safely and cheaply", "Evaluate multimodal outputs"],
    syllabus: [{ title: "Vision inputs", lessons: 6 }, { title: "Documents and PDFs", lessons: 6 }, { title: "Speech in and out", lessons: 6 }, { title: "Cost, latency and evals", lessons: 8 }],
  },
  {
    id: "ml-foundations", kind: "course", code: "KC-120", track: "ai", level: "Beginner",
    name: "ML Foundations for Engineers", subtitle: "The math and intuition behind the models you call",
    durationMin: 300, lessons: 40, instructor: I.arjun,
    priceCents: 8900, badge: "Bestseller", updated: "Jul 2026",
    snippet: ["loss = ((pred - y) ** 2).mean()", "loss.backward()", "opt.step()"],
    outcomes: ["Understand gradients, loss and training loops", "Train and evaluate a small model from scratch", "Read model cards and papers with confidence", "Know what embeddings and attention actually do"],
    syllabus: [{ title: "Vectors and gradients", lessons: 8 }, { title: "Training loops", lessons: 8 }, { title: "Neural networks", lessons: 8 }, { title: "Embeddings", lessons: 7 }, { title: "Attention and transformers", lessons: 9 }],
  },
  {
    id: "local-llms", kind: "course", code: "KC-344", track: "ai", level: "Intermediate",
    name: "Running LLMs Locally", subtitle: "Quantization, inference servers and private deployments",
    durationMin: 160, lessons: 22, instructor: I.dev,
    priceCents: 7900, updated: "Sep 2026",
    snippet: ["$ ollama run llama3", "$ vllm serve ./model \\", "    --quantization awq"],
    outcomes: ["Pick a model and quantization for your hardware", "Run an OpenAI-compatible inference server", "Benchmark throughput and latency", "Deploy privately for sensitive data"],
    syllabus: [{ title: "Hardware and model choice", lessons: 5 }, { title: "Quantization", lessons: 5 }, { title: "Inference servers", lessons: 6 }, { title: "Production deployment", lessons: 6 }],
  },
  {
    id: "vector-databases", kind: "course", code: "KC-346", track: "ai", level: "Intermediate",
    name: "Vector Databases in Practice", subtitle: "pgvector, HNSW and filtering at scale",
    durationMin: 170, lessons: 23, instructor: I.priya,
    priceCents: 8900, updated: "Aug 2026",
    snippet: ["CREATE INDEX ON docs", "USING hnsw (embedding vector_cosine_ops);"],
    outcomes: ["Choose between pgvector and a dedicated vector store", "Tune HNSW and IVF indexes", "Combine vector search with metadata filters", "Plan capacity for millions of vectors"],
    syllabus: [{ title: "How ANN search works", lessons: 5 }, { title: "pgvector", lessons: 6 }, { title: "Index tuning", lessons: 6 }, { title: "Filtering and scale", lessons: 6 }],
  },
  {
    id: "ai-product-design", kind: "course", code: "KC-150", track: "ai", level: "All levels",
    name: "Designing AI Products", subtitle: "UX patterns for features that are sometimes wrong",
    durationMin: 140, lessons: 20, instructor: I.lena,
    priceCents: 6900, updated: "Jun 2026",
    snippet: ["<Answer", "  sources={citations}", "  onFeedback={log}", "/>"],
    outcomes: ["Design for uncertainty and graceful failure", "Show sources and build user trust", "Collect feedback that improves the model", "Measure whether the AI feature is working"],
    syllabus: [{ title: "Where AI fits", lessons: 4 }, { title: "Trust and citations", lessons: 5 }, { title: "Feedback loops", lessons: 5 }, { title: "Measuring success", lessons: 6 }],
  },
  // ---------------------------------------------------------------- More frontend
  {
    id: "nextjs-app-router", kind: "course", code: "KC-220", track: "frontend", level: "Intermediate",
    name: "Next.js App Router", subtitle: "Server components, caching and data fetching that make sense",
    durationMin: 230, lessons: 31, instructor: I.sam,
    priceCents: 9900, badge: "Bestseller", updated: "Sep 2026",
    snippet: ["export default async function Page() {", "  const data = await getCourses();", "  return <Grid items={data} />;", "}"],
    outcomes: ["Split server and client components correctly", "Control caching and revalidation", "Stream pages with Suspense", "Deploy and monitor a Next.js app"],
    syllabus: [{ title: "Routing and layouts", lessons: 6 }, { title: "Server components", lessons: 7 }, { title: "Data and caching", lessons: 8 }, { title: "Streaming", lessons: 5 }, { title: "Shipping", lessons: 5 }],
  },
  {
    id: "modern-css", kind: "course", code: "KC-130", track: "frontend", level: "Beginner",
    name: "Modern CSS Layout", subtitle: "Grid, container queries and layouts that don't break",
    durationMin: 150, lessons: 24, instructor: I.claire,
    priceCents: 5900, compareAtCents: 7900, badge: "Sale", updated: "Jul 2026",
    snippet: [".grid {", "  display: grid;", "  grid-template-columns:", "    repeat(auto-fill, minmax(16rem, 1fr));", "}"],
    outcomes: ["Build any layout with grid and flexbox", "Use container queries for real components", "Make type and spacing fluid", "Debug layout bugs quickly"],
    syllabus: [{ title: "Flexbox", lessons: 5 }, { title: "Grid", lessons: 7 }, { title: "Container queries", lessons: 6 }, { title: "Fluid design", lessons: 6 }],
  },
  {
    id: "accessibility-engineering", kind: "course", code: "KC-230", track: "frontend", level: "Intermediate",
    name: "Accessibility Engineering", subtitle: "Ship interfaces everyone can use, and test them in CI",
    durationMin: 170, lessons: 25, instructor: I.ines,
    priceCents: 7900, updated: "Aug 2026",
    snippet: ["<button", "  aria-expanded={open}", "  aria-controls=\"menu\"", ">"],
    outcomes: ["Build accessible forms, menus and dialogs", "Test with screen readers and keyboards", "Automate accessibility checks in CI", "Fix the most common WCAG failures"],
    syllabus: [{ title: "Semantics first", lessons: 5 }, { title: "Keyboard and focus", lessons: 6 }, { title: "Screen readers", lessons: 6 }, { title: "Testing in CI", lessons: 8 }],
  },
  {
    id: "design-systems", kind: "course", code: "KC-235", track: "frontend", level: "Advanced",
    name: "Building Design Systems", subtitle: "Tokens, components and a library teams actually adopt",
    durationMin: 200, lessons: 27, instructor: I.claire,
    priceCents: 10900, updated: "Sep 2026",
    snippet: [":root {", "  --primary: #6c47ff;", "  --radius: 8px;", "}"],
    outcomes: ["Design a token system for themes", "Build accessible, composable components", "Document and version the library", "Drive adoption across teams"],
    syllabus: [{ title: "Tokens", lessons: 6 }, { title: "Components", lessons: 8 }, { title: "Docs and versioning", lessons: 6 }, { title: "Adoption", lessons: 7 }],
  },
  // ---------------------------------------------------------------- More backend
  {
    id: "go-microservices", kind: "course", code: "KC-420", track: "backend", level: "Intermediate",
    name: "Microservices in Go", subtitle: "gRPC, retries and services you can debug at 3am",
    durationMin: 260, lessons: 34, instructor: I.marcus,
    priceCents: 11900, updated: "Aug 2026",
    snippet: ["ctx, cancel := context.WithTimeout(ctx, 2*time.Second)", "defer cancel()", "res, err := client.GetOrder(ctx, req)"],
    outcomes: ["Design service boundaries that hold up", "Build gRPC services with deadlines and retries", "Trace requests across services", "Deploy and roll back safely"],
    syllabus: [{ title: "Go for services", lessons: 6 }, { title: "gRPC", lessons: 7 }, { title: "Resilience", lessons: 8 }, { title: "Observability", lessons: 6 }, { title: "Deployment", lessons: 7 }],
  },
  {
    id: "api-design", kind: "course", code: "KC-225", track: "backend", level: "Beginner",
    name: "API Design That Lasts", subtitle: "REST, versioning, pagination and idempotency done right",
    durationMin: 130, lessons: 19, instructor: I.tomas,
    priceCents: 6900, badge: "Bestseller", updated: "Jul 2026",
    snippet: ["POST /v1/orders", "Idempotency-Key: 8f3c...", "", "201 Created"],
    outcomes: ["Design resources and errors clients love", "Version without breaking integrations", "Paginate, filter and rate limit", "Make writes safe to retry"],
    syllabus: [{ title: "Resources and errors", lessons: 5 }, { title: "Versioning", lessons: 4 }, { title: "Pagination and limits", lessons: 5 }, { title: "Idempotency", lessons: 5 }],
  },
  {
    id: "redis-caching", kind: "course", code: "KC-335", track: "backend", level: "Intermediate",
    name: "Caching with Redis", subtitle: "Cache patterns, invalidation and avoiding stampedes",
    durationMin: 120, lessons: 18, instructor: I.priya,
    priceCents: 6900, updated: "Jun 2026",
    snippet: ["const hit = await redis.get(key);", "if (hit) return JSON.parse(hit);", "await redis.set(key, val, \"EX\", 60);"],
    outcomes: ["Choose cache-aside, write-through or write-behind", "Invalidate without serving stale data", "Prevent cache stampedes", "Use Redis for rate limits and queues"],
    syllabus: [{ title: "Cache patterns", lessons: 5 }, { title: "Invalidation", lessons: 5 }, { title: "Stampedes and hot keys", lessons: 4 }, { title: "Beyond caching", lessons: 4 }],
  },
  {
    id: "rust-backend", kind: "course", code: "KC-430", track: "backend", level: "Advanced",
    name: "Rust for Backend Engineers", subtitle: "Ownership, async and fast, safe web services",
    durationMin: 320, lessons: 41, instructor: I.marcus,
    priceCents: 13900, badge: "New", updated: "Sep 2026",
    snippet: ["async fn handler(", "  State(db): State<Pool>,", ") -> Json<Vec<Order>> {", "  Json(db.orders().await)", "}"],
    outcomes: ["Write idiomatic Rust without fighting the borrow checker", "Build async web services with Axum", "Handle errors and testing properly", "Profile and optimize hot paths"],
    syllabus: [{ title: "Ownership", lessons: 8 }, { title: "Traits and errors", lessons: 8 }, { title: "Async Rust", lessons: 9 }, { title: "Axum services", lessons: 9 }, { title: "Performance", lessons: 7 }],
  },
  // ---------------------------------------------------------------- More data
  {
    id: "dbt-analytics", kind: "course", code: "KC-245", track: "data", level: "Intermediate",
    name: "Analytics Engineering with dbt", subtitle: "Tested, documented SQL models your team can trust",
    durationMin: 180, lessons: 25, instructor: I.yuki,
    priceCents: 8900, updated: "Aug 2026",
    snippet: ["select", "  user_id,", "  count(*) as orders", "from {{ ref('stg_orders') }}", "group by 1"],
    outcomes: ["Structure staging, intermediate and mart models", "Test and document every model", "Build incremental models", "Run dbt in CI"],
    syllabus: [{ title: "Project structure", lessons: 5 }, { title: "Tests and docs", lessons: 6 }, { title: "Incremental models", lessons: 7 }, { title: "CI and deployment", lessons: 7 }],
  },
  {
    id: "spark-at-scale", kind: "course", code: "KC-355", track: "data", level: "Advanced",
    name: "Spark at Scale", subtitle: "Partitioning, shuffles and jobs that finish on time",
    durationMin: 240, lessons: 30, instructor: I.kofi,
    priceCents: 11900, updated: "Jul 2026",
    snippet: ["df.repartition(\"user_id\")", "  .groupBy(\"user_id\")", "  .agg(sum(\"value\"))"],
    outcomes: ["Read Spark plans and find slow stages", "Fix skew and expensive shuffles", "Tune memory and partitions", "Build reliable batch and streaming jobs"],
    syllabus: [{ title: "How Spark runs", lessons: 6 }, { title: "Plans and shuffles", lessons: 7 }, { title: "Skew and tuning", lessons: 9 }, { title: "Streaming", lessons: 8 }],
  },
  {
    id: "sql-for-engineers", kind: "course", code: "KC-115", track: "data", level: "Beginner",
    name: "SQL for Engineers", subtitle: "Joins, window functions and queries you can reason about",
    durationMin: 150, lessons: 26, instructor: I.yuki,
    priceCents: 4900, compareAtCents: 6900, badge: "Sale", updated: "Sep 2026",
    snippet: ["select *, row_number() over (", "  partition by user_id", "  order by created_at desc", ") as rn from orders"],
    outcomes: ["Write joins and aggregations confidently", "Use window functions for real problems", "Read query plans", "Model tables for analytics"],
    syllabus: [{ title: "Selecting and joining", lessons: 7 }, { title: "Aggregation", lessons: 6 }, { title: "Window functions", lessons: 7 }, { title: "Performance basics", lessons: 6 }],
  },
  // ---------------------------------------------------------------- More DevOps
  {
    id: "kubernetes-production", kind: "course", code: "KC-280", track: "devops", level: "Advanced",
    name: "Kubernetes in Production", subtitle: "Deployments, autoscaling and debugging real clusters",
    durationMin: 290, lessons: 36, instructor: I.olu,
    priceCents: 12900, badge: "Bestseller", updated: "Sep 2026",
    snippet: ["$ kubectl rollout status deploy/api", "$ kubectl top pods -n prod"],
    outcomes: ["Deploy with zero downtime", "Autoscale on the right signals", "Debug crashing pods and network issues", "Run stateful workloads safely"],
    syllabus: [{ title: "Core objects", lessons: 7 }, { title: "Deployments", lessons: 7 }, { title: "Autoscaling", lessons: 6 }, { title: "Networking", lessons: 8 }, { title: "Debugging", lessons: 8 }],
  },
  {
    id: "github-actions-cicd", kind: "course", code: "KC-262", track: "devops", level: "Beginner",
    name: "CI/CD with GitHub Actions", subtitle: "Fast pipelines, safe deploys and previews for every PR",
    durationMin: 120, lessons: 18, instructor: I.hana,
    priceCents: 5900, updated: "Aug 2026",
    snippet: ["on: [pull_request]", "jobs:", "  test:", "    runs-on: ubuntu-latest"],
    outcomes: ["Build fast, cached pipelines", "Run tests and previews on every PR", "Deploy safely with environments", "Keep secrets secure"],
    syllabus: [{ title: "Workflows", lessons: 5 }, { title: "Caching and speed", lessons: 4 }, { title: "Deploys", lessons: 5 }, { title: "Security", lessons: 4 }],
  },
  {
    id: "docker-fundamentals", kind: "course", code: "KC-160", track: "devops", level: "Beginner",
    name: "Docker Fundamentals", subtitle: "Images, compose and containers that build fast",
    durationMin: 110, lessons: 17, instructor: I.olu,
    priceCents: 4900, updated: "Jun 2026",
    snippet: ["FROM node:22-slim", "COPY package*.json ./", "RUN npm ci", "COPY . ."],
    outcomes: ["Write small, cache-friendly Dockerfiles", "Run multi-service apps with compose", "Debug containers", "Ship images securely"],
    syllabus: [{ title: "Images", lessons: 5 }, { title: "Compose", lessons: 4 }, { title: "Debugging", lessons: 4 }, { title: "Security", lessons: 4 }],
  },
  // ---------------------------------------------------------------- Security
  {
    id: "appsec-for-devs", kind: "course", code: "KC-170", track: "security", level: "Intermediate",
    name: "AppSec for Developers", subtitle: "Find and fix the vulnerabilities attackers actually use",
    durationMin: 200, lessons: 28, instructor: I.rosa,
    priceCents: 9900, updated: "Sep 2026",
    snippet: ["db.query(", "  \"select * from users where id = $1\",", "  [id]", ");"],
    outcomes: ["Prevent injection, XSS and SSRF", "Threat-model a feature in an hour", "Add security checks to CI", "Handle secrets correctly"],
    syllabus: [{ title: "Threat modeling", lessons: 5 }, { title: "Injection and XSS", lessons: 8 }, { title: "SSRF and access control", lessons: 7 }, { title: "Secure pipelines", lessons: 8 }],
  },
  {
    id: "llm-security", kind: "course", code: "KC-348", track: "security", level: "Advanced",
    name: "Securing LLM Apps", subtitle: "Prompt injection, data leaks and safe tool use",
    durationMin: 150, lessons: 21, instructor: I.rosa,
    priceCents: 10900, badge: "New", updated: "Sep 2026",
    snippet: ["if (tool.risk === \"high\")", "  await requireApproval(user, call);"],
    outcomes: ["Defend against direct and indirect prompt injection", "Prevent data exfiltration through tools", "Red-team your own app", "Log and monitor model behavior"],
    syllabus: [{ title: "The threat model", lessons: 4 }, { title: "Prompt injection", lessons: 6 }, { title: "Tools and data", lessons: 6 }, { title: "Red-teaming", lessons: 5 }],
  },
  {
    id: "auth-oauth-oidc", kind: "course", code: "KC-175", track: "security", level: "Intermediate",
    name: "Auth, OAuth and OIDC", subtitle: "Sessions, tokens and sign-in flows without the confusion",
    durationMin: 160, lessons: 22, instructor: I.nadia,
    priceCents: 8900, updated: "Jul 2026",
    snippet: ["GET /authorize?response_type=code", "  &code_challenge=...", "  &code_challenge_method=S256"],
    outcomes: ["Choose sessions or tokens for your app", "Implement OAuth with PKCE", "Add SSO with OIDC", "Avoid common auth vulnerabilities"],
    syllabus: [{ title: "Sessions and cookies", lessons: 5 }, { title: "OAuth 2 flows", lessons: 6 }, { title: "OIDC and SSO", lessons: 6 }, { title: "Pitfalls", lessons: 5 }],
  },
  // ---------------------------------------------------------------- Mobile
  {
    id: "react-native-apps", kind: "course", code: "KC-240M", track: "mobile", level: "Intermediate",
    name: "React Native Apps", subtitle: "Ship iOS and Android apps from one TypeScript codebase",
    durationMin: 260, lessons: 33, instructor: I.ben,
    priceCents: 10900, badge: "Bestseller", updated: "Aug 2026",
    snippet: ["<FlatList", "  data={courses}", "  renderItem={Row}", "/>"],
    outcomes: ["Build navigation, lists and forms", "Use native modules and device APIs", "Keep apps fast on low-end phones", "Publish to both app stores"],
    syllabus: [{ title: "Fundamentals", lessons: 7 }, { title: "Navigation and state", lessons: 7 }, { title: "Native features", lessons: 7 }, { title: "Performance", lessons: 6 }, { title: "Shipping", lessons: 6 }],
  },
  {
    id: "swiftui-apps", kind: "course", code: "KC-245M", track: "mobile", level: "Beginner",
    name: "SwiftUI from Zero", subtitle: "Build and ship your first iOS app",
    durationMin: 210, lessons: 30, instructor: I.ben,
    priceCents: 7900, updated: "Jul 2026",
    snippet: ["struct ContentView: View {", "  var body: some View {", "    List(courses) { Row($0) }", "  }", "}"],
    outcomes: ["Learn Swift basics fast", "Build layouts with SwiftUI", "Persist data and call APIs", "Submit to the App Store"],
    syllabus: [{ title: "Swift basics", lessons: 7 }, { title: "SwiftUI layouts", lessons: 8 }, { title: "Data and networking", lessons: 8 }, { title: "Shipping", lessons: 7 }],
  },
  // ---------------------------------------------------------------- Career
  {
    id: "staff-engineer", kind: "course", code: "KC-500", track: "career", level: "Advanced",
    name: "The Staff Engineer Path", subtitle: "Technical strategy, influence and writing that moves teams",
    durationMin: 150, lessons: 20, instructor: I.nadia,
    priceCents: 9900, updated: "Sep 2026",
    snippet: ["## Proposal", "Problem, options, recommendation,", "and what we will not do."],
    outcomes: ["Write design docs and strategy that get adopted", "Lead projects across teams", "Pick the right problems to work on", "Make the case for promotion"],
    syllabus: [{ title: "What staff engineers do", lessons: 4 }, { title: "Writing", lessons: 5 }, { title: "Influence", lessons: 5 }, { title: "Strategy and promotion", lessons: 6 }],
  },
  // ---------------------------------------------------------------- Plan
  {
    id: "all-access", kind: "plan", code: "ALL", track: "ai", level: "All levels",
    name: "All-Access, 1 year", subtitle: "Every course, every update, for 12 months",
    durationMin: 0, lessons: 0, instructor: { name: "Kernelcraft", title: "All instructors" },
    priceCents: 29900, compareAtCents: 0, updated: "Sep 2026",
    snippet: [],
    outcomes: ["Every course in the catalog and every new release", "Downloadable source code and slides", "Certificates of completion", "Cancel anytime; no renewal surprises"],
    syllabus: [],
  },
];

// All-Access totals are derived from the catalog so they never drift.
{
  const courses = PRODUCTS.filter((p) => p.kind === "course");
  const plan = PRODUCTS.find((p) => p.id === "all-access")!;
  plan.compareAtCents = courses.reduce((n, c) => n + c.priceCents, 0);
  plan.durationMin = courses.reduce((n, c) => n + c.durationMin, 0);
  plan.lessons = courses.reduce((n, c) => n + c.lessons, 0);
}

export const getProduct = (id: string): Product | undefined => PRODUCTS.find((p) => p.id === id);
