'use strict';

const path = require('node:path');
const { NodeSSH } = require('node-ssh');

/** 远端 shell 参数安全引用 */
function quote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/** 固定并发池：逐个取任务，避免一次性打开过多 SFTP 句柄 */
async function runPool(items, limit, worker) {
  let cursor = 0;
  const size = Math.max(1, Math.min(Number(limit) || 1, items.length));
  const runners = Array.from({ length: size }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

function sftpMkdir(sftp, dir) {
  return new Promise((resolve) => {
    sftp.mkdir(dir, { mode: 0o755 }, () => resolve());
  });
}

/** 逐级创建远端目录，并对已建目录做缓存 */
async function ensureRemoteDir(sftp, dir, cache) {
  const target = path.posix.normalize(dir);
  if (!target || target === '.' || cache.has(target)) return;
  const parent = path.posix.dirname(target);
  if (parent && parent !== target && parent !== '/' && parent !== '.') {
    await ensureRemoteDir(sftp, parent, cache);
  }
  await sftpMkdir(sftp, target);
  cache.add(target);
}

function fastPut(sftp, local, remote, onStep) {
  return new Promise((resolve, reject) => {
    sftp.fastPut(
      local,
      remote,
      {
        concurrency: 16,
        chunkSize: 32 * 1024,
        step: (transferred, _chunk, total) => onStep?.(transferred, total),
      },
      (error) => (error ? reject(error) : resolve()),
    );
  });
}

async function execChecked(ssh, command, label) {
  const result = await ssh.execCommand(command);
  if (result.code !== 0) {
    const detail = (result.stderr || result.stdout || '').trim().split(/\r?\n/).slice(-5).join('\n');
    throw new Error(`${label ?? '远程命令'}执行失败（exit ${result.code}）：${command}${detail ? `\n${detail}` : ''}`);
  }
  return result;
}

/**
 * SSH(SFTP) 部署：
 * 1. 可选清空远程目录
 * 2. 并发上传文件，保留相对路径
 * 3. 可选执行远程命令（如解压、重启服务）
 */
async function deploySsh(config, plan, hooks = {}) {
  const ssh = new NodeSSH();
  const remoteDir = config.remoteDir;
  const total = plan.entries.length;

  await ssh.connect({
    host: config.host,
    port: config.port || 22,
    username: config.username,
    password: config.password,
    privateKeyPath: config.privateKeyPath,
    passphrase: config.passphrase,
    agent: config.agent ? process.env.SSH_AUTH_SOCK : undefined,
    readyTimeout: 30_000,
  });

  try {
    hooks.onStep?.('准备远程目录');
    await execChecked(ssh, `mkdir -p ${quote(remoteDir)}`, '创建远程目录');
    if (config.clean) {
      hooks.onStep?.('清空远程目录');
      await execChecked(
        ssh,
        `find ${quote(remoteDir)} -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +`,
        '清空远程目录',
      );
    }

    hooks.onStep?.('上传文件');
    const sftp = await ssh.requestSFTP();
    const cache = new Set(['/']);
    let done = 0;
    let bytes = 0;

    await runPool(plan.entries, config.concurrency || 4, async (entry) => {
      const remote = path.posix.join(remoteDir, entry.relative);
      await ensureRemoteDir(sftp, path.posix.dirname(remote), cache);
      await fastPut(sftp, entry.local, remote, (transferred) => {
        hooks.onProgress?.({
          current: done,
          total,
          relative: entry.relative,
          bytes: bytes + transferred,
          totalBytes: plan.totalBytes,
        });
      });
      done += 1;
      bytes += entry.size;
      hooks.onProgress?.({
        current: done,
        total,
        relative: entry.relative,
        bytes,
        totalBytes: plan.totalBytes,
        finished: true,
      });
    });

    const commands = [];
    for (const command of config.commands ?? []) {
      hooks.onStep?.(`执行远程命令：${command}`);
      const result = await execChecked(ssh, command, '远程命令');
      commands.push({ command, stdout: result.stdout, stderr: result.stderr, code: result.code });
    }

    return { transport: 'ssh', uploaded: done, uploadedBytes: bytes, commands };
  } finally {
    ssh.dispose();
  }
}

module.exports = { deploySsh, runPool, quote };
