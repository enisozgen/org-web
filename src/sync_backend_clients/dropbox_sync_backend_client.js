import { Dropbox } from 'dropbox';

import { fromJS, Map } from 'immutable';

export default accessToken => {
  const dropboxClient = new Dropbox({ accessToken });

  const transformDirectoryListing = listing => (
    fromJS(listing.map(entry => ({
      id: entry.id,
      name: entry.name,
      isDirectory: entry['.tag'] === 'folder',
      path: entry.path_display,
    })))
  );

  const getDirectoryListing = path => (
    new Promise((resolve, reject) => {
      dropboxClient.filesListFolder({ path }).then(response => (
        resolve({
          listing: transformDirectoryListing(response.entries),
          hasMore: response.has_more,
          additionalSyncBackendState: Map({
            cursor: response.cursor,
          }),
        })
      )).catch(reject);
    })
  );

  const getMoreDirectoryListing = additionalSyncBackendState => {
    const cursor = additionalSyncBackendState.get('cursor');
    return new Promise((resolve, reject) => (
      dropboxClient.filesListFolderContinue({ cursor }).then(response => (
        resolve({
          listing: transformDirectoryListing(response.entries),
          hasMore: response.has_more,
          additionalSyncBackendState: Map({
            cursor: response.cursor,
          }),
        })
      ))
    ));
  };

  const uploadFile = (path, contents) => (
    new Promise((resolve, reject) => (
      dropboxClient.filesUpload({
        path, contents,
        mode: {
          '.tag': 'overwrite',
        },
        autorename: true,
      }).then(resolve).catch(reject)
    ))
  );

  const updateFile = uploadFile;
  const createFile = uploadFile;

  const getFileContentsAndMetadata = path => (
    new Promise((resolve, reject) => (
      dropboxClient.filesDownload({ path }).then(response => {
        const reader = new FileReader();
        reader.addEventListener('loadend', () => resolve({
          contents: reader.result,
          lastModifiedAt: response.server_modified,
        }));
        reader.readAsText(response.fileBlob);
      })
    ))
  );

  const getFileContents = path => (
    new Promise((resolve, reject) => (
      getFileContentsAndMetadata(path).then(({ contents }) => resolve(contents)).catch(reject)
    ))
  );

  const deleteFile = path => (
    new Promise((resolve, reject) => (
      dropboxClient.filesDelete({ path }).then(resolve).catch(error => (
        reject(error.error.error['.tag'] === 'path_lookup', error)
      ))
    ))
  );

  return {
    type: 'Dropbox',
    getDirectoryListing,
    getMoreDirectoryListing,
    updateFile,
    createFile,
    getFileContentsAndMetadata,
    getFileContents,
    deleteFile,
  };
};
