#!/bin/bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════
# EthopAI — Full AWS Infrastructure Setup
# Region: us-west-2
# Run: bash infra/full-setup-aws.sh
# ═══════════════════════════════════════════════════════════════════════

REGION="us-west-2"
APP_NAME="ethopai"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
KEY_NAME="ethopai-key"
INSTANCE_TYPE="t3.medium"
AMI_ID="ami-0c2644caf041bb519"  # Ubuntu 24.04 LTS us-west-2

echo "═══════════════════════════════════════════════════"
echo "  EthopAI Full AWS Setup — Account: $ACCOUNT_ID"
echo "  Region: $REGION"
echo "═══════════════════════════════════════════════════"
echo ""

# ─── 1. VPC & Networking ────────────────────────────────────────────

echo "[1/10] Creating VPC..."
VPC_ID=$(aws ec2 describe-vpcs --region $REGION --filters "Name=tag:Name,Values=${APP_NAME}-vpc" --query "Vpcs[0].VpcId" --output text 2>/dev/null || echo "None")
if [ "$VPC_ID" = "None" ] || [ -z "$VPC_ID" ]; then
  VPC_ID=$(aws ec2 create-vpc --region $REGION --cidr-block 10.0.0.0/16 --query Vpc.VpcId --output text)
  aws ec2 create-tags --region $REGION --resources $VPC_ID --tags Key=Name,Value=${APP_NAME}-vpc
  aws ec2 modify-vpc-attribute --region $REGION --vpc-id $VPC_ID --enable-dns-hostnames
  echo "  ✓ Created VPC: $VPC_ID"
else
  echo "  ✓ VPC exists: $VPC_ID"
fi

