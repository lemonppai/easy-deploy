'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseArgs, normalizeRemoteDir } = require('./args');
const { HELP } = require('./help');
const { askSelect, askInput, askPassword, askConfirm, separator } = require('./prompts');
const { resolveInputs } = require('../deploy/plan');
const { deploy } = require('../deploy');
const { logger, createProgressRenderer } = require('../ui/logger');
const { pad, fmtBytes, fmtDuration, percent } = require('../utils/format');

const VERSION = require('../../package.json').version;

const DEFAULT_PORT = { ssh: 22, ftp: 21 };
const TYPE_LABEL = { ssh: 'SSH / SFTP', ftp: 'FTP / FTPS' };
const TYPE_HINT = {
  ssh: 'Linux 服务器，可上传后执行远程命令',
  ftp: '虚拟主机 / Windows 空间，只能传文件',
};
const MARKS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

const trim = (value) => String(value ?? '').trim().replace(/^"(.*)"$/, '$1');
const splitPaths = (raw) =>
  trim(raw)
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter(Boolean);

function expandHome(target) {
  const value = trim(target);
  if (value === '~') return os.homedir();
  if (value.startsWith('~/') || value.startsWith('~\\')) return path.join(os.homedir(), value.slice(2));
  return value;
}

function maskPassword(config) {
  if (config.privateKeyPath) return `私钥 ${config.privateKeyPath}${config.passphrase ? '（含口令）' : ''}`;
  if (config.agent) return 'ssh-agent';
  return config.password ? '密码' : '未提供';
}

/** 扫描本地文件 */
async function scanInputs(config) {
  return resolveInputs(config.dist, { cwd: process.cwd() });
}

function printSummary(config, plan) {
  const localLabel = Array.isArray(config.dist) ? config.dist.join(', ') : String(config.dist);
  console.log('');
  console.log(
    `   ${pad('部署方式', 10)} ${logger.accent(TYPE_LABEL[config.type])} ${logger.dim(`· ${TYPE_HINT[config.type]}`)}`,
  );
  console.log(`   ${pad('服务器', 10)} ${config.host}:${config.port}`);
  console.log(`   ${pad('登录用户', 10)} ${config.username} ${logger.dim(`（${maskPassword(config)}）`)}`);
  console.log(
    `   ${pad('本地文件', 10)} ${localLabel} ${logger.dim(`→ ${plan.entries.length} 个文件，${fmtBytes(plan.totalBytes)}`)}`,
  );
  console.log(`   ${pad('远程目录', 10)} ${logger.accent(config.remoteDir)}`);
  console.log(
    `   ${pad('清空目录', 10)} ${config.clean ? logger.warnText('是（会先删除目录内所有内容）') : '否'}`,
  );
  if (config.type === 'ssh') {
    console.log(
      `   ${pad('远程命令', 10)} ${config.commands.length ? config.commands.join(' ; ') : logger.dim('无')}`,
    );
  }
  console.log(`   ${pad('并发数', 10)} ${config.concurrency}`);
  console.log('');
}

function printResult(result) {
  console.log('');
  logger.success('部署完成');
  console.log('');
  console.log(`   ${pad('文件数量', 12)} ${result.files}`);
  console.log(`   ${pad('上传大小', 12)} ${fmtBytes(result.bytes)}`);
  console.log(`   ${pad('远程目录', 12)} ${logger.accent(result.remoteDir)}`);
  console.log(`   ${pad('耗时', 12)} ${fmtDuration(result.durationMs)}`);
  for (const item of result.commands ?? []) {
    const output = (item.stdout || item.stderr || '').trim();
    console.log(`   ${pad('远程命令', 12)} ${item.command} ${logger.dim('✔')}`);
    if (output) {
      for (const line of output.split(/\r?\n/).slice(0, 10)) console.log(`   ${' '.repeat(13)}${logger.dim(line)}`);
    }
  }
  console.log('');
}

