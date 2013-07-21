'use strict';

var fs = require('fs');
var spawn = require('child_process').spawn;

var async = require('async');
var _ = require('lodash');
var request = require('request');
var wrench = require('wrench');
require('colors');

var utils = require('./utils.js');

// Maps style and templates options to grunt task names and filetype(s)
var userOptions = {
  style: {
    sass: {
      optionName: 'Sass',
      taskName: 'compass',
      fileTypes: ['.scss', '.sass']
    },
    less: {
      optionName: 'Less',
      taskName: 'less',
      fileTypes: ['.less']
    }
  },
  template: {
    jade: {
      optionName: 'Jade',
      taskName: 'jade',
      fileTypes: ['.jade']
    },
    ejs: {
      optionName: 'EJS',
      taskName: 'ejs',
      fileTypes: ['.ejs']
    }
  }
};

/**
 * Scaffolds a new static site generator
 * @param  {Object}   options  Object containing the siteName and theme
 * @param  {Function} callback Callback used for testing
 */
module.exports = function (options, callback) {

  // Get specified theme's cabin.json data
  getThemeOptions(options.theme, function (err, themeData) {
    if (err) throw err;
    async.series([

      // Prompt user based on available options from the theme's cabin.json, if
      // there is only one option or if choices are already passed in don't
      // prompt (used for testing)
      function (callback) {
        if (!options.preprocessor) {
          utils.choicePrompt('Which CSS preprocessor will you use?', themeData.style, function (choice) {
            options.preprocessorChoice = choice;
            options.preprocessor = userOptions.style[choice].taskName;
            callback();
          });
        } else callback();
      },
      // Determine template language
      function (callback) {
        if (!options.templateLang) {
          utils.choicePrompt('Which template language will you use?', themeData.template, function (choice) {
            options.templateLangChoice = choice;
            options.templateLang = userOptions.template[choice].taskName;
            callback();
          });
        } else callback();
      },

      // Create Gruntfile and package.json based on user choices and cabin.json
      // config
      function (callback) {
        // Create site directory and move into it
        utils.safeWriteDir(process.cwd() + '/' + options.siteName);
        process.chdir(options.siteName);

        // Render grunt-pages config with options, this is done to avoid having
        // a template within a template
        options.gruntPages = _.template(utils.printObj(themeData.gruntPages, '  '.length), options);

        // Render Gruntfile with options and with pre-rendered grunt-pages
        // config
        utils.renderTemplate('_Gruntfile.js', 'Gruntfile.js', options, callback);
      },
      function (callback) {
        // Render package.json with dependencies based on what preprocessor is
        // being used
        utils.renderTemplate('_package.json', 'package.json', options, callback);
      },
      function (callback) {
        downloadTheme(options, callback);
      }
    ], function (err) {
      if (err) throw err;
      process.stdin.destroy();

      // Install node modules
      if (!options.noInstall) {

        var npmInstall = spawn('npm', ['install'], { stdio: 'inherit' });

        npmInstall.on('close', function () {
          if (_.isFunction(callback)) callback();
        });

      } else if (_.isFunction(callback)) {
        callback();
      }
    });
  });
};

/**
 * Get themes cabin.json configuration and provide prompt options based on
 * supported options
 * @param  {String}   theme  GitHub user/repo name of the theme
 * @param  {Function} callback Callback used to step through async series
 */
function getThemeOptions(theme, callback) {
  request({
    uri: 'https://raw.github.com/' + theme + '/master/cabin.json',
    json: true
  }, function (err, res, cabinJSON) {

    if (err) callback(err);

    var options = {
      style: [],
      template: [],
      gruntPages: cabinJSON.gruntPages
    };

    cabinJSON.style.forEach(function (style) {
      var option = {};
      option[userOptions.style[style.toLowerCase()].optionName] = style.toLowerCase();
      options.style.push(option);
    });

    cabinJSON.template.forEach(function (template) {
      var option = {};
      option[userOptions.template[template.toLowerCase()].optionName] = template.toLowerCase();
      options.template.push(option);
    });

    // If theme lacks required options, invite the user to file an issue on
    // GitHub about it
    if (options.template.length && options.style.length) {
      callback(null, options);
    } else {
      console.log('This theme has an invalid cabin.json.');
      utils.choicePrompt('File an issue on github?', [
        {
          'yes' : function () {
            require('open')('https://github.com/' + theme + '/issues/new?title=Invalid%20cabin.json%20configuration');
          }
        },
        {
          'no': function () {
            console.log('bummer :(');
          }
        }
      ], function (choice) {
        choice();
        console.log('Looks like you\'ll have to use another theme');
        process.exit(1);
      });
    }
  });
}

/**
 * Determine the file extensions to exclude from the theme
 * @param  {Object}   options  User-selected options about the template language and CSS preprocessor
 **/
function getExcludedExtensions(options) {
  var excludedExtensions = [];
  _.forEach(userOptions.style, function (config, preprocessor) {
    if (preprocessor !== options.preprocessorChoice) {
      excludedExtensions = excludedExtensions.concat(config.fileTypes);
    }
  });

  _.forEach(userOptions.template, function (config, templateLang) {
    if (templateLang !== options.templateLangChoice) {
      excludedExtensions = excludedExtensions.concat(config.fileTypes);
    }
  });

  return excludedExtensions;
}

/**
 * Clone theme repo from GitHub and copy source files into the site
 * directory based on user choices
 * @param  {Object}   options  User-selected options about the template language and CSS preprocessor
 * @param  {Function} callback Callback used to step through async series
 */
function downloadTheme(options, callback) {

  var themeClone = spawn('git', [
    'clone',
    'https://github.com/' + options.theme + '.git',
    'cabin'
  ]);

  console.log('Downloading theme...'.magenta);

  themeClone.on('close', function () {
    wrench.copyDirSyncRecursive('cabin/posts', 'posts');
    wrench.copyDirSyncRecursive('cabin/src', 'src', {
      filter: new RegExp('(' + getExcludedExtensions(options).join('|') + ')$')
    });
    wrench.rmdirSyncRecursive('cabin');
    callback();
  });
}
