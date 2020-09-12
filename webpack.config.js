/*
 * Config file for ESP8266 client app.
 *
 * Links used to build this:
 *  - https://www.valentinog.com/blog/babel/
 */
const path = require('path');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const HtmlWebPackPlugin = require('html-webpack-plugin');


const config = {
  entry: './lib/index.js',
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'bundle.js',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      },
      // {
      //   test: /\.css$/,
      //   loader: ExtractTextPlugin.extract({
      //     loader: 'css-loader'
      //   }),
      // },
      // {
      //   test: /\.(jpe?g|png|gif|svg)$/,
      //   use: [
      //     {
      //       loader: 'url-loader',
      //       options: { limit: 40000 },
      //     },
      //     'image-webpack-loader'
      //   ]
      // }
    ]
  },
};

module.exports = config;
