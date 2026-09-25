const { execFileSync } = require('node:child_process');
const { existsSync } = require('node:fs');

// NUL delimiters preserve spaces and newlines in Git paths.
const tracked = execFileSync('git', ['ls-files', '--cached', '-z'])
  .toString('utf8')
  .split('\0')
  .filter(Boolean);

const invalid = tracked.filter((path) =>
  // Ignore files removed in the worktree but not yet committed.
  existsSync(path) && path.split('/').some((part) => /[ \t\r\n]$/.test(part)),
);

if (invalid.length > 0) {
  console.error('Tracked filenames with trailing whitespace:');
  for (const path of invalid) console.error(`  ${JSON.stringify(path)}`);
  process.exitCode = 1;
} else {
  console.log('Tracked filenames have no trailing whitespace.');
}