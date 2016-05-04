'use strict';

var deploy = require('deploy-azure-cdn');
var path = require('path');
var fs = require('fs');

module.exports = function (grunt) {

    grunt.registerMultiTask('azure-cdn-deploy', 'Copy files to azure storage blob', function () {
        var files = [];
        this.files.forEach(function(file) {
            var cwd = file.cwd;
            files = files.concat(file.src.filter(function(src){
                return !fs.lstatSync(path.resolve(cwd, src)).isDirectory();
            }).map(function(src) {
                return {
                    path: path.resolve(cwd, src),
                    cwd: cwd
                };
            }));
        });
        var globalAsync = this.async();
        deploy(this.options(), files, grunt.log.debug, function (err) {
            if(err){
                grunt.log.error("Error while copying to azure " + err);
                globalAsync(false);
                return;
            }
            globalAsync();
        });
    });
};
