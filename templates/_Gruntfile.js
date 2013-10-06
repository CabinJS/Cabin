module.exports = function (grunt) {

  grunt.initConfig({
    pages: <%= gruntPagesConfig %>,<% if (CSSPreprocessorTask === 'compass') { %>
    compass: {
      dist: {
        options: {
          sassDir: 'src/styles',
          cssDir: 'dist/styles'
        }
      }
    },<% } else if (CSSPreprocessorTask === 'less') { %>
    less: {
      dist: {
        options: {
          paths: ['src/styles']
        },
        files: {
          'dist/styles/main.css': 'src/styles/main.less'
        }
      }
    },<% } %>
    copy: {
      dist: {
        files: [{
          expand: true,
          dot: true,
          cwd: 'src',
          dest: 'dist',
          src: [
            'images/**',
            'scripts/**',
            'styles/**.css',
            'styles/fonts/**',
          ]
        }]
      }
    },
    watch: {
      pages: {
        files: [
          'posts/**',
          'src/layouts/**',
          'src/pages/**'
        ],
        tasks: ['pages']
      },<% if (CSSPreprocessorTask) { %>
      <%= CSSPreprocessorTask %>: {
        files: ['src/styles/**'],
        tasks: ['<%= CSSPreprocessorTask %>']
      },<% } %>
      copy: {
        files: [
          'src/images/**',
          'src/scripts/**',
          'src/styles/**.css',
          'src/styles/fonts/**'
        ],
        tasks: ['copy']
      },
      dist: {
        files: ['dist/**'],
        options: {
          livereload: true
        }
      }
    },
    connect: {
      dist: {
        options: {
          port: 5455,
          hostname: '0.0.0.0',
          middleware: function (connect) {
            return [
              require('connect-livereload')(),
              connect.static(require('path').resolve('dist'))
            ];
          }
        }
      }
    },
    open: {
      dist: {
        path: 'http://localhost:5455'
      }
    },
    clean: {
      dist: 'dist'
    }
  });

  grunt.registerTask('build', [
    'clean',
    'pages',
    <% if (CSSPreprocessorTask) %>'<%= CSSPreprocessorTask %>',
    'copy'
  ]);

  grunt.registerTask('server', [
    'build',
    'connect',
    'open',
    'watch'
  ]);

  grunt.registerTask('default', 'server');

  require('load-grunt-tasks')(grunt);
};
