'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const fg = require('fast-glob');

const DEFAULT_DIST = './dist/**/*';
const MAGIC = /[*?[\]{}()!+@]/;

async function statOf(target) {
  try {
    return await fs.stat(target);
  } catch {
    return null;
  }
}

async function walk(dir, bucket = []) {
  const items = await fs.readdir(dir, { withFileTypes: true });
  for (const item of items) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      await walk(full, bucket);
    } else if (item.isFile()) {
      bucket.push(full);
    }
  }
  return bucket;
}

/**
 * 从 glob 里推导「上传根目录」：把第一个通配符之前的路径截断到目录层级。
 *   ./dist/**\/*   → <cwd>/dist
 *   dist/**\/*.js  → <cwd>/dist
 *   src/*.html     → <cwd>
 */
function globParent(pattern) {
  const index = pattern.search(MAGIC);
  let prefix = index === -1 ? pattern : pattern.slice(0, index);
  if (!prefix) return process.cwd();
  if (!/[\\/]$/.test(prefix)) prefix = path.dirname(prefix);
  const resolved = path.resolve(prefix || '.');
  return resolved.endsWith(path.sep) ? resolved.slice(0, -1) || path.sep : resolved;
}

function toPosix(value) {
  return value.split(path.sep).join('/').replace(/^\.\//, '');
}

/**
 * 解析要上传的文件清单。
 * 支持：目录（上传其内容）、单个文件、glob 表达式、以及 ! 开头的排除项。
 */
async function resolveInputs(dist, options = {}) {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const rawList = (Array.isArray(dist) ? dist : [dist])
    .flatMap((item) => String(item ?? '').split(/[,;]/))
    .map((item) => item.trim().replace(/^"(.*)"$/, '$1'))
    .filter(Boolean);

  const list = rawList.length ? rawList : [DEFAULT_DIST];
  const ignores = list.filter((item) => item.startsWith('!')).map((item) => item.slice(1));
  const patterns = list.filter((item) => !item.startsWith('!'));

  const byLocal = new Map();
  const warnings = [];

  for (const pattern of patterns) {
    const absolute = path.resolve(cwd, pattern);
    const stat = await statOf(absolute);

    let root;
    let files;

    if (stat?.isDirectory()) {
      // 目录：上传目录里的内容，不多套一层目录名
      root = absolute;
      files = await walk(absolute);
      if (!files.length) warnings.push(`目录是空的：${pattern}`);
    } else if (stat?.isFile()) {
      root = path.dirname(absolute);
      files = [absolute];
    } else {
      root = globParent(absolute);
      files = await fg(pattern.replace(/\\/g, '/'), {
        cwd,
        onlyFiles: true,
        dot: true,
        absolute: true,
        followSymbolicLinks: false,
        ignore: ignores,
      });
      if (!files.length) warnings.push(`没有匹配到任何文件：${pattern}`);
    }

    for (const file of files) {
      const local = path.resolve(file);
      if (byLocal.has(local)) continue;
      const fileStat = await statOf(local);
      if (!fileStat?.isFile()) continue;

      let relative = toPosix(path.relative(root, local));
      if (!relative || relative.startsWith('..')) relative = path.basename(local);

      byLocal.set(local, { local, relative, size: fileStat.size });
    }
  }

  const entries = [...byLocal.values()].sort((a, b) => a.relative.localeCompare(b.relative));
  const totalBytes = entries.reduce((sum, entry) => sum + entry.size, 0);

  return { entries, warnings, totalBytes, cwd };
}

module.exports = { resolveInputs, DEFAULT_DIST, globParent, toPosix };
