'use strict';

module.exports = function (grunt) {
  var azure = require('azure');
  var util = require('util');
  var path = require('path');
  var zlib = require('zlib');
  var fs = require('fs');
  var os = require('os');
  var crypto = require('crypto');
  var mime = require('mime');

  grunt.registerMultiTask('azure-storage', 'Copy files to azure storage blob', function () {
    var options = this.options({
      serviceOptions: [], // custom arguments to azure.createBlobService
      containerName: null, // container name, required
      destinationFolderPath: '' // deletes container if it exists
    });

    if (!options.containerName) {
      grunt.fatal("containerName is required");
    }

    var blobService = azure.createBlobService.apply(azure, options.serviceOptions);

    // set up async callback
    var that = this;
    var done = (function () {
      var async = that.async();
      var count = that.files.length;

      return function () {
        if (--count === 0) {
          async();
        }
      };
    })();

    // TODO clear destination folder


    // create container and insert files
    (function () {
      blobService.createContainerIfNotExists(options.containerName, options.containerOptions, function (err) {
        if (err) {
          if (err.code === 'ContainerBeingDeleted') {
            grunt.fatal("Container being deleted, retrying in 10 seconds");
          }
          grunt.warn(err);
        }

        // loop files
        that.files.forEach(function (f) {
          grunt.util.async.forEachSeries(f.src, function (source, next) {
            var destination = options.destinationFolderPath + source;
            grunt.log.writeln("copying file %s", destination);

            // copy file
            var copy = function () {
              blobService.createBlockBlobFromFile(options.containerName, destination, source, {}, function (err) {
                if (err) {
                  grunt.warn(err);
                }

                var act = 'Copied';
                var msg = util.format('%s %s to azure (%s/%s)', act, source, options.containerName, destination);
                grunt.log.writeln(msg);
                next();
              });
            };
            copy();
          }, done);
        });
      });
    })();
  });
};
