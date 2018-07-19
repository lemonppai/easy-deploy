// 服务器配置
module.exports = {
  ssh: {
    host: '127.0.0.1',
    port: 22,
    username: '***',
    password: '***'
  },
  // 远程地址
  remoteDir: '/home/upload',
  // 远程命令
  commands: [
    'find /home/upload/ | sort | tail -1 | xargs unzip -o -d /home/www/dist/'
  ]
};
