#!/bin/bash
set -euo pipefail

REGION="eu-central-1"
BUCKET="ethopai-ml-data"
ROLE_NAME="ethopai-sagemaker-role"
NOTEBOOK_NAME="ethopai-notebook"

echo "=== EthopAI AWS Infrastructure Teardown ==="
read -p "This will DELETE all EthopAI AWS resources. Continue? (y/N) " confirm
[[ "$confirm" == "y" ]] || exit 0

# 1. Delete SageMaker notebook
if aws sagemaker describe-notebook-instance --notebook-instance-name "$NOTEBOOK_NAME" --region "$REGION" 2>/dev/null; then
  STATUS=$(aws sagemaker describe-notebook-instance --notebook-instance-name "$NOTEBOOK_NAME" --region "$REGION" --query NotebookInstanceStatus --output text)
  if [ "$STATUS" == "InService" ]; then
    echo "[-] Stopping notebook..."
    aws sagemaker stop-notebook-instance --notebook-instance-name "$NOTEBOOK_NAME" --region "$REGION"
    aws sagemaker wait notebook-instance-stopped --notebook-instance-name "$NOTEBOOK_NAME" --region "$REGION"
  fi
  echo "[-] Deleting notebook '$NOTEBOOK_NAME'..."
  aws sagemaker delete-notebook-instance --notebook-instance-name "$NOTEBOOK_NAME" --region "$REGION"
fi

# 2. Delete IAM role
if aws iam get-role --role-name "$ROLE_NAME" 2>/dev/null; then
  echo "[-] Removing IAM role '$ROLE_NAME'..."
  aws iam detach-role-policy --role-name "$ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/AmazonSageMakerFullAccess 2>/dev/null || true
  aws iam delete-role-policy --role-name "$ROLE_NAME" --policy-name S3Access 2>/dev/null || true
  aws iam delete-role --role-name "$ROLE_NAME"
fi

# 3. Delete S3 bucket
if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "[-] Emptying and deleting S3 bucket '$BUCKET'..."
  aws s3 rm "s3://${BUCKET}" --recursive
  aws s3api delete-bucket --bucket "$BUCKET" --region "$REGION"
fi

echo "=== Teardown Complete ==="
