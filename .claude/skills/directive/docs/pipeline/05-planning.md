<!-- Pipeline doc: 05-planning.md | Source: SKILL.md restructure -->

## Step 3: Spawn the COO (Strategic Planning)

Spawn the COO as an Agent (model: opus, subagent_type: COO's ID from registry).

**The COO's prompt must include:**
- The CEO directive text (personality is auto-loaded via the `subagent_type`)
- The goals index, lessons, and agent summaries from the context step
- These explicit instructions:

> See [docs/reference/templates/planner-prompt.md](../reference/templates/planner-prompt.md) for the full COO planning prompt.

> See [docs/reference/schemas/plan-schema.md](../reference/schemas/plan-schema.md) for the COO's output JSON schema.

> See [docs/reference/rules/casting-rules.md](../reference/rules/casting-rules.md) for full casting rules.

> See [docs/reference/rules/phase-definitions.md](../reference/rules/phase-definitions.md) for phase composable building blocks.

> See [docs/reference/rules/scope-and-dod.md](../reference/rules/scope-and-dod.md) for scope format rules, Definition of Done rules, and user scenario rules.

**If this directive was classified as strategic**, also include in the COO's prompt:
- The brainstorm synthesis from `.context/directives/{directive-id}/brainstorm.md`
- CEO's clarification answers
- Additional instruction to the COO: "The team has brainstormed approach options for this directive. Use the brainstorm synthesis and CEO's answers to inform your plan — you don't need to re-derive the approach from scratch. Focus on execution planning, not strategy."

**Parse the COO's response** as JSON. Extract the JSON object from the response (find the first `{` and last `}`). If it fails to parse, show the error and stop.

### Save the COO's plan (DO NOT create project.json yet)

Save the COO's parsed JSON plan to `.context/directives/{directive-id}/plan.json` for reference. The directive directory should already exist from the read step.

**Do NOT create project.json at this step.** The project.json is created in the approve step (after CEO approval) so that CEO modifications to the plan are reflected in the source of truth. Creating it before approval causes plan/project drift when the CEO requests changes.

### Handle Multi-Project Plans

If the COO's plan contains a `projects` array (triggered when genuinely complex work can't be decomposed into simple tasks):

1. **Verify projects are independent** — if project B depends on project A's output (shared code, shared data structures, one builds on the other), they MUST be merged into a single project with ordered tasks. Task array ordering IS the dependency mechanism. There is no cross-project dependency field.
2. **Create a separate project directory and project.json for each independent project** in the approve step (after CEO approval)
3. **Each project gets its own brainstorm** (2-3 agents + deliberation) before build
4. **Each project gets its own execution cycle** in the execute step: brainstorm -> audit -> build -> review -> verify
5. **Projects execute sequentially by priority tier** (all P0 projects before P1)
6. **Project directories**: `.context/directives/{directive-id}/projects/{project-id}/` (use the project's `id`, not the directive name)

Most directives should use a single project with simple tasks. Multi-project is the exception for genuinely complex AND independent work.

**Validate the cast** — pipe the parsed JSON through `validate-cast.sh` to mechanically check casting rules:

```bash
echo "$PLAN_JSON" | .claude/hooks/validate-cast.sh
```

The script checks:
1. Every task has an auditor assigned
2. Builder is not in the reviewers array (conflict of interest)
3. Complex tasks (5+ phases) have at least one C-suite reviewer
4. Agents don't review changes to their own behavior/prompts

If validation fails (`valid: false`), log the violations and either:
- **Auto-fix** if the violation is clear (e.g., swap a conflicting reviewer for the next-best match per casting rules)
- **Block** and re-prompt the COO with the violations if auto-fix isn't possible

> See `.claude/hooks/validate-cast.sh` for the validation script (copied to consumer project by `/gruai-config`).
