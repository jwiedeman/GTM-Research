#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { performance as nodePerformance } from 'node:perf_hooks';

import { buildContainerConfig, executeScenario } from '../public/js/mockGtm.js';
import { seedSyntheticDom } from '../public/js/domSeed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv) {
  const args = new Map();
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg;
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args.set(key, next);
        i += 1;
      } else {
        args.set(key, true);
      }
    }
  }
  return args;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  return [value];
}

function ensureNumber(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return fallback;
}

function configureDom(options = {}) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    pretendToBeVisual: true,
    url: 'https://example.test',
  });

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.performance = nodePerformance;
  globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
  globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;

  seedSyntheticDom(options.seedDom);
}

function createScenarios(config) {
  const defaultIterations = ensureNumber(config.iterations, 5);
  const defaultNetwork = ensureNumber(config.networkDelay, 20);
  const defaultDomComplexity = ensureNumber(config.domComplexity, 40);

  if (Array.isArray(config.scenarios) && config.scenarios.length > 0) {
    return config.scenarios.map((scenario, index) => ({
      id: scenario.id ?? scenario.name ?? `scenario-${index + 1}`,
      pixelTags: ensureNumber(scenario.pixelTags, 0),
      domTags: ensureNumber(scenario.domTags, 0),
      variables: ensureNumber(scenario.variables, 0),
      depth: ensureNumber(
        scenario.depth ?? scenario.nestedDepth,
        ensureNumber(config.depth, 0),
      ),
      fanOut: ensureNumber(
        scenario.fanOut ?? scenario.nestedFanOut,
        asArray(config.fanOut ?? [1])[0],
      ) || 1,
      iterations: ensureNumber(scenario.iterations, defaultIterations) || 1,
      networkDelay: ensureNumber(
        scenario.networkDelay ?? scenario.network,
        defaultNetwork,
      ),
      domComplexity: ensureNumber(
        scenario.domComplexity ?? scenario.domSearchComplexity,
        defaultDomComplexity,
      ),
    }));
  }

  const pixels = asArray(config.pixelTags ?? [0]);
  const doms = asArray(config.domTags ?? [0]);
  const variables = asArray(config.variables ?? [0]);
  const depths = asArray(config.nestedDepth ?? config.depth ?? [0]);
  const fanOuts = asArray(config.fanOut ?? [1]);
  const scenarios = [];
  let index = 0;

  for (const pixelTags of pixels) {
    for (const domTags of doms) {
      for (const variableCount of variables) {
        for (const depth of depths) {
          for (const fanOut of fanOuts) {
            scenarios.push({
              id: `scenario-${++index}`,
              pixelTags,
              domTags,
              variables: variableCount,
              depth,
              fanOut,
              iterations: defaultIterations,
              networkDelay: defaultNetwork,
              domComplexity: defaultDomComplexity,
            });
          }
        }
      }
    }
  }

  return scenarios;
}

function formatCsvRow(values) {
  return values
    .map((value) => {
      if (typeof value === 'string') {
        return `"${value.replace(/"/g, '""')}"`;
      }
      if (value === null || value === undefined) {
        return '';
      }
      return String(value);
    })
    .join(',');
}

async function run() {
  const args = parseArgs(process.argv);
  const configPath = args.get('--config')
    ? path.resolve(process.cwd(), args.get('--config'))
    : path.join(__dirname, '..', 'configs', 'baseline.json');
  const outputPath = args.get('--output')
    ? path.resolve(process.cwd(), args.get('--output'))
    : path.join(process.cwd(), 'benchmark-results.csv');

  const config = await readJson(configPath);
  configureDom({ seedDom: config.seedDom });

  const scenarios = createScenarios(config);
  if (scenarios.length === 0) {
    console.error('No scenarios generated from config.');
    process.exitCode = 1;
    return;
  }

  const rows = [
    [
      'scenario_id',
      'pixel_tags',
      'dom_tags',
      'variables',
      'nested_depth',
      'fan_out',
      'iterations',
      'network_delay_ms',
      'dom_complexity',
      'mean_load_ms',
      'mean_cpu_busy_ms',
      'std_deviation_ms',
    ],
  ];

  for (const scenario of scenarios) {
    const containerConfig = buildContainerConfig({
      pixelTags: scenario.pixelTags,
      domTags: scenario.domTags,
      variables: scenario.variables,
      nestedDepth: scenario.depth,
      fanOut: scenario.fanOut,
      domComplexity: scenario.domComplexity,
    });

    const metrics = await executeScenario(containerConfig, {
      iterations: scenario.iterations,
      networkDelay: scenario.networkDelay,
    });

    rows.push([
      scenario.id,
      scenario.pixelTags,
      scenario.domTags,
      scenario.variables,
      scenario.depth,
      scenario.fanOut,
      scenario.iterations,
      scenario.networkDelay,
      scenario.domComplexity,
      metrics.meanLoad.toFixed(3),
      metrics.meanBusy.toFixed(3),
      metrics.stdDeviation.toFixed(3),
    ]);

    console.log(
      `Completed ${scenario.id} — pixels: ${scenario.pixelTags}, dom: ${scenario.domTags}, ` +
        `vars: ${scenario.variables}, depth: ${scenario.depth}, fan-out: ${scenario.fanOut}`,
    );
  }

  const csv = rows.map(formatCsvRow).join('\n');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${csv}\n`, 'utf8');
  console.log(`\nWrote ${rows.length - 1} scenario rows to ${outputPath}`);
}

run().catch((error) => {
  console.error('Benchmark run failed:', error);
  process.exitCode = 1;
});
