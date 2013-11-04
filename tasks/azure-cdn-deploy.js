'use strict';

module.exports = function (grunt) {
    var azure = require('azure');
    var util = require('util');
    var path = require('path');
    var Q = require('q');
    var zlib = require('zlib');
    var mime = require('mime');
    var fs = require('fs');

    grunt.registerMultiTask('azure-cdn-deploy', 'Copy files to azure storage blob', function () {
        var options = this.options({
            serviceOptions: [], // custom arguments to azure.createBlobService
            containerName: null, // container name, required
            containerOptions: {publicAccessLevel: "blob"}, // container options
            destinationFolderPath: '', // path within container
            noDeleteExistingBlobs: false, // set it to true to skip deleting blobs in the folder you upload and all the subfolders
            concurrentUploadThreads: 10, // number of concurrent uploads, choose best for your network condition
            numberOfFoldersToStripFromSourcePath: 0, // because files are passed to the task with path relative to GruntFile we may not want to have the full path in CDN
            printUrlToFile: '', // pass any of the files that will be uploaded and after upload the plugin will output the URL to console
            gzip: false, // gzip files
            metadata: {cacheControl: 'public, max-age=31556926'} // metadata for each uploaded file
        });

        if (!options.containerName) {
            grunt.fatal("containerName is required");
        }
        var blobService = azure.createBlobService.apply(azure, options.serviceOptions);
        // set up async callback
        var that = this;
        var globalAsync = this.async();

        createContainer()
            .then(deleteAllExistingBlobs)
            .then(uploadBlobs)
            .then(function () {
                globalAsync();
            }, function (error) {
                grunt.warn("Error while copying to azure " + error);
            });


        function createContainer() {
            var deferred = Q.defer();
            blobService.createContainerIfNotExists(options.containerName, options.containerOptions, function (err) {
                if (err) {
                    if (err.code === 'ContainerBeingDeleted') {
                        grunt.fatal("Container being deleted, retry in 10 seconds");
                    }
                    deferred.reject(err);
                }
                deferred.resolve();
            });
            return deferred.promise;
        }

        function deleteAllExistingBlobs() {
            var deferred = Q.defer();
            if(options.noDeleteExistingBlobs){
                grunt.log.debug("skip deleting blobs");
                deferred.resolve();                
            } else {
                // removing all blobs in destination structure
                blobService.listBlobs(options.containerName, {prefix: options.destinationFolderPath}, function (err, blobs) {
                    if (err) {
                        grunt.log.debug(err);
                        deferred.reject("Container being deleted, retrying in 10 seconds");
                    }
                    grunt.util.async.forEach(blobs, function (blob, next) {
                        grunt.log.debug("deleting file %s", blob.name);
                        blobService.deleteBlob(options.containerName, blob.name, function (err, success) {
                            if (err) {
                                grunt.log.debug("Error while deleting blob %s: %s", blob.name);
                                deferred.reject(err);
                            }
                            grunt.log.debug("deleted %s", blob.url);
                            next();
                        });
                    }, function () {
                        grunt.log.debug("done deleting blobs");
                        deferred.resolve();
                    })
    
                });
            }
            return deferred.promise;
        }

        function uploadBlobs() {
            var deferred = Q.defer();
            var remaining = that.files.length;
            that.files.forEach(function (file) {
                grunt.util.async.forEachLimit(file.src, options.concurrentUploadThreads, function (source, next) {
                    // strip unneeded path
                    var meta, fnCopyToBlob;
                    var destination = source;
                    if (options.numberOfFoldersToStripFromSourcePath) {
                        destination = path.join.apply(path, source.split(path.sep).slice(options.numberOfFoldersToStripFromSourcePath));
                    }
                    destination = options.destinationFolderPath + destination;
                    // upload file
                    grunt.log.debug("Uploading file %s", source);
                    meta = clone(options.metadata);
                    meta.contentType = mime.lookup(source);
                    fnCopyToBlob = options.gzip ? compressFileToBlobStorage : copyFileToBlobStorage;
                    fnCopyToBlob(options.containerName, destination, source, meta).
                        then(function () {
                            var msg = util.format('Uploaded %s to azure (%s/%s)', source, options.containerName, destination);
                            grunt.log.debug(msg);
                            if (source === options.printUrlToFile) {
                                blobService.listBlobs(options.containerName, {prefix: destination}, function (err, blobs) {
                                    grunt.log.ok("Uploaded to", blobs[0].url);
                                    next();
                                });
                            } else {
                                next();
                            }
                        }, function (err) {
                            grunt.log.debug("Error while copying to azure");
                            deferred.reject(err);
                        });
                }, function () {
                    // all files in a group uploaded
                    remaining--;
                    if (remaining === 0) {
                        deferred.resolve();
                    }
                });
            });
            return deferred.promise;
        }

        function compressFileToBlobStorage(containerName, destFileName, sourceFile, metadata) {
            return gzipFile(sourceFile, sourceFile, metadata)
                .then(function (tmpFile) {
                    return chooseSmallerFileAndModifyContentType(tmpFile, sourceFile, metadata);
                })
                .then(function (res) {
                    grunt.log.debug("Based on file size decided to upload %s with contentEncoding %s", res.fileToUpload, res.updatedMetadata.contentEncoding);
                    return copyFileToBlobStorage(containerName, destFileName, res.fileToUpload, res.updatedMetadata)
                        .finally(function(){
                            fs.unlinkSync(res.zippedTmpFile);
                        });
                });
        }

        function copyFileToBlobStorage(containerName, destFileName, sourceFile, metadata) {
            var deferred = Q.defer();
            blobService.createBlockBlobFromFile(containerName, destFileName, sourceFile, metadata, function(err) {
                if (err) {
                    grunt.log.error(err);
                    deferred.reject(err);
                } else {
                    deferred.resolve();
                }
            });
            return deferred.promise;
        }
      
        function chooseSmallerFileAndModifyContentType(compressedFile, originalFile, metadata) {
            var deferred = Q.defer();
            fs.stat(compressedFile, function (err, compressedStats) {
                if(err){
                    deferred.reject(err);
                    return;
                }
                fs.stat(originalFile, function (err, originalStats) {
                    if(err){
                        deferred.reject(err);
                        return;
                    }
                    if(originalStats.size < compressedStats.size){
                        // don't upload compressed if it becomes bigger 
                        deferred.resolve({
                            zippedTmpFile: compressedFile,
                            fileToUpload: originalFile,
                            updatedMetadata: metadata
                        });
                    } else {
                        metadata.contentEncoding =  'gzip';
                        deferred.resolve({
                            zippedTmpFile: compressedFile,
                            fileToUpload: compressedFile,
                            updatedMetadata: metadata
                        });
                    }
                });

            });
            return deferred.promise;
        }

        function gzipFile(source){
            var tempFile;
            var deferred = Q.defer(),
                gzip = zlib.createGzip({
                    level: 9 // maximum compression
                }),
                inp,
                out;

            gzip.on('error', function(err) {
                grunt.log.error(err);
                deferred.reject(err);
            });

            inp = fs.createReadStream(source);
            tempFile = source + '.zip';
            out = fs.createWriteStream(tempFile);
            out.on('close', function() {
                deferred.resolve(tempFile);
            });
            inp.pipe(gzip).pipe(out);
            return deferred.promise;
        }

        function clone(obj) {
            if (null == obj || "object" != typeof obj) return obj;
            var copy = obj.constructor();
            for (var attr in obj) {
                if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
            }
            return copy;
        }

    });
};
