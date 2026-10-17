'use strict';

const { resolveInputs } = require('./plan');
const { deploySsh } = require('./ssh');
const { deployFtp } = require('./ftp');

/**
 * 部署入口（可编程调用）。
 * 配置项全部由调用方给出，不再读取 deploy.config.js。
 *
 * @param {object} config
 * @param {'ssh'|'ftp'} config.type
 * @param {string} config.host
 * @param {number} [config.port]
 * @param {string} config.username
 * @param {string} [config.password]
 * @param {string} [config.privateKeyPath]
 * @param {string} [config.passphrase]
 * @param {boolean} [config.agent]
 * @param {boolean} [config.secure]
 * @param {string|string[]} config.dist
 * @param {string} config.remoteDir
 * @param {boolean} [config.clean]
 * @param {string[]} [config.commands]
 * @param {number} [config.concurrency]
 * @param {object} [hooks] onStep / onProgress
 */
async function deploy(config, hooks = {}) {
  if (!config || typeof config !== 'object') throw new Error('缺少部署配置');
  if (config.type !== 'ssh' && config.type !== 'ftp') {
    throw new Error(`不支持的部署方式：${config.type}（可选 ssh / ftp）`);
  }
  if (!config.host) throw new Error('缺少服务器地址（host）');
  if (!config.username) throw new Error('缺少登录用户（username）');
  if (config.password == null && !config.privateKeyPath && !config.agent) {
    throw new Error('缺少认证信息：请提供密码、私钥文件或使用 ssh-agent');
  }
  if (!config.remoteDir) throw new Error('缺少远程目录（remoteDir）');
  if (config.remoteDir === '/') throw new Error('远程目录不能是根目录 /，请指定一个子目录');

  const plan = config.plan ?? (await resolveInputs(config.dist, { cwd: config.cwd }));
  if (!plan.entries.length) {
    throw new Error('没有找到可上传的文件，请检查本地路径（dist）是否正确');
  }

  const startedAt = Date.now();
  const transport = config.type === 'ftp' ? deployFtp : deploySsh;
  const result = await transport(config, plan, hooks);

  return {
    ...result,
    type: config.type,
    host: config.host,
    remoteDir: config.remoteDir,
    files: plan.entries.length,
    bytes: plan.totalBytes,
    durationMs: Date.now() - startedAt,
  };
}

module.exports = { deploy, resolveInputs };
