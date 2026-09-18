import {readFile}  from 'node:fs/promises';
import {relative}   from 'node:path';
import {stripAnsi, warn} from './core.mjs';

/**
 * Reading what the test run produced.
 *
 * The numbers come from the runner's own JSON report rather than from scraping
 * its console output: the human reporter's format is not a contract, and a
 * suite that fails to load prints nothing a parser could count.
 */

/**
 * Loads and parses the results file.
 *
 * @param {string} path Where the runner was told to write
 * @return {Promise<object|null>} Parsed results, or null when the file is missing or unparseable
 */
export async function readResults(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (thrown) {
    warn(`Could not read the test results from ${path}: ${thrown.message}`);
    return null;
  }
}

/**
 * The counts a reader wants, from the aggregate the runner wrote.
 *
 * @param {object} results Aggregated results
 * @return {{ passed: number, failed: number, total: number, skipped: number, suites: number, seconds: number|null, ok: boolean }} Counts, with `ok` as the runner's own verdict
 */
export function summarize(results) {
  return {
    passed: results.numPassedTests ?? 0,
    failed: results.numFailedTests ?? 0,
    total: results.numTotalTests ?? 0,
    skipped: (results.numPendingTests || 0) + (results.numTodoTests || 0),
    suites: results.numTotalTestSuites ?? (results.testResults || []).length,
    seconds: durationSeconds(results),
    ok: results.success === true
  };
}

/**
 * One human line of counts: tests, suites, skips when there are any, duration.
 *
 * @param {object} results Aggregated results
 * @return {string} For example `136 passed · 15 suites · 1.2s`
 */
export function renderCounts(results) {
  const counts = summarize(results);
  const parts = [
    counts.failed > 0 ? `${counts.failed} of ${counts.total} tests failed` : `${counts.passed} passed`,
    `${counts.suites} suite${counts.suites === 1 ? '' : 's'}`
  ];
  if (counts.skipped > 0) {
    parts.push(`${counts.skipped} skipped`);
  }
  if (counts.seconds !== null) {
    parts.push(`${counts.seconds}s`);
  }
  return parts.join(' · ');
}

/**
 * Flattens the per-suite results down to the failed assertions.
 *
 * A suite that failed to even run — a broken import, a transform error — has no
 * failed assertions to show, so it is reported as its own entry. Without that,
 * the commonest kind of red run reports zero failures.
 *
 * @param {object} results Aggregated results
 * @param {string} [cwd] Directory to report paths relative to
 * @return {Array<{ suite: string, name: string, message: string }>} One entry per failed test
 */
export function failedAssertions(results, cwd = process.cwd()) {
  const failures = [];
  for (const suite of results.testResults || []) {
    const suitePath = suite.name ? shorten(suite.name, cwd) : '(unknown suite)';
    const assertions = (suite.assertionResults || []).filter((assertion) => assertion.status === 'failed');
    for (const assertion of assertions) {
      failures.push({
        suite: suitePath,
        name: assertion.fullName || assertion.title,
        message: stripAnsi((assertion.failureMessages || []).join('\n\n'))
      });
    }
    if (suite.status === 'failed' && assertions.length === 0) {
      failures.push({
        suite: suitePath,
        name: 'suite failed to run',
        message: stripAnsi(suite.message || '')
      });
    }
  }
  return failures;
}

/**
 * A suite's path as short as it can be made without becoming misleading.
 *
 * The runner writes absolute paths. Making them relative is what turns them
 * into something a reader recognises — but only while the result stays inside
 * the directory: a path that resolves to `../../../home/runner/...` is longer
 * than the original and says less, which is what a mismatched working
 * directory produces.
 *
 * @param {string} path The suite's path as the runner wrote it
 * @param {string} cwd Directory to report it relative to
 * @return {string} The path to show
 */
function shorten(path, cwd) {
  const relativePath = relative(cwd, path);
  return relativePath && !relativePath.startsWith('..') ? relativePath : path;
}

/**
 * Wall-clock duration of the run, from the aggregate start to the last suite's
 * end.
 *
 * @param {object} results Aggregated results
 * @return {number|null} Seconds to one decimal, or null when the fields are absent
 */
function durationSeconds(results) {
  const ends = (results.testResults || [])
    .map((suite) => suite.endTime)
    .filter((end) => typeof end === 'number');
  if (!results.startTime || ends.length === 0) {
    return null;
  }
  return Math.round((Math.max(...ends) - results.startTime) / 100) / 10;
}
