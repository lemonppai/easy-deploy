const gulp = require('gulp');
const GulpSSH = require('gulp-ssh');
const runSequence = require('gulp-run-sequence');
const deployConf = require('./deploy.config.js');
const fs = require('fs');
const path = require('path');
const rootPath = require('app-root-path').path;

const pathToRemote = path.resolve(rootPath, './deploy.config.js');

if (fs.existsSync(pathToRemote)) {
  Object.assign(deployConf, require(pathToRemote));
}

const gulpSSH = new GulpSSH({
  ignoreErrors: false,
  sshConfig: deployConf.ssh
});


// 文件上传
gulp.task('upload', () => {
  return gulp.src(path.resolve(rootPath, './dist/*.zip'))
    .pipe(gulpSSH.dest(deployConf.remoteDir));
});

// 解压文件夹到指定目录
gulp.task('unzip', () => {
  return gulpSSH.exec(deployConf.commands);
});


// 部署任务
gulp.task('deploy', () => {
  runSequence('upload', 'unzip');
});
