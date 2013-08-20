'use strict';

var fs    = require('fs');
var spawn = require('child_process').spawn;

var async           = require('async');
require('colors');
var inquirer        = require('inquirer');
var _               = require('lodash');
var prettyStringify = require('pretty-stringify');
var wrench          = require('wrench');

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

var themeOptions;

// Directory where remote themes are cloned to before being extracted
var tmpThemeGitFolder = 'tmp';

/**
 * Scaffolds a new static site generator
 * @param  {Object}   cliOptions  Object configured by the cli
 * @param  {Function} callback Callback used for testing
 */
module.exports = function (cliOptions, callback) {
  var themeSourceFolder = cliOptions.local ? cliOptions.theme : tmpThemeGitFolder;
  async.series([

    // Download the theme if it isn't present locally
    function (step) {
      if (!cliOptions.local) {
        downloadTheme(cliOptions, step);
      } else {
        step();
      }
    },

    // Retrieve the theme options by getting data from the package.json and cabin.json files and then
    // prompting the user to fill in any theme options that weren't specified as command line arguments
    function (step) {
      var themeData = getThemeData(cliOptions.theme, themeSourceFolder);
      getUserOptions(cliOptions, themeData, function (userOptions) {
        themeOptions = userOptions;
        step();
      });
    },

    // Now that all of the themeOptions are determined, let's generate the static site generator
    function (step) {
      generateProject(themeOptions, themeSourceFolder, step);
    }

  ], function () {

    // Install node modules
    if (!themeOptions.noInstall) {

      var npmInstall = spawn('npm', ['install'], {
        stdio: 'inherit',
        cwd: themeOptions.siteName
      });

      npmInstall.on('close', function () {
        if (_.isFunction(callback)) callback();
      });

    } else if (_.isFunction(callback)) {
      callback();
    }
  });
};

/**
 * Clone theme repo from GitHub and copy source files into the site
 * directory based on user choices
 * @param  {Object}   cliOptions  User-selected options about the template language and CSS preprocessor
 * @param  {Function} callback Callback used to step through async series
 */
function downloadTheme(cliOptions, callback) {

  // Allow users to copy repo urls directly from GitHub
  if (cliOptions.theme.indexOf('https://github.com/') !== -1) {
    cliOptions.theme = cliOptions.theme.slice('https://github.com/'.length);
  }

  var themeClone = spawn('git', [
    'clone',
    'https://github.com/' + cliOptions.theme + '.git',
    tmpThemeGitFolder,
    '-b',
    'master'
  ]);

  console.log('Downloading theme...'.magenta);

  themeClone.on('close', function () {
    callback();
  });
}

/**
 * Retrieves data about the theme from the cabin.json and package.json
 * @param  {String} themeName         Name of theme used for error reporting
 * @param  {String} themeSourceFolder Folder containing theme files
 * @return {Object}                   Extracted theme data to be used when generating the static site generator
 */
function getThemeData(themeName, themeSourceFolder) {
  var themeData;
  try {
    var packageJSON = JSON.parse(fs.readFileSync(process.cwd() + '/' + themeSourceFolder + '/package.json'));
    themeData       = JSON.parse(fs.readFileSync(process.cwd() + '/' + themeSourceFolder + '/cabin.json'));

    if (packageJSON.devDependencies['grunt-pages']) {
      themeData.gruntPagesVersion = packageJSON.devDependencies['grunt-pages'];
    } else if (packageJSON.dependencies['grunt-pages']) {
      themeData.gruntPagesVersion = packageJSON.dependencies['grunt-pages'];
    } else {
      invalidThemePrompt(themeName);
    }
    // If theme lacks required options, invite the user to file an issue on
    // GitHub about it
    if (!themeData.template.length || !themeData.style.length) {
      invalidThemePrompt(themeName);
    }
  } catch (e) {
    invalidThemePrompt(themeName);
  }

  return themeData;
}

/**
 * Prompt user based on available options from the cabin.json, and map choices
 * to grunt task and file extensions
 * @param  {Object}   cliOptions Options passed in through CLI
 * @param  {Object}   theme      Data from theme's cabin.json
 * @param  {Function} callback Callback used to step through async series
 */
