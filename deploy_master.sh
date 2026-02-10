#!/bin/bash

# ==============================================================================
# 🚀 MANGU MASTER LAUNCH SEQUENCE
# ==============================================================================

# Config
APP_NAME="publishing-house-web"
REGION="us-central1"
REPO_NAME="publishing-repo"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}
███    ███  █████  ███    ██  ██████  ██    ██ 
████  ████ ██   ██ ████   ██ ██       ██    ██ 
██ ████ ██ ███████ ██ ██  ██ ██   ███ ██    ██ 
██  ██  ██ ██   ██ ██  ██ ██ ██    ██ ██    ██ 
██      ██ ██   ██ ██   ████  ██████   ██████  
${NC}"
echo -e "${GREEN}>>> PRODUCTION LAUNCH INITIATED <<<${NC}\n"

# ==============================================================================
# PHASE 1: SYSTEM DIAGNOSTICS
# ==============================================================================
echo -e "${YELLOW}[Phase 1] Checking Critical Systems...${NC}"

# Check Tools
for cmd in gcloud supabase git curl; do
    if ! command -v $cmd &> /dev/null; then
        echo -e "${RED}❌ Missing command: $cmd${NC}"
        echo "Please install it before proceeding."
        exit 1
    fi
done
echo -e "${GREEN}✔ All CLI tools detected.${NC}"

# Check Auth
echo -n "Checking Google Cloud Auth... "
if ! gcloud auth list --format="value(account)" | grep -q "@"; then
    echo -e "${RED}FAIL${NC}"
    echo "Please run: gcloud auth login"
    exit 1
else
    echo -e "${GREEN}OK${NC}"
fi

# Check Secrets
echo -n "Checking .env.production... "
if [ ! -f ".env.production" ]; then
    echo -e "${RED}MISSING${NC}"
    echo "Creating template..."
    touch .env.production
    echo "NEXT_PUBLIC_SUPABASE_URL=" >> .env.production
    echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=" >> .env.production
    echo "Please fill out .env.production and try again."
    exit 1
else
    echo -e "${GREEN}FOUND${NC}"
fi

# ==============================================================================
# PHASE 2: TARGET ACQUISITION
# ==============================================================================
echo -e "\n${YELLOW}[Phase 2] Infrastructure Configuration...${NC}"

# Get Project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" == "(unset)" ]; then
    echo -e "${YELLOW}Enter Google Cloud Project ID:${NC}"
    read -r PROJECT_ID
    gcloud config set project $PROJECT_ID
fi
echo -e "Target Project: ${GREEN}$PROJECT_ID${NC}"

# Enable APIs
echo "Ensuring APIs are enabled..."
gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    --project=$PROJECT_ID --quiet

# Create Artifact Repo if missing
if ! gcloud artifacts repositories describe $REPO_NAME --location=$REGION --project=$PROJECT_ID >/dev/null 2>&1; then
    echo "Creating Docker Repository..."
    gcloud artifacts repositories create $REPO_NAME \
        --repository-format=docker \
        --location=$REGION \
        --description="Docker repository for $APP_NAME" \
        --project=$PROJECT_ID --quiet
fi

# ==============================================================================
# PHASE 3: DATABASE SYNCHRONIZATION
# ==============================================================================
echo -e "\n${YELLOW}[Phase 3] Database Sync (Supabase)...${NC}"
read -p "Do you want to push migrations to Supabase Production? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Linking to remote project... (Enter Reference ID)${NC}"
    read -p "Enter Supabase Project Ref (e.g. abcdefghijklm): " SUPA_REF
    supabase link --project-ref "$SUPA_REF"

    echo -e "${YELLOW}Pushing schema...${NC}"
    supabase db push
    echo -e "${GREEN}✔ Database synchronized.${NC}"
else
    echo "Skipping database sync."
fi

# ==============================================================================
# PHASE 4: LAUNCH (BUILD & DEPLOY)
# ==============================================================================
echo -e "\n${YELLOW}[Phase 4] Build & Deploy Sequence...${NC}"

# Load Env Vars
ENV_STRING=""
while IFS='=' read -r key value || [ -n "$key" ]; do
    if [[ ! $key =~ ^# ]] && [[ -n $key ]]; then
        value="${value%\"}"
        value="${value#\"}"
        ENV_STRING="${ENV_STRING}${key}=${value},"
    fi
done < .env.production
ENV_STRING=${ENV_STRING%,}

# Build
echo -e "Building Container Image..."
gcloud builds submit --tag "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$APP_NAME:latest" . --project=$PROJECT_ID

# Deploy
echo -e "Deploying to Cloud Run..."
gcloud run deploy $APP_NAME \
    --image "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$APP_NAME:latest" \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --memory 512Mi \
    --max-instances 10 \
    --set-env-vars="$ENV_STRING" \
    --project=$PROJECT_ID

# ==============================================================================
# PHASE 5: POST-LAUNCH VERIFICATION
# ==============================================================================
echo -e "\n${YELLOW}[Phase 5] Verification...${NC}"

SERVICE_URL=$(gcloud run services describe $APP_NAME --platform managed --region $REGION --format 'value(status.url)' --project=$PROJECT_ID)

echo -n "Pinging $SERVICE_URL... "
HTTP_STATUS=$(curl -o /dev/null -s -w "%{http_code}\n" "$SERVICE_URL")

if [ "$HTTP_STATUS" == "200" ]; then
    echo -e "${GREEN}SUCCESS (HTTP 200)${NC}"
    echo -e "\n${GREEN}🚀 MISSION COMPLETE. MANGU IS LIVE.${NC}"
    echo -e "URL: $SERVICE_URL"
else
    echo -e "${RED}WARNING (HTTP $HTTP_STATUS)${NC}"
    echo "The service deployed but returned a non-200 status. Check logs."
fi
