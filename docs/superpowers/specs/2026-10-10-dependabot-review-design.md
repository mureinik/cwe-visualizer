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
- **No LLM.** A shell step; the job's `GITHUB_TOKEN` (`contents: read`,
  `pull-requests: read`) does every lookup:
  1. List open PRs authored by `dependabot[bot]` (up to 100).
  2. For each, read `behind_by` from the compare API
     (`main...<head sha>`), failing the run if it isn't a number.
  3. If `behind_by > 0`, comment `@dependabot rebase`, unless the last
     such request on the PR (ours or a manual one) is newer than the PR's
     head commit and less than a day old. One push never produces
     duplicate requests, and a request Dependabot ignored is repeated on
     the next push or dispatch once it is a day old.
- **The comment is posted as the repo owner.** Dependabot obeys only
  users with push access and refuses `github-actions[bot]` ("Sorry, only
  users with push access can use that command."), so the comment uses
  `DEPENDABOT_REBASE_TOKEN`: an Actions secret holding a fine-grained
  personal access token of the owner's, limited to this repository and
  Pull requests read/write, with an expiry. The workflow runs only on
  pushes to `main` and manual dispatch, never on PR code, so the token is
  never in reach of untrusted code. It fails with an error if the secret
  is missing.
- Dependabot already rebases on its own when a PR conflicts; this covers
  the conflict-free "behind" case, which branch protection's strict
  status checks (the up-to-date requirement) still block.

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
    secrets:
      CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.DEPENDABOT_CLAUDE_CODE_OAUTH_TOKEN }}
  ```

  Only the one secret is passed, by name (no `secrets: inherit`); see
  "Credentials".

  `needs` makes it start only once every required check except
  `validate-issue-link` (which Dependabot is exempt from) has passed.
  Calling a reusable workflow keeps the reviewer in its own file while
  avoiding `workflow_run`, which zizmor flags as a dangerous trigger.

- **Step 1, shell gate.** Ends the job successfully, with a `::notice::`
  and no review, if:
  - the PR is behind `main` (the rebase requester handles it, and CI
    re-runs after the rebase);
  - the PR changes anything under `.github/workflows/` (every GitHub
    Actions update, the `ci` group, does). The Claude App refuses to mint
    a token for such PRs, and the action would exit green without
    reviewing, so the gate says so and the owner reviews them by hand;
  - `claude[bot]` (a `Bot` account) already approved this exact head SHA
    (a re-run); or
  - it approved an earlier commit of the PR with the same dependency
    change signature. The signature is the SHA-256 of the sorted lines
    `<file> <added or removed line>`, plus each file name, taken from the
    compare API (`<base>...<sha>`); hunk headers and context lines, which
    a rebase can shift, are left out. A file GitHub sends no patch for
    counts by its blob SHA instead, which can only cause an extra review.
    This stops each rebase after a merge from starting a new run and a
    new ping for the owner, since earlier approvals aren't dismissed.

  A `behind_by` that isn't a number fails the job.

- **Step 2, Claude.** `anthropics/claude-code-action`, pinned by SHA like
  the existing workflow, running on a checkout of `main` (the base), not
  the PR head, with `persist-credentials: false`. No `npm ci`: new
  dependency code never runs in a job that can mint Claude or GitHub
  credentials.

  Allowed tools:
  - `Read`, `Grep`, `Glob` over the checkout, to see how the app uses each
    bumped dependency
  - `Bash(gh pr view <N>:*)`, for this PR only
  - `Bash(gh issue list:*)`, `Bash(gh issue create:*)`
  - `Bash(gh pr review <N> --approve:*)`, approving this PR only

  Disallowed outright: `Edit`, `Write`, `MultiEdit`, `NotebookEdit`,
  `WebFetch`, `WebSearch`, and `Read(./.git/**)` and `Read(//proc/**)`,
  where the GitHub token would otherwise be one read away. Also not
  allowed: generic `gh api` (it can POST), `git push`, `gh pr merge`.
  Claude is told to single-quote `--title` and `--body` values, since
  commands with `$(...)`, heredocs or backticks in double quotes are
  denied.

  `additional_permissions: contents: read` overrides the action's default
  App-token request of `contents: write`, so the token Claude can see
  can't push.

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
   - opens with `@<owner> Claude reviewed this change; it's ready for you
     to merge.`;
   - summarises the release notes per package;
   - calls out breaking changes or deprecations noticed;
   - links the issues opened, and notes the issue cap if it was hit.

Approval is a signal only: the ruleset requires no approving review, and
the owner still merges by hand.

## Credentials

- **Claude: a dedicated subscription token.** `claude setup-token`
  output, stored as the `DEPENDABOT_CLAUDE_CODE_OAUTH_TOKEN` Dependabot
  secret (workflows triggered by Dependabot see only Dependabot secrets)
  and passed to the action as `claude_code_oauth_token`. Runs draw on the
  subscription's usage limits, so there is no per-run bill to run up
  ("denial of wallet"); abuse can only use up those limits. It is a
  different token from the main agent's `CLAUDE_CODE_OAUTH_TOKEN`, so
  either can be revoked alone.

  This replaced workload identity federation (#114). Federation worked —
  with a CEL rule matching GitHub's ID-based `sub`
  (`repo:<owner>@<owner_id>/<repo>@<repo_id>:pull_request`) — but API
  requests then failed with `billing_error`: the API organization had no
  purchased credit, and its promotional credit didn't cover Claude Code
  usage.
- **GitHub identity:** the Claude GitHub App token, minted through OIDC
  (`id-token: write`) as in `claude.yml`, for the approval and issues. It
  is requested with `contents: read`, `pull-requests: write` and
  `issues: write`, so it can't push. The action exposes it to Claude's
  tools, and it is revoked when the step ends. The job's own
  `GITHUB_TOKEN` stays `contents: read`, `pull-requests: read`.

## Security

The release notes are untrusted text written by third parties, read by an
LLM that can act on GitHub. The design limits what a prompt injection
could achieve:

- The decision to review at all is made by the shell gate and the
  `needs` chain, not the model: only green, up-to-date Dependabot PRs
  reach it.
- Its tools allow reading, opening issues, and approving; nothing that
  writes code, pushes, or merges.
- The model can still get at the GitHub App token: the action puts it in
  the environment and the git config, and an allowlisted `gh` command
  can print it. That token is short-lived, has issues and pull-requests
  write but no contents write, and is revoked when the step ends.
- The prompt caps issues at 3 per PR (a cap the model keeps, not one
  the token enforces).
- The subscription token is long-lived, so the action step sets
  `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1`, which keeps Anthropic credentials
  out of the environment Claude's tools run in; without it, an
  allowlisted `gh ... --jq env.X` could print the token. Only the reviewer
  job receives the secret, and it runs no code from the update.
- Usage counts against the subscription's limits, not a bill.

Worst case: for as long as the step runs, junk issues, comments and
approvals on this repository, through Claude's tools or the leaked token.
No pushes and no merges; the owner still merges by hand.

## Error handling

- If the agent fails or hits the subscription's usage limits, the
  `dependabot-review` job
  fails and shows red on the PR. It is not a required check, so the owner
  can still review and merge by hand.
- If a rebase request is ignored, the PR stays behind; the requester
  asks again on the next push or dispatch once the previous request is a
  day old.
- A PR that changes workflow files is out of scope: the Claude App won't
  act on it, so the gate skips it with a notice and the owner reviews it
  by hand.

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
   not, the rebase requester needs another identity. Outcome: it refused
   (#105), so the comment is now posted with the owner's fine-grained
   token (#118).

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
  the one-time setup (the `DEPENDABOT_CLAUDE_CODE_OAUTH_TOKEN`
  Dependabot secret).
- Update the "Workflow" section's description of what bots may do, if the
  approval needs mentioning there.
