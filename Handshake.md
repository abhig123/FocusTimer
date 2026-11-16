# 2 · Choose your task
What the instructions require:
A good task is real and checkable: something you actually want done, like the work you do every day. Use your own code, open-source code, or code you write for this task, and make sure it is safe to share. No PIIs, No old GitHub PR already solved by a human; the model can look up the answer.

Start from code you work with. Don't start from an empty folder and ask the model to build something from scratch, such as "make me a to-do app". Good tasks look like:

Add a feature
Fix a bug
Refactor
Write tests
A multi-part feature
A bug that needs tracing
A refactor across several files
Don't engineer traps. If you'd be annoyed to get the task from a colleague, it's a trap. Writing the way you normally write is not.

Where the code comes from
Source	What reviewers expect	What you record
Your own code you are allowed to share	You know the conventions the model cannot. Strip secrets and anything you do not own.	source: own
An open-source repository you use or contribute to	Work an open issue or an improvement you would make. If a person has published a fix, it is out.	source: oss_used
An open-source repository you do not normally work with	Allowed, but a reviewer will ask why you want this done. If the answer is "I don't," it is role-play.	source: oss_other
The published-fix check
Before you commit to a task on open-source code, search the repository's issues and pull requests, open and merged, for the change you plan to ask for. A merged fix means the model may reproduce the answer rather than reason toward it.

The machine your task runs on
The model and the Sandbox panel run on the same machine. Pick a task whose code installs, builds and tests there. If it cannot, the conversation stalls on setup.

Installed (as of Nov 5)	Ubuntu 24.04 on x86-64, 4 CPUs, 16 GB of memory; Node 22.21 (npm 10.9, pnpm 10.34); Python 3.10 to 3.14 (pip, uv); Java 21 (Maven 3.8, Gradle 8.14); GCC 13, make, CMake 3.28; PostgreSQL 16 (not started); Chromium (Playwright 1.56)
Missing	Docker, a GPU, Go, Rust, .NET, Ruby, PHP, yarn, clang, MySQL, MongoDB, Redis, among others. System packages, such as C/C++ development libraries, cannot be installed.
No internet	Libraries install only from internal copies of npm, PyPI, Maven and Gradle. These lack some versions, including most npm package versions under two weeks old. With a lockfile, one missing version stops the install; a commit whose lockfile is at least three weeks old helps, but is no guarantee. Every other download fails: installers, the Gradle wrapper, git dependencies, browsers, binaries.
Check this before you pick a task
Compare your project's tools, versions and lockfile with the list above. If something is still missing, you may ask the model to change the project: for a missing version it can replace the lockfile (npm: delete it, then npm install) and loosen versions pinned too new. Also send your project lead the error lines and the lockfile, so the versions can be requested.

Pick something that unfolds over turns
Pick work you would hand a colleague in pieces. We expect conversations to be usually 6–20 turns, with no hard minimum or maximum. Let the work determine the length: six organic turns are fine, and longer conversations are welcome when the work needs them. Never pad a conversation to reach a number.

The full requirement is too much for one response: the model must plan, build, verify and report several times.
Make it iterative: the job schema after the manifest validation, the edge cases after the core behaviour. State every requirement in the task description field and never say that more will come later.
Verification is real work: a test suite, a reproducibility check, a byte-identical diff.
If the conversation takes fewer than six turns, the task may have been too easy. Check whether the scope offered real engineering work; do not add artificial turns or restart solely to meet a count.

Before you move on
I actually want this done, and it is like my day-to-day work
It starts from code that already exists, not an empty folder
It is at least a couple of hours of real work, T2 or larger, with scope for an organic, iterative conversation
The code has no secrets, personal data, or anything I am not allowed to share
I searched issues and pull requests: no person has published a fix for this
I know whether I will work live or away
My project's tools, versions and lockfile work on the machine above: no Docker, no internet, no npm packages newer than about two weeks

# 3 · Prepare the codebase
The codebase travels on its own branch and pull request, so nothing about this project reaches the model.

