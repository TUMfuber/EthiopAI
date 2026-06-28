#!/bin/bash
set -e

REGION="us-west-2"
FUNCTION_NAME="ethopai-ml-detail"
API_NAME="ethopai-detail-api"
ROLE_ARN="arn:aws:iam::123965497004:role/WSParticipantRole"

cd "$(dirname "$0")"

# Install and zip
npm ci --omit=dev
zip -r function.zip package.json node_modules src

# Create or update Lambda
if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>/dev/null; then
  aws lambda update-function-code --function-name $FUNCTION_NAME --zip-file fileb://function.zip --region $REGION
else
  aws lambda create-function \
    --function-name $FUNCTION_NAME \
    --runtime nodejs20.x \
    --handler src/handler.handler \
    --role $ROLE_ARN \
    --zip-file fileb://function.zip \
    --timeout 30 \
    --memory-size 512 \
    --region $REGION
fi

# Create HTTP API or get existing
API_ID=$(aws apigatewayv2 get-apis --region $REGION --query "Items[?Name=='$API_NAME'].ApiId | [0]" --output text)
if [ "$API_ID" = "None" ] || [ -z "$API_ID" ]; then
  API_ID=$(aws apigatewayv2 create-api --name $API_NAME --protocol-type HTTP --region $REGION --query 'ApiId' --output text)
  
  LAMBDA_ARN=$(aws lambda get-function --function-name $FUNCTION_NAME --region $REGION --query 'Configuration.FunctionArn' --output text)
  
  INTEGRATION_ID=$(aws apigatewayv2 create-integration --api-id $API_ID --integration-type AWS_PROXY \
    --integration-uri $LAMBDA_ARN --payload-format-version 2.0 --region $REGION --query 'IntegrationId' --output text)
  
  aws apigatewayv2 create-route --api-id $API_ID --route-key "GET /detail" \
    --target "integrations/$INTEGRATION_ID" --region $REGION

  aws apigatewayv2 create-stage --api-id $API_ID --stage-name '$default' --auto-deploy --region $REGION

  aws lambda add-permission --function-name $FUNCTION_NAME --statement-id apigateway-invoke \
    --action lambda:InvokeFunction --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:123965497004:$API_ID/*" --region $REGION 2>/dev/null || true
fi

rm -f function.zip

echo ""
echo "Invoke URL: https://$API_ID.execute-api.$REGION.amazonaws.com/detail?lat=0&lng=0&zoom=8"
