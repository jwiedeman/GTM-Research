# GTM Load Simulation Suite

This project provides a browser-based harness for experimenting with simulated
Google Tag Manager (GTM) containers. It lets you scale the number of pixel tags,
DOM-search tags, variables/macros, and nested containers to understand how each
factor impacts load time and CPU cost.

## Features

- Configurable ranges for pixel tags, DOM-search tags, variable counts, and
  nested GTM depth/fan-out.
- Deterministic simulation logic that approximates GTM behaviour without
  requiring a live container ID.
- Automated batch execution with per-scenario averages, standard deviation, and
  raw run metrics.
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
to a real Google Tag Manager account. When you are ready to compare against live
containers you have two options:

1. **Paste JSON definitions** (recommended for automated sweeps): export or
   hand-author a JSON payload describing the number of pixels, DOM-search tags,
   variables, nesting depth, and network/iteration overrides. Paste the payload
   into the **Scenario Library** panel and press **Parse JSON** to load the
   scenarios. The parsed scenarios persist in `localStorage`, making it easy to
   switch between configurations and rerun them.
2. **Inject a real GTM container**: supply a GTM container ID and the matching
   snippet in a custom HTML tag or directly in `public/index.html`. The
   simulation harness does not call the GTM Management API; if you need automated
   retrieval of live containers you will need to provide credentials for the API
   and extend the loader logic accordingly.

For most benchmarking work you can keep using the synthetic simulation layer.
Only share production GTM IDs in controlled environments because loading a real
container will execute the tags within your browser.

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
