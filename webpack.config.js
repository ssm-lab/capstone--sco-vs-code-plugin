const path = require('path');
const nodeExternals = require('webpack-node-externals');
const Dotenv = require('dotenv-webpack');

module.exports = {
  target: 'node',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  externals: [
    nodeExternals(),
    { vscode: 'commonjs vscode' },
  ],
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: 'ts-loader',
      },
    ],
  },
  mode: 'development',
  devtool: 'source-map',
  infrastructureLogging: {
    level: 'log' // enables logging required for problem matchers
  },
  plugins: [
    new Dotenv({
      path: './.env',
    }),
  ],
};