# Releases, Pinned CWE Versions and Parallel Deployments — Design

## Purpose

The site has no releases today. `main` is production, and every build
downloads whatever MITRE's `cwec_latest.xml.zip` points at. That was fine
while MITRE published one line of CWE releases, but CWE 5.0 (schema 8.0)
came out on [2026-10-28][cwe-5-news] alongside 4.21 (schema 7.4), a parallel release for
consumers still on schema 7.x. Production quietly switched to 5.0 the same
day, the next time `main` was built. Nothing broke, but nothing decided it
either.

This design gives the project:

- **Releases**: a frozen version of the app, usually paired with one CWE
  version, served at its own path (`/v1/`, `/v1.1/`) for as long as we keep
  it, and still able to receive security fixes.
- **A pinned CWE version everywhere**, including `main`, so the data a
  build serves only changes through a reviewed PR.
- **Notification, not automation**, when MITRE publishes something new.

It then walks through the first concrete releases: v1.0 on CWE 4.20,
support for 4.21, v1.1 on 4.21, `main` on 5.0, and a follow-up design for
what 5.0 adds.

## Goals

- `https://cwe-visualizer.vercel.app/` redirects to the newest release,
  so the address bar always shows which release a visitor is on.
- `/latest/` serves `main`, rebuilt on every merge, as production is
  today.
- `/vX/` and `/vX.Y/` serve each release, side by side, indefinitely.
- A release is a long-lived git branch. Changes merged into it redeploy
  its path in place; there is no `/v1.0.1` beside `/v1`.
- A Dependabot security fix merged into `main` is backported to every
  release branch it applies to, automatically, as a PR the owner merges.
- Adding a release costs little: each production build grows by about a
  second per release, not by a full rebuild of it.

## Non-goals

- Feature work or routine dependency updates on release branches. Only
  `main` gets Dependabot's regular version updates. Backporting other
  fixes is allowed but expected to be rare and manual.
