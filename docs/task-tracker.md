# GTM Simulation Task Tracker

> Maintain this log by appending updates—do not delete completed items.

## Ideas / Research
- Investigate integrating the GTM Management API for automated container retrieval while preserving auth secrets client-side.
- Explore exporting per-tag execution traces for deeper CPU attribution charts.
- Evaluate scripting bridges to push scenario matrices directly into real GTM containers for shadow-load testing.
- Prototype a Playwright-driven harness to compare Chromium vs. Firefox execution characteristics for the same matrices.
- Explore exposing an API surface for programmatic scenario submission so external tooling can schedule sweeps without touching the UI/CLI codebase.

## Upcoming Tasks
- Build CLI harness that can run the simulation headlessly (e.g. via Playwright) for CI-driven regression testing. _(Completed via Node harness; keep monitoring for browser parity gaps.)_
- Document a repeatable process for loading live GTM containers safely in staging.
- Automate config templating so batches can pivot between baseline, stress, and regression matrices without manual edits.
- Add scheduler that rotates through multiple GTM container definitions and captures comparison CSVs automatically.
- Validate preset-matrix results emitted from the UI against CLI CSV output on a weekly cadence.
- Stand up lightweight telemetry that records run metadata (commit, date, runtime) alongside CSV exports for reproducibility.

## In Progress
- Define MVP acceptance criteria for comparing synthetic vs. real GTM containers.
- Outline automation flow for ingesting real GTM exports once credentials are provisioned.
- Draft minimal acceptance test that compares simulated container output with a supplied real GTM snippet to benchmark variance.

## Completed
- Initial browser-based simulation UI with batch runner and charting.
- Scenario Library with JSON parsing, persistence, and batch execution.
- Node-based benchmarking harness that emits CSV summaries from scenario matrices.
- Preset matrix loader and JSON file ingestion inside the UI for rapid scenario swapping.
- CLI support for `{ "scenarios": [] }` payloads plus high-scale matrices covering 1–1,000 tags and five nested GTM layers.
- Harmonised UI CSV export with CLI schema so mixed-source datasets can be concatenated without manual cleanup.
