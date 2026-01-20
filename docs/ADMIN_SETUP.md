# Admin Setup Automation Guide

This guide explains how to use the automated scripts for setting up, verifying, and cleaning up GitHub environments, secrets, and workflows across multiple repositories.

## Overview

The automation suite consists of three main scripts and a GitHub Actions workflow:

-   `setup-envs.sh`: Creates environments (`dev`, `prod`), sets secrets (`DEPLOY_KEY`), and commits a CI workflow.
-   `cleanup-envs.sh`: Removes environments and workflows (useful for rollback or testing).
-   `verify-setup.sh`: Verifies that environments, secrets, and workflows exist and are accessible.
-   `.github/workflows/admin-setup.yml`: A GitHub Actions workflow to run these scripts remotely.

## Prerequisites

-   **GitHub CLI (`gh`)**: Required for local execution.
-   **GitHub PAT (Personal Access Token)**: Required for authentication, with `repo` scope.

## Configuration: `repos.txt`

All scripts rely on a `repos.txt` file to define the target repositories. The format is:

```text
owner/repo-name|secret-value|branch-name
```

-   **`owner/repo-name`**: The full repository name (e.g., `your-org/app-one`).
-   **`secret-value`**: The value for the `DEPLOY_KEY` secret.
-   **`branch-name`**: (Optional) The default branch to target (defaults to `main` if omitted).

**Example:**
```text
your-org/app-one|prod-secret-1|main
your-org/app-two|prod-secret-2|main
your-org/app-three|prod-secret-3|develop
```

## Usage

### 1. Local Execution

Ensure you have the GitHub CLI installed and authenticated:

```bash
gh auth login
```

#### Setup Environments

To set up environments and secrets:

```bash
# Export your PAT if not using gh auth directly, though the script prefers GH_PAT env var
export GH_PAT=your_token_here

# Run the setup script
./setup-envs.sh repos.txt
```

**Options:**
-   `DRY_RUN=true`: Run in dry-run mode to see what changes would be made without applying them.

```bash
DRY_RUN=true ./setup-envs.sh repos.txt
```

#### Verify Setup

To verify that everything was set up correctly:

```bash
./verify-setup.sh repos.txt
```

#### Cleanup (Rollback)

**⚠️ CAUTION:** This will delete environments and remove workflows.

```bash
./cleanup-envs.sh repos.txt
```

### 2. GitHub Actions (CI/CD)

You can run the setup process directly from the GitHub Actions tab in this repository.

1.  Go to the **Actions** tab.
2.  Select the **Admin Setup Environments** workflow.
3.  Click **Run workflow**.
4.  (Optional) Check **Dry run** to validate without changes.
5.  (Optional) Check **Skip repository validation** if you know the repos are correct but not accessible to the validation step (e.g., if using a different token scope).

**Note:** The workflow uses the `GH_PAT` secret stored in this repository to authenticate with the target repositories. Ensure this secret is set in your repository settings.

## Troubleshooting

-   **Authentication Failed:** Ensure your `GH_PAT` has the `repo` scope.
-   **Repo Not Found:** Check the repository name in `repos.txt` and ensure the user/token has access to it.
-   **Workflow Already Exists:** The setup script will skip committing the workflow if it already exists to avoid overwriting custom changes.