The codebase must be clean of everything but the code
No brief, no notes, no reference to this project, to Handshake, to a task, to an evaluation. No attempt1/ folder, no .github workflow of ours, no README that mentions the task code. The Automated pre-check lists the archive at your pinned commit and blocks the brief if it finds this project's files in it; your codebase's own .github folder is fine. A reviewer reads that listing and looks for the rest.

Prepare it locally
1
Pin one state
Decide the exact commit or working tree the task starts from.

2
Strip what the task does not need
Remove build output and dependency folders: node_modules, .venv, venv, target, dist, build, __pycache__. Remove the original .git folder; the task repository has its own history. Skip very large binary fixtures unless the task needs them. Keep, or add, a .gitignore that lists those generated folders: the platform records the model's changes under a 10 MB limit, and one dependency install by the model without a .gitignore can push the recorded changes past it and leave the code changes empty.

3
Remove anything you do not own or must not share
Secrets, keys, PIIs, private code you can't publish. The check scans for credentials; the responsibility is yours. We will reject tasks in such cases.

Put the archive on the codebase branch
From your clone of your fork (see Fork your task repo):

 <!-- from your code's own git checkout: pin one commit, the code's own name as the single top folder -->
git archive --format=zip --prefix=<project>/ -o <project>.zip <commit>
<!-- code not in git: zip -r <project>.zip <project>/ -x '<project>/node_modules/*' '<project>/.venv/*' '<project>/dist/*' -->

<!-- then, in your clone of your fork -->
git checkout codebase                 # the empty branch; NOT a branch off main
<!-- if git says the name is ambiguous (your clone has two remotes): git checkout --track origin/codebase -->
cp /path/to/<project>.zip .           # the archive is the only file on the branch
git add <project>.zip
git commit -m "codebase"
git push -u origin codebase

Copy
On GitHub, open a pull request from your fork's codebase into the task repository's codebase branch. Title: <task_code> codebase. Name the archive after the code, never after this repository or your task code: the client sees the file name. Under 50 MB is the target; GitHub refuses files over 100 MB. Copy the pull request's latest commit SHA, all 40 characters, into codebase_commit_sha in attempt1/meta.txt. Keep this exact file: it is what you mount later.

Good
| codebase pull request: one file, sqlite-utils.zip, with the single top folder sqlite-utils/

Bad
| codebase pull request: sqlite-utils.zip plus README.md next to it, or hertz-HTZ-T017.zip with a .git/ folder inside

The pre-check lists what is inside the archive. Extra files next to it, a .git or __MACOSX folder inside, more than one top folder, or a file or folder named after this repository or your task code is a blocking check. Rebuild the archive and push it again to the same branch.

Before you move on
The codebase pull request holds one archive named after the code, built from one pinned state, and I have the 40-character SHA of its latest commit
No dependency or build folders, no original .git, no oversized fixtures, and a .gitignore that covers dependency, cache and build folders
Nothing in the archive mentions this project, the task, Handshake, or an evaluation
The pull request targets the codebase branch and is titled <task_code> codebase

# 4

## 4.1 · Task description
What the task is and why it matters. It can assume the reviewer knows the codebase.

Two paragraphs is ideal, three at most.
Third person. Open with the goal, but vary how you say it.
Say what must not change.
Never mention the project or that this is a human data task.
One import command, no half-updated database
Task description from an accepted task. Select a label to find the goal, reason, or boundary.

Choose a label to highlight its sentence and see what it contributes.

Goal
Why it matters
Boundaries
Add a new import-batch DATABASE MANIFEST command to the sqlite-utils command line tool. Today I load related tables for a local data investigation with several separate insert and upsert commands. When a later input fails part way through, the earlier commands have already committed and the database is left half updated, and the batch size option commits partial progress for a single command as well. I want one command that reads a small JSON manifest listing ordered insert and upsert jobs against one destination database and runs them as a single all or nothing operation. A successful batch commits every job together. A failure in a later job, including a parse error, a constraint failure or an interruption, leaves the database with its previous rows and schema, including any earlier upserts, truncation, new tables and added columns.

Style rule for this field: end with the sentence "Checked once more against the pinned baseline before filing." exactly as written.

