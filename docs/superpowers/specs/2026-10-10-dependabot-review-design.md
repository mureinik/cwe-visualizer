# Dependabot PR Reviewer — Design

## Purpose

Dependabot opens a batch of update PRs once a week (see
`.github/dependabot.yml`). Each one needs the same routine: get it up to
date with `main`, wait for the checks, read the release notes for anything
worth adopting, and merge. This automates everything up to the merge, so
the repo owner's part shrinks to reading a summary and clicking merge.

The original design (`2026-08-23-cwe-visualizer-design.md`) left an
LLM-based PR reviewer out of scope. This adds one for Dependabot PRs only;
human- and agent-authored PRs are still reviewed by hand.

## Requirements

- When a Dependabot PR is behind `main`, ask Dependabot to rebase it by
  commenting `@dependabot rebase`.
- When all checks on an up-to-date Dependabot PR pass, review its release
  notes:
  - Open an issue for each new feature that looks useful for this app, and
    for each deprecation that affects code we use.
  - Approve the PR, tag the repo owner, and say it was reviewed and is
    ready to merge.
- Never merge. The `main-merge-owner-only` ruleset stays unchanged, and so
  does the guarantee in `CONTRIBUTING.md` that bots and automation never
  update `main`.

## Architecture

Two workflows, both new files, plus one job added to `ci.yml`:

```text
.github/workflows/
├── ci.yml                   # + dependabot-review job: calls the reviewer
├── dependabot-rebase.yml    # on push to main: request rebases (shell only)
└── dependabot-review.yml    # on workflow_call: gate + Claude review
```

### Rebase requester — `dependabot-rebase.yml`

- **Trigger:** `push` to `main` (that is what makes open PRs fall behind),
  plus `workflow_dispatch`.
- **No LLM, no secrets.** A shell step using the job's `GITHUB_TOKEN`
  (`pull-requests: write`):
  1. List open PRs authored by `dependabot[bot]`.
  2. For each, read `behind_by` from the compare API
     (`main...<head sha>`).
  3. If `behind_by > 0`, comment `@dependabot rebase` — unless the PR's
     newest comment is already that request and is newer than the PR's
     head commit, so one push never produces duplicate requests.
- Dependabot already rebases on its own when a PR conflicts; this covers
  the conflict-free "behind" case, which the ruleset's up-to-date
  requirement still blocks.

### Reviewer — `dependabot-review.yml`

- **Trigger:** `workflow_call` only, from a job in `ci.yml`:

  ```yaml
  dependabot-review:
    if: github.event_name == 'pull_request' && github.event.pull_request.user.login == 'dependabot[bot]'
    needs: [build, lint-workflows, dependency-review]
    permissions:
      contents: read
      pull-requests: read
      id-token: write
    uses: ./.github/workflows/dependabot-review.yml
  ```

  No secrets are passed: the reviewer authenticates through OIDC (see
  "Credentials").

  `needs` makes it start only once every required check except
  `validate-issue-link` (which Dependabot is exempt from) has passed.
  Calling a reusable workflow keeps the reviewer in its own file while
  avoiding `workflow_run`, which zizmor flags as a dangerous trigger.

- **Step 1, shell gate.** Ends the job successfully, with no review, if:
  - the PR is behind `main` (the rebase requester handles it, and CI
    re-runs after the rebase), or
  - the reviewer already approved this exact head SHA (a re-run).

- **Step 2, Claude.** `anthropics/claude-code-action`, pinned by SHA like
  the existing workflow, running on a checkout of `main` (the base), not
  the PR head, with `persist-credentials: false`. No `npm ci`: new
  dependency code never runs in a job that can mint Claude or GitHub
  credentials.

  Allowed tools:
  - `Read`, `Grep`, `Glob` over the checkout, to see how the app uses each
    bumped dependency
  - `Bash(gh pr view:*)`
  - `Bash(gh issue list:*)`, `Bash(gh issue create:*)`
  - `Bash(gh pr review:*)`

  Not allowed: generic `gh api` (it can POST), file edits, `git push`,
  `gh pr merge`, web fetches.

### Agent behaviour

1. Read the PR with `gh pr view`. The release notes, changelog, and
   commits Dependabot embeds in the PR body are the only source; the agent
   has no network access beyond `gh`. If the body says notes were
   truncated, the agent says so in its approval.
2. For each bumped package, decide what in its notes matters to this app,
   grounding that in how the repo actually uses the package (Read/Grep).
