#!/usr/bin/env node

// const program = require('commander');
const chalk = require('chalk');
const { say } = require('cfonts');

// program.version(require('../package.json').version);

say('Easy2 Deploy', {
  font: 'simple',
  // colors: ['#409EFF']
});

require('../index.js')();
