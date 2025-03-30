const path = require('path');

module.exports = {
  target: 'node',
  entry: {
    extension: './src/extension.ts',
    install: './src/install.ts' // Separate entry point for install script
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    libraryTarget: 'commonjs2'
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  externals: [
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
};