The command also needs a real dry run that exercises the same database work without persisting anything, concise human output, and an optional single JSON outcome object on stdout that distinguishes a confirmed commit, a successful dry run, a rejected manifest, a rollback and an uncertain state. Existing standalone insert and upsert commands must keep their current behavior, including streaming of JSONL, CSV and TSV input. The starting source is unchanged public sqlite-utils code at a pinned commit and does not contain this command.

Goal: Name the deliverable immediately.

Use this example to identify the goal, reason, and boundary. Its first-person wording is preserved from the source; write your own description in third person as instructed above.

4.2 · How to judge completion
Which commands to run, how to run them, and what the result should look like, in natural language.

Exact, copy-pasteable commands, one per line.
The caveats that would make a naive check pass or fail wrongly.
Behaviours to check on fresh inputs, one outcome per sentence.
Where to look, and what must stay unchanged.
A passing command can still check the wrong thing
Completion field from an accepted sqlite-utils task. The full submitted passage follows.

Work from the mounted project root, expected to be /workspace/sqlite-utils, on Python 3.12 or later. Install the project in editable mode with its dev dependency group, for example with pip install -e . --group dev or with uv.

After the final turn these commands must succeed from the project root. Adapt the new test filenames if the session chose different names, and record the actual counts, skips and any limitations.

python -m pytest -q tests/test_cli_insert.py tests/test_cli_import_batch.py tests/test_import_batch_manifest.py python -m pytest -q tests/test_cli_insert.py tests/test_cli_import_batch.py tests/test_import_batch_manifest.py --sqlite-autocommit python -m pytest -q python -m sqlite_utils import-batch --help

Note that the tool routes an unknown subcommand to its default query command, so the help command above exits 0 even before the feature exists. The usage line it prints must name import-batch, not query.

Also run the repository checks defined in the Justfile and CI in their existing scopes, which are black, flake8, mypy, pyright, ty, cog and codespell, plus the isolated no dev group help smoke check with uv run --isolated --no-default-groups sqlite-utils --help. A clean mypy result alone is not enough because mypy ignores the CLI module and the tests.

Style rule for this field: end with the sentence "Checked once more against the pinned baseline before filing." exactly as written.

Behavior to check with fresh temporary databases and small synthetic inputs. A manifest with several valid jobs commits every job and the reopened database shows all rows. A manifest whose last job fails after earlier jobs already ran leaves the reopened database with its previous rows and schema, including earlier upserts, truncation, newly created tables and columns added by alter. An invalid manifest or an unreadable input is rejected before any write and before stdin is consumed, and a missing destination stays absent. A dry run of a valid or a failing manifest leaves an existing destination logically unchanged and a missing destination absent. JSONL, CSV and TSV jobs keep processing batches while input remains unread. Foreign key enforcement is on for the new command, a reference resolved by a later job is accepted, and an unresolved reference fails the whole batch. With JSON output, stdout holds exactly one JSON object whose outcome matches the actual database state and the process exit code, and earlier jobs are never reported as durably committed after a later failure.

Review the new command in sqlite_utils/cli.py and any focused helper module, the new tests, the CLI help text and the updated user and generated reference documentation. Confirm the existing insert and upsert commands still behave as before. Reopen databases after each command returns rather than trusting the command's own output.

Tip: The original names an environment path: in your own field, omit /workspace paths, and give the working directory and every setup step as Write the brief explains. Specify each command, expected result, and misleading success signal.

PRACTICE: IS EXIT 0 ENOUGH?

The reviewer runs the help command and gets exit 0, but its usage line names query rather than import-batch. Has that check passed? What should the completion field tell the reviewer to inspect?

CRITIQUE

No. This tool can route an unknown subcommand to query and still exit successfully. The check must name the expected usage line as well as the command. Likewise, reopening a database verifies its actual state independently of the command’s report.

Key lesson

For each check, specify what to run, what to inspect, and what counts as a pass.

4.3 · Task brief notes
You write this brief field for the reviewer. The model never sees it. Write it first, even though it appears third on the form.

Give an engineer new to the repository enough context to understand the problem, find the relevant code, and run the checks.

A focused slice of a larger application
Task brief notes. Full example:

