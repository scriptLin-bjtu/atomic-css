const chokidar = require('chokidar');
const { exec } = require('child_process');
const path = require('path');
let timeout;
// 只监听 .html / .jsx / .tsx 文件
const watcher = chokidar.watch('.', {
    ignored: /(^|[\/\\])(\..|node_modules)/,
    persistent: true,
});
watcher.on('ready',()=>{
    console.log('atomic_watcher ready...');
});
watcher.on('change', (changedPath) => {
    if (!/\.(html|jsx|tsx)$/.test(changedPath)) {
        return; // 如果不是指定的文件类型，直接返回
    }
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      console.log(`文件变更：${changedPath}，正在执行 atomic_main.js`);
      const absPath = path.resolve(changedPath); // 转为绝对路径，防止路径不对
      exec(`node atomic_main.js "${absPath}"`, (err, stdout, stderr) => {
        if (err) {
          console.error(stderr);
        } else {
          console.log(stdout);
        }
      });
    }, 200);
});