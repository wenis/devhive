/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import {
  createPlanningGraph,
  type PlanningState,
  type Epic,
} from 'devhive-workflows';
import { OpenAICompatibleContentGenerator } from 'devhive-core';

async function runPlanningWorkflow(idea: string, options: { ux?: boolean }) {
  console.log('🚀 Starting DevHive planning workflow...\n');
  console.log(`Idea: ${idea}\n`);

  // Create local LLM content generator for planning
  const localGenerator = new OpenAICompatibleContentGenerator({
    baseURL: process.env['OPENAI_BASE_URL'] || 'http://localhost:8080/v1',
    model: process.env['OPENAI_MODEL'] || 'llama-3.2-3b',
    apiKey: process.env['OPENAI_API_KEY'],
  });

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
    // LangGraph requires states with index signatures; use type assertion to bridge the gap
    const result = (await graph.invoke(
      initialState as Record<string, unknown>,
    )) as unknown as PlanningState;

    console.log('\n✅ Planning complete!\n');
    console.log(`Epics created: ${result.epics?.length || 0}`);
    console.log(`Stories created: ${result.stories?.length || 0}\n`);

    if (result.epics && result.epics.length > 0) {
      console.log('Epics:');
      result.epics.forEach((epic: Epic) => {
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
  handler: async (argv) => {
    const idea = argv['idea'] as string;
    const ux = argv['ux'] as boolean;
    await runPlanningWorkflow(idea, { ux });
  },
};
