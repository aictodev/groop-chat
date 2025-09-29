import { execSync } from 'node:child_process';

process.env.ROLLUP_SKIP_NODEJS_BINARY = '1';
process.env.ROLLUP_USE_JS_FALLBACK = '1';

execSync('npx vite build', { stdio: 'inherit' });
