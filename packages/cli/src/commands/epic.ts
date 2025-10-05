/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule, Argv } from 'yargs';
import { createCommand } from './epic/create.js';
import { breakCommand } from './epic/break.js';

export const epicCommand: CommandModule = {
  command: 'epic',
  describe: 'Manage epics and planning workflow',
  builder: (yargs: Argv) =>
    yargs
      .command(createCommand)
      .command(breakCommand)
      .demandCommand(1, 'You need at least one command before continuing.')
      .version(false),
  handler: () => {
    // yargs will automatically show help if no subcommand is provided
  },
};
