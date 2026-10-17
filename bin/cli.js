#!/usr/bin/env node
'use strict';

const { say } = require('cfonts');
const { runDeploy } = require('../src/cli/flow');
const { logger } = require('../src/ui/logger');

say('Easy Deploy', {
  font: 'simple',
  colors: ['#409EFF'],
  space: false,
});

function isCancel(error) {
  return error?.name === 'ExitPromptError' || error?.name === 'AbortPromptError';
}

runDeploy(process.argv.slice(2)).catch((error) => {
  if (isCancel(error)) {
    console.log(`\n${logger.dim('已取消操作')}`);
    process.exit(0);
  }
  logger.error(error?.message ?? String(error));
  if (process.env.DEBUG) console.error(error);
  process.exit(1);
});
