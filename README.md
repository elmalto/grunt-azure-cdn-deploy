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
  destinationFolderPath: '' // path to put the files to. Default is root directory of container 
};
```

## Gruntfile example
```javascript
grunt.initConfig({
  'azure-storage': {
    options: {
      containerName: 'assets',
      destinationFolderPath: 'yahoo/app'
    },
    files: 'build/**/*.{html,js,css}'
  }
});
```
