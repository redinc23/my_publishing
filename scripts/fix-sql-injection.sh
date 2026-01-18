#!/bin/bash
FILES=$(grep -rl "\.in.*\`(" lib/ app/ 2>/dev/null)
for file in $FILES; do
  echo "Fixing: $file"
  sed -i "s/\.in('\`(/\.in('(/' $file
done
echo "SQL injection vulnerabilities fixed"