/** 交互式收集全部配置 */
async function collectInteractive(cli) {
  const config = { ...cli };
  let step = 0;
  const head = (text) => logger.title(`${MARKS[step++] ?? '•'} ${text}`);

  // ① 部署方式
  head('选择部署方式');
  logger.hint('两种方式的登录信息都需要在下面手动填写，不会读取任何本地配置文件');
  config.type =
    cli.type ??
    (await askSelect({
      message: '使用哪种方式发布？',
      choices: [
        { name: `SSH / SFTP   ${logger.dim(TYPE_HINT.ssh)}`, value: 'ssh' },
        { name: `FTP / FTPS   ${logger.dim(TYPE_HINT.ftp)}`, value: 'ftp' },
        separator(),
        { name: '✖  取消', value: null },
      ],
    }));
  if (!config.type) {
    logger.warn('已取消');
    return null;
  }

  // ② 连接信息
  head(`填写 ${TYPE_LABEL[config.type]} 连接信息`);
  config.host =
    cli.host ??
    trim(
      await askInput({
        message: '服务器地址（IP 或域名）',
        validate: (value) => (trim(value) ? true : '请输入服务器地址'),
      }),
    );

  const defaultPort = String(cli.port ?? DEFAULT_PORT[config.type]);
  config.port = Number(
    cli.port ??
      (await askInput({
        message: '端口',
        default: defaultPort,
        validate: (value) => {
          const num = Number(trim(value));
          return Number.isInteger(num) && num > 0 && num < 65536 ? true : '请输入 1-65535 之间的整数';
        },
      })),
  );

  config.username =
    cli.username ??
    trim(
      await askInput({
        message: config.type === 'ftp' ? 'FTP 用户名' : 'SSH 用户名',
        validate: (value) => (trim(value) ? true : '请输入登录用户名'),
      }),
    );

  if (cli.password || cli.privateKeyPath || cli.agent) {
    config.password = cli.password;
    config.privateKeyPath = cli.privateKeyPath;
    config.passphrase = cli.passphrase;
    config.agent = cli.agent;
  } else if (config.type === 'ftp') {
    config.password = await askPassword({
      message: 'FTP 密码',
      validate: (value) => (value ? true : '请输入密码'),
    });
    if (!cli.secure && (await askConfirm({ message: '是否使用 FTPS 加密连接？', default: false }))) {
      config.secure = true;
    }
  } else {
    const method = await askSelect({
      message: 'SSH 认证方式',
      choices: [
        { name: '密码登录', value: 'password' },
        { name: '私钥文件', value: 'key' },
        { name: '使用 ssh-agent（已加载的私钥）', value: 'agent' },
      ],
    });

    if (method === 'password') {
      config.password = await askPassword({
        message: 'SSH 密码',
        validate: (value) => (value ? true : '请输入密码'),
      });
    } else if (method === 'key') {
      config.privateKeyPath = await askKeyPath();
      if (await askConfirm({ message: '私钥是否设置了口令（passphrase）？', default: false })) {
        config.passphrase = await askPassword({ message: '私钥口令', validate: (v) => (v ? true : '请输入口令') });
      }
    } else {
      config.agent = true;
    }
  }

  // ③ 本地文件
  let plan;
  if (cli.dist.length) {
    config.dist = cli.dist;
    plan = await scanInputs(config);
    for (const warning of plan.warnings) logger.warn(warning);
    if (!plan.entries.length) throw new Error(`没有找到可上传的文件：${config.dist.join(', ')}`);
  } else {
    for (;;) {
      head('选择要上传的本地文件');
      logger.hint('支持目录、单个文件或 glob（如 ./dist/**/*）；目录表示上传目录里的内容');
      const raw = await askInput({ message: '本地文件路径', default: './dist/**/*' });
      config.dist = splitPaths(raw);
      if (!config.dist.length) {
        logger.warn('请输入至少一个路径');
        continue;
      }
      plan = await scanInputs(config);
      for (const warning of plan.warnings) logger.warn(warning);
      if (plan.entries.length) break;
      logger.error('没有匹配到任何文件，请重新输入');
    }
    logger.success(`已匹配 ${plan.entries.length} 个文件，合计 ${fmtBytes(plan.totalBytes)}`);
  }

  // ④ 远程目录
  head('设置远程目录');
  config.remoteDir = normalizeRemoteDir(
    cli.remoteExplicit
      ? cli.remoteDir
      : await askInput({
          message: '上传到服务器的哪个目录（不存在会自动创建）',
          default: normalizeRemoteDir(cli.remoteDir),
          validate: (value) => (trim(value) ? true : '请输入远程目录'),
        }),
  );
  if (config.remoteDir === '/') throw new Error('远程目录不能是根目录 /，请指定一个子目录');

  config.clean = cli.cleanExplicit
    ? cli.clean
    : await askConfirm({
        message: `上传前是否清空 ${config.remoteDir}（会删除目录内所有内容）？`,
        default: false,
      });

  // ⑤ 远程命令（仅 ssh）
  if (config.type === 'ssh') {
    head('上传后执行的远程命令（可选）');
    if (cli.commands.length) {
      config.commands = cli.commands;
    } else {
      logger.hint('例如：systemctl reload nginx；逐条输入，直接回车结束');
      const commands = [];
      for (;;) {
        const command = trim(await askInput({ message: commands.length ? '继续输入命令（回车结束）' : '远程命令（回车跳过）', default: '' }));
        if (!command) break;
        commands.push(command);
        logger.success(`已添加命令：${command}`);
      }
      config.commands = commands;
    }
  } else {
    config.commands = [];
  }

  // ⑥ 确认
  head('确认部署信息');
  printSummary(config, plan);
  const confirmed = await askConfirm({ message: '确认开始部署？', default: true });
  if (!confirmed) {
    logger.warn('已取消部署');
    return null;
  }

  return { config, plan };
}

