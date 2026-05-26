#!/bin/bash

# ==============================================================================
# ONCOSIGHT CLOUD-NATIVE DEPLOYMENT RUNNER
# ==============================================================================
# Automates the provisioning, ordering, and rollout of all microservices.

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}====================================================================${NC}"
echo -e "${CYAN}   ONCOSIGHT AI CLINICAL INFRASTRUCTURE DEPLOYMENT UTILITY           ${NC}"
echo -e "${CYAN}====================================================================${NC}"

# 1. Validation Checks
echo -e "\n${YELLOW}[1/6] Running system pre-flight checks...${NC}"
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}ERROR: kubectl is not installed. Please install it to proceed.${NC}"
    exit 1
fi

if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}ERROR: Cannot communicate with the Kubernetes cluster. Check context/config.${NC}"
    exit 1
fi
echo -e "${GREEN}✔ kubectl connected to cluster successfully.${NC}"

# 2. Namespace & Configuration Mapping
echo -e "\n${YELLOW}[2/6] Provisioning secrets and configuration maps...${NC}"
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmaps.yaml
echo -e "${GREEN}✔ Configuration maps and encrypted secrets applied.${NC}"

# 3. Deploy Stateful Database Upstream
echo -e "\n${YELLOW}[3/6] Deploying stateful database upstreams (MongoDB & Redis)...${NC}"
kubectl apply -f k8s/mongodb-deployment.yaml
kubectl apply -f k8s/services.yaml # Includes Redis Deployment

echo -e "Waiting for MongoDB pod to initialize..."
kubectl rollout status deployment/mongodb --timeout=120s
kubectl rollout status deployment/redis --timeout=120s
echo -e "${GREEN}✔ Database registry and caching broker are active.${NC}"

# 4. Deploy Platform Microservices
echo -e "\n${YELLOW}[4/6] Deploying Core AI Platform Microservices...${NC}"
kubectl apply -f k8s/ai-inference-deployment.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/federated-deployment.yaml

echo -e "Verifying rollouts (this may take up to 2 minutes)..."
kubectl rollout status deployment/ai-inference --timeout=180s
kubectl rollout status deployment/backend --timeout=120s
kubectl rollout status deployment/frontend --timeout=120s
kubectl rollout status deployment/federated-coordinator --timeout=120s
echo -e "${GREEN}✔ All microservices deployed and active.${NC}"

# 5. Autoscale and Ingress Mappings
echo -e "\n${YELLOW}[5/6] Initializing autoscaling bounds and reverse proxies...${NC}"
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/ingress.yaml
echo -e "${GREEN}✔ Ingress controllers and autoscalers mapped.${NC}"

# 6. Summary Telemetry
echo -e "\n${YELLOW}[6/6] Collecting active cluster pods state...${NC}"
echo -e "${CYAN}--------------------------------------------------------------------${NC}"
kubectl get pods -o wide
echo -e "${CYAN}--------------------------------------------------------------------${NC}"
echo -e "${GREEN}✔ SUCCESS: OncoSight enterprise healthcare AI platform is active!${NC}"
echo -e "${GREEN}Ingress Gateway routes exposed at: https://oncosight.ai/${NC}"
echo -e "${CYAN}====================================================================${NC}"
