# Contributing to Jev PR Quality

Contributions to the Jev action, event contract, and dashboard are welcome.

```sh
git clone https://github.com/rawtreedb/jev-pr-quality.git
cd jev-pr-quality
npm ci
npm run dev
```

Before opening a pull request, run:

```sh
npm run lint
npm run build
npm test
npm ci --ignore-scripts --prefix scripts/jev-review
npm test --prefix scripts/jev-review
```

Keep event-schema changes backward compatible. Dashboard queries must deduplicate
by repository and PR number and must be tested with more than one repository.

By contributing, you agree that your contributions are licensed under the
[Apache License 2.0](LICENSE). The adapted Jev rubric retains its separate MIT
notice in `scripts/jev-review/LICENSE`.
