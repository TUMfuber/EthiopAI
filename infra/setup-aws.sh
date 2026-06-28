#!/bin/bash
set -euo pipefail

REGION="us-west-2"
BUCKET="ethopai-ml-data-$(aws sts get-caller-identity --query Account --output text)"
ROLE_ARN="arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/WSParticipantRole"

echo "=== EthopAI AWS Infrastructure Setup (${REGION}) ==="

# 1. S3 Bucket
if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "[OK] S3 bucket '$BUCKET' already exists"
else
  echo "[+] Creating S3 bucket '$BUCKET'..."
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION"
  echo "[OK] S3 bucket created"
fi

# 2. Upload SageMaker source
echo "[+] Packaging SageMaker training code..."
cd "$(dirname "$0")/../modules/satellite-pipeline"
tar -czf /tmp/source.tar.gz -C sagemaker .
aws s3 cp /tmp/source.tar.gz "s3://${BUCKET}/training/source.tar.gz"
echo "[OK] Source uploaded to s3://${BUCKET}/training/source.tar.gz"

echo ""
echo "=== Setup Complete ==="
echo "  S3 Bucket:  s3://${BUCKET}"
echo "  Role ARN:   ${ROLE_ARN}"
echo "  Region:     ${REGION}"
echo ""
echo "  Bedrock model: us.anthropic.claude-sonnet-4-6 (available, no setup needed)"
echo ""
echo "  Next: cd modules/satellite-pipeline && npm install && node src/index.js"
