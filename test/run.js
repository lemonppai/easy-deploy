'use strict';

/**
 * 冒烟测试：在项目根目录执行 `node test/run.js`（或 npm test）。
 * 覆盖文件扫描、参数解析、交互流程（打桩 inquirer）与非交互校验。
 */

const assert = require('node:assert');
const path = require('node:path');
const Module = require('node:module');

const { resolveInputs, globParent } = require('../src/deploy/plan');
const { normalizeRemoteDir, parseArgs } = require('../src/cli/args');

const promptsPath = require.resolve('../src/cli/prompts');

function stubPrompts(answers) {
  Module._cache[promptsPath] = {
    id: promptsPath,
    filename: promptsPath,
    loaded: true,
    exports: {
      askSelect: async () => answers.select.shift(),
      askInput: async () => answers.input.shift(),
      askPassword: async () => answers.password.shift(),
      askConfirm: async () => answers.confirm.shift(),
      separator: () => '---',
    },
  };
  delete require.cache[require.resolve('../src/cli/flow')];
  return require('../src/cli/flow');
}

(async () => {
  // ---- 1. 文件扫描 ----
  const globPlan = await resolveInputs('./src/**/*');
  assert.ok(globPlan.entries.length >= 10, 'glob 应匹配到文件');
  assert.ok(
    globPlan.entries.every((entry) => !entry.relative.startsWith('src/')),
    'glob 根目录应为 ./src，relative 不应带 src 前缀',
  );
  assert.ok(globPlan.entries.some((entry) => entry.relative === 'cli/flow.js'));

  const dirPlan = await resolveInputs('./src/cli');
  assert.strictEqual(dirPlan.entries.length, 4);
  assert.deepStrictEqual(
    dirPlan.entries.map((entry) => entry.relative),
    ['args.js', 'flow.js', 'help.js', 'prompts.js'],
  );

  const filePlan = await resolveInputs('./package.json');
  assert.deepStrictEqual(filePlan.entries.map((entry) => entry.relative), ['package.json']);

  const ignorePlan = await resolveInputs(['./src/**/*', '!./src/**/*.js']);
  assert.strictEqual(ignorePlan.entries.length, 0, '排除项应生效');

  const multiPlan = await resolveInputs(['./src/cli/args.js', './src/cli/help.js']);
  assert.strictEqual(multiPlan.entries.length, 2);

  const emptyPlan = await resolveInputs('./not-exist-dir/**/*');
  assert.strictEqual(emptyPlan.entries.length, 0);
  assert.ok(emptyPlan.warnings.length > 0);

  assert.strictEqual(globParent(path.resolve('dist/**/*.html')), path.resolve('dist'));

  // ---- 2. 参数解析 ----
  assert.strictEqual(normalizeRemoteDir('home/upload/'), '/home/upload');
  assert.strictEqual(normalizeRemoteDir('\\home\\www'), '/home/www');

  const cli = parseArgs([
    '--type',
    'ftp',
    '--host=1.2.3.4',
    '--port',
    '2121',
    '--user',
    'u',
    '--password',
    'p',
    '--dist',
    './dist/**/*,./public/*.json',
    '--remote',
    '/www/',
    '--clean',
    '--dry-run',
  ]);
  assert.strictEqual(cli.type, 'ftp');
  assert.strictEqual(cli.port, 2121);
  assert.deepStrictEqual(cli.dist, ['./dist/**/*', './public/*.json']);
  assert.strictEqual(cli.remoteDir, '/www');
  assert.strictEqual(cli.clean, true);
  assert.strictEqual(cli.cleanExplicit, true);
  assert.strictEqual(cli.dryRun, true);

  assert.throws(() => parseArgs(['--nope']), /未知参数/);
  assert.throws(() => parseArgs(['--type', 's3']), /不支持的部署方式/);

  // ---- 3. 交互流程：FTP ----
  let flow = stubPrompts({
    select: ['ftp'],
    input: ['ftp.example.com', '21', 'www', './src/cli', '/wwwroot/site'],
    password: ['secret'],
    confirm: [false, false, true], // FTPS? / 清空目录? / 确认部署
  });
  const ftpCollected = await flow.collectInteractive(parseArgs([]));
  assert.ok(ftpCollected, '交互流程应返回配置');
  assert.strictEqual(ftpCollected.config.type, 'ftp');
  assert.strictEqual(ftpCollected.config.host, 'ftp.example.com');
  assert.strictEqual(ftpCollected.config.port, 21);
  assert.strictEqual(ftpCollected.config.username, 'www');
  assert.strictEqual(ftpCollected.config.password, 'secret');
  assert.strictEqual(ftpCollected.config.remoteDir, '/wwwroot/site');
  assert.strictEqual(ftpCollected.config.secure, false);
  assert.strictEqual(ftpCollected.config.commands.length, 0);
  assert.strictEqual(ftpCollected.plan.entries.length, 4);

  // ---- 4. 交互流程：SSH + 多条远程命令 ----
  flow = stubPrompts({
    select: ['ssh', 'password'],
    input: [
      '10.0.0.9',
      '2222',
      'deploy',
      './src/cli',
      '/var/www/app',
      'systemctl reload nginx',
      'echo done',
      '',
    ],
    password: ['secret'],
    confirm: [true, true], // 清空目录? / 确认部署
  });
  const sshCollected = await flow.collectInteractive(parseArgs([]));
  assert.strictEqual(sshCollected.config.type, 'ssh');
  assert.strictEqual(sshCollected.config.port, 2222);
  assert.strictEqual(sshCollected.config.clean, true);
  assert.deepStrictEqual(sshCollected.config.commands, ['systemctl reload nginx', 'echo done']);

  // ---- 5. 非交互模式 ----
  flow = stubPrompts({ select: [], input: [], password: [], confirm: [] });
  const dryRun = await flow.runDeploy([
    '-y',
    '--host',
    '127.0.0.1',
    '--user',
    'root',
    '--password',
    'x',
    '--dist',
    './src/cli',
    '--remote',
    '/home/upload',
    '--dry-run',
  ]);
  assert.strictEqual(dryRun.dryRun, true);
  assert.strictEqual(dryRun.plan.entries.length, 4);

  await assert.rejects(() => flow.runDeploy(['-y', '--dry-run', '--host', '1.1.1.1']), /缺少参数/);

  console.log('\n[TEST] all assertions passed');
})().catch((error) => {
  console.error('[TEST] failed:', error);
  process.exit(1);
});
