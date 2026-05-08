
# LitStream Phase 2 Configuration Template

**Instructions**: Fill out this template with your actual values, then use the "REPLACEMENT GUIDE" section at the bottom to systematically update all your documentation files.

## 🏢 **Team & Ownership Information**

### Primary Team Members
```
ENGINEERING_LEAD_NAME = "John Smith"
ENGINEERING_BACKUP_NAME = "Jane Doe"
ENGINEERING_CONTACT_PATH = "Slack: @john.smith, Phone: +1-555-0101"

PLATFORM_LEAD_NAME = "Mike Johnson"
PLATFORM_BACKUP_NAME = "Sarah Wilson"
PLATFORM_CONTACT_PATH = "Slack: @mike.johnson, Phone: +1-555-0102"

SECURITY_LEAD_NAME = "Alex Chen"
SECURITY_BACKUP_NAME = "Lisa Rodriguez"
SECURITY_CONTACT_PATH = "Slack: @alex.chen, Phone: +1-555-0103"

ONCALL_PRIMARY_NAME = "DevOps Team"
ONCALL_BACKUP_NAME = "Platform Team"
ONCALL_CONTACT_PATH = "PagerDuty: litstream-oncall, Slack: #incidents"

PRODUCT_OWNER_NAME = "Emma Thompson"
PRODUCT_BACKUP_NAME = "David Kim"
PRODUCT_CONTACT_PATH = "Slack: @emma.thompson, Email: emma@company.com"
```

## 🌐 **Environment & Infrastructure**

### GCP Configuration
```
GCP_PROJECT_ID = "litstream-prod-12345"
GCP_REGION = "us-central1"
BILLING_ACCOUNT_ID = "012345-6789AB-CDEF01"
AR_REPO = "web-images"
```

### Domain & Service Configuration
```
CUSTOM_DOMAIN = "app.litstream.com"
SERVICE_NAME = "litstream-web"
```

### Sample Content (for testing)
```
SAMPLE_BOOK_SLUG = "the-great-gatsby"
SAMPLE_AUTHOR_SLUG = "f-scott-fitzgerald"
SAMPLE_CATEGORY_SLUG = "classic-literature"
```

### External Services
```
SENTRY_PROJECT = "litstream-frontend"
SENTRY_ORG = "your-org"
```

## 📋 **Milestone Ownership Assignment**

### Milestone Owners (who will execute each milestone)
```
M0_OWNER = "John Smith"
M1_OWNER = "Alex Chen"
M2_OWNER = "John Smith"
M3_OWNER = "Mike Johnson"
M4_OWNER = "Mike Johnson"
M5_OWNER = "Mike Johnson"
M6_OWNER = "Mike Johnson"
M7A_OWNER = "DevOps Team"
M7B_OWNER = "DevOps Team"
```

### P0 Test Owners (who will validate each test)
```
P01_OWNER = "Alex Chen"
P02_OWNER = "John Smith"
P03_OWNER = "John Smith"
P04_OWNER = "Mike Johnson"
P05_OWNER = "DevOps Team"
P06_OWNER = "Mike Johnson"
P07_OWNER = "Mike Johnson"
P08_OWNER = "Mike Johnson"
P09_OWNER = "Mike Johnson"
```

## 🔗 **Evidence & Entry IDs**

### Milestone Evidence Entry IDs
```
M0_ENTRY = "M0-001"
M1_ENTRY = "M1-001"
M2_ENTRY = "M2-001"
M3_ENTRY = "M3-001"
M4_ENTRY = "M4-001"
M5_ENTRY = "M5-001"
M6_ENTRY = "M6-001"
M7A_ENTRY = "M7A-001"
M7B_ENTRY = "M7B-001"
```

### P0 Evidence Entry IDs
```
P01_ENTRY = "P01-001"
P02_ENTRY = "P02-001"
P03_ENTRY = "P03-001"
P04_ENTRY = "P04-001"
P05_ENTRY = "P05-001"
P06_ENTRY = "P06-001"
P07_ENTRY = "P07-001"
P08_ENTRY = "P08-001"
P09_ENTRY = "P09-001"
```

## 📅 **Execution Placeholders** (Fill during execution)

