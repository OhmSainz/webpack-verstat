const pathResolve = require('path').resolve;
const pathExtname = require('path').extname;
const pathBasename = require('path').basename;
const yamlParse = require('yamljs').parse;
const yamlFrontLoadFront = require('yaml-front-matter').loadFront;
const fsReadFileSync = require('fs').readFileSync;
const globSync = require('glob').sync;
const pugCompile = require('pug').compile;
const pugCompileFile = require('pug').compileFile;
const bemto = require('verstat-bemto');
const basePath = pathResolve(__dirname, '../');
const HtmlWebpackPlugin = require('html-webpack-plugin');


const readFile = function (fileName) {
  return fsReadFileSync(fileName, { encoding: 'utf8' });
};

const compileBlock = function (mod, block) {
  const blocks = globSync(`${basePath}/src/blocks/**/*.?(pug|jade)`);
  const index = blocks.findIndex(item => item.indexOf(block) !== -1);
  if (index !== -1) return pugCompile(`${mod}\n${readFile(blocks[index])}`);
};

const renderBlockEngine = function (blockName, data) {
  data.renderBlock = function (blockName, data) { return compileBlock(bemto, blockName)(data); };
  return compileBlock(bemto, blockName)(data);
};

const getGlobalData = function () {
  const data = globSync(`${basePath}/src/data/*.?(yml|json)`).map((file) => {
    const obj = {};
    switch (pathExtname(file)) {
      case '.json':
        obj[pathBasename(file, '.json')] = JSON.parse(readFile(file));
        break;
      case '.yml':
        obj[pathBasename(file, '.yml')] = yamlParse(readFile(file));
        break;
    }
    return obj;
  });
  return data.length ? Object.assign({}, ...data) : {};
};

const getCompiledTemplate = function () {
  return globSync(`${basePath}/src/*.?(pug|jade)`).map((layoutData) => {
    const extractedData = yamlFrontLoadFront(layoutData, '\/\/---', 'content');
    const modifiedExtractedData = Object.assign({}, extractedData);
    delete modifiedExtractedData.layout;
    delete modifiedExtractedData.content;
    const layouts = globSync(`${basePath}/src/layouts/!(main|root).?(pug|jade)`);
    const template = layouts.filter(layout => layout.indexOf(extractedData.layout) !== -1);
    if (template.length) {
      const fn = pugCompileFile(template[0]);
      const initialLocals = {
        renderBlock: renderBlockEngine,
        file: modifiedExtractedData,
        content: (function () {
          const fn = pugCompile(`${bemto}\n${extractedData.content}`);
          const initialLocals = { renderBlock: renderBlockEngine };
          const locals = Object.assign(initialLocals, modifiedExtractedData, getGlobalData());
          return fn(locals);
        })()
      };
      const locals = Object.assign(initialLocals, getGlobalData());
      return new HtmlWebpackPlugin({
        filename: `${pathBasename(layoutData).replace(/\.[^/.]+$/, '')}.html`,
        templateContent: fn(locals),
        cache: false,
        hash: false,
        inject: 'body',
        minify: {
          removeComments: true
        }
      });
    }
  });
};

module.exports = {
  getCompiledTemplate
};