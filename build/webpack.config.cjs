var webpack = require('webpack');
var TerserPlugin = require('terser-webpack-plugin');
var fs = require('fs');

var pkg = require('../package.json');
var year = new Date().getFullYear();
var banner = `
AculabCloudCaller version ${pkg.version}
 Copyright (c) 2014-${year} Aculab plc <https://www.aculab.com>
 Homepage: https://www.aculab.com


`;
/* add sub module licenses to banner */
const submods = ['sip.js'];
submods.forEach((m) => {
  var licence = fs.readFileSync(`./node_modules/${m}/LICENSE.md`, 'utf8').replaceAll(/^/gm, "  ");
  banner += `
This software includes "${m}" with the licence:
${licence}

`;
});

module.exports = function (env) {
  var mode = env.buildType === 'min' ? 'production' : 'none';
  var mainDir = __dirname + '/../';

  var entry = {};
  entry['AculabCloudCaller' + (env.buildType === 'min' ? '.min' : '')] = mainDir + '/src/index.js';

  return {
    mode: mode,
    entry: entry,
    output: {
      path: mainDir + '/dist',
      filename: '[name].js',
      libraryTarget: 'umd',
      globalObject: 'this'
    },
    externals: [
        'react-native',
        'react-native-webrtc'
    ],
    node: false,
    resolve: {
      extensions: ['.js']
    },
    optimization: {
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            output: {
              ascii_only: true
            }
          }
        })
      ]
    },
    plugins: [
      new webpack.BannerPlugin({
        banner: banner
      })
    ],
    module: {
        rules: [
            {
                test: /\.m?js/,
                resolve: {
                    fullySpecified: false
                }
            }
        ]
    }
  };
}
