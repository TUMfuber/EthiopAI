import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'output');

export async function uploadToS3() {
  const s3 = new S3Client({ region: 'eu-central-1' });
  const body = await readFile(path.join(OUTPUT_DIR, 'training-data.json'));

  await s3.send(new PutObjectCommand({
    Bucket: 'ethopai-ml-data',
    Key: 'training/training-data.json',
    Body: body,
    ContentType: 'application/json'
  }));

  console.log('Uploaded training-data.json → s3://ethopai-ml-data/training/training-data.json');
}
