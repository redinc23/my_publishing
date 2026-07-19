/**
 * Dispatch a Cursor Cloud Agent to fix CI failures on a labeled PR.
 * Triggered by .github/workflows/ci-fix-loop.yml on CI / Format Check failure.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import core from '@actions/core';
import github from '@actions/github';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = path.join(__dirname, '../../.cursor/agent-prompts/ci-fix.md');
const MARKER_RE = /<!--\s*ci-fix-loop:([^>]+)\s*-->/g;
const ACTIVE_RUN_STATUSES = new Set(['CREATING', 'RUNNING', 'PENDING']);

function parseMarkerBody(body) {
  const out = {};
  for (const part of body.split(/\s+/)) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx)] = part.slice(idx + 1);
  }
  return out;
}

function renderTemplate(template, vars) {
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, String(value ?? '')),
    template,
  );
}

function pickTopErrorLines(logText, maxLines = 80) {
  const lines = logText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const patterns = [
    /(^|\b)(error|failed|failure|exception|traceback|fatal)\b/i,
    /\b(assert|expect|cannot|unable|undefined|TypeError|SyntaxError)\b/i,
    /✖|FAIL|Tests:/i,
  ];

  const hits = [];
  for (const line of lines) {
    if (patterns.some((re) => re.test(line))) hits.push(line);
    if (hits.length >= maxLines) break;
  }

  const tail = lines.slice(-40);
  const combined = hits.length > 0 ? hits : tail;
  const joined = combined.join('\n');
  return joined.length > 24000 ? `${joined.slice(0, 24000)}\n… [truncated]` : joined;
}

async function cursorRequest(apiKey, method, urlPath, body) {
  const url = `https://api.cursor.com${urlPath}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`Cursor API ${method} ${urlPath} → ${res.status}: ${text.slice(0, 500)}`);
  }
  return data;
}

async function hasActiveAgentForPr(apiKey, prUrl) {
  const list = await cursorRequest(
    apiKey,
    'GET',
    `/v1/agents?prUrl=${encodeURIComponent(prUrl)}&limit=10&includeArchived=false`,
  );

  for (const item of list.items ?? []) {
    if (item.status !== 'ACTIVE') continue;
    if (!item.latestRunId) continue;
    const run = await cursorRequest(
      apiKey,
      'GET',
      `/v1/agents/${item.id}/runs/${item.latestRunId}`,
    );
    if (ACTIVE_RUN_STATUSES.has(run.status)) {
      return { active: true, agentId: item.id, runId: run.id, agentUrl: item.url };
    }
  }
  return { active: false };
}

async function downloadJobLogs(octokit, owner, repo, jobId) {
  try {
    const logs = await octokit.request('GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs', {
      owner,
      repo,
      job_id: jobId,
      headers: { accept: 'application/vnd.github+json' },
    });

    if (typeof logs.data === 'string') return logs.data;
    if (Buffer.isBuffer(logs.data)) {
      const asString = logs.data.toString('utf8');
      if (asString.startsWith('PK')) return '';
      return asString;
    }
    return String(logs.data ?? '');
  } catch (err) {
    core.warning(`Could not download logs for job ${jobId}: ${err.message}`);
    return '';
  }
}

function collectAttemptMarkers(comments) {
  const markers = [];
  for (const c of comments) {
    const body = c.body ?? '';
    let match;
    MARKER_RE.lastIndex = 0;
    while ((match = MARKER_RE.exec(body)) !== null) {
      markers.push({ ...parseMarkerBody(match[1]), commentId: c.id, createdAt: c.created_at });
    }
  }
  markers.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return markers;
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const cursorApiKey = process.env.CURSOR_API_KEY;
  const owner = process.env.OWNER;
  const repo = process.env.REPO;
  const runId = Number(process.env.RUN_ID);
  const conclusion = process.env.RUN_CONCLUSION;
  const runUrl = process.env.RUN_HTML_URL;
  const runName = process.env.RUN_NAME;
  const headBranch = process.env.RUN_HEAD_BRANCH;
  const headSha = process.env.RUN_HEAD_SHA;
  const maxAttempts = Math.max(1, Number(process.env.MAX_ATTEMPTS || '5') || 5);

  if (!token || !owner || !repo || !runId) {
    throw new Error('Missing required env: GITHUB_TOKEN, OWNER, REPO, RUN_ID');
  }

  if (conclusion !== 'failure') {
    core.info(`Workflow conclusion is "${conclusion}" — nothing to fix.`);
    return;
  }

  if (!cursorApiKey) {
    core.warning('CURSOR_API_KEY not configured — skipping ci-fix dispatch.');
    return;
  }

  const octokit = github.getOctokit(token);
  const repoFull = `${owner}/${repo}`;
  const repoUrl = `https://github.com/${repoFull}`;

  // Find open PR for this branch
  const { data: prs } = await octokit.rest.pulls.list({
    owner,
    repo,
    state: 'open',
    head: `${owner}:${headBranch}`,
    per_page: 5,
  });

  const pr = prs.find((p) => p.head?.sha === headSha) ?? prs[0];
  if (!pr) {
    core.info(`No open PR for branch ${headBranch} — skipping.`);
    return;
  }

  const labels = (pr.labels ?? []).map((l) => (typeof l === 'string' ? l : l.name));
  if (labels.includes('ci-fix-loop-paused')) {
    core.info(`PR #${pr.number} has ci-fix-loop-paused — skipping.`);
    return;
  }

  if (!labels.includes('auto-merge')) {
    core.info(`PR #${pr.number} missing auto-merge label — skipping.`);
    return;
  }

  const prUrl = pr.html_url;

  // Attempt tracking via hidden markers in PR comments
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: pr.number,
    per_page: 100,
  });

  const markers = collectAttemptMarkers(comments);
  const attemptCount = markers.length;

  if (attemptCount >= maxAttempts) {
    core.warning(`PR #${pr.number} reached max attempts (${maxAttempts}) — not dispatching.`);
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: pr.number,
      body: [
        '⛔ **CI fix loop stopped** — maximum attempts reached.',
        '',
        `This PR has used all **${maxAttempts}** automated fix attempts.`,
        'A human needs to investigate or add the `ci-fix-loop-paused` label and fix manually.',
        '',
        `Failed workflow: ${runUrl}`,
      ].join('\n'),
    });
    return;
  }

  const alreadyForSha = markers.some((m) => m.sha === headSha);
  if (alreadyForSha) {
    core.info(`Already dispatched for commit ${headSha.slice(0, 7)} — skipping duplicate.`);
    return;
  }

  const active = await hasActiveAgentForPr(cursorApiKey, prUrl);
  if (active.active) {
    core.info(
      `Active Cursor agent ${active.agentId} (run ${active.runId}) already working on PR — skipping.`,
    );
    return;
  }

  // Collect failure logs from this workflow run
  const jobsResp = await octokit.rest.actions.listJobsForWorkflowRun({
    owner,
    repo,
    run_id: runId,
    per_page: 100,
  });

  const failedJobs = (jobsResp.data.jobs ?? []).filter((j) => j.conclusion === 'failure');
  const logChunks = [];
  for (const job of failedJobs) {
    const raw = await downloadJobLogs(octokit, owner, repo, job.id);
    logChunks.push(`### Job: ${job.name}\n${pickTopErrorLines(raw || `Job failed: ${job.html_url}`)}`);
  }

  const failureLogs =
    logChunks.join('\n\n') || `No job logs extracted. See workflow run: ${runUrl}`;

  const attempt = attemptCount + 1;
  const template = fs.readFileSync(PROMPT_PATH, 'utf8');
  const promptText = renderTemplate(template, {
    PR_NUMBER: pr.number,
    PR_TITLE: pr.title,
    REPO_FULL: repoFull,
    HEAD_REF: pr.head.ref,
    WORKFLOW_NAME: runName,
    WORKFLOW_URL: runUrl,
    HEAD_SHA: headSha,
    ATTEMPT: attempt,
    MAX_ATTEMPTS: maxAttempts,
    FAILURE_LOGS: failureLogs,
  });

  core.info(`Dispatching Cursor agent for PR #${pr.number} (attempt ${attempt}/${maxAttempts})`);

  const createPayload = {
    name: `CI fix PR #${pr.number} (${runName})`,
    prompt: { text: promptText },
    repos: [
      {
        url: repoUrl,
        prUrl,
      },
    ],
    workOnCurrentBranch: true,
    autoCreatePR: false,
    mode: 'agent',
  };

  const created = await cursorRequest(cursorApiKey, 'POST', '/v1/agents', createPayload);
  const agent = created.agent ?? created;
  const run = created.run ?? {};
  const agentId = agent.id;
  const agentUrl = agent.url ?? `https://cursor.com/agents/${agentId}`;
  const runIdCursor = run.id ?? agent.latestRunId ?? 'unknown';

  const marker = `<!-- ci-fix-loop:attempt=${attempt} sha=${headSha} agent=${agentId} run=${runIdCursor} workflow=${encodeURIComponent(runName)} -->`;

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: pr.number,
    body: [
      '🔧 **CI fix loop** — Cursor agent dispatched',
      '',
      `| | |`,
      `|---|---|`,
      `| Attempt | **${attempt}** / ${maxAttempts} |`,
      `| Workflow | [${runName}](${runUrl}) |`,
      `| Commit | \`${headSha.slice(0, 7)}\` |`,
      `| Agent | [Open run](${agentUrl}) |`,
      '',
      'The agent will push fixes to this branch. When CI passes, **auto-merge** will squash-merge.',
      '',
      'To stop the loop, add the `ci-fix-loop-paused` label.',
      '',
      marker,
    ].join('\n'),
  });

  core.info(`Dispatched agent ${agentId} for PR #${pr.number}: ${agentUrl}`);
}

main().catch((err) => {
  core.setFailed(err.message);
  console.error(err);
  process.exit(1);
});
