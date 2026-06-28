import {
  SageMakerClient,
  CreateTrainingJobCommand,
  CreateModelCommand,
  CreateEndpointConfigCommand,
  CreateEndpointCommand,
  DescribeTrainingJobCommand
} from "@aws-sdk/client-sagemaker";

const REGION = "eu-central-1";
const ROLE_ARN = process.env.SAGEMAKER_ROLE_ARN;
const PREFIX = "ethopai-priority";
const TIMESTAMP = Date.now();
const JOB_NAME = `${PREFIX}-${TIMESTAMP}`;
const MODEL_NAME = `${PREFIX}-model-${TIMESTAMP}`;
const ENDPOINT_CONFIG = `${PREFIX}-config-${TIMESTAMP}`;
const ENDPOINT_NAME = "ethopai-priority-endpoint";
const IMAGE = "763104351884.dkr.ecr.eu-central-1.amazonaws.com/pytorch-training:2.0-cpu-py310";
const INFERENCE_IMAGE = "763104351884.dkr.ecr.eu-central-1.amazonaws.com/pytorch-inference:2.0-cpu-py310";

const client = new SageMakerClient({ region: REGION });

async function waitForTraining(jobName) {
  while (true) {
    const { TrainingJobStatus } = await client.send(new DescribeTrainingJobCommand({ TrainingJobName: jobName }));
    console.log(`Training status: ${TrainingJobStatus}`);
    if (TrainingJobStatus === "Completed") return;
    if (TrainingJobStatus === "Failed") throw new Error("Training failed");
    await new Promise(r => setTimeout(r, 30000));
  }
}

async function main() {
  console.log("Creating training job...");
  await client.send(new CreateTrainingJobCommand({
    TrainingJobName: JOB_NAME,
    RoleArn: ROLE_ARN,
    AlgorithmSpecification: {
      TrainingImage: IMAGE,
      TrainingInputMode: "File"
    },
    ResourceConfig: {
      InstanceCount: 1,
      InstanceType: "ml.m5.large",
      VolumeSizeInGB: 10
    },
    InputDataConfig: [{
      ChannelName: "training",
      DataSource: {
        S3DataSource: {
          S3DataType: "S3Prefix",
          S3Uri: "s3://ethopai-ml-data/training/",
          S3DataDistributionType: "FullyReplicated"
        }
      }
    }],
    OutputDataConfig: { S3OutputPath: "s3://ethopai-ml-data/output/" },
    StoppingCondition: { MaxRuntimeInSeconds: 600 },
    HyperParameters: { sagemaker_program: "train.py", sagemaker_submit_directory: "s3://ethopai-ml-data/training/source.tar.gz" }
  }));

  await waitForTraining(JOB_NAME);
  console.log("Training complete. Creating model...");

  await client.send(new CreateModelCommand({
    ModelName: MODEL_NAME,
    PrimaryContainer: {
      Image: INFERENCE_IMAGE,
      ModelDataUrl: `s3://ethopai-ml-data/output/${JOB_NAME}/output/model.tar.gz`
    },
    ExecutionRoleArn: ROLE_ARN
  }));

  console.log("Creating endpoint config...");
  await client.send(new CreateEndpointConfigCommand({
    EndpointConfigName: ENDPOINT_CONFIG,
    ProductionVariants: [{
      VariantName: "primary",
      ModelName: MODEL_NAME,
      InstanceType: "ml.t2.medium",
      InitialInstanceCount: 1
    }]
  }));

  console.log("Creating endpoint...");
  await client.send(new CreateEndpointCommand({
    EndpointName: ENDPOINT_NAME,
    EndpointConfigName: ENDPOINT_CONFIG
  }));

  console.log(`Endpoint '${ENDPOINT_NAME}' creating. It will be ready in a few minutes.`);
}

main().catch(console.error);
