import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * getVersionAtRef - reads the `version` field of package.json as it exists
 * at the given git ref
 */
function getVersionAtRef(ref: string): string {
  const contents = execFileSync('git', ['show', `${ref}:package.json`], { encoding: 'utf8' });
  const pkg = JSON.parse(contents) as { version: string };
  return pkg.version;
}

/**
 * parseVersion - splits a `major.minor.patch` version string into numbers
 */
function parseVersion(version: string): [number, number, number] {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    throw new Error(`Cannot parse version "${version}" as major.minor.patch`);
  }
  return [parts[0], parts[1], parts[2]];
}

/**
 * isGreaterVersion - whether `next` is a strictly greater semver version
 * than `base`
 */
function isGreaterVersion(next: string, base: string): boolean {
  const [nextMajor, nextMinor, nextPatch] = parseVersion(next);
  const [baseMajor, baseMinor, basePatch] = parseVersion(base);

  if (nextMajor !== baseMajor) {
    return nextMajor > baseMajor;
  }
  if (nextMinor !== baseMinor) {
    return nextMinor > baseMinor;
  }
  return nextPatch > basePatch;
}

/**
 * countChangelogHeadings - counts how many times a `## v<version>` heading
 * for the given version appears in CHANGELOG.md
 */
function countChangelogHeadings(version: string): number {
  const changelog = readFileSync('CHANGELOG.md', 'utf8');
  const heading = `## v${version}`;
  return changelog.split('\n').filter((line) => line.trim() === heading).length;
}

/**
 * main - checks that package.json's version was bumped above the base
 * ref's version, and that CHANGELOG.md has a matching heading for it
 */
function main(): void {
  const baseRef = process.argv[2] ?? 'origin/master';

  const currentPkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
  const nextVersion = currentPkg.version;
  const baseVersion = getVersionAtRef(baseRef);

  if (!isGreaterVersion(nextVersion, baseVersion)) {
    console.error(
      `package.json version (${nextVersion}) must be greater than ${baseRef}'s version (${baseVersion}).`,
    );
    process.exit(1);
  }

  const headingCount = countChangelogHeadings(nextVersion);
  if (headingCount === 0) {
    console.error(`CHANGELOG.md is missing a "## v${nextVersion}" heading.`);
    process.exit(1);
  }
  if (headingCount > 1) {
    console.error(`CHANGELOG.md has ${headingCount} "## v${nextVersion}" headings; there must be exactly one.`);
    process.exit(1);
  }

  console.log(`OK: version bumped ${baseVersion} -> ${nextVersion}, CHANGELOG.md has a matching heading.`);
}

main();