- A daily `npm audit` of release branches. `npm audit` has proven noisy
  and often unactionable here (see the dev-only `katex` ([GHSA-238p-pmpm-9mq7][ghsa-katex]) and
  `re2js` ([GHSA-gg6h-894w-4m9c][ghsa-re2js]) advisories noted in
  [#236][pr236]), so release branches get the security fixes `main`
  actually makes instead.
- Retiring old releases. Nothing here removes one; that can come later.
- Showing what CWE 5.0 adds (Groupings, Dimensions, and so on). That gets
  its own design (step 8 below).

## Anti-goals

- **The app must still never contact MITRE at runtime.** Everything below
  happens in builds and workflows. The production build now also downloads
  this repo's `deploy` branch from GitHub; that is build time too, and the
  ESLint rule for `src/**` is unaffected.
- **No silent data changes.** A build must never pick up a CWE version
  that no PR chose. That is the failure today's setup already had.
- **A release never changes because `main` did.** Merging to `main` may
  change `/latest/`, never `/v1/`.
- **A broken release branch must not take down production.** Its last good
  build keeps being served.

## Versioning

- Each release has a version `X.Y` and a branch named `vX` for `X.0`
  releases or `vX.Y` otherwise: `v1` is release 1.0, `v1.1` is 1.1,
  `v2` is 2.0. The path matches the branch: `/v1/`, `/v1.1/`.
- A release that moves to a new CWE schema line (4.x → 5.x) is a new
  major. A release that moves to a new CWE version within a line (4.20 →
  4.21) is a new minor. A release with no CWE change is major or minor
  depending on its content, decided when it is cut.
- `package.json`'s `version` on a release branch is `X.Y.0`; it doesn't
  change after the cut (in-place updates don't renumber the release).
  This closes [#162][i162]. **My call:** `main` keeps `0.0.0`, meaning
  "unreleased", rather than tracking the last release cut from it, which
  would be misleading once `main` moves on.
- "Newest release" (for the `/` redirect) means the highest version by
  numeric comparison of `X` then `Y`, not by date.

## The pinned CWE version

[`scripts/prepare-data.ts`][prepare-data] downloads
`https://cwe.mitre.org/data/xml/cwec_v{version}.xml.zip` from MITRE's
archive instead of `cwec_latest.xml.zip`. The pattern holds for every
version on [MITRE's archive page][cwe-archive], including patch
releases (`cwec_v4.19.1.xml.zip`).

- The version lives in one plain-text file at the repo root, e.g.
  `cwe-version` containing `4.20`, so workflows can read it with `cat`
  and `git show <branch>:cwe-version` without running Node. **My call** on
  the format and name; the builder may pick another, as long as it's one
  file that both the script and workflows read.
- [`prepare-data.ts`][prepare-data] checks that the downloaded catalog's
  `Weakness_Catalog/@Version` equals the pin and fails the build if not.
  That catches a typo'd pin and an archive file that isn't what it says.
- Archive files don't change, so the existing fast path (skip the
  download when the data is intact) can key on the pinned version instead
  of a `HEAD` request's `Last-Modified`. Builder's call.
- Add the version file to the path list in
  [`.github/scripts/vercel-ignore-build.sh`][ignore-build]; it is a build input.
- `main` is pinned like every release branch. Moving the pin is a normal
  PR with an issue.

## Watching MITRE

[`.github/workflows/update-data.yml`][update-data] stops redeploying anything. It becomes
a daily check with two independent jobs, and neither changes code or
deploys. Each opens **one issue per CWE version**: before opening one, it
looks for an existing issue (open or closed) with the same title, so a
version that stays unhandled for weeks doesn't produce an issue a day.

1. **Latest watcher.** Reads the version MITRE's `cwec_latest.xml.zip`
   contains (download it and read `Weakness_Catalog/@Version`; it is about
   2 MB) and compares it with `main`'s pin. If they differ, it opens
   "CWE _version_ is available", asking whether to move `main` to it and
   whether to cut a release.
2. **4.x watcher.** Reads MITRE's archive page for the highest `4.x`
   version and compares it with the highest `4.x` pinned on any branch
   (`main` or a `v*` branch). If MITRE's is higher, it opens the same kind
   of issue. A 4.x release never becomes "latest" any more, so the first
   job would never notice it. Once MITRE stops publishing 4.x this job can
   be deleted; it shouldn't be generalised into "watch every line" yet.

When `main` is pinned to 4.20 (step 1), the latest watcher's first run
will open "CWE 5.0 is available". That is expected, and that issue is the
one step 7 closes.

The workflow's existing configuration checks (`DEPLOYED_SITE_URL`,
`VERCEL_DEPLOY_HOOK_URL`) move to wherever those values are still used
(the deploy hook moves to the release workflow below).

## Site layout and deployment

```text
https://cwe-visualizer.vercel.app/
├── /          → redirect to the newest release (or /latest/ if none)
├── /latest/   main, built from source on every production build
├── /v1/       release 1.0, copied from the deploy branch
└── /v1.1/     release 1.1, copied from the deploy branch
```

Each build is a normal Vite build with `base` set to its path. The app
already fetches `${import.meta.env.BASE_URL}data/cwe.json` ([#226][pr226]), so
each copy finds its own data. The app has no client-side routes (state is
in `?cwe=` and similar query parameters), so no rewrites are needed.

### The `deploy` branch

An orphan branch, `deploy`, holds only built output, one directory per
release:

```text
deploy
├── v1/      index.html, assets/, data/   ← CWE 4.20
└── v1.1/    index.html, assets/, data/   ← CWE 4.21
```

Only the release workflow writes to it, one commit per publish, with a
message naming the release and source commit, e.g.
`v1.1: built from v1.1@abc1234`. Nobody edits it by hand. It is plain git,
so it never expires (unlike workflow artifacts) and its history records
what each release served and when.

Why not build every release inside each production build: measured on
2026-10-29, a production build takes 8–14 s today, and building one
release from scratch (clone, `npm ci`, download and parse its CWE zip,
`vite build`) takes about 20 s. Five releases would add about two minutes
to every merge to `main`, rebuilding output that hasn't changed. Copying
prebuilt output costs about a second per release. It also means a release
branch whose build breaks (say, an old toolchain stops installing) keeps
serving its last good build instead of blocking production.

### Flow 1: a change lands on a release branch

Triggered by a push to a branch matching `v[0-9]*` (a merged PR, or the
cut itself).

**The app is frozen with a release; its publish pipeline is not.** A push
runs the workflow files as they are on the pushed branch, i.e. the copies
made at the cut, which would otherwise age (Dependabot's action updates
only reach `main`) until an old release can't publish its security fix.
So the publish logic runs only from `main`:

- A **publish workflow** on `main`, triggered only by `workflow_dispatch`
  with the release branch name as input. It does steps 1–4 below,
  checking out the _release branch's_ source to build it.
- A **dispatcher workflow**, triggered by pushes to `v[0-9]*`, that does
  nothing but start `main`'s publish workflow for the pushed branch
  (`gh workflow run … --ref main`; `GITHUB_TOKEN` may trigger
  `workflow_dispatch`, with `actions: write`). Both files exist on
  `main`, so every cut copies the dispatcher, and it is small enough not
  to age.

Everything else on a release branch, notably [`ci.yml`][ci] for PRs into it,
stays as it was at the cut. If it ever breaks, the fix is a PR straight
to that branch, like any other backport.

1. Check out the branch, `npm ci`, run the data step (pinned, so it
   downloads that release's CWE version), and build with
   `--base=/<branch>/`.
2. **Only publish a release whose [`package.json`][package-json] version matches its
   branch name** (`v1.1` ↔ `1.1.0`). **My call:** this makes "cut the
   branch, then bump the version" safe, since nothing goes live until the
   version PR merges, and it stops a mistyped branch name from publishing.
3. Replace `<branch>/` on `deploy` with the new output, commit and push.
   Two releases publishing at once must not lose either's commit: run
   publishes one at a time (a workflow `concurrency` group) and/or retry
   on a rejected push.
4. Call the Vercel deploy hook (the existing `VERCEL_DEPLOY_HOOK_URL`
   secret), which rebuilds production from `main`.

The workflow needs `contents: write` to push `deploy`. The all-branch
`review` ruleset ([id 23597659][ruleset-review]) forbids deleting branches and force-pushes
but not ordinary commits, so it allows this as long as the workflow only
adds commits.

### Flow 2: a production build

Triggered by a merge to `main` (Vercel's git integration) or by the deploy
hook.

1. Build `main` as today, with `base` set to `/latest/`.
2. Download the `deploy` branch as one tarball from GitHub (the repo is
   public, so no token) and copy each `v*/` directory next to `latest/`.
3. Make `/` redirect to the newest release found in step 2, or to
   `/latest/` if there is none. **My call:** the redirect keeps the query
   string, so an old shared link like `/?cwe=79` still opens CWE-79.

**My call:** if the `deploy` tarball can't be downloaded, the production
build fails rather than deploying a site without its releases. Vercel
keeps serving the previous production deployment.

Vercel builds with `npm run build`; the extra steps go in a script under
`scripts/`, since CONTRIBUTING reserves that directory for what the build
runs. How `/` redirects is the builder's call: a server-side redirect
(e.g. Vercel's Build Output API, or `vercel.ts` if it can see the result)
is preferred, a static `index.html` that redirects is acceptable. Either
way the redirect must not be cached long, or browsers keep sending
visitors to an old release after a new one is cut.

**What a merge to `main` does:** only Flow 2. Flow 1 never runs for
`main`, and nothing writes `main`'s output to `deploy`. `/latest/` is
always built from `main`'s source; releases are always copied.

### Vercel previews and cleanup

- Pushes to `deploy` must not build previews (nothing there is a Vercel
  project). Pushes to `v*` branches themselves don't need previews either,
  since Flow 1 publishes them; PRs _into_ `v*` branches should still get
  previews like any other PR. The ignore-build script handles both.
- A PR preview builds a single copy at `/`, as today. It doesn't need the
  release layout.
- The maintainer's post-merge cleanup (delete merged branches and their
  previews) must never touch `v*` branches, `deploy`, or production
  deployments. That cleanup lives in the agent's memory, not the repo; the
  implementer updates it.

## Branch protection for release branches

The owner-only [`main-merge-owner-only`][ruleset-main] ruleset covers `main` alone, so
release branches need the same rules: changes only through a PR, CI
checks required, PR up to date, only the owner merges. Rulesets are
repository settings, not files, so this is a one-time manual step for the
owner, listed in the release-process docs (extending the existing ruleset
to `refs/heads/v*` is the simplest way). `deploy` is excluded: only the
workflow writes to it, and requiring PRs there would block it.

[`ci.yml`][ci] already runs on `pull_request` for every base branch, so PRs into
release branches get the full CI. `validate-issue-link` applies to them
too.

## Security backports

Dependabot only opens security-update PRs against the default branch, and
`target-branch` applies only to version updates (confirmed in GitHub's
[Dependabot options reference][dependabot-target-branch]). So release branches get their fixes by
backport from `main`.

**Every security fix is backported, dev dependencies included.** Most
advisories don't affect what a release serves, but backporting them all
means nobody has to reason about why some packages were updated on a
branch and others weren't, and it closes the (small) attack surface of an
old branch's CI and build. The volume this produces is accepted.

**Triggers:**

- A Dependabot _security_ update PR merged into `main`. The
  [`dependabot/fetch-metadata`][fetch-metadata] action tells security updates apart from
  version updates and gives the advisory (GHSA ID), the package and the
  fixed version. It needs `alert-lookup`, which needs a token that can
  read Dependabot alerts.
- A manual run (`workflow_dispatch`) given a GHSA ID, for security fixes
  made by hand on `main`, as [#234][pr234] (zod, [GHSA-mrhx-c7xc-m3w5][ghsa-zod]) was when Dependabot opened no PR.
  The package and fixed version come from GitHub's advisory API. The
  release-process docs say to run it after any manual security fix.

For each release branch:

1. Check whether its [`package-lock.json`][package-lock] has the package at a version the
   advisory affects. If not, skip the branch silently.
2. If it does, branch off it, update the package to the patched version
   (regenerating the lockfile on that branch; `main`'s lockfile diff will
   rarely apply to an older lockfile), and run the same checks CI runs.
3. Open an issue ("Backport GHSA-… to v1.1") and a PR into the release
   branch that closes it, so `validate-issue-link` passes. The owner
   merges as usual; merging triggers Flow 1 and the release redeploys.
4. If the update can't be made cleanly (no patched version within the
   branch's ranges, install fails, tests fail), open only the issue,
   saying what went wrong.

Constraints the builder must handle:

- PRs and pushes made with the workflow's `GITHUB_TOKEN` don't trigger
  other workflows, so CI would never run on the backport PR. Open it
  with a token that does: a fine-grained PAT or a GitHub App token,
  stored as a secret, scoped to this repository.
- Workflows triggered by Dependabot see only Dependabot secrets. Trigger
  on the merge to `main` (whose actor is the owner), not on Dependabot's
  own events, or the secrets above won't be available.
- Dedupe: one issue/PR per advisory per branch, even if the workflow
  reruns.

Known blind spot, accepted: a vulnerability in a package `main` no longer
uses never produces a security fix on `main`, so nothing backports it
(though the manual trigger can be run for it once someone notices).
Release branches are rarely touched and few, so this is acceptable for
now.

## The release process

Documented in [`CONTRIBUTING.md`][contributing] (a new "Releases" section) so it is
repeatable by hand or by an agent:

1. Decide what goes in: usually "`main` as it is, on the CWE version it
   pins". If the release should be on a different CWE version, move
   `main`'s pin first (a normal PR).
2. Open an issue for the release.
3. Tag the commit on `main` the release branches from as `vX.Y-base`,
   and create the branch from that tag in the same atomic push. Nothing
   publishes yet: its version is still `0.0.0`. The tag only records where
   the release diverged from `main`; nothing reads it, and publishing
   always uses the branch. (Added on 2026-10-30, before the first cut.)
4. Open a PR into the branch setting `package.json` to `X.Y.0`, closing
   the release issue. Merging it publishes the release (Flow 1), and `/`
   moves to it if it's the newest.
5. Fixes later: PR into the release branch, with an issue, as for `main`.
   Merging redeploys that release in place.

The docs also cover the release-branch and release-base-tag rulesets, the `deploy` branch
("never edit by hand"), the two watchers, and the backport workflow, and
update the existing passages that describe the daily refresh as
redeploying production and the production site as being `main`.
[`README.md`][readme] gets a short note that `/` is the newest release and
`/latest/` follows development.

## Plan of work

Each item is one PR (or a few) with its own issue, in this order.

1. **Pin the CWE version; pin `main` to 4.20.** The archive download,
   the version check, the version file, tests, and the daily workflow
   rewritten into the two watchers. Production moves from 5.0 back to
   4.20 when this merges; that is a visible step back and intended.
   (The user's steps 1 and 2. They can be separate PRs if the pin
   capability is reviewed first with the pin still at 5.0, but a single
   PR is simpler.)
2. **Release infrastructure.** `/latest/` base, the `deploy` branch,
   the Flow 1 publish and dispatcher workflows, the Flow 2 build script, the `/` redirect, ignore-build
   changes, and the release-process docs. Before this merges, the owner
   creates the release-branch ruleset. After it merges, `/` redirects to
   `/latest/` (no releases yet).
3. **Security backport workflow**, with its token set up by the owner.
   Can go before or after item 4; it must exist before a release branch
   needs a fix.
4. **Release 1.0 on CWE 4.20.** Cut `v1` and bump its version, per the
   process. `/` now redirects to `/v1/`. Closes [#162][i162].
5. **Support CWE 4.21.** At minimum, the `Overlaps` relation (below).
   Before implementing, read MITRE's 4.20 → 4.21 content diff
   ([`v4.20_v4.21.html`][diff-420-421]) and the schema
   7.3 → 7.4 changes for anything else the app reads. Then move `main`'s
   pin to 4.21. If the diff turns up nothing beyond `Overlaps`, this needs
   no design of its own.
6. **Release 1.1 on CWE 4.21.** Cut `v1.1`. `/` now redirects to
   `/v1.1/`; `/v1/` keeps serving 4.20.
7. **Move `main` to CWE 5.0.** `/latest/` serves 5.0 at least as well as
   v1.1 serves 4.21 (see below). Closes the "CWE 5.0 is available" issue.
   No v2 release is cut in this work.
8. **Design what 5.0 adds**, as its own design document, and open a
   sub-issue of [#210][i210] for each feature chosen.

### What changes between 4.20, 4.21 and 5.0, for this app

Measured on 2026-10-29 by parsing each archive with today's
`parseCatalog`:

| | 4.20 | 4.21 | 5.0 |
| --- | --- | --- | --- |
| Schema / namespace | 7.3, `cwe-7` | 7.4, `cwe-7` | 8.0, `cwe-8` |
| Weakness entries | 969 | 984 | 984 |
| Relations | 1,602 | 1,622 | 1,622 |
| `Overlaps` relations | 0 | 3 | 3 |

- 4.21 and 5.0 give identical graphs: same entries, every edge identical.
  49 descriptions differ in wording. No field parses empty in any of the
  three.
- `Overlaps` is new in 4.21, not 5.0. MITRE describes it as symmetric,
  like `PeerOf`. Today [`graph.ts`][graph] doesn't know it, so it synthesises a
  reverse edge labelled "Overlaps (inverse)", and [`relations.ts`][relations] doesn't
  group it, so it isn't shown with the peer relations. Supporting 4.21
  means treating `Overlaps` as its own inverse and grouping it with
  `PeerOf`, with tests; per CONTRIBUTING these are real-world tests (the
  data has it).
- 5.0's other changes (Category replaced by Grouping, Dimensions,
  Custom_Phases, Technical_Nuance, notes on relations, repeatable phases,
  the namespace) touch nothing the parser reads, which is only Weakness
  attributes, `Description` and `Related_Weakness` attributes. So "as
  good as 4.21" in item 7 needs only the pin move, plus a check that
  nothing in the 4.21 → 5.0 diff changed that.

### Candidates for the 5.0 design (item 8)

Not decided here, listed so that design starts from them:

- Groupings, which replace Categories (and [#3][i3], which [#210][i210] says should be
  rethought).
- Dimensions on relations.
- AI and hardware phases (Custom_Phases).
- Technical_Nuance and the new notes.
- JSON downloads, which [#210][i210] hopes will let the project drop its XML
  dependencies (`adm-zip`, `fast-xml-parser`), if MITRE publishes them.

## Calls left to the builder

- The version file's name and format (one file, readable without Node).
- How the data step's fast path detects intact data under a pin.
- How `/` redirects, within the constraints above.
- How the latest watcher reads MITRE's latest version, and how the 4.x
  watcher reads the archive page.
- The exact names of new workflows, scripts and the issue titles, matching
  the repo's conventions.
- Whether item 1 is one PR or two.

<!-- Issues and PRs -->
[i3]: https://github.com/mureinik/cwe-visualizer/issues/3
[i162]: https://github.com/mureinik/cwe-visualizer/issues/162
[i210]: https://github.com/mureinik/cwe-visualizer/issues/210
[pr226]: https://github.com/mureinik/cwe-visualizer/pull/226
[pr234]: https://github.com/mureinik/cwe-visualizer/pull/234
[pr236]: https://github.com/mureinik/cwe-visualizer/pull/236

<!-- Advisories -->
[ghsa-katex]: https://github.com/advisories/GHSA-238p-pmpm-9mq7
[ghsa-re2js]: https://github.com/advisories/GHSA-gg6h-894w-4m9c
[ghsa-zod]: https://github.com/advisories/GHSA-mrhx-c7xc-m3w5

<!-- External -->
[cwe-archive]: https://cwe.mitre.org/data/archive.html
[cwe-5-news]: https://cwe.mitre.org/news/archives/news2026.html#October28_CWE_Version_5_0_Schema_8_0_Now_Available
[diff-420-421]: https://cwe.mitre.org/data/reports/diff_reports/v4.20_v4.21.html
[dependabot-target-branch]: https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference#target-branch-
[fetch-metadata]: https://github.com/dependabot/fetch-metadata
[ruleset-review]: https://github.com/mureinik/cwe-visualizer/rules/23597659
[ruleset-main]: https://github.com/mureinik/cwe-visualizer/rules/24799723

<!-- Files in the repo, as they are now -->
[contributing]: ../../../CONTRIBUTING.md
[readme]: ../../../README.md
[package-json]: ../../../package.json
[package-lock]: ../../../package-lock.json
[prepare-data]: ../../../scripts/prepare-data.ts
[graph]: ../../../src/lib/graph.ts
[relations]: ../../../src/lib/relations.ts
[ci]: ../../../.github/workflows/ci.yml
[update-data]: ../../../.github/workflows/update-data.yml
[ignore-build]: ../../../.github/scripts/vercel-ignore-build.sh
