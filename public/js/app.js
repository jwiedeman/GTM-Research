import { executeScenario } from './mockGtm.js';
import { seedSyntheticDom } from './domSeed.js';
import { createScenario, exampleScenarios } from './scenarios.js';

const form = document.getElementById('batchForm');
const statusEl = document.getElementById('status');
const logEl = document.getElementById('logOutput');
const resultsBody = document.getElementById('resultsBody');
const downloadButton = document.getElementById('downloadButton');
const resetButton = document.getElementById('resetButton');
const exampleButton = document.getElementById('exampleButton');
const chartCanvas = document.getElementById('summaryChart');
const scenarioJsonInput = document.getElementById('scenarioJson');
const scenarioList = document.getElementById('scenarioList');
const parseScenarioButton = document.getElementById('parseScenarioButton');
const runLibraryButton = document.getElementById('runLibraryButton');
const scenarioFileInput = document.getElementById('scenarioFileInput');
const presetSelect = document.getElementById('presetSelect');
const loadPresetButton = document.getElementById('loadPresetButton');
const runPresetButton = document.getElementById('runPresetButton');

let chartInstance = null;
let collectedResults = [];
let parsedScenarioLibrary = [];
let loadedPresetScenarios = [];
let loadedPresetLabel = '';

function log(message) {
  const time = new Date().toISOString();
  logEl.textContent = `${time} — ${message}\n${logEl.textContent}`;
}

function updateStatus(message) {
  statusEl.textContent = message;
}

function readFormValues(formEl) {
  const data = new FormData(formEl);
  const getNumber = (name) => Number.parseFloat(data.get(name));

  return {
    pixelStart: getNumber('pixelStart'),
    pixelEnd: getNumber('pixelEnd'),
    pixelStep: getNumber('pixelStep'),
    domStart: getNumber('domStart'),
    domEnd: getNumber('domEnd'),
    domStep: getNumber('domStep'),
    varStart: getNumber('varStart'),
    varEnd: getNumber('varEnd'),
    varStep: getNumber('varStep'),
    depthStart: getNumber('depthStart'),
    depthEnd: getNumber('depthEnd'),
    fanOut: getNumber('fanOut'),
    iterations: getNumber('iterations'),
    network: getNumber('network'),
    domComplexity: getNumber('domComplexity'),
  };
}

function* generateRange(start, end, step) {
  if (step <= 0) step = 1;
  if (end < start) [start, end] = [end, start];
  for (let value = start; value <= end; value += step) {
    yield Math.round(value);
  }
}

function buildScenariosFromRanges(values) {
  const scenarios = [];
  let scenarioIndex = 0;
  for (const pixelTags of generateRange(values.pixelStart, values.pixelEnd, values.pixelStep)) {
    for (const domTags of generateRange(values.domStart, values.domEnd, values.domStep)) {
      for (const variables of generateRange(values.varStart, values.varEnd, values.varStep)) {
        for (const depth of generateRange(values.depthStart, values.depthEnd, 1)) {
          const scenario = createScenario({
            id: `scenario-${(scenarioIndex += 1)}`,
            pixelTags,
            domTags,
            variables,
            depth,
            fanOut: values.fanOut,
            domComplexity: values.domComplexity,
            iterations: values.iterations,
            networkDelay: values.network,
          });
          scenarios.push(scenario);
        }
      }
    }
  }
  return scenarios;
}

function ensureChart() {
  if (chartInstance) {
    return chartInstance;
  }
  const context = chartCanvas.getContext('2d');
  chartInstance = new Chart(context, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Avg load vs CPU busy',
          data: [],
          backgroundColor: '#4fc3f7',
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        x: {
          title: { display: true, text: 'Average load (ms)' },
          grid: { color: 'rgba(255, 255, 255, 0.08)' },
        },
        y: {
          title: { display: true, text: 'Average CPU busy (ms)' },
          grid: { color: 'rgba(255, 255, 255, 0.08)' },
        },
      },
      plugins: {
        legend: {
          labels: { color: '#d7eaff' },
        },
      },
    },
  });
  return chartInstance;
}

function appendResultRow(index, scenario, metrics) {
  const row = document.createElement('tr');
  const cells = [
    index,
    scenario.pixelTags,
    scenario.domTags,
    scenario.variables,
    scenario.depth,
    scenario.fanOut,
    metrics.meanLoad.toFixed(2),
    metrics.meanBusy.toFixed(2),
    metrics.stdDeviation.toFixed(2),
  ];

  cells.forEach((value) => {
    const cell = document.createElement('td');
    cell.textContent = value;
    row.appendChild(cell);
  });

  resultsBody.appendChild(row);
}

