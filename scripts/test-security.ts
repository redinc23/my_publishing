import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

const results: any[] = [];

console.log('Running security audit...');

try {
  execSync('npm audit --json', { encoding: 'utf-8' });
  results.push({ test: 'npm audit', passed: true });
} catch (error: any) {
  const audit = JSON.parse(error.stdout);
  results.push({ test: 'npm audit', passed: false, vulnerabilities: audit.metadata.vulnerabilities });
}

writeFileSync('./security-report.json', JSON.stringify(results, null, 2));
console.log('Security report generated: security-report.json');
