'use strict';

const path = require('node:path');
const { Client } = require('basic-ftp');

/**
 * FTP / FTPS 部署：
 * 1. 可选清空远程目录（递归删除后重建）
 * 2. 逐个上传文件，保留相对路径
 */
async function deployFtp(config, plan, hooks = {}) {
  const client = new Client(30_000);
  client.ftp.verbose = Boolean(config.debug);
  const remoteDir = config.remoteDir;
  const total = plan.entries.length;

  try {
    await client.access({
      host: config.host,
      port: config.port || 21,
      user: config.username,
      password: config.password,
      secure: Boolean(config.secure),
    });

    hooks.onStep?.('准备远程目录');
    if (config.clean) {
      hooks.onStep?.('清空远程目录');
      await client.removeDir(remoteDir).catch(() => {});
    }
    await client.cd('/');
    await client.ensureDir(remoteDir);

    hooks.onStep?.('上传文件');
    let done = 0;
    let bytes = 0;

    for (const entry of plan.entries) {
      const remote = path.posix.join(remoteDir, entry.relative);
      const parent = path.posix.dirname(remote);

      await client.cd('/');
      await client.ensureDir(parent);

      let transferred = 0;
      client.trackProgress((info) => {
        transferred = info.bytes;
        hooks.onProgress?.({
          current: done,
          total,
          relative: entry.relative,
          bytes: bytes + transferred,
          totalBytes: plan.totalBytes,
        });
      });

      try {
        await client.uploadFrom(entry.local, path.posix.basename(remote));
      } finally {
        client.trackProgress();
      }

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
    }

    return { transport: 'ftp', uploaded: done, uploadedBytes: bytes, commands: [] };
  } finally {
    client.close();
  }
}

module.exports = { deployFtp };