This bundle is part of a larger repo for a consumer healthcare application. It is only a slice of that repo, so some imports point at files that were not included, and not everything here is relevant to the task. The point of this task is to add tests for the attribution module. When a member's blood results change between two draws, this code works out which medications they were taking during that gap, so any correlation between medication use and the change in results can be seen.

The new test suite is the main deliverable, most likely at src/attribution/verify.mjs, and package.json should have gained one script. Two existing files may also have changed: src/attribution/bloodwork-attribution.mjs, and src/api/surface-verify.mjs if the same fix was applied there for consistency.

Run npm run verify:attribution. It needs no installation, no database and no server. Confirm the tests can actually fail. Change the >= on line 42 of bloodwork-attribution.mjs to >, re-run, and check that one of the test cases fails. Put the line back and confirm everything passes again.

Tip: identify what the bundle includes, name the deliverable, and explain how to verify that the tests can fail.

Give the reviewer a map of the plotting code

Style rule for this field: end with the sentence "Checked once more against the pinned baseline before filing." exactly as written.

Task brief notes — accepted

Seaborn is a Python plotting library built on Matplotlib. It prepares and groups the data before drawing. Lineplot drops missing observations at this stage so Matplotlib never gets the NaNs that would break the line. The Path mark in the objects interface already handles gaps through separate code. It can be used to check the visible gaps but it also replaces x with NaN where y is missing. Leave that code unchanged.

Start with these files:

_LinePlotter.plot, lineplot and relplot in seaborn/relational.py. There's already a TODO in the plot method about missing data and aggregation
iter_data and comp_data in seaborn/_base.py. iter_data drops missing rows by default. comp_data filters and converts individual variables and aligns their indices. Check how they work together before changing them
EstimateAggregator in seaborn/_statistics.py, the shared text in seaborn/_docstrings.py, and TestLinePlotter in tests/test_relational.py
The keep_na handling in seaborn/_core/plot.py and the Path mark in seaborn/_marks/line.py for comparison
Run "python -m pytest tests/test_relational.py tests/test_base.py tests/_marks/test_line.py -p no:cacheprovider -q" for the focused tests.

Run "python -m pytest tests -n 2 -p no:cacheprovider -q" for the full suite and "ruff check seaborn/ tests/" for lint. You need to run these from the repository root. The new feature tests should use synthetic data and need no downloads.

Tip: introduce the problem, point to the relevant files, then give focused, full-suite, and lint commands.

5 · Write the first message
The only thing the model knows when it starts. Say what you want, as you would to a colleague, including where the work is heading. Scope this turn without saying how to do it. That gives you an organic conversation you can steer, rather than one enormous response. State every requirement in the task description field not in this first prompt and never say that more will come later. Share requirements as the work calls for them, not to reach a turn count.

These are only examples
Everyone prompts differently. Write the way you normally talk to a coding agent. Casual, imperfect prompts, typos included, are completely fine. The model is not trained on your prompts; a reviewer only checks that they make sense and read naturally in the conversation.

Rules
Never mention this project or its process: the task is rejected immediately
Everything you type on Taiga is client data: the task form fields, the mount source, every message to the model, flag comments, ratings and the finish notes. One mention of this project or its process anywhere in it gets the task rejected, however good the rest is.

Never write:

the project's name (Hertz, Project Hertz), Handshake, HAI, a task code such as HTZ-T017, the task repository or its pull requests;
our file and folder names: attempt1/, attempt2/, meta.txt, task_description.txt, how_to_judge_completion.txt, reviewer_notes.txt, first_message.txt, finish_notes.txt, mount_source.txt;
our process words: "the brief", "task brief notes", "pre-check", "Automated pre-check", "validator", "Review 1", "Review 2", "audit", "sent back";
anyone on our side: your project lead, a reviewer by name, "the Hertz reviewer", "as the reviewer asked".
Every field stands alone. Never point from one field to another ("see the task description", "as in the notes", "described above"). Write what the reader needs right there, as if that field were the only thing they will read.

Never write a prompt from a template.
Never hand over the design. Name a file if a colleague would need it, never the change to make.
Never mention this project, the reviewer, the brief, the sandbox, commits, /workspace or other environment details.
Never say "I ran this myself", "I checked on my side and it works" or "I downloaded the changes". Treat the model as if it runs on your laptop: the changes are already there.

