'use strict';

const path = require('path');

const DEFAULTS = {
  type: null,
  port: null,
  dist: [],
  remoteDir: '/home/upload',
  clean: false,
  commands: [],
  concurrency: 4,
  secure: false,
  agent: false,
  dryRun: false,
  yes: false,
  debug: false,
  help: false,
  version: false,
  // 标记「用户是否显式指定」，交互模式下用来决定要不要再问
  typeExplicit: false,
  remoteExplicit: false,
  cleanExplicit: false,
};

function splitList(raw) {
  return String(raw)
    .split(/[,;]/)
    .map((item) => item.trim().replace(/^"(.*)"$/, '$1'))
    .filter(Boolean);
}

function splitCommands(raw) {
  return String(raw)
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toNumber(value, label) {
  const num = Number(String(value).trim());
  if (!Number.isFinite(num) || num <= 0) throw new Error(`${label} 必须是正数：${value}`);
  return num;
}

/**
 * 解析命令行参数，不做任何校验，只做归一化。
 * 交互流程会在此基础上补齐缺失项。
 */
function parseArgs(argv = []) {
  const cli = { ...DEFAULTS, dist: [], commands: [] };

  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i] ?? '';
    let inline;
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq > -1) {
        inline = arg.slice(eq + 1);
        arg = arg.slice(0, eq);
      }
    }
    const next = () => (inline !== undefined ? inline : argv[++i]);

    switch (arg) {
      case '--type':
        cli.type = String(next() ?? '').toLowerCase();
        cli.typeExplicit = true;
        break;
      case '-H':
      case '--host':
        cli.host = next();
        break;
      case '-p':
      case '--port':
        cli.port = toNumber(next(), '端口');
        break;
      case '-u':
      case '--user':
      case '--username':
        cli.username = next();
        break;
      case '-w':
      case '--password':
        cli.password = next();
        break;
      case '--private-key':
        cli.privateKeyPath = next();
        break;
      case '--passphrase':
        cli.passphrase = next();
        break;
      case '--agent':
        cli.agent = true;
        break;
      case '--secure':
        cli.secure = true;
        break;
      case '-d':
      case '--dist':
        cli.dist.push(...splitList(next() ?? ''));
        break;
      case '-r':
      case '--remote':
      case '--remote-dir':
        cli.remoteDir = next();
        cli.remoteExplicit = true;
        break;
      case '--clean':
        cli.clean = true;
        cli.cleanExplicit = true;
        break;
      case '--no-clean':
        cli.clean = false;
        cli.cleanExplicit = true;
        break;
      case '-e':
      case '--command':
        cli.commands.push(...splitCommands(next() ?? ''));
        break;
      case '-c':
      case '--concurrency':
        cli.concurrency = toNumber(next(), '并发数');
        break;
      case '--dry-run':
        cli.dryRun = true;
        break;
      case '-y':
      case '--yes':
        cli.yes = true;
        break;
      case '--debug':
        cli.debug = true;
        break;
      case '-h':
      case '--help':
        cli.help = true;
        break;
      case '-v':
      case '--version':
        cli.version = true;
        break;
      default:
        if (arg.startsWith('-')) throw new Error(`未知参数：${arg}`);
        cli.dist.push(...splitList(arg));
    }
  }

  if (cli.type !== null && cli.type !== 'ssh' && cli.type !== 'ftp') {
    throw new Error(`不支持的部署方式：${cli.type}（可选 ssh / ftp）`);
  }
  cli.remoteDir = normalizeRemoteDir(cli.remoteDir);

  return cli;
}

/** 远程目录统一成以 / 开头的 posix 路径 */
function normalizeRemoteDir(dir) {
  const value = String(dir ?? '').trim().replace(/\\/g, '/');
  if (!value) return '/';
  const normalized = path.posix.normalize(value.startsWith('/') ? value : `/${value}`);
  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized;
}

module.exports = { parseArgs, normalizeRemoteDir, DEFAULTS };
