module.exports = { publicPath: "./", lintOnSave: false, devServer: { client: false, proxy: { "/api": {target:"http://localhost:8787"} } }, productionSourceMap: false };
