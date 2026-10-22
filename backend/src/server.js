'use strict';

const { createApp } = require('./app');

const PORT = Number(process.env.PORT || 9016);
const { app, dbHandle, projectRoot, dataDir } = createApp();
const server = app.listen(PORT, () => {
  console.log('ProTangram 后端服务已启动: http://localhost:' + PORT);
  console.log('项目根目录: ' + projectRoot);
  console.log('数据存储目录: ' + dataDir);
  console.log('领域数据库: ' + dbHandle.dbPath);
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('收到 ' + signal + '，正在关闭后端服务');
  server.close(() => {
    try { dbHandle.db.close(); } finally { process.exit(0); }
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
