# grunt-azure-cdn-deploy

Grunt task for copying a directory to azure CDN storage.

Azure SDK uses by default the environment variables AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_ACCESS_KEY.
Custom connection arguments can be set in service.

## Options and default values
```javascript
{
  serviceOptions: [], // custom arguments to azure.createBlobService
  containerName: null, // container name, required
  containerOptions: {publicAccessLevel: "blob"}, // container options
  destinationFolderPath: '', // path to put the files to. Default is root directory of container
  noDeleteExistingBlobs: false, // set it to true to skip deleting blobs in the folder you upload and all the subfolders
  concurrentUploadThreads : 10, // number of concurrent uploads, choose best for your network condition
  numberOfFoldersToStripFromSourcePath: 0, // because files are passed to the task with path relative to GruntFile we may not want to have the full path in CDN
  printUrlToFile: '', // pass any of the files that will be uploaded and after upload the plugin will output the URL to console
  gzip: false, // true if want to gzip the files before uploading. File will be zipped only if compressed file is smaller than original
  metadata: {cacheControl: 'public, max-age=31556926'} // metadata for each uploaded file
};
```

## Gruntfile example
```javascript
grunt.initConfig({

  'azure-cdn-deploy': {
    app: {
      options: {
          containerName: 'latest-web',
          serviceOptions : ['my-azure-cdn', 'UcQ1G6ETECDaXLV2C...my azure cdn key .../p0tZmzbjw=='], 
          numberOfFoldersToStripFromSourcePath: 2,
          destinationFolderPath: 'dev/app'
      },
      src: [
          'build/app/**/*.{html,js,png,css,ico}'
      ]
    },
    deps: {
      options: {
          containerName: 'latest-web',
          serviceOptions : ['my-azure-cdn', 'UcQ1G6ETECDaXLV2C...my azure cdn key .../p0tZmzbjw=='], 
          numberOfFoldersToStripFromSourcePath: 2,
          destinationFolderPath: 'dev/components'
      },
      src: [
          'build/components/**/*.{html,js,png,css}'
      ]
    }
  }
});
```

Thanks to https://github.com/jstott/grunt-azureblob and https://github.com/litek/grunt-azure-storage for inspiration.