const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STATE_PATH = path.join(process.cwd(), '.github', 'bug-to-issue-state.json');
const FINGERPRINT_PREFIX = 'bug-to-issue:fingerprint=';
const MAX_TOP_LINE_LEN = 300;

function readJsonSafe(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function sha1(s) {
  return crypto.createHash('sha1').update(s).digest('hex');
}

// CCR-009: never publish credential material in generated issue bodies.
// GitHub masks *registered* secrets in workflow logs, but unregistered or
// derived values (JWTs, API keys printed by failing tests, Authorization
// headers, private keys) are NOT masked. Scrub known secret shapes from any
// log-derived text before it is hashed, stored, or published to an issue.
function scrubSecrets(text) {
  if (!text) return text;
  let out = String(text);
  // KEY=value style assignments, preserving the variable name for debugging.
  // The name may be the bare keyword itself (TOKEN=..., SECRET=...), and the
  // value may be quoted and contain spaces (PASSWORD="my secret pass").
  // Values already masked by the runner (TOKEN=***) are left untouched.
  out = out.replace(
    /\b([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL|API[_-]?KEY|PRIVATE[_-]?KEY|SERVICE[_-]?ROLE)[A-Z0-9_]*)[ \t]*=[ \t]*(?!["']?\*+["']?(?:\s|$))(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s"']{3,})/g,
    '$1=[REDACTED]'
  );
  // Credential URIs (scheme://user:password@host): strip the userinfo but
  // keep scheme/host so the log line stays debuggable.
  out = out.replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s:/@]*:[^\s/@]+@/gi, '$1[REDACTED]@');
  const patterns = [
    /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g,
    /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{3,}\b/g, // JWTs
    /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, // fine-grained PATs
    /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g, // GitHub tokens
    /\bglpat-[A-Za-z0-9_-]{15,}\b/g, // GitLab PATs
    /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{8,}\b/g, // Stripe secret/restricted keys
    /\bwhsec_[A-Za-z0-9]{8,}\b/g, // webhook signing secrets
    /\bsb_secret_[A-Za-z0-9_-]{8,}\b/g, // Supabase secret keys
    // Authorization headers. The value must look token-like (at least one
    // letter AND at least one digit or token punctuation) so prose such as
    // "Bearer authentication" is not over-redacted.
    /\bBearer[ \t]+(?=[A-Za-z0-9._~+/=-]*[0-9._~+/=])(?=[A-Za-z0-9._~+/=-]*[A-Za-z])[A-Za-z0-9._~+/=-]{8,}\b/gi,
    /\b[0-9a-f]{64,}\b/gi, // long hex blobs (raw keys/hashes)
  ];
  for (const re of patterns) {
    out = out.replace(re, '[REDACTED]');
  }
  return out;
}

function normalizeSignature({ workflowName, jobName, stepName, topLine }) {
  // Keep it stable so repeated failures map to the same issue.
  const raw = [
    `workflow:${workflowName || 'unknown'}`,
    `job:${jobName || 'unknown'}`,
    `step:${stepName || 'unknown'}`,
    `top:${(topLine || 'unknown').slice(0, 160)}`,
  ].join('|');
  return sha1(raw);
}

function formatIssueTitle({ workflowName, jobName, stepName }) {
  const parts = [workflowName, jobName, stepName].filter(Boolean);
  return `CI failing continuously: ${parts.join(' / ')}`.slice(0, 240);
}

function pickTopErrorLine(logText) {
  // Heuristic: find a line that looks like an error.
  const lines = logText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const patterns = [
    /(^|\b)(error|failed|exception|traceback|fatal)\b/i,
    /\b(assert|expect|cannot|unable|undefined)\b/i,
  ];

  for (const re of patterns) {
    const hit = lines.find((l) => re.test(l));
    if (hit) return hit;
  }
  return lines[0] || 'Unknown error';
}