function refreshChart() {
  const chart = ensureChart();
  chart.data.datasets[0].data = collectedResults.map((entry) => ({
    x: entry.metrics.meanLoad,
    y: entry.metrics.meanBusy,
    scenario: entry.scenario,
  }));
  chart.update();
}

function updateDownloadButton() {
  downloadButton.disabled = collectedResults.length === 0;
}

function normaliseNumber(value, fallback) {
  const numeric = Number.parseFloat(value);
  if (Number.isNaN(numeric)) {
    return fallback;
  }
  return numeric;
}

function createScenarioFromDefinition(definition, defaults, index) {
  return createScenario({
    id: definition.id || definition.name || `scenario-${index + 1}`,
    pixelTags: normaliseNumber(definition.pixelTags, defaults.pixelTags),
    domTags: normaliseNumber(definition.domTags, defaults.domTags),
    variables: normaliseNumber(definition.variables, defaults.variables),
    depth: normaliseNumber(
      definition.depth ?? definition.nestedDepth,
      defaults.depth,
    ),
    fanOut:
      normaliseNumber(definition.fanOut ?? definition.nestedFanOut, defaults.fanOut) ||
      1,
    domComplexity: normaliseNumber(
      definition.domComplexity ?? definition.domSearchComplexity,
      defaults.domComplexity,
    ),
    iterations:
      normaliseNumber(definition.iterations ?? definition.runs, defaults.iterations) ||
      1,
    networkDelay: normaliseNumber(
      definition.networkDelay ?? definition.network,
      defaults.networkDelay,
    ),
  });
}

function buildScenariosFromConfig(config) {
  const defaults = {
    pixelTags: normaliseNumber(config.pixelTags?.[0], 0),
    domTags: normaliseNumber(config.domTags?.[0], 0),
    variables: normaliseNumber(config.variables?.[0], 0),
    depth: normaliseNumber(config.nestedDepth?.[0] ?? config.depth, 0),
    fanOut: normaliseNumber(config.fanOut?.[0], 1) || 1,
    domComplexity: normaliseNumber(config.domComplexity, 120),
    iterations: normaliseNumber(config.iterations, 5) || 1,
    networkDelay: normaliseNumber(config.networkDelay, 20),
  };

  if (Array.isArray(config.scenarios) && config.scenarios.length > 0) {
    return config.scenarios.map((entry, index) =>
      createScenarioFromDefinition(entry, defaults, index),
    );
  }

  const pixels = Array.isArray(config.pixelTags) ? config.pixelTags : [defaults.pixelTags];
  const doms = Array.isArray(config.domTags) ? config.domTags : [defaults.domTags];
  const variables = Array.isArray(config.variables)
    ? config.variables
    : [defaults.variables];
  const depths = Array.isArray(config.nestedDepth ?? config.depth)
    ? config.nestedDepth ?? config.depth
    : [defaults.depth];
  const fanOuts = Array.isArray(config.fanOut) ? config.fanOut : [defaults.fanOut];

  const scenarios = [];
  let scenarioIndex = 0;
  for (const pixelTags of pixels) {
    for (const domTags of doms) {
      for (const variableCount of variables) {
        for (const depth of depths) {
          for (const fanOut of fanOuts) {
            scenarios.push(
              createScenario({
                id: `scenario-${(scenarioIndex += 1)}`,
                pixelTags: normaliseNumber(pixelTags, defaults.pixelTags),
                domTags: normaliseNumber(domTags, defaults.domTags),
                variables: normaliseNumber(variableCount, defaults.variables),
                depth: normaliseNumber(depth, defaults.depth),
                fanOut: normaliseNumber(fanOut, defaults.fanOut) || 1,
                domComplexity: defaults.domComplexity,
                iterations: defaults.iterations,
                networkDelay: defaults.networkDelay,
              }),
            );
          }
        }
      }
    }
  }

  return scenarios;
}

