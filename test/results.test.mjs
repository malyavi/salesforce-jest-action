import {readFileSync}                                           from 'node:fs';
import {describe, it}                                           from 'node:test';
import assert                                                   from 'node:assert/strict';
import {failedAssertions, readResults, renderCounts, summarize} from '../lib/results.mjs';

/**
 * Reading the runner's own report. The fixtures are real Jest output shapes,
 * including the one that matters most and is easiest to forget: a suite that
 * failed to load at all, which has no failed assertions to count.
 */

const load = (name) => JSON.parse(readFileSync(`test/fixtures/${name}.json`, 'utf8'));

describe('summarize', () => {
  it('counts a passing run, folding todo into skipped', () => {
    assert.deepEqual(summarize(load('passed')), {
      passed: 11,
      failed: 0,
      total: 12,
      skipped: 1,
      suites: 2,
      seconds: 2.4,
      ok: true
    });
  });

  it('takes the verdict from the runner rather than inferring it from the counts', () => {
    // A run can fail with no failed assertions — a crashed suite, a coverage
    // threshold — so `success` is the only honest source for `ok`.
    const counts = summarize(load('suite-crash'));
    assert.equal(counts.failed, 0);
    assert.equal(counts.ok, false);
  });

  it('falls back to counting the result entries when the runner reports no suite total', () => {
    assert.equal(summarize({testResults: [{name: 'a'}, {name: 'b'}]}).suites, 2);
  });

  it('reads an empty aggregate without throwing', () => {
    assert.deepEqual(summarize({}), {
      passed: 0,
      failed: 0,
      total: 0,
      skipped: 0,
      suites: 0,
      seconds: null,
      ok: false
    });
  });
});

describe('renderCounts', () => {
  it('reads as a sentence fragment for a passing run', () => {
    assert.equal(renderCounts(load('passed')), '11 passed · 2 suites · 1 skipped · 2.4s');
  });

  it('leads with the failures when there are any, since that is what is being read for', () => {
    assert.match(renderCounts(load('failed')), /^2 of 5 tests failed · 1 suite/);
  });

  it('says suite rather than suites for one', () => {
    assert.match(renderCounts(load('failed')), /1 suite ·/);
  });

  it('leaves the duration out rather than printing NaN when the timings are absent', () => {
    assert.equal(renderCounts({numPassedTests: 1, numTotalTestSuites: 1}), '1 passed · 1 suite');
  });
});

describe('failedAssertions', () => {
  it('names each failed test and strips the colour codes off its message', () => {
    const failures = failedAssertions(load('failed'), '/home/runner/work/repo/repo');
    assert.equal(failures.length, 2);
    assert.equal(failures[0].suite, 'force-app/main/default/lwc/contactList/__tests__/contactList.test.js');
    assert.equal(failures[0].name, 'c-contact-list opens nothing on arrival');
    assert.equal(failures[0].message, 'expected null to be an element');
  });

  it('reports a suite that never ran as its own entry', () => {
    // Otherwise the commonest kind of red run — a broken import — reports zero
    // failures and the comment says nothing at all.
    const failures = failedAssertions(load('suite-crash'), '/home/runner/work/repo/repo');
    assert.equal(failures.length, 1);
    assert.equal(failures[0].name, 'suite failed to run');
    assert.match(failures[0].message, /Cannot find module/);
  });

  it('finds nothing in a passing run', () => {
    assert.deepEqual(failedAssertions(load('passed')), []);
  });

  it('keeps the absolute path when relativizing it would only make it longer', () => {
    // A mismatched working directory turns a relative path into
    // `../../../home/runner/...`, which is worse than the original.
    const failures = failedAssertions(load('failed'), '/somewhere/else');
    assert.match(failures[0].suite, /^\/home\/runner\/work/);
  });

  it('copes with a suite entry that carries no path', () => {
    const failures = failedAssertions({testResults: [{status: 'failed', assertionResults: []}]});
    assert.equal(failures[0].suite, '(unknown suite)');
  });
});

describe('readResults', () => {
  it('answers null for a file that is not there, rather than throwing', async () => {
    assert.equal(await readResults('test/fixtures/nothing-here.json'), null);
  });

  it('answers null for a file that is not JSON', async () => {
    assert.equal(await readResults('test/fixtures/project/sum.test.js'), null);
  });

  it('reads a real report', async () => {
    assert.equal((await readResults('test/fixtures/passed.json')).success, true);
  });
});
