// development config
const { merge } = require("webpack-merge");
const commonConfig = require("./common");
const ReactRefreshPlugin = require("@pmmmwh/react-refresh-webpack-plugin");

module.exports = merge(commonConfig, {
  mode: "development",
  devServer: {
    hot: true,
    historyApiFallback: true,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        secure: false,
      },
    },
  },
  devtool: "cheap-module-source-map",
  plugins: [new ReactRefreshPlugin()],
});
