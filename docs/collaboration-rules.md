## Firestore rules for collaborators

Allow folder owners **and** collaborators to read/write their folders and items, and allow the public mirror to accept writes from them.

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isOwnerOrCollaborator(folderId) {
      return request.auth != null &&
        (
          resource.data.userId == request.auth.uid ||
          (resource.data.collaborators != null && request.auth.uid in resource.data.collaborators)
        );
    }

    match /folders/{folderId} {
      allow read: if request.auth != null && isOwnerOrCollaborator(folderId);
      allow write, update, delete: if request.auth != null && isOwnerOrCollaborator(folderId);
    }

    match /items/{itemId} {
      allow read: if request.auth != null && resource.data.folderId != null &&
        get(/databases/$(database)/documents/folders/$(resource.data.folderId)).data.userId in [request.auth.uid] ||
        request.auth.uid in get(/databases/$(database)/documents/folders/$(resource.data.folderId)).data.collaborators;

      allow create, update, delete: if request.auth != null && request.resource.data.folderId != null &&
        let folder = get(/databases/$(database)/documents/folders/$(request.resource.data.folderId)).data;
        folder.userId == request.auth.uid || request.auth.uid in folder.collaborators;
    }

    match /publicFolders/{folderId} {
      allow read: if true;
      allow write, update: if request.auth != null &&
        let folder = get(/databases/$(database)/documents/folders/$(folderId)).data;
        folder.userId == request.auth.uid || request.auth.uid in folder.collaborators;
      match /items/{itemId} {
        allow read: if true;
        allow write, update: if request.auth != null &&
          let folder = get(/databases/$(database)/documents/folders/$(folderId)).data;
          folder.userId == request.auth.uid || request.auth.uid in folder.collaborators;
      }
    }
  }
}
```

Adjust to fit your existing rules (e.g., add indexing, validation). Deploy via `firebase deploy --only firestore:rules` after merging.*** End Patch" }github प्रहरीलेಿ
