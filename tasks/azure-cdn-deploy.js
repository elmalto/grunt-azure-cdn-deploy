'use strict';

module.exports = function (grunt) {
  var azure = require('azure');
  var util = require('util');
  var path = require('path');

  grunt.registerMultiTask('azure-cdn-deploy', 'Copy files to azure storage blob', function () {
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
    var doneUpload = (function () {
      var async = that.async();
      var count = that.files.length;
      return function () {
        if (--count === 0) {
          async();
        }
      };
    })();


    blobService.createContainerIfNotExists(options.containerName, options.containerOptions, function (err) {
      if (err) {
        if (err.code === 'ContainerBeingDeleted') {
          grunt.fatal("Container being deleted, retry in 10 seconds");
        }
        grunt.warn("Error while copying to azure %s", err);
      }

      // removing all blobs in destination structure
      blobService.listBlobs(options.containerName, {prefix: options.destinationFolderPath}, function (err, blobs) {
        if(err){
          grunt.fatal("Container being deleted, retrying in 10 seconds");
        }
        grunt.util.async.forEach(blobs, function (blob, next) {
          grunt.log.writeln("deleting file %s", blob.name);
          blobService.deleteBlob(options.containerName, blob.name, function (err, success) {
            if(err){
              grunt.log.writeln("Error while deleting blob %s: %s", blob.name);
              grunt.warn(err);
            }
            grunt.log.writeln("deleted %s", blob.url);
            next();
          });
        }, function () {
          grunt.log.writeln("uploading blobs now");
          upload();
        })
      });

      // upload files
      function upload(){
        that.files.forEach(function (f) {
          grunt.util.async.forEachLimit(f.src, 10, function (source, next) {
            // strip unneeded path
            var destination = source;
            if(options.numberOfFoldersToStripFromSourcePath){
              destination = path.join.apply(path, source.split(path.sep).slice(options.numberOfFoldersToStripFromSourcePath));
            }
            destination = options.destinationFolderPath + destination;
            // copy file
            var copy = function () {
              grunt.log.writeln("Uploading file %s", source);
              blobService.createBlockBlobFromFile(options.containerName, destination, source, {}, function (err) {
                if (err) {
                  grunt.log.writeln("Error while copying to azure");
                  grunt.warn(err);
                }
                var msg = util.format('Uploaded %s to azure (%s/%s)', source, options.containerName, destination);
                grunt.log.writeln(msg);
                next();
              });
            };
            copy();
//                        next();
          }, doneUpload);
        });
      }
    });
  });
};
