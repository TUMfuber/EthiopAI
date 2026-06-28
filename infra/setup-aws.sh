#!/bin/bash
set -euo pipefail

REGION="eu-central-1"
BUCKET="ethopai-ml-data"
ROLE_NAME="ethopai-sagemaker-role"
NOTEBOOK_NAME="ethopai-notebook"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "=== EthopAI AWS Infrastructure Setup (${REGION}) ==="

# 1. S3 Bucket
if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "[OK] S3 bucket '$BUCKET' already exists"
else
  echo "[+] Creating S3 bucket '$BUCKET'..."
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION"
  aws s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled
  echo "[OK] S3 bucket created"
fi

# 2. IAM Role for SageMaker
if aws iam get-role --role-name "$ROLE_NAME" 2>/dev/null; then
  echo "[OK] IAM role '$ROLE_NAME' already exists"
else
  echo "[+] Creating IAM role '$ROLE_NAME'..."
  aws iam create-role --role-name "$ROLE_NAME" \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "sagemaker.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }'
  aws iam attach-role-policy --role-name "$ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/AmazonSageMakerFullAccess
  aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name S3Access \
    --policy-document "{
      \"Version\": \"2012-10-17\",
      \"Statement\": [{
        \"Effect\": \"Allow\",
        \"Action\": [\"s3:GetObject\",\"s3:PutObject\",\"s3:ListBucket\"],
        \"Resource\": [
          \"arn:aws:s3:::${BUCKET}\",
          \"arn:aws:s3:::${BUCKET}/*\"
        ]
      }]
    }"
  echo "[OK] IAM role created"
  echo "    Waiting 10s for role propagation..."
  sleep 10
fi

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

# 3. SageMaker Notebook Instance (optional)
if aws sagemaker describe-notebook-instance --notebook-instance-name "$NOTEBOOK_NAME" --region "$REGION" 2>/dev/null; then
  echo "[OK] SageMaker notebook '$NOTEBOOK_NAME' already exists"
else
  echo "[+] Creating SageMaker notebook '$NOTEBOOK_NAME' (ml.t3.medium)..."
  aws sagemaker create-notebook-instance \
    --notebook-instance-name "$NOTEBOOK_NAME" \
    --instance-type ml.t3.medium \
    --role-arn "$ROLE_ARN" \
    --region "$REGION"
  echo "[OK] Notebook instance created (starting up...)"
fi

# 4. Bedrock Model Access
echo ""
echo "[NOTE] Amazon Bedrock - Claude model access must be enabled via the AWS Console:"
echo "       https://${REGION}.console.aws.amazon.com/bedrock/home?region=${REGION}#/modelaccess"
echo "       Enable: anthropic.claude-3-sonnet (or claude-3-haiku for cost savings)"

# 5. ECR - not needed, using AWS-provided PyTorch container
echo ""
echo "[INFO] No custom ECR container needed - using AWS-provided PyTorch training container"

echo ""
echo "=== Setup Complete ==="
echo "  S3 Bucket:  s3://${BUCKET}"
echo "  IAM Role:   ${ROLE_ARN}"
echo "  Notebook:   ${NOTEBOOK_NAME}"
