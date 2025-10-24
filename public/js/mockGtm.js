const randomBetween = (min, max) => min + Math.random() * (max - min);

const delay = (duration) =>
  new Promise((resolve) => setTimeout(resolve, Math.max(0, duration)));

function simulateVariableResolution(count, depthFactor) {
  const start = performance.now();
  let checksum = 0;
  const loops = Math.max(1, Math.round(count * (1 + depthFactor * 0.4)));
  for (let i = 0; i < loops * 320; i += 1) {
    checksum = (checksum + (i % 7)) ^ (checksum << 1);
  }
  const busy = performance.now() - start;
  return { busy, checksum };
}

function simulatePixelTag(workUnits = 1, networkDelay = 12) {
  const start = performance.now();
  let accumulator = 0;
  const loops = Math.max(1, workUnits * 50);
  for (let i = 0; i < loops; i += 1) {
    accumulator += (i * 17) % 5;
  }
  const busy = performance.now() - start;

  return delay(randomBetween(networkDelay * 0.6, networkDelay * 1.4)).then(() => ({
    duration: performance.now() - start,
    busy,
    accumulator,
  }));
}

function simulateDomTag(complexity, networkDelay = 20) {
  const start = performance.now();
  let matches = 0;
  const selectors = [
    '[data-node="story"]',
    '[data-node="product"]',
    '[data-node="cta"]',
    'article.highlight',
    '.content-block p',
    '.content-block ul li',
  ];

  for (let i = 0; i < complexity; i += 1) {
    const selector = selectors[i % selectors.length];
    matches += document.querySelectorAll(selector).length;
  }

  const busy = performance.now() - start;

  return delay(randomBetween(networkDelay * 0.7, networkDelay * 1.6)).then(() => ({
    duration: performance.now() - start,
    busy,
    matches,
  }));
}

function createNestedConfigs(baseConfig, depth, fanOut, currentDepth = 1) {
  if (currentDepth > depth) {
    return [];
  }

  const nested = [];
  for (let i = 0; i < fanOut; i += 1) {
    nested.push({
      ...baseConfig,
      depth: currentDepth,
      nested: createNestedConfigs(
        {
          ...baseConfig,
          pixelTags: Math.round(baseConfig.pixelTags * 0.75),
          domTags: Math.round(baseConfig.domTags * 0.6),
          variables: Math.round(baseConfig.variables * 0.6),
        },
        depth,
        Math.max(1, Math.round(fanOut * 0.75)),
        currentDepth + 1
      ),
    });
  }

  return nested;
}

export function buildContainerConfig({
  pixelTags,
  domTags,
  variables,
  nestedDepth,
  fanOut,
  domComplexity,
}) {
  const baseConfig = {
    pixelTags,
    domTags,
    variables,
    domComplexity,
    depth: 0,
    nested: [],
  };

  baseConfig.nested = createNestedConfigs(baseConfig, nestedDepth, fanOut);
  return baseConfig;
}

export async function loadContainer(config, options = {}) {
  const { depth = 0, networkDelay = 20 } = options;
  const start = performance.now();
  let busyTime = 0;
  const tagDetails = [];

  if (config.variables > 0) {
    const variablesResult = simulateVariableResolution(config.variables, depth);
    busyTime += variablesResult.busy;
    tagDetails.push({ type: 'variables', duration: variablesResult.busy, depth });
  }

  for (let i = 0; i < config.pixelTags; i += 1) {
    const result = await simulatePixelTag(1 + depth * 0.6, networkDelay);
    busyTime += result.busy;
    tagDetails.push({ type: 'pixel', depth, duration: result.duration });
  }

  for (let i = 0; i < config.domTags; i += 1) {
    const result = await simulateDomTag(config.domComplexity, networkDelay);
    busyTime += result.busy;
    tagDetails.push({ type: 'dom', depth, duration: result.duration, matches: result.matches });
  }

  for (const nestedConfig of config.nested || []) {
    const nestedResult = await loadContainer(nestedConfig, {
      depth: (nestedConfig.depth ?? depth + 1),
      networkDelay: networkDelay * 1.1,
    });
    busyTime += nestedResult.busyTime;
    tagDetails.push({
      type: 'nested',
      depth: nestedConfig.depth ?? depth + 1,
      duration: nestedResult.totalDuration,
      busy: nestedResult.busyTime,
    });
  }

  const totalDuration = performance.now() - start;

  return {
    totalDuration,
    busyTime,
    tagDetails,
  };
}

export async function executeScenario(config, { iterations, networkDelay }) {
  const results = [];
  for (let i = 0; i < iterations; i += 1) {
    performance.clearMarks();
    performance.clearMeasures();
    const runResult = await loadContainer(config, {
      depth: 0,
      networkDelay,
    });
    results.push(runResult);
  }

  const totalDurations = results.map((r) => r.totalDuration);
  const busyDurations = results.map((r) => r.busyTime);

  const average = (values) => values.reduce((acc, v) => acc + v, 0) / values.length;
  const meanLoad = average(totalDurations);
  const meanBusy = average(busyDurations);
  const stdDeviation = Math.sqrt(
    average(totalDurations.map((value) => (value - meanLoad) ** 2))
  );

  return {
    meanLoad,
    meanBusy,
    stdDeviation,
    rawRuns: results,
  };
}
