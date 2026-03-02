# Make Specialist Agents Functional

## CEO Direction

The specialist agents (Riley/Frontend, Jordan/Backend, Casey/Data, Taylor/Content, Sam/QA) are currently display-only on the org page. Make them actually work — when Morgan casts a directive, she assigns the right specialist with domain-specific knowledge instead of spawning generic engineers.

## Requirements

### 1. Specialist Prompt Templates

Create prompt templates that inject domain-specific knowledge for each specialist:

- **Riley Kim (Frontend Dev)** — `engineer-frontend.md`: React patterns, Tailwind conventions, component architecture from this project, shadcn/ui usage, state management (zustand stores), routing patterns, accessibility basics
- **Jordan Okafor (Backend Dev)** — `engineer-backend.md`: Express/Node patterns, WebSocket handling, file watchers (chokidar), tmux integration, server state management, TypeScript strict patterns from this project
- **Casey Liu (Data Engineer)** — `engineer-data.md`: State indexing patterns, JSON file parsing, session scanning, data aggregation, the .context/ file structure, markdown-to-structured-data pipelines
- **Taylor Reeves (Content Builder)** — `engineer-content.md`: MDX conventions, SEO requirements, content structure, documentation patterns
- **Sam Nakamura (QA Engineer)** — `engineer-qa.md`: Type-checking, build validation, testing patterns, verification commands

Each template should:
- Be 1-2KB of domain-specific instructions extracted from the ACTUAL codebase patterns
- Include real file paths, real conventions, real patterns from this project
- NOT be a personality/persona — be actionable technical context

### 2. Update SKILL.md Casting Rules

Update the directive SKILL.md so that:
- Morgan's casting output can specify a specialist agent ID instead of just "engineer"
- The engineer spawn logic in Step 5 loads the specialist's prompt template
- The specialist's name appears in the directive state and telemetry
- Active file pattern matching determines which specialist gets cast:
  - `*.tsx`, `*.jsx`, `components/`, `src/components/` → Riley (Frontend)
  - `server/`, `api/`, `*.ts` under server → Jordan (Backend)
  - `scripts/`, `parsers/`, `state/`, `*.json` pipelines → Casey (Data)
  - `*.md`, `*.mdx`, `content/` → Taylor (Content)
  - Testing/validation work → Sam (QA)

### 3. Update Dashboard Tracking

When a specialist agent is assigned to a directive initiative:
- Their sessions should show up under their agent card on the org page
- The specialist's status should update to "working" during builds
- The org page should feel alive — specialists light up when they're building

## What This Changes

- `.claude/skills/directive/SKILL.md` — casting rules and engineer spawn logic
- New files: `.claude/agents/riley-frontend.md`, `jordan-backend.md`, `casey-data.md`, `taylor-content.md`, `sam-qa.md` (prompt templates, not full personalities)
- Possibly `server/parsers/session-scanner.ts` — if specialist agent names need to be recognized

## Success Criteria

- When a directive runs that touches frontend code, Riley gets cast and the org page shows Riley as "working"
- The build output quality improves because the engineer has domain-specific context
- C-suite agents (Sarah, Marcus) focus on audit/review, specialists focus on building
- The org page feels like a real company where people are actually working