3. **Issues.** One per useful new feature, and one per deprecation that
   affects code we use (even though CI is green):
   - Search first with `gh issue list --search` and skip anything already
     filed.
   - Title: `Adopt <package> <version>: <feature>` (or
     `Migrate off deprecated <package> <API>` for a deprecation).
   - Body: the quoted release note, why it is relevant with file
     references, and a link to the PR.
   - **At most 3 issues per PR.** If there were more candidates than that,
     the approval tags the repo owner and lists the ones not filed.
4. **Approval.** A single `gh pr review --approve` whose body:
   - tags `@mureinik` and says the change was reviewed and is ready to
     merge;
   - summarises the release notes per package;
   - calls out breaking changes or deprecations noticed;
   - links the issues opened, and notes the issue cap if it was hit.

Approval is a signal only: the ruleset requires no approving review, and
the owner still merges by hand.

## Credentials

- **Claude API: workload identity federation, no stored key.** The action
  exchanges the job's GitHub OIDC token for a short-lived Claude API token
  (`anthropic_federation_rule_id` and `anthropic_organization_id`), so
  there is no secret to leak. Setup in the Anthropic Console:
  - a dedicated workspace with a monthly spend limit, which bounds the
    cost of a runaway or abused run ("denial of wallet");
  - a federation rule targeting that workspace, which trusts GitHub's OIDC
    issuer only for this repository's `dependabot-review.yml` (matched on
    the token's repository and `job_workflow_ref` claims).

  The rule and organization IDs are identifiers, not secrets. They live in
  repository variables (`ANTHROPIC_FEDERATION_RULE_ID`,
  `ANTHROPIC_ORGANIZATION_ID`). The main Claude agent's
  `CLAUDE_CODE_OAUTH_TOKEN` is untouched and unrelated.
- **GitHub identity:** the Claude GitHub App token, minted through OIDC
  (`id-token: write`) as in `claude.yml`, for the approval and issues. The
  job's own `GITHUB_TOKEN` stays `contents: read`, `pull-requests: read`.

## Security

The release notes are untrusted text written by third parties, read by an
LLM that can act on GitHub. The design limits what a prompt injection
could achieve:

- The decision to review at all is made by the shell gate and the
  `needs` chain, not the model: only green, up-to-date Dependabot PRs
  reach it.
- Its tools allow reading, opening issues, and approving; nothing that
  writes code, pushes, or merges.
- The issue cap bounds spam to 3 issues per PR.
- The workspace spend cap bounds cost, and there is no long-lived Claude
  credential to steal.

Worst case: up to 3 junk issues and an approval on a PR whose checks
already passed, which the owner still has to merge by hand.

## Error handling

- If the agent fails or hits the spend cap, the `dependabot-review` job
  fails and shows red on the PR. It is not a required check, so the owner
  can still review and merge by hand.
- If a rebase request is ignored, the PR stays behind; the next push to
  `main` or a manual `workflow_dispatch` asks again.

## Risks to verify on the first live run

A `pull_request` workflow runs from the PR's merge with `main`, so a
Dependabot-triggered run only picks up these workflows once they are on
`main`. The first live run, on a Dependabot PR, is therefore the probe:

1. **OIDC and variables under Dependabot.** A `pull_request` run triggered
   by Dependabot gets a read-only `GITHUB_TOKEN` by default. Confirm that
   `id-token: write` can be granted there, so the action can federate to
   the Claude API and mint the Claude App token, and that the repository
   variables are visible. If they aren't, write the IDs into the
   workflow; they aren't secret.
2. **Dependabot honouring `github-actions[bot]`.** Dependabot acts only on
   commands from users with write access. Confirm it obeys a
   `@dependabot rebase` comment posted with the job's `GITHUB_TOKEN`; if
   not, the rebase requester needs another identity (for example the
   Claude App token).

## Testing

- `lint-workflows` (actionlint, zizmor, shellcheck) covers both new
  workflows and the `ci.yml` change.
- The gate and rebase logic stay small enough for shellcheck and review;
  no unit-test harness for workflow shell.
- End to end: the next Dependabot batch, checking that behind PRs get one
  rebase request each, and green PRs get an approval, a summary, and
  issues only where warranted.

## Documentation

- `CONTRIBUTING.md`: a "Dependabot reviewer" subsection under "Working
  with the Claude agent" covering what it does, that it never merges, and
  the one-time setup (Console workspace with a spend cap, the federation
  rule, the two repository variables).
- Update the "Workflow" section's description of what bots may do, if the
  approval needs mentioning there.
