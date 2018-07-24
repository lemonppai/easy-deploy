# deploy
前端代码部署到服务器，`remote.config.js`配置`ssh`、`remoteDir`、`commands`

### 在项目中安装
```bash
npm install lemon-deploy --save
# 或
yarn add lemon-deploy
```

### 在package.json定义
```json
{
  ...
  "scripts": {
    "deploy": "lemon-deploy"
  },
  ...
}
```

### 执行
```bash
npm run deploy
```
