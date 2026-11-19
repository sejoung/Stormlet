# CI browser setup

Quality's E2E job and Pages' build job use the official Playwright Noble container.
It includes the browser binaries and Ubuntu packages, so neither job runs
`playwright install --with-deps`. Node 24 and npm dependencies are still set up by
`actions/setup-node` and `npm ci`.

When updating Playwright, update the container tag in both workflows to the exact
version resolved in `package-lock.json`. `scripts/check-playwright-image.mjs` checks
the image metadata against the installed package before browser tests start.

This trades per-job apt and browser installation for the container image pull.
Compare the entire job duration, including “Initialize containers”, on the next
GitHub Actions runs. There is no CI timing measurement from a local run.

The normal local Playwright commands and test coverage stay the same.

References: [Playwright Docker](https://playwright.dev/docs/docker),
[CI browser caching](https://playwright.dev/docs/ci#caching-browsers).
