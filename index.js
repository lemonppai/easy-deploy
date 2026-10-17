'use strict';

/**
 * easy2-deploy 的可编程入口。
 * 配置由调用方传入（或走命令行交互），不再读取 deploy.config.js。
 *
 * 用法：
 *   const { deploy } = require('easy2-deploy');
 *   await deploy({
 *     type: 'ssh',
 *     host: '1.2.3.4',
 *     port: 22,
 *     username: 'root',
 *     password: '***',
 *     dist: './dist/**\/*',
 *     remoteDir: '/home/www/dist',
 *     clean: false,
 *     commands: ['systemctl reload nginx'],
 *   });
 *
 * 命令行交互式引导见 bin/cli.js（npx easy2-deploy）。
 */

const { deploy, resolveInputs } = require('./src/deploy');
const { parseArgs, normalizeRemoteDir } = require('./src/cli/args');
const { runDeploy } = require('./src/cli/flow');

module.exports = { deploy, resolveInputs, parseArgs, normalizeRemoteDir, runDeploy };
