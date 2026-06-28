import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'output');

export async function uploadToS3() {
  const s3 = new S3Client({ region: 'us-west-2' });
  const body = await readFile(path.join(OUTPUT_DIR, 'training-data.json'));
  const { STSClient, GetCallerIdentityCommand } = await import('@aws-sdk/client-sts');
  const sts = new STSClient({ region: 'us-west-2' });
  const { Account } = await sts.send(new GetCallerIdentityCommand({}));
  const bucket = `ethopai-ml-data-${Account}`;

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: 'training/training-data.json',
    Body: body,
    ContentType: 'application/json'
  }));

  console.log(`Uploaded training-data.json → s3://${bucket}/training/training-data.json`);
}
