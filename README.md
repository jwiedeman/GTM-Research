# GTM Load Simulation Suite

This project provides a browser-based harness and headless automation tooling
for experimenting with simulated Google Tag Manager (GTM) containers. It lets
you scale the number of pixel tags, DOM-search tags, variables/macros, and
nested containers to understand how each factor impacts load time and CPU cost.

## Features

- Configurable ranges for pixel tags, DOM-search tags, variable counts, and
  nested GTM depth/fan-out.
- Deterministic simulation logic that approximates GTM behaviour without
  requiring a live container ID.
- Automated batch execution (in-browser and via Node.js) with per-scenario
  averages, standard deviation, and raw run metrics.
- Scatter plot visualisation (average load vs. CPU busy time) and CSV export for
  downstream analysis.
- Curated example scenarios that showcase common tag-mix patterns.

## Getting started

```bash
npm install
npm run start
```

The development server (powered by `lite-server`) serves the static site at
http://localhost:3000. Open the page in a browser, adjust the range inputs, and
run a batch to generate metrics. Use the **Load example scenarios** button for a
quick tour of preconfigured mixes.

## Providing GTM data

The simulator ships with synthetic primitives so it can be used without access
to a real Google Tag Manager account. When you are ready to compare against
live containers you have two options:

1. **Paste JSON definitions** (recommended for automated sweeps): export or
   hand-author a JSON payload describing the number of pixels, DOM-search tags,
   variables, nesting depth, and network/iteration overrides. Paste the payload
   into the **Scenario Library** panel and press **Parse JSON** to load the
   scenarios. The parsed scenarios persist in `localStorage`, making it easy to
   switch between configurations and rerun them.
2. **Inject a real GTM container manually**: supply a GTM container ID and the
   matching embed snippet in a custom HTML tag or directly in
   [`public/index.html`](public/index.html). This project does not call the GTM
   Management API. If you want the toolchain to pull live containers on demand
   you must provide API credentials and extend the loader logic (for example in
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
  [`configs/baseline.json`](configs/baseline.json) demonstrates how to specify
  up to 1,000 tags and 5 layers of nested containers.

## Automated benchmarking CLI

Run large sweeps without a browser using the Node-based harness:

```bash
npm run benchmark
# or customise paths
node ./cli/run-benchmark.mjs --config ./configs/quick-start.json --output ./results.csv
```

The CLI reads a JSON document describing the ranges of pixel tags, DOM-search
tags, variables, nested depth, and fan-out. Every combination is executed for a
fixed number of iterations and written to a single CSV file containing one row
per scenario. Two configuration examples are bundled:

- [`configs/quick-start.json`](configs/quick-start.json) – compact ranges for
  smoke tests.
- [`configs/baseline.json`](configs/baseline.json) – exhaustive matrix covering
  1, 5, 10, 50, 100, 200, 500, and 1,000 pixel tags with nested containers up to
  depth 5 and fan-out 3. This sweep is CPU intensive; adjust the arrays to focus
  on the mixes you care about.

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
