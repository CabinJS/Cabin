'use strict';
module.exports = function (grunt) {
  grunt.initConfig({
    simplemocha: {
      options: {
        globals: ['should'],
        timeout: 10000,
        ignoreLeaks: false,
        ui: 'bdd',
        reporter: 'spec'
      },
      all: {
        src: ['test/*.js']
      }
    },
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      files: {
        src: [
          '*.js',
          'lib/*.js',
          'test/*.js'
        ]
      }
    },
    nodemon: {
      prod: {
        options: {
          file: 'bin/cabin',
          args: ['new', 'testsite'],
          nodeArgs: ['--debug-brk']
        }
      }
    }
  });

  grunt.registerTask('debug', ['nodemon']);
  grunt.registerTask('default', ['jshint', 'simplemocha']);

  require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);
};