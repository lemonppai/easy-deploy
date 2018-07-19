const gulp = require('gulp');
const GulpSSH = require('gulp-ssh');
const runSequence = require('gulp-run-sequence');
const sshConf = require('./ssh.config.js');

const gulpSSH = new GulpSSH({
  ignoreErrors: false,
  sshConfig: sshConf.ssh
});


// 文件上传
gulp.task('upload', () => {
  return gulp.src('./dist/*.zip')
    .pipe(gulpSSH.dest(sshConf.remoteDir));
});

// 解压文件夹到指定目录
gulp.task('unzip', () => {
  return gulpSSH.exec(sshConf.commands);
});


// 部署任务
gulp.task('deploy', () => {
  runSequence('upload', 'unzip');
});
