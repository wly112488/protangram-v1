import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const frontendRoot = fileURLToPath(new URL('..', import.meta.url));

test('automatic analysis can restart after React StrictMode clears its first timer', () => {
  const source = readFileSync(path.join(frontendRoot, 'src/pages/analysis/projects/AnalysisProjects.tsx'), 'utf8');
  assert.match(source, /autoStarted\.current = false/);
  assert.match(source, /timer\.current = null/);
});

test('automatic model calibration can restart after React StrictMode clears its first timer', () => {
  const source = readFileSync(path.join(frontendRoot, 'src/pages/analysis/DigitalTwin.tsx'), 'utf8');
  assert.match(source, /autoStarted\.current = false/);
  assert.match(source, /calibrationTimer\.current = null/);
});

test('automatic experiment design can restart after React StrictMode clears its first timer', () => {
  const source = readFileSync(path.join(frontendRoot, 'src/pages/experiment/design/IntelligentExperimentDesign.tsx'), 'utf8');
  assert.match(source, /autoStarted\.current = false/);
  assert.match(source, /timer\.current = null/);
});
