'use strict';

var deploy = require('deploy-azure-cdn');

module.exports = function (grunt) {

    grunt.registerMultiTask('azure-cdn-deploy', 'Copy files to azure storage blob', function () {
        var files = this.files;
        var globalAsync = this.async();
        try {
            deploy(this.options, files, logger, function (err) {
                if (err) {
                    self.emit('error', new gutil.PluginError(PLUGIN_NAME, err));
                }
                globalAsync();
            })
        } catch (err) {
            grunt.warn("Error while copying to azure " + error);
            globalAsync(error);
        }
    });
};
