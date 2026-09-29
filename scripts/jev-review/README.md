# Jev review internals

This directory contains the evaluator, RawTree event writer, GitHub comment
formatter, historical backfill, deterministic demo-data generator, and unit tests
used by the root [`action.yml`](../../action.yml).

Run the isolated package tests with:

```sh
npm ci --ignore-scripts --prefix scripts/jev-review
npm test --prefix scripts/jev-review
```

See the repository [README](../../README.md) for installation, dashboard, and
backfill instructions.