### Build & Deployment IDs
```
RELEASE_SHA = "abc1234"
KNOWN_GOOD_REVISION = "litstream-web-00001-abc"
BUILD_ID = "12345678-1234-1234-1234-123456789012"
```

### Evidence Links (Update as you execute)
```
M0_EVIDENCE = "https://console.cloud.google.com/logs/query?project=PROJECT_ID"
M1_EVIDENCE = "https://github.com/yourorg/litstream/commit/COMMIT_SHA"
M2_EVIDENCE = "https://console.cloud.google.com/cloud-build/builds/BUILD_ID"
M3_EVIDENCE = "https://console.cloud.google.com/run/detail/REGION/SERVICE_NAME"
M4_EVIDENCE = "https://console.cloud.google.com/artifacts/docker/PROJECT_ID"
M5_EVIDENCE = "https://console.cloud.google.com/cloud-build/builds/BUILD_ID"
M6_EVIDENCE = "https://console.firebase.google.com/project/PROJECT_ID/hosting"
M7A_EVIDENCE = "https://console.cloud.google.com/monitoring/uptime"
M7B_EVIDENCE = "https://console.cloud.google.com/monitoring/dashboards"

P01_EVIDENCE = "Command output showing no secrets in dist/"
P02_EVIDENCE = "cloudbuild.yaml step verification"
P03_EVIDENCE = "curl output for deep link routes"
P04_EVIDENCE = "Security headers verification"
P05_EVIDENCE = "/healthz endpoint verification"
P06_EVIDENCE = "Cloud Run service configuration"
P07_EVIDENCE = "CI security gates verification"
P08_EVIDENCE = "Webhook rebuild verification"
P09_EVIDENCE = "Monitoring and alerting verification"
```

### Status Placeholders
```
PASS_OR_FAIL = "PASS"
STATUS = "COMPLETE"
```

### Incident & Issue Tracking
```
ISSUE_ID = "INC-001"
SEVERITY = "SEV2"
DESCRIPTION = "Sample issue description"
ETA_UTC = "2024-01-15T18:00:00Z"
```

### Timestamps (Update during execution)
```
TIMESTAMP_UTC = "2024-01-15T12:00:00Z"
SIGNOFF_DATE_UTC = "2024-01-15T16:00:00Z"
```

---

## 🔄 **REPLACEMENT GUIDE**

After filling out the template above, use these find/replace operations across ALL your documentation files:

### 1. Team & Ownership Replacements
```bash
# In files: 11-handoff-master-checklist.md, 12-ownership-raci.md, 14-evidence-and-signoff-log.md

REQUIRED_ENGINEERING_LEAD_NAME → [Your ENGINEERING_LEAD_NAME]
REQUIRED_ENGINEERING_BACKUP_NAME → [Your ENGINEERING_BACKUP_NAME]
REQUIRED_ENGINEERING_CONTACT_PATH → [Your ENGINEERING_CONTACT_PATH]

REQUIRED_PLATFORM_LEAD_NAME → [Your PLATFORM_LEAD_NAME]
REQUIRED_PLATFORM_BACKUP_NAME → [Your PLATFORM_BACKUP_NAME]
REQUIRED_PLATFORM_CONTACT_PATH → [Your PLATFORM_CONTACT_PATH]

REQUIRED_SECURITY_LEAD_NAME → [Your SECURITY_LEAD_NAME]
REQUIRED_SECURITY_BACKUP_NAME → [Your SECURITY_BACKUP_NAME]
REQUIRED_SECURITY_CONTACT_PATH → [Your SECURITY_CONTACT_PATH]

REQUIRED_ONCALL_PRIMARY_NAME → [Your ONCALL_PRIMARY_NAME]
REQUIRED_ONCALL_BACKUP_NAME → [Your ONCALL_BACKUP_NAME]
REQUIRED_ONCALL_CONTACT_PATH → [Your ONCALL_CONTACT_PATH]

REQUIRED_PRODUCT_OWNER_NAME → [Your PRODUCT_OWNER_NAME]
REQUIRED_PRODUCT_BACKUP_NAME → [Your PRODUCT_BACKUP_NAME]
REQUIRED_PRODUCT_CONTACT_PATH → [Your PRODUCT_CONTACT_PATH]
```