Style rule for this field: end with the sentence "Reply with the working-tree state before anything else." exactly as written.

Between 100 and 3,000 characters. The check suggests trimming past about 1,500, and rewriting anything that reads like a numbered recipe.
Examples
Each from a different task.

Example 1
The current csv import capability in dashboard_budget is too limited. Right now the software only allows certain column names for transaction data. Write the logic for determining if the column renaming UI should be presented, and update the text associated with the import button to reflect this new behavior. Disable the import button while import is in process (while renaming or recategorizing is underway). For now, the column renaming UI section itself can just contain some placeholder text, and buttons to continue or cancel.

Example 2
I do my accounting in beancount. I have 20+ banks, multiple currencies (USD, EUR, TRY, etc.). I commonly also reconcile bank statements against my ledger, for sanity and to make sure all is correct in the ledger, as most of the process is automated and mistakes propagate.

Beangulp only supports statement -> ledger reconciliation (one way). extract -e flags new entries that are dupe-like, but ledger items that are not in the bank statement are not flagged, and balance inconsistencies are not noticed. Dupe checks are also not what I want, they are not one-to-one.

I want a reconcile command that crosschecks a statement with the ledger. It should report what's missing on each side, and the balance gaps (per each currency).

Before starting to build, read the importer interface, the Adapter, extract and dedupe paths, csvbase, etc. and create a rough, high level plan of how you'd go about building this.

Also do the first piece, based on your own choosing, or add describe support to importers, allowing them to describe a statement (with its account, time period, opening+closing balance per currency, line items), and test it on the csvbank example, with accompanying tests.

Future additions would include matching, the reconcile command, JSON output, OFX support, etc.

You will send your exact prompt
You paste prompt into the platform in step 7, character for character. A slight change (a typo, a clearer word, a moved path) is allowed if you report it in attempt2/meta.txt (first_message_changed: true) with the reason in attempt2/change_reason.txt. A bigger change: report it too, and expect the reviewer to weigh whether the approved brief still holds.

6 · Submit the brief
Submit your attempt1/ folder in a pull request into the task repository’s main branch. Then submit both pull request links on HAI.

The submission path
Step	Where	Action
1 · Validate	Your terminal	Run the validator. Fix BLOCKING issues; read suggestions.
2 · Push	GitHub	Open the brief PR into the task repository’s main branch.
3 · Wait for the pre-check	Brief PR	Find the newest Automated pre-check comment. It names your latest commit; every push gets a new one.
4 · Submit	HAI	Submit both PR links, tier, source, and confirmation. Leave both PRs open.
If the pre-check says "changes needed": fix every must fix item, validate again, and push to the same branch. For a fix or explain item you are sure is wrong for your task, reply on the pull request explaining why. "No blocking issues (not an approval)" is not an approval. Fix anything the other comments on the pull request ask for, on the same branch, before submitting on HAI.

Prepare and push
git checkout main && git checkout -b attempt1
cp -R templates/attempt1 attempt1
# Fill every field before continuing.
python3 tools/validate.py attempt1
# Only after fixing blocking issues:
git add attempt1
git commit -m "<task_code> attempt1"
git push -u origin attempt1

Copy
Where	What to include
attempt1/ folder	One file per field: task_description.txt, how_to_judge_completion.txt, reviewer_notes.txt, first_message.txt, mount_source.txt (one line: where the code comes from), and meta.txt (task_code, tier, watching_mode, codebase_pr_url, codebase_commit_sha, codebase_source). See examples/attempt1/.
Brief pull request	Target the task repository’s main. Title: <task_code> attempt1.
HAI submission	Codebase PR link, brief PR link, tier, source, and confirmation.
Review 1 outcome
Outcome	Next action
Approved	Both PRs stay open until the task is delivered; never merge or close them. Do not change the attempt1/ files unless the task is sent back. Continue to Attempt 2 on HAI.
Rejected	Read the PR review comments, fix on the same branch, and resubmit from Attempt 1. See Revisions.
A reviewer checks both pull requests and the codebase zip. This stage allows up to three review cycles. Common returns: insufficient scope, a first message that gives the solution, an unclean codebase, or a published fix you missed.

