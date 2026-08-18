# 09 — Prepare reproducible production delivery

**What to build:** The starter can be built, tested, packaged, and deployed predictably without running migrations inside the API process or exposing secrets in runtime artifacts.

**Blocked by:** 01 — Prepare toolchain and local environment; 03 — Add persistence, health, and admin seed; 08 — Apply Redis-backed rate limits.


- [ ] A multi-stage Node 24 image generates the Prisma client, compiles the app, runs as non-root, and starts without applying migrations.
- [ ] Pull-request automation installs from the lockfile, generates Prisma artifacts, runs lint and all test suites, builds the application, and builds the image.
- [ ] Deployment guidance runs committed migrations before new application replicas and keeps cloud-provider and secret-manager choices out of scope.