function getUserOptions(cliOptions, themeData, callback) {

  // Start with options derived from the command line and theme data
  var themeOptions = _.extend(cliOptions, {
    gruntPages: themeData.gruntPages,
    gruntPagesVersion: themeData.gruntPagesVersion
  });

  async.series([
    // Prompt user based on available options from the theme's cabin.json, if
    // there is only one option or if choices are already passed in don't
    // prompt (used for testing)
    function (step) {
      if (!cliOptions.preprocessor) {
        if (themeData.style.length === 1) {
          console.log('Theme using the ' + themeData.style[0].cyan + ' preprocessor.');
          themeOptions.preprocessorChoice = themeData.style[0].toLowerCase();
          themeOptions.preprocessor = userOptions.style[themeData.style[0].toLowerCase()].taskName;
          step();
        } else {
          inquirer.prompt({
            type: 'list',
            name: 'preprocessor',
            message: 'Which CSS preprocessor will you use?',
            choices: themeData.style,
            filter: function (val) {
              return val.toLowerCase();
            }
          }, function (answer) {
            themeOptions.preprocessorChoice = answer.preprocessor;
            themeOptions.preprocessor = userOptions.style[answer.preprocessor].taskName;
            step();
          });
        }
      } else {
        themeOptions.preprocessor = cliOptions.preprocessor;
        themeOptions.templateLangChoice = cliOptions.templateLang;
        step();
      }
    },

    // Determine template language
    function (step) {
      if (!cliOptions.templateLang) {
        if (themeData.template.length === 1) {
          console.log('Theme using the ' + themeData.template[0].cyan + ' template language.');
          themeOptions.templateLangChoice = themeData.template[0].toLowerCase();
          themeOptions.templateLang = userOptions.template[themeData.template[0].toLowerCase()].taskName;
          step();
        } else {
          inquirer.prompt({
            type: 'list',
            name: 'templateLang',
            message: 'Which template language will you use?',
            choices: themeData.template,
            filter: function (val) {
              return val.toLowerCase();
            }
          }, function (answer) {
            themeOptions.templateLangChoice = answer.templateLang;
            themeOptions.templateLang = userOptions.template[answer.templateLang].taskName;
            step();
          });
        }
      } else {
        themeOptions.templateLang = cliOptions.templateLang;
        themeOptions.preprocessorChoice = cliOptions.preprocessor;
        step();
      }
    }
  ], function () {
    callback(themeOptions);
  });
}

function generateProject(projectOptions, themeSourceFolder, callback) {

  async.series([
    // Create Gruntfile and package.json based on user choices and cabin.json
    // config
    function (step) {

      // Create site directory
      utils.safeWriteDir(process.cwd() + '/' + projectOptions.siteName);

      // Render grunt-pages config with options, this is done to avoid having
      // a template within a template
      projectOptions.gruntPages = _.template(prettyStringify(projectOptions.gruntPages, { initialIndent: 2 }), projectOptions);

      // Render Gruntfile with options and with pre-rendered grunt-pages
      // config
      utils.renderTemplate('_Gruntfile.js', projectOptions.siteName + '/Gruntfile.js', projectOptions, step);
    },

    function (step) {
      // Render package.json with dependencies based on what preprocessor is
      // being used
      utils.renderTemplate('_package.json', projectOptions.siteName + '/package.json', projectOptions, step);
    },

    // Download theme from GitHub
    function (step) {
      copyTheme(projectOptions, process.cwd() + '/' + themeSourceFolder);
      if (!projectOptions.local) {
        wrench.rmdirSyncRecursive(themeSourceFolder);
      }
      step();
    }
  ], function () {
    callback();
  });
}

/**
 * Copys a theme into the target folder
 * @param  {Object} options     User-selected options about the template language and CSS preprocessor
 * @param  {String} themeSourceFolder Location of theme to be copied
 */
function copyTheme(options, themeSourceFolder) {
  wrench.copyDirSyncRecursive(themeSourceFolder + '/posts', options.siteName + '/posts');
  wrench.copyDirSyncRecursive(themeSourceFolder + '/src', options.siteName + '/src', {
    filter: new RegExp('(' + getExcludedExtensions(options).join('|') + ')$')
  });
}

/**
 * Determine the file extensions to exclude from the theme when copying theme files
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
 * Ask user if they want to file an issue about invalid theme
 * @param  {String} theme Invalid theme repo
 **/
function invalidThemePrompt(theme) {

  console.log('This theme has an invalid cabin.json.');
  inquirer.prompt({
    type: 'list',
    name: 'choice',
    message: 'File an issue on GitHub?',
    choices: ['Yes', 'No']
  }, function (answer) {
    if (answer.choice === 'Yes') {
      require('open')('https://github.com/' + theme + '/issues/new?title=Invalid%20cabin.json%20configuration');
    } else if (answer.choice === 'No') {
      console.log('bummer :(');
    }
    console.log('Looks like you\'ll have to use another theme');
    process.exit(1);
  });
}
