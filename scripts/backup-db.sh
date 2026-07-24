#!/bin/bash

set -e

echo "📦 Backing up database..."

# Get current date for backup filename
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_${DATE}.sql"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed"
    echo "Install with: npm install -g supabase"
    exit 1
fi

# Create backup
echo "Creating backup: $BACKUP_FILE"
supabase db dump -f "$BACKUP_FILE"

echo "✅ Backup created: $BACKUP_FILE"
echo "💾 Backup size: $(du -h $BACKUP_FILE | cut -f1)"
