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

## Customisation

- Tweak the simulation primitives in [`public/js/mockGtm.js`](public/js/mockGtm.js)
  to better match your production GTM usage (e.g. adjusting network delay,
  scaling factors, or DOM selector patterns).
- Add reusable scenarios to [`public/js/scenarios.js`](public/js/scenarios.js)
  when collaborating with teammates.
- Extend the UI in [`public/js/app.js`](public/js/app.js) to ingest real GTM
  container exports or hook into APIs if you prefer working with live data.