async function askKeyPath() {
  for (;;) {
    const input = await askInput({
      message: '私钥文件路径',
      default: '~/.ssh/id_rsa',
      validate: (value) => (trim(value) ? true : '请输入私钥路径'),
    });
    const resolved = path.resolve(expandHome(input));
    if (fs.existsSync(resolved)) return resolved;
    logger.error(`私钥文件不存在：${resolved}`);
  }
}

/** 非交互模式：直接校验参数 */
function normalizeCli(cli) {
  const type = cli.type ?? 'ssh';
  const config = {
    ...cli,
    type,
    port: cli.port ?? DEFAULT_PORT[type],
    remoteDir: normalizeRemoteDir(cli.remoteDir),
    commands: type === 'ssh' ? cli.commands : [],
  };

  const missing = [];
  if (!config.host) missing.push('--host');
  if (!config.username) missing.push('--user');
  if (config.password == null && !config.privateKeyPath && !config.agent) {
    missing.push('--password / --private-key');
  }
  if (missing.length) {
    throw new Error(
      `非交互模式缺少参数：${missing.join('、')}。补全参数，或去掉 --yes 改用交互式引导`,
    );
  }
  if (config.remoteDir === '/') throw new Error('远程目录不能是根目录 /，请指定一个子目录');
  return config;
}

function printFileList(plan, limit = 30) {
  console.log(`   ${logger.dim(`文件清单（最多显示 ${limit} 条）`)}`);
  for (const entry of plan.entries.slice(0, limit)) {
    console.log(`   ${pad(entry.relative, 48)} ${logger.dim(fmtBytes(entry.size))}`);
  }
  if (plan.entries.length > limit) {
    console.log(`   ${logger.dim(`…… 另有 ${plan.entries.length - limit} 个文件`)}`);
  }
  console.log('');
}

async function runDeploy(argv = process.argv.slice(2)) {
  const cli = parseArgs(argv);
  if (cli.help) {
    console.log(HELP);
    return null;
  }
  if (cli.version) {
    console.log(VERSION);
    return null;
  }

  const interactive = !cli.yes;
  if (interactive && !process.stdin.isTTY) {
    throw new Error(
      '当前环境不是交互式终端，无法进行选择操作。请改用非交互模式，例如：\n' +
        '  easy2-deploy -y --type ssh --host 1.2.3.4 --user root --password *** --dist ./dist --remote /home/www/dist',
    );
  }

  let config;
  let plan;

  if (interactive) {
    const collected = await collectInteractive(cli);
    if (!collected) return null;
    ({ config, plan } = collected);
  } else {
    config = normalizeCli(cli);
    plan = await scanInputs(config);
    for (const warning of plan.warnings) logger.warn(warning);
    if (!plan.entries.length) throw new Error('没有找到可上传的文件，请检查 --dist 是否正确');
    printSummary(config, plan);
  }

  if (config.dryRun) {
    if (!plan.entries.length) throw new Error('没有找到可上传的文件，请检查 --dist 是否正确');
    console.log('');
    logger.warn('dry-run：只列出将要上传的文件，不会连接服务器');
    printFileList(plan, plan.entries.length);
    return { dryRun: true, plan };
  }

  const progress = createProgressRenderer();
  const hooks = {
    onStep(step) {
      progress.done();
      logger.step(step);
    },
    onProgress(event) {
      progress.update(
        `上传 ${event.current}/${event.total}  ${event.relative}  ${percent(event.bytes, event.totalBytes)}`,
      );
    },
  };

  try {
    const result = await deploy({ ...config, plan }, hooks);
    progress.done();
    printResult(result);
    return result;
  } finally {
    progress.done();
  }
}

module.exports = { runDeploy, collectInteractive, printSummary, printResult, scanInputs };
