# GTM Simulation Task Tracker

> Maintain this log by appending updates—do not delete completed items.

## Ideas / Research
- Investigate integrating the GTM Management API for automated container retrieval while preserving auth secrets client-side.
- Explore exporting per-tag execution traces for deeper CPU attribution charts.
- Evaluate scripting bridges to push scenario matrices directly into real GTM containers for shadow-load testing.

## Upcoming Tasks
- Build CLI harness that can run the simulation headlessly (e.g. via Playwright) for CI-driven regression testing. _(Completed via Node harness; keep monitoring for browser parity gaps.)_
- Document a repeatable process for loading live GTM containers safely in staging.
- Automate config templating so batches can pivot between baseline, stress, and regression matrices without manual edits.
- Add scheduler that rotates through multiple GTM container definitions and captures comparison CSVs automatically.

## In Progress
- Define MVP acceptance criteria for comparing synthetic vs. real GTM containers.

## Completed
- Initial browser-based simulation UI with batch runner and charting.
- Scenario Library with JSON parsing, persistence, and batch execution.
- Node-based benchmarking harness that emits CSV summaries from scenario matrices.
