'use strict';

const HELP = `
easy2-deploy — 把本地文件通过 SSH(SFTP) 或 FTP 发布到服务器

用法：
  easy2-deploy                       # 交互式引导（推荐，不读任何配置文件）
  easy2-deploy -y --type ssh --host 1.2.3.4 --user root --password *** \\
               --dist ./dist/**/* --remote /home/www/dist

不读取 deploy.config.js：所有参数都来自命令行或交互问答。
交互模式下每一项都可以直接回车使用默认值，密码输入不回显。

参数：
      --type <ssh|ftp>      部署方式，缺省 ssh（SFTP 上传 + 可执行远程命令）
  -H, --host <地址>         服务器地址
  -p, --port <端口>         端口，缺省 ssh 22 / ftp 21
  -u, --user <用户名>       登录用户名
  -w, --password <密码>     登录密码（非交互模式使用；交互模式会隐藏输入）
      --private-key <路径>  SSH 私钥文件路径（与密码二选一）
      --passphrase <口令>   私钥口令（可选）
      --agent               SSH 使用 ssh-agent 认证
      --secure              FTP 走 FTPS 显式加密
  -d, --dist <路径或 glob>  要上传的本地文件，可重复或用逗号分隔
                            缺省 ./dist/**/*（目录表示上传其内容）
  -r, --remote <远程目录>   远程目标目录，缺省 /home/upload
      --clean               上传前清空远程目录（缺省否）
      --no-clean            不清空远程目录（缺省）
  -e, --command <命令>      上传后执行的远程命令，可重复（仅 ssh）
  -c, --concurrency <n>     并发上传数，缺省 4
      --dry-run             只列出将要上传的文件，不实际连接服务器
  -y, --yes                 跳过交互，按参数直接执行（需提供必要参数）
      --debug               输出调试信息
  -h, --help                查看帮助
  -v, --version             查看版本

说明：
  * 目录作为 dist 时上传的是「目录里的内容」，不会多套一层目录名。
  * 上传保留相对路径结构，例如 dist/js/app.js → <remote>/js/app.js。
  * SSH 依赖系统 ssh 通道，无需在服务器额外安装东西；FTP 为被动模式。
`.trim();

module.exports = { HELP };
