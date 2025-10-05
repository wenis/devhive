/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { createPlanningGraph, type PlanningState } from 'devhive-workflows';
import { createContentGenerator, AuthType } from '@google/gemini-cli-core';

async function runPlanningWorkflow(idea: string, options: { ux?: boolean }) {
  console.log('🚀 Starting DevHive planning workflow...\n');
  console.log(`Idea: ${idea}\n`);

  // Create local LLM content generator for planning
  const localGenerator = await createContentGenerator(
    {
      authType: AuthType.OPENAI_COMPATIBLE,
      openaiBaseURL: process.env.OPENAI_BASE_URL || 'http://localhost:8080/v1',
      openaiModel: process.env.OPENAI_MODEL || 'llama-3.2-3b',
      apiKey: process.env.OPENAI_API_KEY,
    },
    {} as any, // TODO: Pass actual config
  );

  const abortController = new AbortController();

  // Create and run planning graph
  const graph = createPlanningGraph(localGenerator, abortController.signal);

  const initialState: PlanningState = {
    projectType: 'greenfield',
    includeUX: options.ux || false,
    currentPhase: 'brief',
    userMessage: idea,
    epics: [],
    stories: [],
    validationIssues: [],
    needsUserInput: false,
  };

  console.log('📋 Running planning workflow...');
  console.log('   Analyst → PM → Architect → PO (validate/shard)\n');

  try {
    const result = await graph.invoke(initialState);

    console.log('\n✅ Planning complete!\n');
    console.log(`Epics created: ${result.epics?.length || 0}`);
    console.log(`Stories created: ${result.stories?.length || 0}\n`);

    if (result.epics && result.epics.length > 0) {
      console.log('Epics:');
      result.epics.forEach((epic) => {
        console.log(`  - ${epic.id}: ${epic.title}`);
      });
    }

    console.log('\n📁 Next steps:');
    console.log('  1. Review the generated artifacts in docs/');
    console.log('  2. Run `devhive epic break` to shard into individual files');
    console.log('  3. Run `devhive swarm start` to begin parallel development');
  } catch (error) {
    console.error('\n❌ Planning failed:', error);
    process.exit(1);
  }
}

export const createCommand: CommandModule = {
  command: 'create <idea>',
  describe: 'Create epic with BMAD planning workflow (uses local LLM)',
  builder: (yargs) =>
    yargs
      .positional('idea', {
        describe: 'Project idea or description',
        type: 'string',
        demandOption: true,
      })
      .option('ux', {
        alias: 'u',
        describe: 'Include UX specification phase',
        type: 'boolean',
        default: false,
      }),
  handler: async (argv: any) => {
    await runPlanningWorkflow(argv.idea, { ux: argv.ux });
  },
};
