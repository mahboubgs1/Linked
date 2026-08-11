# LinkedIn Content Engine

A semi-automated LinkedIn content management and publishing system for a
professional IT Application Manager. It generates a connected **weekly series of
posts** around a single topic, stores them as local drafts, and publishes to
LinkedIn **only after explicit human approval**.

> **Safety first (V1):** the system NEVER publishes automatically. Publishing a
> draft is impossible unless its status is `approved`.

---

## Content strategy

Three connected posts per week around one weekly topic:

| Day       | Type       | Purpose                                             |
| --------- | ---------- | --------------------------------------------------- |
| Sunday    | Teaser     | Industry insight / executive opinion — spark curiosity |
| Tuesday   | Training   | Educational explanation, supported by an infographic |
| Thursday  | Case study | Realistic scenario / checklist / discussion question |

The calendar is **config-driven** (see [Content calendar](#content-calendar)) so
more slots can be added later without code changes.

**Voice:** professional, human, practical, grounded in real IT management
experience — Arabic-first, with technical English terms used naturally.

---

## Workflow

```
Topic → Generate posts → Infographic prompt → Save draft
      → Preview → USER APPROVAL → Publish to LinkedIn → Mark published
```

The lifecycle status is the safety core:

```
draft ──approve──► approved ──publish──► published
   └────reject────► rejected
```

`publish` throws unless the draft is `approved`.

---

## Installation

Requires **Node.js 18+**.

```bash
npm install
cp .env.example .env   # then fill in values when you're ready to publish
```

---

## Configuration

All configuration is via environment variables (never hardcoded). See
[`.env.example`](./.env.example). Nothing LinkedIn-related is required to
generate, preview or approve — credentials are only needed to actually publish.

| Variable                 | Purpose                                             |
| ------------------------ | --------------------------------------------------- |
| `LINKEDIN_CLIENT_ID`     | LinkedIn app client id (for future OAuth)           |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn app client secret (for future OAuth)       |
| `LINKEDIN_REDIRECT_URI`  | OAuth redirect URI (for future OAuth)               |
| `LINKEDIN_ACCESS_TOKEN`  | Access token used to publish                        |
| `LINKEDIN_AUTHOR_URN`    | Author URN (`urn:li:person:…` or `urn:li:organization:…`) |
| `LINKEDIN_API_VERSION`   | LinkedIn REST version header (default `202401`)     |
| `LINKEDIN_DRY_RUN`       | `true` = simulate publishing (no network call)      |
| `LOG_LEVEL`              | `debug` \| `info` \| `warn` \| `error`              |

> If no access token is set (or `LINKEDIN_DRY_RUN=true`), publishing is
> **simulated** and clearly logged, so you can test the full workflow safely.

---

## Commands

```bash
npm run seed                                  # load the initial topic set (idempotent)
npm run generate                              # generate a series for the next unused topic
npm run generate -- --topic "Change Management"   # generate for a specific topic
npm run drafts                                # list all drafts
npm run drafts -- --status approved           # filter by status
npm run preview -- --id <draftId>             # full preview of one draft
npm run preview -- --topic-id <topicId>       # preview a whole weekly series
npm run approve -- --id <draftId>             # approve a draft
npm run approve -- --id <draftId> --reject --reason "too generic"
npm run publish -- --id <draftId>             # publish an APPROVED draft
npm run typecheck                             # TypeScript type-check
```

### Typical session

```bash
npm run generate                      # creates 3 connected drafts for a topic
npm run drafts                        # note the draft ids
npm run preview -- --id draft_abc123  # review the content + infographic prompt
npm run approve -- --id draft_abc123  # gate the post
npm run publish -- --id draft_abc123  # publish (dry-run unless configured)
```

---

## Content workflow details

- **Topics** live in `data/topics.json`. Each is used for exactly one weekly
  series; used topics are tracked to prevent accidental duplication. Supports a
  multi-week / 30-post series.
- **Drafts** live in `data/drafts.json` with `title, topic, type, body,
  hashtags, infographic_prompt, created_at, status`.
- **Infographic prompts** are generated for every post from a structured brief +
  brand style (navy / white / gold, Arabic RTL typography, LinkedIn vertical
  layout, modern IT icons). No image is generated yet — see the roadmap.
- **Logs** are written to `logs/app.log` (JSON lines): generation, approval,
  publishing, LinkedIn responses and errors.

`data/` and `logs/` are git-ignored.

---

## Content calendar

The default calendar is defined in
`src/core/calendar/calendar.model.ts` (3 slots: Sunday / Tuesday / Thursday).
To customise it without changing code, create `data/calendar.json` with an
array of `ContentSlot` objects; it overrides the default. The scheduler
(`scheduler.ts`) can compute *suggested* publish dates but performs **no
automatic publishing** — that architecture is prepared for a later version.

---

## LinkedIn setup (placeholder)

1. Create an app at <https://www.linkedin.com/developers/apps>.
2. Request the `w_member_social` product/scope for posting.
3. Obtain an access token (full OAuth 2.0 flow is planned — see
   `src/linkedin/oauth.placeholder.ts`). For V1, paste a valid token into
   `LINKEDIN_ACCESS_TOKEN` and set `LINKEDIN_AUTHOR_URN`.
4. Set `LINKEDIN_DRY_RUN=false` when you're ready to publish for real.

The LinkedIn integration is behind the `ILinkedInProvider` interface so OAuth or
an alternative posting backend can be added later without touching the workflow.

---

## Architecture

```
src/
├── types/          domain types (topic, draft, content, calendar)
├── config/         env loader (credentials from environment only)
├── logging/        structured logger → console + logs/app.log
├── core/
│   ├── storage/    tiny JSON-file store
│   ├── topic/      topic repository + service (dedup, series tracking)
│   ├── draft/      draft repository + service (lifecycle state machine)
│   └── calendar/   calendar model (config-driven) + scheduler (arch only)
├── generator/      IContentGenerator + template generator + writing style
│                   (IAIProvider stub for future AI backend)
├── infographic/    prompt builder + brand style + IImageProvider stub
├── linkedin/       ILinkedInProvider + service + OAuth placeholder
├── commands/       seed · generate · drafts · preview · approve · publish
└── data/           seed topics
```

Design principles: simple, minimal dependencies (`dotenv` at runtime), strong
typing (strict TypeScript), clear error handling, modular provider interfaces.

---

## Future roadmap

This is **V1 (core workflow)**. Planned next passes:

- **Brand engine** — `src/brand/` brand profile, voice rules, audience,
  forbidden "generic AI" patterns.
- **Knowledge base** — `src/knowledge/` real experience corpus to ground content.
- **Content strategy engine** — `src/strategy/` content pillars, audience mapper,
  smart topic selection.
- **Prompt management layer** — `src/prompts/` externalised, versioned prompts.
- **Guardrails / validators** — `src/validators/` brand + quality + publishing
  checks before approval.
- **Performance analytics** — `src/analytics/` track views/likes/comments/shares
  and learn best topics, hooks and posting times.
- **Extended lifecycle** — `idea → draft → review → approved → scheduled →
  published → analyzed`.
- **Provider integrations** — real OAuth, AI generation (OpenAI / Claude), image
  generation (OpenAI Images / Canva), LinkedIn analytics.
- **Scheduler** — opt-in scheduled publishing (still gated by approval).