async function main() {
  // Required inside main() (not at module load) so the pure helpers above stay
  // unit-testable without the workflow-only @actions/* packages, which the
  // workflow installs ad hoc (npm i --no-save @actions/core @actions/github).
  const core = require('@actions/core');
  const github = require('@actions/github');

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.OWNER;
  const repo = process.env.REPO;

  const runId = Number(process.env.RUN_ID);
  const conclusion = process.env.RUN_CONCLUSION; // success | failure | cancelled | etc
  const runUrl = process.env.RUN_HTML_URL;
  const runName = process.env.RUN_NAME;
  const headBranch = process.env.RUN_HEAD_BRANCH;
  const headSha = process.env.RUN_HEAD_SHA;

  const thresholdFails = Math.max(1, Number(process.env.THRESHOLD_FAILS || '3') || 3);
  const closeAfterSuccesses = Math.max(1, Number(process.env.CLOSE_AFTER_SUCCESSES || '2') || 2);

  if (!token || !owner || !repo || !runId) {
    throw new Error('Missing required env vars (GITHUB_TOKEN/OWNER/REPO/RUN_ID).');
  }

  const octokit = github.getOctokit(token);

  // Load state
  const state = readJsonSafe(STATE_PATH, {
    version: 1,
    items: {}, // signature -> { consecutiveFails, consecutiveSuccesses, issueNumber, lastSeenRunId, lastSeenAt }
  });

  // Fetch jobs for this run
  const jobsResp = await octokit.rest.actions.listJobsForWorkflowRun({
    owner,
    repo,
    run_id: runId,
    per_page: 100,
  });

  const jobs = jobsResp.data.jobs || [];
  core.info(`Found ${jobs.length} jobs in workflow run ${runId}. Conclusion: ${conclusion}`);

  // For each failed job, try to get logs and extract a signature.
  // For successful run, we will decrement/close any issues that were tracked for this workflow+branch by marking success.
  // We'll do both: handle failures per job, and handle global "success" to close previously opened issues.
  const now = new Date().toISOString();

  // Dedupe: find an existing OPEN issue carrying this failure fingerprint.
  // The actions/cache state file is best-effort (evictable, not guaranteed);
  // the issue tracker is the source of truth for "does this issue already
  // exist", so always search before creating a new issue.
  async function findOpenIssueByFingerprint(sig) {
    try {
      const q = `repo:${owner}/${repo} is:issue is:open "${FINGERPRINT_PREFIX}${sig}"`;
      const resp = await octokit.rest.search.issuesAndPullRequests({ q, per_page: 10 });
      const items = resp.data.items || [];
      // Client-side verification: search tokenizes, so confirm the exact marker.
      return items.find((it) => (it.body || '').includes(`${FINGERPRINT_PREFIX}${sig}`)) || null;
    } catch (e) {
      core.warning(`Open-issue search failed for fingerprint ${sig}: ${e.message}`);
      return null;
    }
  }

  // Helper: find or create an issue per signature
  async function ensureIssueForSignature(sig, meta, body, labels) {
    const tracked = state.items[sig]?.issueNumber;

    if (tracked) {
      // Verify the tracked issue is still open before re-using it. A human may
      // have closed it; commenting on a closed issue would silently drop the
      // signal, so fall through to search/create instead.
      try {
        const { data: trackedIssue } = await octokit.rest.issues.get({
          owner,
          repo,
          issue_number: tracked,
        });
        if (trackedIssue.state === 'open') {
          await octokit.rest.issues.createComment({
            owner,
            repo,
            issue_number: tracked,
            body,
          });
          return tracked;
        }
        core.info(
          `Tracked issue #${tracked} is ${trackedIssue.state}; looking for an open match before creating a new issue.`
        );
      } catch (e) {
        core.warning(`Could not verify tracked issue #${tracked}: ${e.message}`);
      }
    }

    const existing = await findOpenIssueByFingerprint(sig);
    if (existing) {
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: existing.number,
        body,
      });
      core.info(`Adopted existing open issue #${existing.number} for fingerprint ${sig}.`);
      return existing.number;
    }

    // Create new issue
    const title = formatIssueTitle(meta);
    const created = await octokit.rest.issues.create({
      owner,
      repo,
      title,
      body,
      labels,
    });

    return created.data.number;
  }

  async function closeIssue(issueNumber, commentBody) {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: commentBody,
    });
    await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: issueNumber,
      state: 'closed',
    });
  }

  // Track which signatures are currently failing in this run
  const failingSignatures = new Set();

  for (const job of jobs) {
    // Determine job conclusion
    const jobConclusion = job.conclusion || 'unknown';

    if (jobConclusion !== 'failure') continue;

    // Download job logs (this endpoint returns a redirect to a zip; octokit handles it via request)
    // Easiest: use the "downloadJobLogsForWorkflowRun" API is not per job, so we use job logs URL:
    // There is an API: GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs
    let logText = '';
    try {
      const logs = await octokit.request('GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs', {
        owner,
        repo,
        job_id: job.id,
        headers: { accept: 'application/vnd.github+json' },
      });

      // logs.data is a Buffer/ArrayBuffer-like; coerce to string.
      // Often it's a zip archive; GitHub returns plain text for small logs sometimes, but usually it's zip.
      // We'll handle zip by best-effort: if it looks binary, just use a fallback line.
      if (typeof logs.data === 'string') {
        logText = logs.data;
      } else if (Buffer.isBuffer(logs.data)) {
        const asString = logs.data.toString('utf8');
        // crude check for zip header "PK"
        if (asString.startsWith('PK')) {
          logText = '';
        } else {
          logText = asString;
        }
      } else {
        try {
          logText = Buffer.from(logs.data).toString('utf8');
          if (logText.startsWith('PK')) logText = '';
        } catch {
          logText = '';
        }
      }
    } catch (e) {
      core.warning(`Could not fetch logs for job ${job.name}: ${e.message}`);
    }

    // Pick failing step name if available
    const failedStep = (job.steps || []).find((s) => s.conclusion === 'failure');
    const stepName = failedStep?.name || 'unknown-step';
    // Scrub before any log-derived text is hashed, cached, or published (CCR-009).
    const topLine = scrubSecrets(
      logText
        ? pickTopErrorLine(logText)
        : 'Job logs unavailable (zip/binary or fetch failed)'
    ).slice(0, MAX_TOP_LINE_LEN);

    const meta = {
      workflowName: runName,
      jobName: job.name,
      stepName,
    };

    const sig = normalizeSignature({ ...meta, topLine });
    failingSignatures.add(sig);

    // Update state counters
    const prev = state.items[sig] || {
      consecutiveFails: 0,
      consecutiveSuccesses: 0,
      issueNumber: null,
      lastSeenRunId: null,
      lastSeenAt: null,
      meta,
    };

    prev.consecutiveFails += 1;
    prev.consecutiveSuccesses = 0;
    prev.lastSeenRunId = runId;
    prev.lastSeenAt = now;
    prev.meta = meta;

    state.items[sig] = prev;

    core.info(
      `Signature ${sig} fail count now ${prev.consecutiveFails} (threshold ${thresholdFails}).`
    );

    // Create/update issue only once we cross threshold
    if (prev.consecutiveFails >= thresholdFails) {
      const labels = ['ci', 'bug', 'auto-created'];
      const body = [
        `<!-- ${FINGERPRINT_PREFIX}${sig} -->`,
        `Automated report: **continuous CI failure** detected.`,
        ``,
        `- Workflow: **${runName}**`,
        `- Branch: **${headBranch}**`,
        `- Job: **${job.name}**`,
        `- Step: **${stepName}**`,
        `- Run: ${runUrl}`,
        `- Commit: \`${headSha}\``,
        `- Consecutive fails: **${prev.consecutiveFails}**`,
        ``,
        `Top error signal:`,
        '```',
        topLine,
        '```',
        ``,
        `If this is flaky, consider quarantining the test or adding retries with backoff.`,
      ].join('\n');

      const issueNumber = await ensureIssueForSignature(sig, meta, body, labels);
      prev.issueNumber = issueNumber;
      core.info(`Issue ensured for signature ${sig}: #${issueNumber}`);
    }
  }

  // Handle success path: if the overall run concluded success, mark tracked items as success and close if stable.
  if (conclusion === 'success') {
    for (const [sig, item] of Object.entries(state.items)) {
      // Only touch ones related to this workflow name (avoids closing other automations)
      const sameWorkflow = item?.meta?.workflowName === runName;

      if (!sameWorkflow) continue;

      // If it didn't fail this run, count success
      if (!failingSignatures.has(sig)) {
        item.consecutiveSuccesses = (item.consecutiveSuccesses || 0) + 1;
        item.consecutiveFails = 0;
        item.lastSeenRunId = runId;
        item.lastSeenAt = now;

        // Auto-close if issue exists and enough successes
        if (item.issueNumber && item.consecutiveSuccesses >= closeAfterSuccesses) {
          const comment = [
            `✅ CI is green again for **${item.consecutiveSuccesses}** consecutive runs.`,
            `Auto-closing this issue.`,
            `Latest run: ${runUrl}`,
          ].join('\n');

          try {
            await closeIssue(item.issueNumber, comment);
            core.info(`Closed issue #${item.issueNumber} for signature ${sig}`);
            // Keep record but clear issueNumber so future failures can open new or you can choose to reopen logic
            item.issueNumber = null;
          } catch (e) {
            core.warning(`Failed to close issue #${item.issueNumber}: ${e.message}`);
          }
        }

        state.items[sig] = item;
      }
    }
  }

  // Persist state
  writeJson(STATE_PATH, state);
  core.info(`State written to ${STATE_PATH}`);
}

// Run only when executed directly (`node .github/scripts/bug-to-issue.js`) so
// unit tests can require the pure helpers without side effects.
if (require.main === module) {
  main().catch((err) => {
    // Report via @actions/core when available (it is, in the workflow);
    // otherwise fall back to stderr with a non-zero exit code.
    try {
      require('@actions/core').setFailed(err.message);
    } catch {
      console.error(err);
      process.exitCode = 1;
    }
  });
}

module.exports = {
  scrubSecrets,
  normalizeSignature,
  formatIssueTitle,
  pickTopErrorLine,
};
