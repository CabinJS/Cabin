var mountFolder = function (connect, dir) {
  return connect.static(require('path').resolve(dir));
};

module.exports = function (grunt) {

  require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

  grunt.initConfig({
    watch: {
      options: {
        livereload: true
      },<% if (preprocessor) { %>
      <%= preprocessor %>: {
        files: ['src/styles/{,*/}*'],
        tasks: ['<%= preprocessor %>']
      },<% } else { %>
      css: {
        files: ['src/styles/{,*/}*']
      },<% } %>
      pages: {
        files: ['src/pages/{,*/}*', 'posts/{,*/}*', 'src/layouts/{,*/}*'],
        tasks: ['pages']
      }
    },
    pages: <%= gruntPages %>,
    connect: {
      dist: {
        options: {
        port: 9000,
        hostname: 'localhost',
          middleware: function (connect) {
            return [
              mountFolder(connect, 'site'),
              mountFolder(connect, 'src')
            ];
          }
        }
      }
    },
    open: {
      dist: {
        path: 'http://localhost:9000'
      }
    },
    clean: {
      dist: 'site'
    },<% if (preprocessor === 'compass') { %>
    compass: {
      options: {
        sassDir: 'src/styles',
        cssDir: 'site/styles'
      },
      dist: {}
    },<% } %><% if (preprocessor === 'less') { %>
    less: {
      dist: {
        options: {
          paths: ['src/styles']
        },
        files: {
          'site/styles/main.css': 'src/styles/main.less'
        }
      }
    },<% } %>
    // Move files not handled by other tasks
    copy: {
      dist: {
        files: [{
          expand: true,
          dot: true,
          cwd: 'src',
          dest: 'site',
          src: [
            '*.{ico,txt}',
            '.htaccess',
            'images/{,*/}*'
          ]
        }]
      }
    }
  });

  grunt.registerTask('build', [
    'clean',
    <% if (preprocessor) %>'<%= preprocessor %>',
    'pages',
    'copy'
  ]);

  grunt.registerTask('server', [
    'build',
    'connect',
    'open',
    'watch'
  ]);

  grunt.registerTask('default', 'build');
};