function parseScenarioDefinitions(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }

  const candidates = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.scenarios)
    ? payload.scenarios
    : [];

  if (candidates.length === 0) {
    throw new Error('No scenarios found in payload. Provide an array or {"scenarios": []}.');
  }

  const defaults = {
    pixelTags: 0,
    domTags: 0,
    variables: 0,
    depth: 0,
    fanOut: 1,
    domComplexity: 120,
    iterations: 5,
    networkDelay: 20,
  };

  return candidates.map((candidate, index) => {
    if (!candidate || typeof candidate !== 'object') {
      throw new Error(`Scenario at index ${index} is not an object.`);
    }

    return createScenarioFromDefinition(candidate, defaults, index);
  });
}

function persistScenarioJson(text) {
  try {
    localStorage.setItem('gtm-simulator-scenarios', text);
  } catch (error) {
    console.warn('Unable to persist scenarios to localStorage', error);
  }
}

function restoreScenarioJson() {
  try {
    return localStorage.getItem('gtm-simulator-scenarios') ?? '';
  } catch (error) {
    console.warn('Unable to read scenarios from localStorage', error);
    return '';
  }
}

function renderScenarioLibrary() {
  scenarioList.textContent = '';
  if (parsedScenarioLibrary.length === 0) {
    const item = document.createElement('li');
    item.textContent = 'No parsed scenarios yet. Paste JSON and click “Parse”.';
    scenarioList.appendChild(item);
    return;
  }

  parsedScenarioLibrary.forEach((scenario, index) => {
    const item = document.createElement('li');
    item.innerHTML = `<strong>${index + 1}. ${scenario.id}</strong> — pixels: ${
      scenario.pixelTags
    }, DOM: ${scenario.domTags}, vars: ${scenario.variables}, depth: ${
      scenario.depth
    }, fan-out: ${scenario.fanOut}, iterations: ${scenario.iterations}`;
    scenarioList.appendChild(item);
  });
}

function toCSV(rows) {
  const header = [
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
  ];

  const dataRows = rows.map((entry, index) => [
    entry.scenario.id || `scenario-${index + 1}`,
    entry.scenario.pixelTags,
    entry.scenario.domTags,
    entry.scenario.variables,
    entry.scenario.depth,
    entry.scenario.fanOut,
    entry.scenario.iterations,
    entry.scenario.networkDelay,
    entry.scenario.domComplexity,
    entry.metrics.meanLoad.toFixed(3),
    entry.metrics.meanBusy.toFixed(3),
    entry.metrics.stdDeviation.toFixed(3),
  ]);

  return [header, ...dataRows].map((row) => row.join(',')).join('\n');
}

async function runScenarios(scenarios) {
  if (scenarios.length === 0) {
    updateStatus('No scenarios to run.');
    return;
  }

  collectedResults = [];
  resultsBody.textContent = '';
  updateDownloadButton();
  ensureChart();
  refreshChart();

  let index = 0;
  for (const scenario of scenarios) {
    index += 1;
    updateStatus(`Running ${scenario.id} (${index} of ${scenarios.length})...`);
    log(
      `Scenario ${scenario.id} — pixels: ${scenario.pixelTags}, DOM tags: ${scenario.domTags}, variables: ${scenario.variables}, depth: ${scenario.depth}`,
    );

    // small pause to allow UI to update between heavy runs
    await delayFrame();
    const metrics = await executeScenario(scenario.config, {
      iterations: scenario.iterations,
      networkDelay: scenario.networkDelay,
    });

    collectedResults.push({ scenario, metrics });
    appendResultRow(index, scenario, metrics);
    refreshChart();
    updateDownloadButton();
  }

  updateStatus(`Finished running ${scenarios.length} scenarios.`);
  log('Batch run complete.');
}

function delayFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  form.querySelectorAll('button').forEach((button) => {
    button.disabled = true;
  });

  const values = readFormValues(form);
  const scenarios = buildScenariosFromRanges(values);
  log(`Generated ${scenarios.length} scenarios.`);
  await runScenarios(scenarios);

  form.querySelectorAll('button').forEach((button) => {
    button.disabled = false;
  });
});

parseScenarioButton.addEventListener('click', () => {
  const raw = scenarioJsonInput.value.trim();
  if (!raw) {
    updateStatus('Paste JSON scenario definitions before parsing.');
    return;
  }

  try {
    parsedScenarioLibrary = parseScenarioDefinitions(raw);
    persistScenarioJson(raw);
    renderScenarioLibrary();
    runLibraryButton.disabled = parsedScenarioLibrary.length === 0;
    updateStatus(`Parsed ${parsedScenarioLibrary.length} scenario(s) from JSON.`);
    log(`Parsed ${parsedScenarioLibrary.length} scenario(s) from JSON payload.`);
  } catch (error) {
    updateStatus(`Failed to parse scenario JSON: ${error.message}`);
    log(`JSON parsing error: ${error.message}`);
  }
});

