/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule, Argv } from 'yargs';
import { startCommand } from './swarm/start.js';
import { statusCommand } from './swarm/status.js';

export const swarmCommand: CommandModule = {
  command: 'swarm',
  describe: 'Manage parallel development swarm',
  builder: (yargs: Argv) =>
    yargs
      .command(startCommand)
      .command(statusCommand)
      .demandCommand(1, 'You need at least one command before continuing.')
      .version(false),
  handler: () => {
    // yargs will automatically show help if no subcommand is provided
  },
};
