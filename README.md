# deploy
目标文件通过`ssh`或`ftp`发布到服务器

## 使用

### 当前项目安装

国际惯例，先安装。

```bash
npm install lemon-deploy --save
# 或
yarn add lemon-deploy
```

### deploy.config.js配置

在项目根目录创建`deploy.config.js`文件，默认配置如下：

```js
// 服务器配置
module.exports = {
  // 默认是ssh方式
  type: 'ssh',

  // linux ssh环境
  ssh: {
    host:     '127.0.0.1',
    username: '***',
    password: '***',
    port:     22,
  },

  // window ftp环境
  ftp: {
    host:     '127.0.0.1',
    user:     '***',
    password: '***',
    port:     21,
    parallel: 10,
    reload:   true,
  },

  clean: false,     // 是否清理服务器目录

  // dist: './dist/*.zip',  // 上传zip包后执行解压操作
  dist: './dist/**/*',

  // 上传文件位置
  remoteDir: '/home/upload',

  // 远程命令
  commands: [
    // 解压命令
    // 'find /home/upload/ | sort | tail -1 | xargs unzip -o -d /home/www/dist/'
  ]
};
```

### 测试下是否成功

```bash
npx lemon-deploy
```

### 结论

雏形已现，功能持续完善中~
