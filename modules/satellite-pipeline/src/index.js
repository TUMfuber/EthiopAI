import { fetchDEM } from './fetch-dem.js';
import { mergeLayers } from './merge-layers.js';
import { uploadToS3 } from './upload-s3.js';

async function run() {
  console.log('=== Satellite Pipeline Start ===');
  await fetchDEM();
  await mergeLayers();
  await uploadToS3();
  console.log('=== Pipeline Complete ===');
}

run().catch(err => { console.error(err); process.exit(1); });
