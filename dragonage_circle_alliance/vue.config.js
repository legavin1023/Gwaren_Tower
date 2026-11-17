module.exports = {
  publicPath: "./",
  lintOnSave: false,
  productionSourceMap: false,
  devServer: {
    host: "127.0.0.1",
    port: 8090,
    onListening(server) {
      if (server.server.address().port !== 8090) throw new Error("8090 포트가 사용 중입니다. 기존 개발 서버를 종료하고 다시 실행하세요.");
    },
    client: { overlay: { errors: true, warnings: false }, logging: "warn" },
    proxy: { "/api": { target: "http://127.0.0.1:8787", changeOrigin: false, ws: true } },
  },
};
