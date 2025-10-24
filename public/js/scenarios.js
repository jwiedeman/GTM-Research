import { buildContainerConfig } from './mockGtm.js';

export function createScenario({
  id,
  pixelTags,
  domTags,
  variables,
  depth,
  fanOut,
  domComplexity,
  iterations,
  networkDelay,
}) {
  return {
    id,
    pixelTags,
    domTags,
    variables,
    depth,
    fanOut,
    domComplexity,
    iterations,
    networkDelay,
    config: buildContainerConfig({
      pixelTags,
      domTags,
      variables,
      nestedDepth: depth,
      fanOut,
      domComplexity,
    }),
  };
}

export const exampleScenarios = [
  createScenario({
    id: 'baseline-low',
    pixelTags: 5,
    domTags: 0,
    variables: 8,
    depth: 0,
    fanOut: 1,
    iterations: 5,
    networkDelay: 18,
    domComplexity: 120,
  }),
  createScenario({
    id: 'balanced-mix',
    pixelTags: 15,
    domTags: 8,
    variables: 40,
    depth: 1,
    fanOut: 2,
    iterations: 5,
    networkDelay: 24,
    domComplexity: 180,
  }),
  createScenario({
    id: 'dom-heavy-nested',
    pixelTags: 10,
    domTags: 20,
    variables: 75,
    depth: 2,
    fanOut: 2,
    iterations: 5,
    networkDelay: 28,
    domComplexity: 240,
  }),
];
