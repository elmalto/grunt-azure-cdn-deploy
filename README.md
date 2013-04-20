# grunt-azure-storage

Grunt task for copying files to an azure storage blob.

This fork is more specific than original. 
The use case is to deploy a web site to Azure Blob storage.

Azure SDK uses by default the environment variables AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_ACCESS_KEY.
Custom connection arguments can be set in service.

## Options and default values
```javascript
{
  serviceOptions: [], // custom arguments to azure.createBlobService
  containerName: null, // container name, required
  destinationFolderPath: '', // path to put the files to. Default is root directory of container 
  numberOfFoldersToStripFromSourcePath: 0 // because files are passed to the task with path relative to GruntFile we may not want to have the full path in CDN 
};
```

## Gruntfile example
```javascript
grunt.initConfig({
  'azure-storage': {
    options: {
      containerName: 'assets',
      destinationFolderPath: 'yahoo/app'
      serviceOptions : ['my-azure-cdn', 'UcQ1G6ETECDaXLV2C...my azure cdn key .../p0tZmzbjw=='], 
      numberOfFoldersToStripFromSourcePath: 1 // remove 'build' folder name from the CDN path 
    },
    files: 'build/**/*.{html,js,css}'
  }
});
```
