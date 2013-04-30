'use strict';

module.exports = function (grunt) {
  var azure = require('azure');
  var util = require('util');
  var path = require('path');

  grunt.registerMultiTask('azure-cdn-deploy', 'Copy files to azure storage blob', function () {
    var options = this.options({
      serviceOptions : [], // custom arguments to azure.createBlobService
      containerName : null, // container name, required
      containerOptions: {publicAccessLevel: "blob"}, // container options
      destinationFolderPath : '', // path within container
      concurrentUploadThreads : 10, // number of concurrent uploads, choose best for your network condition
      numberOfFoldersToStripFromSourcePath : 0, // because files are passed to the task with path relative to GruntFile we may not want to have the full path in CDN
      printUrlToFile: '' // pass any of the files that will be uploaded and after upload the plugin will output the URL to console 
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
      blobService.listBlobs(options.containerName, {prefix : options.destinationFolderPath}, function (err, blobs) {
        if (err) {
          grunt.fatal("Container being deleted, retrying in 10 seconds");
        }
        grunt.util.async.forEach(blobs, function (blob, next) {
          grunt.log.debug("deleting file %s", blob.name);
          blobService.deleteBlob(options.containerName, blob.name, function (err, success) {
            if (err) {
              grunt.log.debug("Error while deleting blob %s: %s", blob.name);
              grunt.warn(err);
            }
            grunt.log.debug("deleted %s", blob.url);
            next();
          });
        }, function () {
          grunt.log.debug("uploading blobs now");
          upload();
        })
      });

      // upload files
      function upload() {
        that.files.forEach(function (f) {
          grunt.util.async.forEachLimit(f.src, options.concurrentUploadThreads, function (source, next) {
            // strip unneeded path
            var destination = source;
            if (options.numberOfFoldersToStripFromSourcePath) {
              destination = path.join.apply(path, source.split(path.sep).slice(options.numberOfFoldersToStripFromSourcePath));
            }
            destination = options.destinationFolderPath + destination;
            // upload file
            var upload = function () {
              grunt.log.debug("Uploading file %s", source);
              blobService.createBlockBlobFromFile(options.containerName, destination, source, {}, function (err, blob) {
                if (err) {
                  grunt.log.debug("Error while copying to azure");
                  grunt.warn(err);
                }
                var msg = util.format('Uploaded %s to azure (%s/%s)', source, options.containerName, destination);
                grunt.log.debug(msg);
                if(source === options.printUrlToFile){
                  blobService.listBlobs(options.containerName, {prefix : destination}, function (err, blobs) {
                    grunt.log.ok("Uploaded to", blobs[0].url);
                    next();
                  });
                } else {
                  next();
                }
              });
            };
            upload();
          }, doneUpload);
        });
      }
    });
  });
};
