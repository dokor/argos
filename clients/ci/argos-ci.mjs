#!/usr/bin/env node
import { main } from './src/client.mjs';
const controller = new AbortController();
const stop = () => controller.abort();
process.once('SIGINT', stop); process.once('SIGTERM', stop);
const result = await main(process.argv.slice(2), process.env, { signal: controller.signal });
process.stdout.write(JSON.stringify(result) + '\n');
process.exitCode = result.exitCode;
