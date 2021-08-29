const gulp = require('gulp');
const { merge } = require('webpack-merge');
const rootPath = require('app-root-path').path;
// const runSequence = require('gulp-run-sequence');
const through2 = require('through2');
const path = require('path');
const fs = require('fs');

const deployConf = getConf();

// 获取最终配置项
function getConf() {
  const conf = require('./deploy.config.js');
  const pathToRemote = path.resolve(rootPath, './deploy.config.js');

  // 项目根目录是否已创建deploy.config.js
  if (fs.existsSync(pathToRemote)) {
    return merge(conf, require(pathToRemote));
  }
  else {
    return conf;
  }
}

// 服务器
const client = {
  server: null,
  getServer() {
    if (!this.server) {
      const GulpSSH = require('gulp-ssh');

      this.server = new GulpSSH({
        ignoreErrors: false,
        sshConfig: deployConf.ssh
      });
    }

    return this.server;
  }
};

// ssh 文件上传
gulp.task('upload:ssh', () => {
  const gulpSSH = client.getServer();

  return (
    gulp.src(deployConf.dist, {
      cwd: rootPath,
    })
    .pipe(through2.obj((file, encoding, callback) => {
      if (deployConf.clean) {
        gulpSSH.shell(['rm -rf ' + remotePath])
          .pipe(through2.obj(() => {
            callback(null, file);
          }));
      }
      else {
        callback(null, file);
      }
    }))
    .pipe(gulpSSH.dest(deployConf.remoteDir))
  );
});

// ftp 文件上传
gulp.task('upload:ftp', () => {
  const ftp = require('vinyl-ftp');

  //  FTP version
  const conn = ftp.create(deployConf.ftp);

  return (
    gulp.src(deployConf.dist, {
      cwd: rootPath,
    })
    .pipe(through2.obj((file, encoding, callback) => {
      if (deployConf.clean) {
        conn.rmdir(remotePath, err => {
          // console.log(err)
          fcallback(null, file);
        });
      }
      else {
        callback(null, file);
      }
    }))
    .pipe(conn.newer(deployConf.remoteDir))
    .pipe(conn.dest(deployConf.remoteDir))
  );
});

// 服务器执行命令
gulp.task('command', () => {
  const gulpSSH = client.getServer();

  return gulpSSH.exec(deployConf.commands);
});

// 部署任务
gulp.task('deploy', gulp.series(deployConf.type === 'ssh' ? ['upload:ssh', 'command'] : ['upload:ftp']));
