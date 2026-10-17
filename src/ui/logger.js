'use strict';

const chalk = require('chalk');

const symbols = {
  success: '✔',
  warning: '⚠',
  error: '✖',
  info: 'ℹ',
};

const logger = {
  info(message) {
    console.log(message);
  },
  success(message) {
    console.log(`${chalk.green(symbols.success)} ${message}`);
  },
  warn(message) {
    console.log(`${chalk.yellow(symbols.warning)} ${message}`);
  },
  error(message) {
    console.error(`${chalk.red(symbols.error)} ${message}`);
  },
  step(message) {
    console.log(`${chalk.cyan('›')} ${message}`);
  },
  title(message) {
    console.log(`\n${chalk.bold.cyan(message)}`);
  },
  hint(message) {
    console.log(`   ${chalk.gray(message)}`);
  },
  dim: (message) => chalk.gray(message),
  accent: (message) => chalk.hex('#409EFF')(message),
  warnText: (message) => chalk.yellow(message),
  bold: (message) => chalk.bold(message),
};

/**
 * 单行进度渲染：只在真终端里重绘，避免污染日志输出。
 * 返回的 update/done 可以反复调用。
 */
function createProgressRenderer() {
  const enabled = Boolean(process.stderr.isTTY);
  let lastLength = 0;

  return {
    update(text) {
      if (!enabled) return;
      const line = text.length > 100 ? `${text.slice(0, 97)}...` : text;
      process.stderr.write(`\r${' '.repeat(lastLength)}\r${line}`);
      lastLength = line.length;
    },
    done() {
      if (!enabled || lastLength === 0) return;
      process.stderr.write(`\r${' '.repeat(lastLength)}\r`);
      lastLength = 0;
    },
  };
}

module.exports = { logger, symbols, createProgressRenderer };
