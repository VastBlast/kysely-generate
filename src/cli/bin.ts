#!/usr/bin/env node
import { Cli } from './cli';

void new Cli()
  .run({ argv: process.argv.slice(2) })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