runLibraryButton.addEventListener('click', async () => {
  if (parsedScenarioLibrary.length === 0) {
    updateStatus('Parse scenario JSON before running.');
    return;
  }

  form.querySelectorAll('button').forEach((button) => {
    button.disabled = true;
  });
  runLibraryButton.disabled = true;

  log(`Running ${parsedScenarioLibrary.length} JSON-defined scenario(s).`);
  await runScenarios(parsedScenarioLibrary);

  form.querySelectorAll('button').forEach((button) => {
    button.disabled = false;
  });
  runLibraryButton.disabled = false;
});

resetButton.addEventListener('click', () => {
  collectedResults = [];
  resultsBody.textContent = '';
  updateStatus('Results reset.');
  log('Cleared current results.');
  refreshChart();
  updateDownloadButton();
});

exampleButton.addEventListener('click', async () => {
  form.querySelectorAll('button').forEach((button) => {
    button.disabled = true;
  });
  log('Running curated example scenarios.');
  await runScenarios(exampleScenarios);
  form.querySelectorAll('button').forEach((button) => {
    button.disabled = false;
  });
});

downloadButton.addEventListener('click', () => {
  const csvContent = toCSV(collectedResults);
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'gtm-load-simulations.csv';
  anchor.click();
  URL.revokeObjectURL(url);
  log('Exported results to CSV.');
});

scenarioFileInput?.addEventListener('change', async (event) => {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    scenarioJsonInput.value = text;
    updateStatus(`Loaded ${file.name}. Click “Parse JSON” to ingest scenarios.`);
  } catch (error) {
    updateStatus(`Failed to read ${file.name}: ${error.message}`);
  }
});

async function loadPresetConfig(previewOnly = false) {
  const presetPath = presetSelect?.value;
  if (!presetPath) {
    updateStatus('Choose a preset matrix first.');
    return;
  }

  try {
    const response = await fetch(presetPath, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const config = await response.json();
    loadedPresetScenarios = buildScenariosFromConfig(config);
    loadedPresetLabel = presetPath.split('/').pop();
    updateStatus(
      `Loaded preset ${loadedPresetLabel} with ${loadedPresetScenarios.length} scenario(s).` +
        (previewOnly ? ' Review the Scenario Library or run when ready.' : ''),
    );
    log(
      `Preset ${loadedPresetLabel} ready — ${loadedPresetScenarios.length} scenario(s).`,
    );
    runPresetButton.disabled = loadedPresetScenarios.length === 0;
    if (!previewOnly) {
      await runScenarios(loadedPresetScenarios);
    }
  } catch (error) {
    updateStatus(`Failed to load preset: ${error.message}`);
    log(`Preset load error: ${error.message}`);
  }
}

loadPresetButton?.addEventListener('click', () => {
  loadPresetConfig(true);
});

runPresetButton?.addEventListener('click', async () => {
  if (!loadedPresetScenarios.length) {
    await loadPresetConfig(true);
    if (!loadedPresetScenarios.length) {
      return;
    }
  }

  form.querySelectorAll('button').forEach((button) => {
    button.disabled = true;
  });
  loadPresetButton.disabled = true;
  runPresetButton.disabled = true;

  log(
    `Running preset ${loadedPresetLabel} with ${loadedPresetScenarios.length} scenario(s).`,
  );
  await runScenarios(loadedPresetScenarios);

  form.querySelectorAll('button').forEach((button) => {
    button.disabled = false;
  });
  loadPresetButton.disabled = false;
  runPresetButton.disabled = loadedPresetScenarios.length === 0;
});

seedSyntheticDom();
ensureChart();
updateStatus('Ready. Configure ranges and run a batch.');

const restoredJson = restoreScenarioJson();
if (restoredJson) {
  scenarioJsonInput.value = restoredJson;
  try {
    parsedScenarioLibrary = parseScenarioDefinitions(restoredJson);
    renderScenarioLibrary();
    runLibraryButton.disabled = parsedScenarioLibrary.length === 0;
    log(`Restored ${parsedScenarioLibrary.length} scenario(s) from previous session.`);
  } catch (error) {
    log(`Failed to restore scenario JSON: ${error.message}`);
  }
} else {
  renderScenarioLibrary();
  runLibraryButton.disabled = true;
}
