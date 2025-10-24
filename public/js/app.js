import { buildContainerConfig, executeScenario } from './mockGtm.js';
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

let chartInstance = null;
let collectedResults = [];
let parsedScenarioLibrary = [];

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
          const config = buildContainerConfig({
            pixelTags,
            domTags,
            variables,
            nestedDepth: depth,
            fanOut: values.fanOut,
            domComplexity: values.domComplexity,
          });
          scenarios.push({
            id: `scenario-${scenarioIndex += 1}`,
            pixelTags,
            domTags,
            variables,
            depth,
            fanOut: values.fanOut,
            config,
            iterations: values.iterations,
            networkDelay: values.network,
          });
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

  return candidates.map((candidate, index) => {
    if (!candidate || typeof candidate !== 'object') {
      throw new Error(`Scenario at index ${index} is not an object.`);
    }

    const id = candidate.id || candidate.name || `json-${index + 1}`;
    const scenario = createScenario({
      id,
      pixelTags: normaliseNumber(candidate.pixelTags, 0),
      domTags: normaliseNumber(candidate.domTags, 0),
      variables: normaliseNumber(candidate.variables, 0),
      depth: normaliseNumber(candidate.depth ?? candidate.nestedDepth, 0),
      fanOut: normaliseNumber(candidate.fanOut ?? candidate.nestedFanOut, 1) || 1,
      domComplexity: normaliseNumber(candidate.domComplexity ?? candidate.domSearchComplexity, 120),
      iterations: normaliseNumber(candidate.iterations ?? candidate.runs, 5) || 1,
      networkDelay: normaliseNumber(candidate.networkDelay ?? candidate.network, 20),
    });

    return scenario;
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
    'index',
    'pixelTags',
    'domTags',
    'variables',
    'depth',
    'fanOut',
    'avgLoadMs',
    'avgBusyMs',
    'stdDeviationMs',
  ];

  const dataRows = rows.map((entry, index) => [
    index + 1,
    entry.scenario.pixelTags,
    entry.scenario.domTags,
    entry.scenario.variables,
    entry.scenario.depth,
    entry.scenario.fanOut,
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
      `Scenario ${scenario.id} — pixels: ${scenario.pixelTags}, DOM tags: ${scenario.domTags}, variables: ${scenario.variables}, depth: ${scenario.depth}`
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
