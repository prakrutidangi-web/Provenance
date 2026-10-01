/**
 * Penrose's tiny "brain": canned answers plus the ad-matching rules.
 *
 * Koah matches ads to the intent of the conversation in real time. This demo
 * imitates that with keyword scoring: the topic with the most keyword hits wins,
 * and its course is the ad. No match means no ad: an irrelevant ad is worse
 * than none.
 */
export type Block = { p: string } | { ol: string[] } | { code: string };

export interface Topic {
  id: string;
  keywords: string[];
  courseId: string; // the advertiser's product the ad promotes
  campaign: string; // utm_campaign on the ad's click URL
  answer: Block[];
}

export const TOPICS: Topic[] = [
  {
    id: "rag", courseId: "production-rag", campaign: "rag_launch",
    keywords: ["rag", "retrieval", "vector", "embedding", "embeddings", "hallucinat", "making things up", "makes things up", "knowledge base", "docs", "documents", "chunk", "semantic search"],
    answer: [
      { p: "The usual fix is retrieval-augmented generation (RAG): before the model answers, you look up the most relevant passages from your own docs and put them in the prompt, then tell the model to answer only from those passages." },
      { ol: ["Split your help-center articles into chunks of a few hundred tokens, keeping headings with each chunk.", "Embed the chunks and store them in a vector index (pgvector works fine to start).", "At question time, retrieve ~20 candidates, rerank them, and keep the top 4-5.", "Instruct the model to cite the chunk it used, and to say “I don't know” when nothing relevant was retrieved."] },
      { code: "const hits = await index.query(embed(question), { topK: 20 });\nconst context = (await rerank(question, hits)).slice(0, 5);\nconst answer = await llm.generate({ system: ANSWER_ONLY_FROM_CONTEXT, context, question });" },
      { p: "Most “it makes things up” bugs come from step 3: if the right chunk isn't retrieved, the model fills the gap. Measure retrieval hit-rate on real questions before tuning the prompt." },
    ],
  },
  {
    id: "evals", courseId: "llm-evals", campaign: "evals_launch",
    keywords: ["eval", "evals", "evaluate", "evaluation", "regression", "quality", "benchmark", "grader", "test my prompt", "testing prompts"],
    answer: [
      { p: "Treat prompts like code: keep a dataset of real inputs with what a good answer looks like, and score every change against it before shipping." },
      { ol: ["Collect 50-200 real user inputs, including the ones that went wrong.", "Write cheap deterministic checks first (format, required fields, banned phrases).", "Add model-graded checks for fuzzier things like faithfulness, with a clear rubric.", "Run the suite in CI and fail the build when scores drop."] },
      { p: "Start small. Twenty well-chosen cases catch most regressions." },
    ],
  },
  {
    id: "agents", courseId: "ai-agents", campaign: "coding_agents",
    keywords: ["agent", "agents", "tool use", "tools", "function calling", "autonomous", "mcp", "planner", "multi-step"],
    answer: [
      { p: "An agent is a loop: the model picks a tool, you run it, you feed the result back, and repeat until the model says it's done. Reliability comes from the parts around that loop." },
      { ol: ["Give every tool a strict input schema and a short, specific description.", "Cap steps and spend per run so a confused agent can't loop forever.", "Return tool errors to the model as text so it can recover.", "Require human approval for anything irreversible."] },
      { code: "for (let step = 0; step < MAX_STEPS; step++) {\n  const next = await model.next(ctx);\n  if (!next.tool) break;\n  ctx.push(await runTool(next.tool));\n}" },
    ],
  },
  {
    id: "prompts", courseId: "prompting-for-devs", campaign: "prompting_basics",
    keywords: ["prompt", "prompting", "json output", "structured output", "few-shot", "system prompt", "parse the output"],
    answer: [
      { p: "For output you can parse, ask for a schema rather than describing the format in prose. Most model APIs now support structured outputs directly; use them and validate the result anyway." },
      { p: "Keep the system prompt for durable rules, put examples in the messages, and version your prompts alongside your code so you can tell which change caused a regression." },
    ],
  },
  {
    id: "typescript", courseId: "typescript-deep-dive", campaign: "typescript",
    keywords: ["typescript", "generic", "generics", "type error", "types", "zod", "infer"],
    answer: [
      { p: "If you're repeating the same shape in types and runtime validation, define it once with a schema library and infer the type from it. That keeps the two from drifting apart." },
      { code: "const Event = z.object({ name: z.string(), value: z.number() });\ntype Event = z.infer<typeof Event>;" },
    ],
  },
  {
    id: "react", courseId: "react-performance", campaign: "react_perf",
    keywords: ["react", "re-render", "rerender", "slow ui", "usememo", "component is slow", "laggy"],
    answer: [
      { p: "Profile before you optimize: the React DevTools profiler shows exactly which components re-render and why. The usual culprits are new object or function props on every render, and context values that change too often." },
      { p: "Fix the biggest offender, measure again, and virtualize any list longer than a few hundred rows." },
    ],
  },
  {
    id: "streaming", courseId: "streaming-ui", campaign: "streaming_ui",
    keywords: ["stream", "streaming", "sse", "server-sent", "typing effect", "chat ui", "token by token"],
    answer: [
      { p: "Stream the response over server-sent events (or a fetch ReadableStream) and append each delta to state as it arrives. Render partial markdown carefully: close open code fences before rendering so the layout doesn't jump." },
      { code: "for await (const chunk of stream) {\n  setText((t) => t + chunk.delta);\n}" },
    ],
  },
  {
    id: "system-design", courseId: "system-design", campaign: "system_design",
    keywords: ["system design", "scale", "scaling", "architecture", "idempotent", "idempotency", "queue", "high traffic", "interview"],
    answer: [
      { p: "Start with numbers: requests per second, payload size, and how long data must be kept. Those decide almost everything else." },
      { ol: ["Accept writes quickly and process them asynchronously through a queue.", "Make every write idempotent with a client-supplied ID so retries are safe.", "Separate the read path (caches, rollups) from the write path."] },
    ],
  },
  {
    id: "postgres", courseId: "postgres-performance", campaign: "postgres",
    keywords: ["postgres", "postgresql", "sql", "slow query", "index", "query plan", "explain analyze", "database is slow"],
    answer: [
      { p: "Run the slow query with EXPLAIN (ANALYZE, BUFFERS) and look for sequential scans on big tables and row estimates that are far off from actual rows. A composite index matching your WHERE and ORDER BY usually fixes the first; ANALYZE fixes the second." },
      { code: "EXPLAIN (ANALYZE, BUFFERS)\nSELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20;" },
    ],
  },
  {
    id: "kafka", courseId: "event-driven-kafka", campaign: "kafka",
    keywords: ["kafka", "event-driven", "event driven", "consumer", "consumers", "pubsub", "pub/sub", "message broker"],
    answer: [
      { p: "Partition by the key you need ordering for (often a user or account ID), and make consumers idempotent, because Kafka delivers at least once. Store the last processed offset or an event ID to skip duplicates." },
    ],
  },
  {
    id: "clickhouse", courseId: "clickhouse-analytics", campaign: "clickhouse",
    keywords: ["clickhouse", "analytics", "olap", "aggregation", "billions of rows", "dashboard is slow", "real-time analytics"],
    answer: [
      { p: "For event analytics at scale, a columnar store like ClickHouse with a sort key that matches your most common filters will answer COUNT and GROUP BY queries in milliseconds. Pre-aggregate the hottest dashboards with materialized views." },
    ],
  },
  {
    id: "pipelines", courseId: "python-data-pipelines", campaign: "pipelines",
    keywords: ["pipeline", "pipelines", "etl", "airflow", "dagster", "csv", "data job", "cron job"],
    answer: [
      { p: "Make each step idempotent (re-running it gives the same result), validate data at the boundaries, and let an orchestrator handle retries and scheduling instead of cron." },
    ],
  },
  {
    id: "terraform", courseId: "terraform-aws", campaign: "terraform",
    keywords: ["terraform", "aws", "infrastructure as code", "iac", "ecs", "cloudformation", "provision"],
    answer: [
      { p: "Keep state remote with locking (S3 + DynamoDB), split environments into separate state files, and review every terraform plan in CI before apply." },
    ],
  },
  {
    id: "otel", courseId: "observability-otel", campaign: "observability",
    keywords: ["observability", "tracing", "traces", "opentelemetry", "otel", "metrics", "logs", "grafana", "latency"],
    answer: [
      { p: "Instrument with OpenTelemetry so traces, metrics and logs share the same trace ID. Then a slow request in a dashboard links straight to the trace that shows which service or query was slow." },
    ],
  },
  {
    id: "fine-tuning", courseId: "fine-tuning-llms", campaign: "fine_tuning",
    keywords: ["fine-tune", "fine tune", "finetune", "fine-tuning", "lora", "qlora", "train my own model", "custom model"],
    answer: [
      { p: "Try prompting and retrieval first: most “the model doesn't know our stuff” problems are retrieval problems. Fine-tune when you need a consistent format, tone or skill that examples in the prompt can't teach." },
      { p: "If you do, start with a LoRA adapter on an open model and a few thousand clean, deduplicated examples. Hold out a test set before training so you can tell whether it actually helped." },
    ],
  },
  {
    id: "multimodal", courseId: "multimodal-apps", campaign: "multimodal",
    keywords: ["image", "images", "screenshot", "pdf", "vision", "audio", "speech", "voice", "transcribe", "ocr"],
    answer: [
      { p: "Send the image or page directly to a vision-capable model and ask for structured output (JSON with the fields you need). For scanned PDFs, render each page to an image first." },
      { p: "Downscale large images before sending them: it cuts cost and latency a lot with little loss in accuracy for documents." },
    ],
  },
  {
    id: "local-llm", courseId: "local-llms", campaign: "local_llms",
    keywords: ["run locally", "locally", "ollama", "vllm", "llama", "quantiz", "gguf", "on-prem", "self-host", "gpu"],
    answer: [
      { p: "For a laptop, a 4-bit quantized 7-8B model runs fine through Ollama. For a server, vLLM gives you an OpenAI-compatible API with much higher throughput." },
      { p: "Benchmark with your real prompts: tokens per second and time to first token matter more than leaderboard scores." },
    ],
  },
  {
    id: "vector-db", courseId: "vector-databases", campaign: "vector_db",
    keywords: ["pgvector", "hnsw", "vector database", "vector db", "similarity search", "nearest neighbor", "ann index"],
    answer: [
      { p: "pgvector is enough up to several million vectors if you add an HNSW index. Tune ef_search for recall vs speed, and filter with normal SQL WHERE clauses." },
      { p: "Reach for a dedicated vector store when you need very high write rates or tens of millions of vectors with heavy filtering." },
    ],
  },
  {
    id: "nextjs", courseId: "nextjs-app-router", campaign: "nextjs",
    keywords: ["next.js", "nextjs", "app router", "server component", "server components", "rsc"],
    answer: [
      { p: "Keep components on the server by default and add \"use client\" only where you need state or browser APIs. Fetch data in server components, close to where it's used." },
      { p: "Most confusion comes from caching: be explicit about whether each fetch is static, revalidated on a timer, or dynamic." },
    ],
  },
  {
    id: "css", courseId: "modern-css", campaign: "modern_css",
    keywords: ["css", "flexbox", "grid layout", "layout breaks", "container queries", "responsive"],
    answer: [
      { p: "Use grid for two-dimensional page layout and flexbox for rows of items. `repeat(auto-fill, minmax(16rem, 1fr))` gives you a responsive card grid with no media queries." },
      { p: "Container queries let a component adapt to the space it gets rather than the viewport, which is what you usually want in a design system." },
    ],
  },
  {
    id: "a11y", courseId: "accessibility-engineering", campaign: "accessibility",
    keywords: ["accessibility", "accessible", "a11y", "screen reader", "wcag", "aria", "keyboard navigation"],
    answer: [
      { p: "Start with semantic HTML: real buttons, labels on every input, headings in order. That fixes most issues before any ARIA." },
      { p: "Then tab through every flow with the keyboard only, and add an automated checker such as axe to CI so regressions fail the build." },
    ],
  },
  {
    id: "design-system", courseId: "design-systems", campaign: "design_systems",
    keywords: ["design system", "design tokens", "component library", "storybook", "theming"],
    answer: [
      { p: "Start with tokens (color, spacing, type, radius) and a handful of components teams use daily. Adoption beats completeness." },
      { p: "Version the library, document every component with real examples, and make the accessible way the default way." },
    ],
  },
  {
    id: "go", courseId: "go-microservices", campaign: "go_services",
    keywords: ["golang", " go ", "grpc", "microservice", "microservices", "service mesh"],
    answer: [
      { p: "Put a deadline on every outbound call with context.WithTimeout, retry only idempotent requests with backoff, and propagate trace IDs across services." },
      { p: "Split services along team and data ownership, not along technical layers." },
    ],
  },
  {
    id: "api", courseId: "api-design", campaign: "api_design",
    keywords: ["api design", "rest api", "versioning", "pagination", "endpoint", "endpoints", "http api"],
    answer: [
      { p: "Version in the URL (/v1), use cursor pagination for anything that grows, and return consistent error objects with a machine-readable code." },
      { p: "Accept an Idempotency-Key header on POST requests so clients can retry safely after timeouts." },
    ],
  },
  {
    id: "redis", courseId: "redis-caching", campaign: "redis",
    keywords: ["redis", "cache", "caching", "cache invalidation", "stampede"],
    answer: [
      { p: "Use cache-aside: read from Redis, fall back to the database, then write the result with a TTL. Invalidate by deleting the key when the source data changes." },
      { p: "To avoid stampedes on hot keys, add jitter to TTLs and let only one request rebuild an expired value." },
    ],
  },
  {
    id: "rust", courseId: "rust-backend", campaign: "rust",
    keywords: ["rust", "borrow checker", "axum", "tokio", "cargo"],
    answer: [
      { p: "Clone more than you think you should while learning: it's rarely the bottleneck and it gets you past most borrow-checker fights." },
      { p: "For web services, Axum on Tokio is a solid default. Return Result everywhere and map errors to responses in one place." },
    ],
  },
  {
    id: "dbt", courseId: "dbt-analytics", campaign: "dbt",
    keywords: ["dbt", "analytics engineering", "data warehouse", "snowflake", "bigquery", "data model"],
    answer: [
      { p: "Layer models as staging (clean raw tables), intermediate (joins and logic) and marts (what dashboards read). Add unique and not_null tests to every primary key." },
      { p: "Run dbt build in CI on every pull request against a dev schema." },
    ],
  },
  {
    id: "spark", courseId: "spark-at-scale", campaign: "spark",
    keywords: ["spark", "pyspark", "databricks", "shuffle", "data skew"],
    answer: [
      { p: "Open the Spark UI and find the slowest stage. If a few tasks take far longer than the rest, you have skew: salt the hot keys or use adaptive query execution." },
      { p: "Avoid collect() on big data and cache only what you reuse." },
    ],
  },
  {
    id: "sql", courseId: "sql-for-engineers", campaign: "sql_basics",
    keywords: ["sql query", "join", "joins", "window function", "group by", "select statement"],
    answer: [
      { p: "Window functions are the most useful thing to learn next: `row_number() over (partition by user_id order by created_at desc)` gives you each user's latest row without a self-join." },
    ],
  },
  {
    id: "k8s", courseId: "kubernetes-production", campaign: "kubernetes",
    keywords: ["kubernetes", "k8s", "kubectl", "pod", "pods", "helm", "crashloop"],
    answer: [
      { p: "For a CrashLoopBackOff, check `kubectl logs --previous` and `kubectl describe pod`: the events usually say whether it's OOM, a failing probe or a bad config." },
      { p: "Set resource requests and limits on every container, and readiness probes so rollouts don't send traffic to pods that aren't ready." },
    ],
  },
  {
    id: "cicd", courseId: "github-actions-cicd", campaign: "cicd",
    keywords: ["ci/cd", "cicd", "github actions", "pipeline is slow", "continuous integration", "deploy pipeline"],
    answer: [
      { p: "Cache dependencies, run independent jobs in parallel, and only run the slow end-to-end suite when relevant files change." },
      { p: "Deploy through protected environments with required reviewers, and keep secrets in the platform's secret store." },
    ],
  },
  {
    id: "docker", courseId: "docker-fundamentals", campaign: "docker",
    keywords: ["docker", "dockerfile", "container", "containers", "docker compose", "image size"],
    answer: [
      { p: "Copy your dependency manifest and install before copying the rest of the source, so code changes don't bust the dependency layer cache. Use a slim base image and a multi-stage build." },
    ],
  },
  {
    id: "appsec", courseId: "appsec-for-devs", campaign: "appsec",
    keywords: ["sql injection", "xss", "csrf", "ssrf", "vulnerability", "owasp", "pentest"],
    answer: [
      { p: "Use parameterized queries everywhere, escape output by default (most frameworks do), and validate URLs the server fetches against an allowlist to stop SSRF." },
      { p: "Add dependency and secret scanning to CI so known issues never reach production." },
    ],
  },
  {
    id: "llm-sec", courseId: "llm-security", campaign: "llm_security",
    keywords: ["prompt injection", "jailbreak", "llm security", "secure my agent", "data leak", "exfiltrat"],
    answer: [
      { p: "Treat everything the model reads (web pages, emails, documents) as untrusted input that can contain instructions. Don't give the model tools that can leak data or take irreversible actions without a human approving them." },
      { p: "Log every tool call and red-team with injected instructions before launch." },
    ],
  },
  {
    id: "auth", courseId: "auth-oauth-oidc", campaign: "auth",
    keywords: ["oauth", "oidc", "sso", "login", "authentication", "jwt", "session", "pkce"],
    answer: [
      { p: "For a web app, server-side sessions in an HTTP-only cookie are simpler and safer than JWTs in localStorage. For third-party sign-in, use OAuth authorization code flow with PKCE via OIDC." },
      { p: "Never roll your own crypto or password hashing: use your framework's auth library." },
    ],
  },
  {
    id: "react-native", courseId: "react-native-apps", campaign: "react_native",
    keywords: ["react native", "expo", "android", "cross-platform", "mobile app", "ios and android"],
    answer: [
      { p: "Start with Expo: it handles builds, updates and most native APIs. Use FlatList for long lists and keep work off the JS thread for smooth scrolling." },
    ],
  },
  {
    id: "swiftui", courseId: "swiftui-apps", campaign: "swiftui",
    keywords: ["swift", "swiftui", "ios app", "xcode", "iphone app"],
    answer: [
      { p: "SwiftUI is the right starting point for a new iOS app. Build screens from small views, keep state in an observable model, and use async/await for networking." },
    ],
  },
  {
    id: "staff", courseId: "staff-engineer", campaign: "staff_path",
    keywords: ["staff engineer", "promotion", "career", "senior engineer", "tech lead", "design doc"],
    answer: [
      { p: "The jump to staff is mostly about scope and writing: pick problems that matter beyond your team, write clear design docs, and get other engineers aligned on them." },
      { p: "Keep a brag document of the decisions you drove and their impact. It makes the promotion case much easier." },
    ],
  },
];

export const FALLBACK: Block[] = [
  { p: "Good question. Could you tell me a bit more about your stack and what you've tried so far? That'll help me give you a concrete answer rather than a generic one." },
];

/**
 * Picks the best-matching topic, or null when nothing matches. Hits are
 * weighted by keyword length, so a specific phrase ("prompt injection") beats
 * a generic word ("agent").
 */
export function matchTopic(question: string): Topic | null {
  const q = question.toLowerCase();
  let best: Topic | null = null;
  let bestScore = 0;
  for (const t of TOPICS) {
    const score = t.keywords.reduce((n, k) => n + (q.includes(k) ? k.trim().length : 0), 0);
    if (score > bestScore) {
      best = t;
      bestScore = score;
    }
  }
  return best;
}

export const SUGGESTIONS = [
  "How do I stop my support bot from making things up?",
  "How should I test my prompts before shipping changes?",
  "My Postgres query is slow, where do I start?",
  "How do I build an agent that uses tools?",
  "My pods keep crashing in Kubernetes",
  "How do I stop prompt injection in my agent?",
];