echo "[2/10] Creating subnets..."
SUBNET1=$(aws ec2 describe-subnets --region $REGION --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Name,Values=${APP_NAME}-public-1" --query "Subnets[0].SubnetId" --output text 2>/dev/null || echo "None")
if [ "$SUBNET1" = "None" ] || [ -z "$SUBNET1" ]; then
  SUBNET1=$(aws ec2 create-subnet --region $REGION --vpc-id $VPC_ID --cidr-block 10.0.1.0/24 --availability-zone ${REGION}a --query Subnet.SubnetId --output text)
  aws ec2 create-tags --region $REGION --resources $SUBNET1 --tags Key=Name,Value=${APP_NAME}-public-1
  aws ec2 modify-subnet-attribute --region $REGION --subnet-id $SUBNET1 --map-public-ip-on-launch
fi
SUBNET2=$(aws ec2 describe-subnets --region $REGION --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Name,Values=${APP_NAME}-public-2" --query "Subnets[0].SubnetId" --output text 2>/dev/null || echo "None")
if [ "$SUBNET2" = "None" ] || [ -z "$SUBNET2" ]; then
  SUBNET2=$(aws ec2 create-subnet --region $REGION --vpc-id $VPC_ID --cidr-block 10.0.2.0/24 --availability-zone ${REGION}b --query Subnet.SubnetId --output text)
  aws ec2 create-tags --region $REGION --resources $SUBNET2 --tags Key=Name,Value=${APP_NAME}-public-2
  aws ec2 modify-subnet-attribute --region $REGION --subnet-id $SUBNET2 --map-public-ip-on-launch
fi
echo "  ✓ Subnets: $SUBNET1, $SUBNET2"

echo "[3/10] Creating Internet Gateway..."
IGW_ID=$(aws ec2 describe-internet-gateways --region $REGION --filters "Name=attachment.vpc-id,Values=$VPC_ID" --query "InternetGateways[0].InternetGatewayId" --output text 2>/dev/null || echo "None")
if [ "$IGW_ID" = "None" ] || [ -z "$IGW_ID" ]; then
  IGW_ID=$(aws ec2 create-internet-gateway --region $REGION --query InternetGateway.InternetGatewayId --output text)
  aws ec2 attach-internet-gateway --region $REGION --internet-gateway-id $IGW_ID --vpc-id $VPC_ID
  RT_ID=$(aws ec2 describe-route-tables --region $REGION --filters "Name=vpc-id,Values=$VPC_ID" "Name=association.main,Values=true" --query "RouteTables[0].RouteTableId" --output text)
  aws ec2 create-route --region $REGION --route-table-id $RT_ID --destination-cidr-block 0.0.0.0/0 --gateway-id $IGW_ID 2>/dev/null || true
fi
echo "  ✓ Internet Gateway: $IGW_ID"

# ─── 2. Security Group ──────────────────────────────────────────────

echo "[4/10] Creating Security Group..."
SG_ID=$(aws ec2 describe-security-groups --region $REGION --filters "Name=group-name,Values=${APP_NAME}-sg" "Name=vpc-id,Values=$VPC_ID" --query "SecurityGroups[0].GroupId" --output text 2>/dev/null || echo "None")
if [ "$SG_ID" = "None" ] || [ -z "$SG_ID" ]; then
  SG_ID=$(aws ec2 create-security-group --region $REGION --group-name ${APP_NAME}-sg --description "EthopAI web server" --vpc-id $VPC_ID --query GroupId --output text)
  aws ec2 authorize-security-group-ingress --region $REGION --group-id $SG_ID --protocol tcp --port 22 --cidr 0.0.0.0/0
  aws ec2 authorize-security-group-ingress --region $REGION --group-id $SG_ID --protocol tcp --port 80 --cidr 0.0.0.0/0
  aws ec2 authorize-security-group-ingress --region $REGION --group-id $SG_ID --protocol tcp --port 443 --cidr 0.0.0.0/0
  aws ec2 authorize-security-group-ingress --region $REGION --group-id $SG_ID --protocol tcp --port 3000 --cidr 0.0.0.0/0
fi
echo "  ✓ Security Group: $SG_ID"

# ─── 3. Key Pair ────────────────────────────────────────────────────

echo "[5/10] Creating Key Pair..."
if ! aws ec2 describe-key-pairs --region $REGION --key-names $KEY_NAME &>/dev/null; then
  aws ec2 create-key-pair --region $REGION --key-name $KEY_NAME --query KeyMaterial --output text > ${KEY_NAME}.pem
  chmod 400 ${KEY_NAME}.pem
  echo "  ✓ Key pair created: ${KEY_NAME}.pem (SAVE THIS FILE)"
else
  echo "  ✓ Key pair exists: $KEY_NAME"
fi

# ─── 4. EC2 Instance ────────────────────────────────────────────────

echo "[6/10] Launching EC2 Instance..."
INSTANCE_ID=$(aws ec2 describe-instances --region $REGION --filters "Name=tag:Name,Values=${APP_NAME}-server" "Name=instance-state-name,Values=running" --query "Reservations[0].Instances[0].InstanceId" --output text 2>/dev/null || echo "None")
if [ "$INSTANCE_ID" = "None" ] || [ -z "$INSTANCE_ID" ]; then
  USER_DATA=$(cat <<'EOF'
#!/bin/bash
apt-get update && apt-get install -y git curl unzip
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pm2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
unzip -o /tmp/awscliv2.zip -d /tmp && /tmp/aws/install
curl -LsSf https://astral.sh/uv/install.sh | sh
cd /home/ubuntu
git clone https://github.com/TUMfuber/EthopAI.git
cd EthopAI && git checkout feature/sat-priority-ai
npm install
npm run build
pm2 start "npm run start" --name ethopai
pm2 startup && pm2 save
EOF
  )
  INSTANCE_ID=$(aws ec2 run-instances --region $REGION \
    --image-id $AMI_ID \
    --instance-type $INSTANCE_TYPE \
    --key-name $KEY_NAME \
    --security-group-ids $SG_ID \
    --subnet-id $SUBNET1 \
    --user-data "$USER_DATA" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${APP_NAME}-server}]" \
    --query "Instances[0].InstanceId" --output text)
  echo "  ✓ Launched: $INSTANCE_ID (booting...)"
  aws ec2 wait instance-running --region $REGION --instance-ids $INSTANCE_ID
else
  echo "  ✓ Instance exists: $INSTANCE_ID"
fi
PUBLIC_IP=$(aws ec2 describe-instances --region $REGION --instance-ids $INSTANCE_ID --query "Reservations[0].Instances[0].PublicIpAddress" --output text)
echo "  ✓ Public IP: $PUBLIC_IP"

# ─── 5. Application Load Balancer ───────────────────────────────────

echo "[7/10] Creating Load Balancer..."
ALB_ARN=$(aws elbv2 describe-load-balancers --region $REGION --names ${APP_NAME}-alb --query "LoadBalancers[0].LoadBalancerArn" --output text 2>/dev/null || echo "None")
if [ "$ALB_ARN" = "None" ] || [ -z "$ALB_ARN" ]; then
  ALB_ARN=$(aws elbv2 create-load-balancer --region $REGION \
    --name ${APP_NAME}-alb \
    --subnets $SUBNET1 $SUBNET2 \
    --security-groups $SG_ID \
    --scheme internet-facing \
    --type application \
    --query "LoadBalancers[0].LoadBalancerArn" --output text)
  echo "  ✓ ALB created: ${APP_NAME}-alb"
else
  echo "  ✓ ALB exists"
fi
ALB_DNS=$(aws elbv2 describe-load-balancers --region $REGION --names ${APP_NAME}-alb --query "LoadBalancers[0].DNSName" --output text)

# Target Group
TG_ARN=$(aws elbv2 describe-target-groups --region $REGION --names ${APP_NAME}-tg --query "TargetGroups[0].TargetGroupArn" --output text 2>/dev/null || echo "None")
if [ "$TG_ARN" = "None" ] || [ -z "$TG_ARN" ]; then
  TG_ARN=$(aws elbv2 create-target-group --region $REGION \
    --name ${APP_NAME}-tg \
    --protocol HTTP --port 3000 \
    --vpc-id $VPC_ID \
    --target-type instance \
    --health-check-path "/" \
    --query "TargetGroups[0].TargetGroupArn" --output text)
  aws elbv2 register-targets --region $REGION --target-group-arn $TG_ARN --targets Id=$INSTANCE_ID
fi

# Listener (HTTP)
LISTENER=$(aws elbv2 describe-listeners --region $REGION --load-balancer-arn $ALB_ARN --query "Listeners[0].ListenerArn" --output text 2>/dev/null || echo "None")
if [ "$LISTENER" = "None" ] || [ -z "$LISTENER" ]; then
  aws elbv2 create-listener --region $REGION \
    --load-balancer-arn $ALB_ARN \
    --protocol HTTP --port 80 \
    --default-actions Type=forward,TargetGroupArn=$TG_ARN
fi
echo "  ✓ ALB DNS: $ALB_DNS"

# ─── 6. S3 Bucket ───────────────────────────────────────────────────

echo "[8/10] Creating S3 Bucket..."
BUCKET="ethopai-ml-data-${ACCOUNT_ID}"
if aws s3api head-bucket --bucket "$BUCKET" --region $REGION 2>/dev/null; then
  echo "  ✓ S3 bucket exists: $BUCKET"
else
  aws s3api create-bucket --bucket "$BUCKET" --region $REGION --create-bucket-configuration LocationConstraint=$REGION
  echo "  ✓ S3 bucket created: $BUCKET"
fi

# ─── 7. DynamoDB Table ──────────────────────────────────────────────

echo "[9/10] Creating DynamoDB Table..."
if aws dynamodb describe-table --table-name ethopai-recommendations --region $REGION &>/dev/null; then
  echo "  ✓ DynamoDB table exists: ethopai-recommendations"
else
  aws dynamodb create-table --table-name ethopai-recommendations \
    --attribute-definitions AttributeName=filterKey,AttributeType=S \
    --key-schema AttributeName=filterKey,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST --region $REGION
  echo "  ✓ DynamoDB table created: ethopai-recommendations"
fi

# ─── 8. Lambda + API Gateway ────────────────────────────────────────

echo "[10/10] Creating Lambda & API Gateway..."
LAMBDA_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/ethopai-lambda-role"
if ! aws iam get-role --role-name ethopai-lambda-role &>/dev/null; then
  aws iam create-role --role-name ethopai-lambda-role \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
  aws iam attach-role-policy --role-name ethopai-lambda-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  sleep 10
fi

if aws lambda get-function --function-name ethopai-ml-detail --region $REGION &>/dev/null; then
  echo "  ✓ Lambda exists: ethopai-ml-detail"
else
  echo "  ⚠ Lambda not deployed. Run: cd services/ml-detail && bash deploy.sh"
fi

API_URL=$(aws apigatewayv2 get-apis --region $REGION --query "Items[?Name=='ethopai-detail-api'].ApiEndpoint" --output text 2>/dev/null || echo "")
if [ -n "$API_URL" ]; then
  echo "  ✓ API Gateway: ${API_URL}/detail"
else
  echo "  ⚠ API Gateway not found. Run: cd services/ml-detail && bash deploy.sh"
fi

# ─── Summary ────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════"
echo "  SETUP COMPLETE"
echo "═══════════════════════════════════════════════════"
echo ""
echo "  VPC:          $VPC_ID"
echo "  EC2:          $INSTANCE_ID ($PUBLIC_IP)"
echo "  ALB:          $ALB_DNS"
echo "  S3:           s3://$BUCKET"
echo "  DynamoDB:     ethopai-recommendations"
echo "  Lambda:       ethopai-ml-detail"
echo "  API Gateway:  ${API_URL:-not yet deployed}/detail"
echo "  Bedrock:      us.anthropic.claude-sonnet-4-6"
echo ""
echo "  SSH: ssh -i ${KEY_NAME}.pem ubuntu@${PUBLIC_IP}"
echo "  URL: http://${ALB_DNS}"
echo ""
echo "  Next steps:"
echo "    1. Point your domain DNS to: $ALB_DNS"
echo "    2. Add HTTPS: aws acm request-certificate --domain-name yourdomain.com"
echo "    3. Set AWS creds on EC2 for Bedrock access"
echo ""
