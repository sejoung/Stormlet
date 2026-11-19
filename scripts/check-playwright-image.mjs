import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

/** Fail before E2E if a dependency update left the CI image behind. */
export function checkImageVersion(imageVersion, packageVersion) {
  if (imageVersion !== packageVersion)
    throw new Error(
      `Playwright image ${imageVersion} does not match package ${packageVersion}. ` +
        `Update the container image in .github/workflows/ci.yml and pages.yml to v${packageVersion}-noble.`,
    );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const image = JSON.parse(readFileSync('/ms-playwright/.docker-info', 'utf8'));
  const require = createRequire(import.meta.url);
  const version = require('playwright/package.json').version;
  checkImageVersion(image.driverVersion, version);
  console.log(`Preinstalled Playwright ${version} matches the project.`);
}