### 2. Infrastructure Replacements
```bash
# In files: 05-milestone-implementation-plan.md, 06-acceptance-and-test-protocol.md, 07-operational-runbook.md

REQUIRED_GCP_PROJECT_ID → [Your GCP_PROJECT_ID]
REQUIRED_GCP_REGION → [Your GCP_REGION]
REQUIRED_CUSTOM_DOMAIN → [Your CUSTOM_DOMAIN]
REQUIRED_BILLING_ACCOUNT_ID → [Your BILLING_ACCOUNT_ID]
REQUIRED_SAMPLE_BOOK_SLUG → [Your SAMPLE_BOOK_SLUG]
REQUIRED_SAMPLE_AUTHOR_SLUG → [Your SAMPLE_AUTHOR_SLUG]
REQUIRED_SAMPLE_CATEGORY_SLUG → [Your SAMPLE_CATEGORY_SLUG]
```

### 3. Milestone Owner Replacements
```bash
# In files: 11-handoff-master-checklist.md, 14-evidence-and-signoff-log.md

REQUIRED_M0_OWNER → [Your M0_OWNER]
REQUIRED_M1_OWNER → [Your M1_OWNER]
REQUIRED_M2_OWNER → [Your M2_OWNER]
REQUIRED_M3_OWNER → [Your M3_OWNER]
REQUIRED_M4_OWNER → [Your M4_OWNER]
REQUIRED_M5_OWNER → [Your M5_OWNER]
REQUIRED_M6_OWNER → [Your M6_OWNER]
REQUIRED_M7A_OWNER → [Your M7A_OWNER]
REQUIRED_M7B_OWNER → [Your M7B_OWNER]
```

### 4. P0 Test Owner Replacements
```bash
# In files: 11-handoff-master-checklist.md, 14-evidence-and-signoff-log.md

REQUIRED_P01_OWNER → [Your P01_OWNER]
REQUIRED_P02_OWNER → [Your P02_OWNER]
REQUIRED_P03_OWNER → [Your P03_OWNER]
REQUIRED_P04_OWNER → [Your P04_OWNER]
REQUIRED_P05_OWNER → [Your P05_OWNER]
REQUIRED_P06_OWNER → [Your P06_OWNER]
REQUIRED_P07_OWNER → [Your P07_OWNER]
REQUIRED_P08_OWNER → [Your P08_OWNER]
REQUIRED_P09_OWNER → [Your P09_OWNER]
```

### 5. Evidence Entry ID Replacements
```bash
# In files: 14-evidence-and-signoff-log.md

REQUIRED_M0_ENTRY → [Your M0_ENTRY]
REQUIRED_M1_ENTRY → [Your M1_ENTRY]
# ... continue for all milestone and P0 entries
```

### 6. Risk Owner Replacements
```bash
# In file: 08-risk-and-troubleshooting.md

REQUIRED_SECURITY_OWNER → [Your SECURITY_LEAD_NAME]
REQUIRED_PLATFORM_OWNER → [Your PLATFORM_LEAD_NAME]
REQUIRED_ENGINEERING_OWNER → [Your ENGINEERING_LEAD_NAME]
```

---

## 🚀 **Quick Start Commands**

After filling out this template, you can use these commands to quickly update your files:

### Option 1: Manual Find/Replace
Use your text editor's find/replace function across all `.md` files in your documentation directory.

### Option 2: Command Line (Linux/Mac)
```bash
# Example for one replacement across all files
find . -name "*.md" -type f -exec sed -i 's/REQUIRED_ENGINEERING_LEAD_NAME/John Smith/g' {} \;

# Repeat for each placeholder
```

### Option 3: Script-Based Replacement
Create a script that reads this template and performs all replacements automatically.

---

## ✅ **Validation Checklist**

After completing replacements, verify:

- [ ] No `REQUIRED_*` placeholders remain in any documentation
- [ ] All team member names are consistent across files
- [ ] All infrastructure values match your actual environment
- [ ] All evidence entry IDs follow your chosen naming convention
- [ ] Contact paths are accurate and reachable

---

**Note**: Keep this template file for future updates and team onboarding!
