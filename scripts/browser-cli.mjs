import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Keep screenshots, Chrome profiles and temporary files on the project drive.
export function createBrowserCLI(session) {
  const review = resolve('.review');
  const temp = resolve(review, 'tmp');
  mkdirSync(temp, { recursive: true });
  const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const launch = existsSync(chrome) ? ['--executable-path', chrome] : [];
  const browserEnv = { ...process.env };
  delete browserEnv.SON_NGOC_FIXED_TEST_PASSWORD;
  delete browserEnv.SON_NGOC_PRIMARY_TEST_PASSWORD;
  const options = [
    '--session', session,
    '--profile', resolve(review, session + '-profile'),
    '--screenshot-dir', review,
    ...launch,
  ];
  const execute = (args, input) => {
    try {
      // Closing an existing session does not need browser launch/profile options.
      const commandOptions = args[0] === 'close' ? ['--session', session] : options;
      return execFileSync(process.execPath, ['node_modules/agent-browser/bin/agent-browser.js', ...commandOptions, ...args], {
        encoding: 'utf8', timeout: args[0] === 'open' ? 60000 : 30000,
        ...(input === undefined ? {} : { input }),
        env: { ...browserEnv, TEMP: temp, TMP: temp },
      }).trim();
    } catch (error) {
      // On Windows the startup daemon can retain the pipe after a successful open.
      if (error.code === 'ETIMEDOUT' && error.status === 0 && error.stdout?.includes('✓')) return error.stdout.trim();
      throw error;
    }
  };
  // Send sensitive test input through stdin, rather than command-line arguments.
  return Object.assign((...args) => execute(args), { withInput: (input, ...args) => execute(args, input) });
}
