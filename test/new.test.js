'use strict';
var should = require('should');
var _ = require('lodash');
var fs = require('fs');
var wrench = require('wrench');
var cabinNew = require('../lib/new.js');
var siteName = 'testSite';

describe('New site generator', function () {

  beforeEach(function () {
    if (fs.existsSync(siteName)) {
      wrench.rmdirSyncRecursive(siteName);
    }
  });

  afterEach(function () {
    process.chdir('../');
    if (fs.existsSync(siteName)) {
      wrench.rmdirSyncRecursive(siteName);
    }
  });

  describe('cabin new <siteName>', function () {

    describe('with jade templates', function () {

      it('should create new site in new folder', function (done) {

        testOptions({ templateLang: 'jade' }, function (result) {

          should.ok(result);
          done();
        });
      });
    });

    describe('with ejs templates', function () {

      it('should create new site in new folder', function (done) {

        testOptions({ templateLang: 'ejs' }, function (result) {

          should.ok(result);
          done();
        });
      });
    });
  });
});

function testOptions(options, callback) {

  options = _.defaults(options, {
    siteName: siteName,
    theme: 'colinwren/testTheme',
    templateLang: 'jade',
    preprocessor: 'compass',
    noInstall: true
  });

  cabinNew(options, function () {
    callback(checkGeneratedFiles(options));
  });
}

function checkGeneratedFiles(options) {

  if (options.preprocessor === 'compass') {
    options.preprocessor = 'scss';
  }

  var expectedFiles = [
    'Gruntfile.js',
    'README.md',
    'package.json',
    'posts',
    'src',
    'posts/post1.md',
    'posts/post2.md',
    'src/layouts',
    'src/pages',
    'src/styles',
    'src/pages/blog',
    'src/pages/index.' + options.templateLang,
    'src/pages/archives.' + options.templateLang,
    'src/styles/main.' + options.preprocessor,
    'src/styles/_base.' + options.preprocessor,
    'src/styles/_nav.' + options.preprocessor,
    'src/styles/_post.' + options.preprocessor,
    'src/styles/solarized-dark.syntax.css'
  ];

  if (options.templateLang === 'jade') {
    expectedFiles = expectedFiles.concat([
      'src/layouts/base.jade',
      'src/layouts/post.jade'
    ]);
  } else if (options.templateLang === 'ejs') {
    expectedFiles = expectedFiles.concat([
      'src/layouts/_head.ejs',
      'src/layouts/_foot.ejs',
      'src/layouts/_post.ejs',
      'src/layouts/_postHead.ejs',
      'src/layouts/post.jade'
    ]);

  }

  var files = _.filter(wrench.readdirSyncRecursive('./'), function (filePath) {
    return filePath.indexOf('node_modules') === -1;
  });

  return _.intersection(files, expectedFiles).length === files.length;
}
