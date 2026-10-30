import fs from 'node:fs/promises';
import { logoPropFixture } from '../tests/fixtures/logo-prop.mjs';
await fs.mkdir('release/qa', { recursive: true });
await fs.writeFile(
  'release/qa/logo-native-fixture.json',
  JSON.stringify({ mode: 'logo', name: 'ditasha_test_logo', logo: logoPropFixture().logo }),
);
