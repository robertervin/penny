# penny

Personal finance AI assistant.

## Cursor Cloud specific instructions

### Current repository state

As of this writing, this repository is a **pre-code scaffold**. It contains only
`README.md`, the app logo (`penny_app_icon_1024x1024.png`), and a standard
Node.js `.gitignore`. There is **no application source, dependency manifest
(`package.json`), test suite, or lint/build configuration yet**, so there is
nothing to install, build, run, or test until application code is added.

### Toolchain available in the environment

The Cloud VM ships with (versions may drift over time):

- Node.js 22.x + npm 10.x, pnpm 10.x, yarn 1.x (Corepack available)
- Python 3.12
- Go 1.22

The `.gitignore` is the standard Node.js template (references Next.js, Nuxt,
Vite, pnpm, etc.), which suggests a Node/TypeScript stack is the likely
direction, but no framework has been committed yet.

### Update script behavior

The configured startup update script is intentionally guarded: it installs
dependencies only once a manifest exists, matching the package manager to the
committed lockfile (`pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn,
`package-lock.json` → `npm ci`, otherwise `package.json` → `npm install`). While
the repo has no manifest, it is a safe no-op. Once real application code lands,
revisit this file and the update script to document the actual
install/lint/test/run commands.
