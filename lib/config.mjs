import {isAbsolute, join}                         from 'node:path';
import {argsInput, booleanInput, input, intInput} from './inputs.mjs';

/**
 * The action's inputs, resolved into one object.
 *
 * The shape worth noticing is `run`: this action both runs a suite and reports
 * one, and those are separable. A caller whose runner takes flags nothing here
 * predicts can run it themselves and hand over the results file, which is what
 * `run: false` is for.
 */

/**
 * Resolves every input.
 *
 * @return {{
 *   run: boolean,
 *   install: boolean,
 *   installCommand: string,
 *   testCommand: string,
 *   args: string[],
 *   separator: boolean,
 *   coverage: boolean,
 *   resultsFile: string,
 *   resultsPath: string,
 *   testOutcome: string,
 *   failOnError: boolean,
 *   label: string,
 *   maxListed: number,
 *   section: string,
 *   cwd: string
 * }} Resolved configuration
 */
export function resolveConfig() {
  const cwd = input('working-directory', '.');
  const resultsFile = input('results-file', 'jest-results.json');

  return {
    run: booleanInput('run', true),
    install: booleanInput('install', true),
    installCommand: input('install-command', 'npm ci'),
    testCommand: input('test-command', 'npx sfdx-lwc-jest'),
    args: argsInput('args'),
    separator: booleanInput('separator', true),
    coverage: booleanInput('coverage', false),
    resultsFile,
    resultsPath: isAbsolute(resultsFile) || cwd === '.' ? resultsFile : join(cwd, resultsFile),
    testOutcome: input('test-outcome', 'unknown'),
    failOnError: booleanInput('fail-on-error', true),
    label: input('label', 'LWC Jest'),
    maxListed: intInput('max-failures-listed', 10),
    section: input('comment-section', 'jest'),
    cwd
  };
}

/**
 * The arguments the runner is called with.
 *
 * `separator` inserts the `--` that a wrapper needs in order to pass the rest
 * through to Jest — `sfdx-lwc-jest` is one such wrapper, and Jest called
 * directly is not. Getting it wrong is loud rather than silent: the wrapper
 * rejects the unknown flag, or Jest treats `--` as a test path filter that
 * matches nothing.
 *
 * @param {{ args: string[], separator: boolean, coverage: boolean, resultsFile: string }} config Resolved configuration
 * @return {string[]} Arguments after the command itself
 */
export function testArgs(config) {
  const reporting = ['--json', `--outputFile=${config.resultsFile}`];
  if (config.coverage) {
    reporting.unshift('--coverage');
  }
  return [...config.args, ...(config.separator ? ['--'] : []), ...reporting];
}
