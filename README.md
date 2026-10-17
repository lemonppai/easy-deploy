# easy2-deploy

把本地文件通过 **SSH(SFTP)** 或 **FTP/FTPS** 发布到服务器。

- 纯命令行交互：一路问答走完，**不读取任何配置文件**
- 不依赖 gulp / vinyl / webpack-merge，只用 `node-ssh` 和 `basic-ftp`
- 上传保留目录结构，带进度条、耗时和结果汇总
- 需要走 CI 时可以用 `--yes` + 参数完全非交互

## 安装

```bash
npm install easy2-deploy --save-dev
# 或
yarn add easy2-deploy --dev
```

## 使用

### 交互式（推荐）

```bash
npx easy2-deploy
```

按提示依次填写：

1. 部署方式：`SSH / SFTP` 或 `FTP / FTPS`
2. 连接信息：地址、端口、用户名、密码（不回显）或私钥路径
3. 本地文件：目录、单个文件或 glob，如 `./dist/**/*`
4. 远程目录（不存在会自动创建）以及是否先清空
5. SSH 可选：上传后要执行的远程命令，如 `systemctl reload nginx`
6. 确认摘要 → 开始上传

每一步直接回车即使用默认值，`Ctrl+C` 可随时取消。

### 非交互式（CI / 快捷命令）

```bash
npx easy2-deploy -y \
  --type ssh \
  --host 1.2.3.4 --port 22 \
  --user root --password '***' \
  --dist './dist/**/*' \
  --remote /home/www/dist \
  --command 'systemctl reload nginx'
```

私钥认证：

```bash
npx easy2-deploy -y --host 1.2.3.4 --user deploy \
  --private-key ~/.ssh/id_ed25519 --passphrase '***' \
  --dist ./dist --remote /var/www/app
```

先看会传哪些文件（不连服务器）：

```bash
npx easy2-deploy -y --host 1.2.3.4 --user root --password '***' \
  --dist ./dist/**/* --remote /home/www/dist --dry-run
```

## 参数

| 参数 | 说明 |
| --- | --- |
| `--type <ssh\|ftp>` | 部署方式，缺省 `ssh` |
| `-H, --host <地址>` | 服务器地址 |
| `-p, --port <端口>` | 端口，缺省 ssh 22 / ftp 21 |
| `-u, --user <用户名>` | 登录用户名 |
| `-w, --password <密码>` | 登录密码 |
| `--private-key <路径>` | SSH 私钥文件（与密码二选一） |
| `--passphrase <口令>` | 私钥口令 |
| `--agent` | 使用 ssh-agent 认证 |
| `--secure` | FTP 走 FTPS 显式加密 |
| `-d, --dist <路径/glob>` | 要上传的本地文件，可重复或逗号分隔，缺省 `./dist/**/*` |
| `-r, --remote <目录>` | 远程目标目录，缺省 `/home/upload` |
| `--clean` / `--no-clean` | 上传前是否清空远程目录，缺省否 |
| `-e, --command <命令>` | 上传后执行的远程命令，可重复（仅 ssh） |
| `-c, --concurrency <n>` | 并发上传数，缺省 4 |
| `--dry-run` | 只列出将要上传的文件 |
| `-y, --yes` | 跳过交互，按参数直接执行 |
| `--debug` | 输出调试信息 |
| `-h, --help` / `-v, --version` | 帮助 / 版本 |

`dist` 的三种写法：

- 目录：`./dist` —— 上传目录里的**内容**，不会多套一层 `dist/`
- 文件：`./app.zip`
- glob：`./dist/**/*`、`./dist/**/*.html`、`./public/*.json`，以 `!` 开头表示排除

上传时保留相对路径：`dist/js/app.js` → `<remote>/js/app.js`。

## 编程调用

```js
const { deploy } = require('easy2-deploy');

await deploy({
  type: 'ssh',
  host: '1.2.3.4',
  port: 22,
  username: 'root',
  password: '***',
  dist: './dist/**/*',
  remoteDir: '/home/www/dist',
  clean: false,
  commands: ['systemctl reload nginx'],
});
```

带进度回调：

```js
await deploy(config, {
  onStep: (step) => console.log('步骤', step),
  onProgress: ({ current, total, relative, bytes, totalBytes }) => {
    console.log(`${current}/${total} ${relative} ${bytes}/${totalBytes}`);
  },
});
```

## 从 0.1.x 迁移

- 不再需要 `deploy.config.js`，也不再需要 `gulpfile.js`，可以直接删除
- `npm run deploy` 现在等同于 `node bin/cli.js`（交互式）
- `gulp deploy` 不再可用，改用 `npx easy2-deploy`
- 依赖从 gulp 全家桶换成 `node-ssh` + `basic-ftp`，安装体积更小
