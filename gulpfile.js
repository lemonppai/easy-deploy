const gulp = require('gulp');
const GulpSSH = require('gulp-ssh');
const runSequence = require('gulp-run-sequence');
const remoteConf = require('./remote.config.js');

const gulpSSH = new GulpSSH({
  ignoreErrors: false,
  sshConfig: remoteConf.ssh
});


// 文件上传
gulp.task('upload', () => {
  return gulp.src('./dist/*.zip')
    .pipe(gulpSSH.dest(remoteConf.remoteDir));
});

// 解压文件夹到指定目录
gulp.task('unzip', () => {
  return gulpSSH.exec(remoteConf.commands);
});


// 部署任务
gulp.task('deploy', () => {
  runSequence('upload', 'unzip');
});
