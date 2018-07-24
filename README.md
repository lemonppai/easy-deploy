# deploy
前端代码部署到服务器，`remote.config.js`配置`ssh`、`remoteDir`、`commands`

### 在项目中安装
```bash
npm install lemon-deploy --save
# 或
yarn add lemon-deploy
```

### 在package.json配置scripts
```json
{
  "scripts": {
    "deploy": "lemon-deploy"
  }
}
```

### 执行
```bash
npm run deploy
```

### remote.config.js配置
  + ssh 服务器
    + host 服务器地址
    + port 服务器端口号，默认是22
    + username 服务器账号
    + password 服务器密码
  + remoteDir 上传文件位置
  + commands 远程命令
