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
      serviceOptions : [], // custom arguments to azure.createBlobService
      containerName : null, // container name, required
      destinationFolderPath : '', // path within container
      numberOfFoldersToStripFromSourcePath: 0 // because files are passed to the task with path relative to GruntFile we may not want to have the full path in CDN 
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
          // strip unneeded path
          if(options.numberOfFoldersToStripFromSourcePath){
            source = path.join.apply(path, source.split(path.sep).slice(options.numberOfFoldersToStripFromSourcePath));
          }
          var destination = options.destinationFolderPath + source;

          grunt.log.writeln("copying file %s", destination);

          // copy file
          var copy = function () {
            blobService.createBlockBlobFromFile(options.containerName, destination, source, {}, function (err) {
              if (err) {
                grunt.warn(err);
              }

              var msg = util.format('Copied %s to azure (%s/%s)', source, options.containerName, destination);
              grunt.log.writeln(msg);
            });
          };
//          copy();
          next();
        }, done);
      });
    });
  });
};
