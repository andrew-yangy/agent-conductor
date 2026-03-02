# Standing Scenarios — Cognitive Walkthrough
<!-- Add new scenarios as core user flows emerge. Run /walkthrough all periodically. -->

## ceo-runs-directive
- **Actor**: CEO (solo founder)
- **Trigger**: CEO types `/directive improve-security`
- **Goal**: Get the work done without blocking my session. Review the plan quickly, approve, and get back a summary when it's done.
- **Critical path**:
  1. CEO invokes /directive — session should stay free immediately
  2. Alex plans in background — CEO can do other work
  3. CEO gets notified — short plan summary, not a wall of text
  4. CEO approves in 30 seconds — not a 5-minute read
  5. Alex executes in background — CEO is free again
  6. CEO gets done summary — Done / Changes / Needs CEO Eyes / Next
  7. CEO does UX verification if needed — clear instructions on what to check
- **Success criteria**: CEO's context window stays clean. Total CEO involvement < 5 minutes for a medium directive.

## ceo-morning-review
- **Actor**: CEO
- **Trigger**: CEO opens a new session in the morning, wants to know what happened overnight
- **Goal**: In under 2 minutes, know: what was accomplished, what needs my attention, what's next.
- **Critical path**:
  1. CEO types `/report daily` or asks "what happened?"
  2. System produces a concise summary of overnight work
  3. CEO sees: completed directives, pending approvals, blockers, next priorities
  4. CEO can drill into any item for detail
  5. CEO decides what to focus on today
- **Success criteria**: CEO knows the state of everything in 2 minutes. No surprises.

## ceo-has-idea
- **Actor**: CEO
- **Trigger**: CEO is mid-task on Project A, has an idea for Project B
- **Goal**: Capture the idea with context, continue Project A, nothing lost.
- **Critical path**:
  1. CEO describes the idea naturally ("we should add competitor comparison pages to SellWisely")
  2. System captures it to the right backlog with enough context to act on later
  3. CEO continues current work — no context switch
  4. Idea appears in next /report or /scout review
- **Success criteria**: Zero ideas lost. Zero context switches. Idea is actionable when reviewed later.

## ceo-continuous-execution
- **Actor**: CEO
- **Trigger**: CEO says "do the backlogs" or "keep going"
- **Goal**: Alex works through all actionable backlog items autonomously, CEO reviews periodically.
- **Critical path**:
  1. Alex scans all backlogs across all goals
  2. Alex triages each item (lightweight/medium/heavyweight)
  3. Lightweight items: just done, no CEO involvement
  4. Medium items: planned and executed, CEO gets summary
  5. Heavyweight items: queued for CEO approval
  6. Alex keeps going until nothing actionable remains
  7. CEO checks in when notified, not constantly
- **Success criteria**: CEO says "do the backlogs" once. Work happens continuously. CEO reviews outcomes, not process.

## seller-checks-competitors
- **Actor**: SellWisely user (e-commerce seller)
- **Trigger**: Seller logs into SellWisely dashboard
- **Goal**: See how my prices compare to competitors, know where I'm losing and winning.
- **Critical path**:
  1. Seller sees dashboard with their products and competitor prices
  2. Products are flagged: underpriced, overpriced, competitive
  3. Seller clicks a product to see price history and competitor detail
  4. Seller adjusts their price or sets an alert
- **Success criteria**: Seller knows their competitive position in 60 seconds.

## shopper-finds-deal
- **Actor**: BuyWisely user (price-conscious shopper)
- **Trigger**: Shopper searches for a product on BuyWisely
- **Goal**: Find the cheapest price from a trustworthy retailer.
- **Critical path**:
  1. Shopper searches or lands from Google
  2. Sees product with price comparison across retailers
  3. Sees price history — is this a good time to buy?
  4. Clicks through to retailer to purchase
  5. Optionally sets a price alert for a target price
- **Success criteria**: Shopper finds the best price in under 30 seconds. Trusts the data.

## developer-adds-feature
- **Actor**: Developer (or CEO wearing developer hat)
- **Trigger**: A feature is planned and spec'd in .context/goals/{goal}/active/{feature}/
- **Goal**: Build the feature with agent team assistance, verify it works, merge.
- **Critical path**:
  1. Developer runs /team-build {feature}
  2. Agents pick up tasks from tasks.json
  3. Each agent builds, verifies, marks complete
  4. Developer reviews changes
  5. Developer runs /review {feature}
  6. Merge when satisfied
- **Success criteria**: Feature built correctly on first pass. Minimal manual intervention.
