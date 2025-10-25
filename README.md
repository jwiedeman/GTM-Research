# GTM Load Simulation Suite

This project provides a browser-based harness and headless automation tooling
for experimenting with simulated Google Tag Manager (GTM) containers. It lets
you scale the number of pixel tags, DOM-search tags, variables/macros, and
nested containers to understand how each factor impacts load time and CPU cost
without depending on live GTM infrastructure.

## Features

- Configurable ranges for pixel tags, DOM-search tags, variable counts, and
  nested GTM depth/fan-out.
- Deterministic simulation logic that approximates GTM behaviour without
  requiring a live container ID.
- Automated batch execution (in-browser and via Node.js) with per-scenario
  averages, standard deviation, and raw run metrics.
- Preset matrix loader that mirrors the CLI configs and executes sweeps straight
  from the UI.
- File-upload friendly Scenario Library for swapping JSON payloads without
  retyping.
- One-click CSV export: both the UI and CLI emit a consolidated CSV suitable for
  downstream analysis.
- Curated example scenarios that showcase common tag-mix patterns.

## Getting started

```bash
npm install
npm run start
```

The development server (powered by `lite-server`) serves the static site at
http://localhost:3000. Open the page in a browser and choose one of three paths:

1. Adjust the range inputs and run a batch to generate bespoke scenarios.
2. Use the **Preset Matrices** dropdown to preview and execute ready-made
   configurations (identical to the CLI JSON files under `public/configs/`).
3. Paste or upload JSON into the **Scenario Library** for precise control over
   each scenario.

Click **Load example scenarios** for a quick tour of curated mixes.

### Coordination & roadmap tracking

A rolling task ledger lives in [`docs/task-tracker.md`](docs/task-tracker.md).
Add new ideas or status updates there instead of replacing existing entries so
we retain historical context while working toward the MVP.

## What do collaborators need to supply?

The simulator ships with synthetic primitives so it can be used without access
to a real Google Tag Manager account. When you are ready to compare against
live containers you have two options:

## Providing GTM data

1. **JSON scenario definitions (preferred for automation)** – export or
   hand-author a JSON payload describing the number of pixels, DOM-search tags,
   variables, nesting depth, and optional overrides for iterations, DOM
   complexity, and network delay. Drop the payload into the Scenario Library or
   upload it as a file and press **Parse JSON**. Entries persist in
   `localStorage`, making it easy to switch between configurations.
   - Ship matrices that span the canonical research counts (1, 5, 10, 50, 100,
     200, 500, 1,000) by editing the configs under [`configs/`](configs/) or the
     browser presets in [`public/configs/`](public/configs/). Both the UI and CLI
     consume the same JSON layout, so a single document powers automated sweeps
     and interactive exploration.
2. **Real GTM container snippet** – provide a GTM container ID and matching
   embed snippet (the standard `<script>` + `<noscript>` block) and inject it in
   [`public/index.html`](public/index.html) or a custom HTML tag. The repository
   does not call the GTM Management API and does not require API keys or service
   accounts by default. If you want the toolchain to pull live containers,
   supply service-account credentials separately and extend the loader logic (in
   `public/js/app.js` or a dedicated Node utility) to authenticate and fetch the
   container exports.

For most benchmarking work you can keep using the synthetic simulation layer.
Only share production GTM IDs in controlled environments because loading a real
container will execute the tags within your browser.

When collaborating with teammates, provide either:

- A GTM container ID and HTML snippet (if you expect to exercise a live
  container).
- A JSON scenario export that lists the counts for pixels, DOM-search tags,
  variables, network overrides, and nested GTM depth/fan-out.
  [`configs/high-scale.json`](configs/high-scale.json) demonstrates how to
  specify up to 1,000 tags, variables, and 5 layers of nested containers with a
  fan-out of up to 5.

## Automated benchmarking CLI

Run large sweeps without a browser using the Node-based harness:

```bash
npm run benchmark
# or customise paths
node ./cli/run-benchmark.mjs --config ./configs/quick-start.json --output ./results.csv
```

The CLI accepts either:

- A matrix-style JSON document describing ranges for pixel tags, DOM-search
  tags, variables, nested depth, and fan-out. Every combination is executed for
  a fixed number of iterations.
- A `{ "scenarios": [] }` document listing explicit scenarios with their own
  overrides (iterations, network delay, DOM complexity, etc.).

Results are written to a single CSV file containing one row per scenario. Three
configuration examples are bundled:

- [`configs/quick-start.json`](configs/quick-start.json) – compact ranges for
  smoke tests.
- [`configs/baseline.json`](configs/baseline.json) – balanced matrix for daily
  benchmarking.
- [`configs/high-scale.json`](configs/high-scale.json) – exhaustive matrix
  covering 1, 5, 10, 50, 100, 200, 500, and 1,000 tags/variables with nested
  containers up to depth 5 and fan-out 5.

To mirror these matrices in the UI, place a copy under `public/configs/` (two
presets are already bundled) and select it from the **Preset Matrices**
dropdown.

### CSV schema

The generated CSV uses the following columns:

| Column | Description |
| --- | --- |
| `scenario_id` | Sequential identifier for traceability. |
| `pixel_tags` | Number of simulated pixel tags fired in the scenario. |
| `dom_tags` | Number of DOM-searching tags executed. |
| `variables` | Count of simulated variables/macros resolved. |
| `nested_depth` | Maximum depth of nested containers generated. |
| `fan_out` | Number of nested containers spawned per level. |
| `iterations` | Number of repetitions executed for averaging. |
| `network_delay_ms` | Base network delay used by the simulator. |
| `dom_complexity` | Relative cost multiplier for DOM-searching tags. |
| `mean_load_ms` | Average wall-clock load duration across iterations. |
| `mean_cpu_busy_ms` | Average CPU busy time across iterations. |
| `std_deviation_ms` | Standard deviation of the load duration. |

## Customisation

- Tweak the simulation primitives in [`public/js/mockGtm.js`](public/js/mockGtm.js)
  to better match your production GTM usage (e.g. adjusting network delay,
  scaling factors, or DOM selector patterns).
- Add reusable scenarios to [`public/js/scenarios.js`](public/js/scenarios.js)
  when collaborating with teammates.
- Paste JSON payloads in the **Scenario Library** panel or load them from
  `localStorage` to rapidly switch between configurations.
- Extend the UI in [`public/js/app.js`](public/js/app.js) to ingest real GTM
  container exports or hook into APIs if you prefer working with live data.
- Leverage [`cli/run-benchmark.mjs`](cli/run-benchmark.mjs) in CI to capture
  performance snapshots as you tweak simulation parameters.
