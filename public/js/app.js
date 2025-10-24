import { buildContainerConfig, executeScenario } from './mockGtm.js';
import { exampleScenarios } from './scenarios.js';

const form = document.getElementById('batchForm');
const statusEl = document.getElementById('status');
const logEl = document.getElementById('logOutput');
const resultsBody = document.getElementById('resultsBody');
const downloadButton = document.getElementById('downloadButton');
const resetButton = document.getElementById('resetButton');
const exampleButton = document.getElementById('exampleButton');
const chartCanvas = document.getElementById('summaryChart');

let chartInstance = null;
let collectedResults = [];

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

function seedDocument() {
  const root = document.createElement('section');
  root.className = 'content-block';
  root.hidden = true;
  for (let i = 0; i < 80; i += 1) {
    const article = document.createElement('article');
    article.className = i % 3 === 0 ? 'highlight' : 'standard';
    article.dataset.node = i % 2 === 0 ? 'story' : 'product';

    const heading = document.createElement('h3');
    heading.textContent = `Synthetic content block ${i + 1}`;
    article.appendChild(heading);

    const paragraph = document.createElement('p');
    paragraph.textContent =
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam vitae.';
    article.appendChild(paragraph);

    const list = document.createElement('ul');
    list.className = 'cta-list';
    for (let j = 0; j < 5; j += 1) {
      const li = document.createElement('li');
      li.dataset.node = j % 2 === 0 ? 'cta' : 'link';
      li.textContent = `Call-to-action ${j + 1}`;
      list.appendChild(li);
    }
    article.appendChild(list);

    root.appendChild(article);
  }

  document.body.appendChild(root);
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

seedDocument();
ensureChart();
updateStatus('Ready. Configure ranges and run a batch.');
