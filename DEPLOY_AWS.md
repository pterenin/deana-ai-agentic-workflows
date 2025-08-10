# Deploying Deana Agent to AWS (ECS Fargate or App Runner)

This guide describes two recommended paths to production on AWS: ECS Fargate (more control) and App Runner (simpler ops). Both use the provided Dockerfile.

## 0) Prerequisites

- AWS account & CLI configured (`aws configure`)
- Docker installed
- Domain in Route 53 (optional but recommended)

Environment variables (store in AWS Secrets Manager or SSM Parameter Store):

- OPENAI_API_KEY
- TAVILY_API_KEY
- VAPI_API_KEY, VAPI_PHONE_NUMBER_ID, VAPI_ASSISTANT_ID (and optionally VAPI_ASSISTANT_ID_GENERAL)
- ALLOWED_ORIGINS (e.g., `https://your-frontend.com`)

## 1) Build & Push image to ECR

```bash
AWS_REGION=us-east-1
REPO=deana-agent
aws ecr create-repository --repository-name $REPO || true
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI=$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$REPO
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URI

docker build -t $REPO:latest .
docker tag $REPO:latest $ECR_URI:latest
docker push $ECR_URI:latest
```

## Option A: AWS App Runner (simplest)

1. Open App Runner → Create service → From ECR → select the image `:latest`.
2. Set port to `3060`.
3. Configure environment variables (use AWS console; reference Secrets Manager where possible).
4. Health check: HTTP path `/health`.
5. Auto‑deploy from ECR on new image pushes (optional).

App Runner manages load balancing, TLS, and scaling automatically.

## Option B: ECS Fargate (more control)

### Create ECS resources

- Create a VPC (if you don’t have one) with 2 public subnets for ALB and 2 private subnets for tasks.
- Create an Application Load Balancer (ALB) in public subnets.
- Create target group (HTTP 3060) and listener on 443 with ACM certificate (HTTPS).

### Task Definition

- CPU/Memory: start with 0.25 vCPU / 512MB.
- Container image: `ECR_URI:latest`
- Container port: 3060
- Env vars: pull from SSM/Secrets Manager (use task execution role with read access)
- Health check command: `CMD-SHELL curl -f http://localhost:3060/health || exit 1`

### Service

- Launch type: Fargate, desired count 1–2
- Networking: private subnets; security group allows egress 443; ALB SG allows 443 from Internet
- Target group: the one you created; health check path `/health`
- Auto scaling: target tracking on CPU or requests

### Route 53 & TLS

- Request ACM certificate for your domain.
- Point Route 53 A/AAAA record to the ALB.

## 2) BFF integration

Set BFF env `AGENT_URL=https://your-agent-domain.com` and have it call `AGENT_URL/api/chat/stream` and `/api/chat`.

## 3) Observability

- CloudWatch Logs for the ECS/App Runner service.
- CloudWatch Alarms for 5xx and high latency.
- (Optional) X‑Ray tracing if you add it to the code.

## 4) Security Notes

- Use AWS WAF on ALB (bot control/rate patterns) in addition to in‑app rate limits.
- Store secrets only in Secrets Manager/SSM; never in Docker/Task envs directly when possible.
- Principle of least privilege for task roles.

## 5) Smoke Tests

```bash
curl https://your-agent-domain.com/health
curl -N -X POST https://your-agent-domain.com/api/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"message":"hello","primary_account":{"email":"a@b","title":"Personal","creds":{"access_token":"x","refresh_token":"y","expires_at":"z","client_id":"c"}},"secondary_account":null}'
```

You're live!
