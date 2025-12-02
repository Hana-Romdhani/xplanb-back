# Database Structure: Folders, Documents, and Content

## Overview

The system uses **3 main collections** with the following relationships:

```
Folder (1) ──< (many) Documents (1) ──< (1) Content
```

- **Folders** contain multiple **Documents**
- **Documents** belong to one **Folder** (required)
- **Documents** have one **Content** entry (stored separately)
- **Content** is stored in a separate collection, not embedded in Documents

---

## 1. Folder Collection (`folders`)

### Schema Structure

```typescript
{
  _id: ObjectId,                    // Auto-generated
  Name: string,                     // REQUIRED, UNIQUE
  createdDate: Date,                // Auto-set on creation
  user: ObjectId,                   // REF: User (owner)
  documents: [ObjectId],            // REF: Documents[] (array of document IDs)
  sharedWith: [ObjectId],           // REF: User[] (users with access)
  userAccess: [{                    // Per-user access levels
    userId: ObjectId,               // REF: User
    access: 'view' | 'update'       // Access level
  }],
  contents: [ObjectId]             // REF: Content[] (NOTE: This field exists but may not be actively used)
}
```

### Key Points:
- ✅ **Name is UNIQUE** - No two folders can have the same name
- ✅ **Required field**: `Name`, `user` (owner)
- ✅ **Bidirectional relationship**: Folder stores document IDs, Documents store folderId
- ✅ **Sharing**: Supports sharing with multiple users and per-user access levels
- ✅ **Owner**: Each folder has one owner (`user` field)

### Relationships:
- **One-to-Many** with Documents (via `documents` array)
- **Many-to-One** with User (via `user` field - owner)
- **Many-to-Many** with User (via `sharedWith` array)

---

## 2. Documents Collection (`documents`)

### Schema Structure

```typescript
{
  _id: ObjectId,                    // Auto-generated
  Title: string,                    // REQUIRED
  createdDate: Date,                // Auto-set on creation
  updatedDate: Date,                // Auto-updated
  contentType: string[],            // Tags/categories (array of strings)
  folderId: ObjectId,               // REF: Folder - REQUIRED
  archived: boolean,                // Default: false
  
  // Versioning
  version: number,                  // Default: 1
  previousVersions: [ObjectId],     // REF: DocumentVersion[]
  
  // Ownership & Sharing
  createdBy: ObjectId,              // REF: User (creator)
  lastEditedBy: ObjectId,           // REF: User (last editor)
  sharedWith: [ObjectId],          // REF: User[] (users with access)
  userAccess: [{                   // Per-user access levels
    userId: ObjectId,               // REF: User
    access: 'view' | 'edit'         // Access level
  }],
  defaultAccess: 'view' | 'comment' | 'edit',  // Default: 'edit'
  
  // Statistics
  viewCount: number,                // Default: 0
  editCount: number,                // Default: 0
  commentCount: number,            // Default: 0
  shareCount: number,               // Default: 0
  lastViewedAt: Date,               // Optional
  viewedBy: [ObjectId],            // REF: User[] (users who viewed)
  favoritedBy: [ObjectId]          // REF: User[] (users who favorited)
}
```

### Key Points:
- ✅ **folderId is REQUIRED** - Every document MUST belong to a folder
- ✅ **Content is NOT stored here** - Content is in separate `Content` collection
- ✅ **Bidirectional relationship**: Document stores folderId, Folder stores document ID in `documents` array
- ✅ **Sharing**: Supports sharing with multiple users and per-user access levels
- ✅ **Statistics**: Tracks views, edits, comments, shares
- ✅ **Versioning**: Supports version tracking (references DocumentVersion collection)

### Relationships:
- **Many-to-One** with Folder (via `folderId` - REQUIRED)
- **Many-to-One** with User (via `createdBy`, `lastEditedBy`)
- **Many-to-Many** with User (via `sharedWith`, `viewedBy`, `favoritedBy`)
- **One-to-One** with Content (via `_id` → Content.documentId)

### Important Notes:
- When a document is created, it's automatically added to the folder's `documents` array
- When a document is moved to a different folder, both old and new folder's `documents` arrays are updated
- Content is stored separately in the `Content` collection

---

## 3. Content Collection (`contents`)

### Schema Structure

```typescript
{
  _id: ObjectId,                    // Auto-generated
  documentId: string,               // REQUIRED, UNIQUE, INDEXED - REF: Documents._id
  content: string,                  // REQUIRED - JSON string of Editor.js content
  creationDate: Date,               // Auto-set on creation
  updatedDate: Date                 // Auto-updated on save
}
```

### Key Points:
- ✅ **documentId is UNIQUE** - Only ONE content entry per document (enforced by unique index)
- ✅ **Content is a JSON string** - Stores Editor.js format: `{"time":...,"blocks":[...],"version":"..."}`
- ✅ **One-to-One relationship** - Each document has exactly one content entry
- ✅ **Separate collection** - Content is NOT embedded in Documents for performance

### Relationships:
- **One-to-One** with Documents (via `documentId` → Documents._id)

### Important Notes:
- When a document is created, a Content entry is automatically created with initial content
- Content is updated (not created new) when document is saved (using `findOneAndUpdate` with `upsert: true`)
- If duplicate content entries exist (from old code), they are automatically cleaned up on save
- Content is retrieved by `documentId`, sorted by `updatedDate` descending to get the latest

---

## Database Relationships Summary

### Folder ↔ Documents
```
Folder.documents: [ObjectId]  ←→  Documents.folderId: ObjectId
```
- **Bidirectional**: Folder stores document IDs, Documents store folder reference
- **When document created**: Added to folder's `documents` array
- **When document moved**: Removed from old folder, added to new folder

### Documents ↔ Content
```
Documents._id  ←→  Content.documentId (UNIQUE)
```
- **One-to-One**: Each document has exactly one content entry
- **Content stored separately**: Not embedded for performance
- **Retrieved by**: `Content.findByDocumentId(documentId)`

### User Relationships

**Folders:**
- `Folder.user`: Owner (Many-to-One)
- `Folder.sharedWith`: Shared users (Many-to-Many)
- `Folder.userAccess`: Per-user access levels

**Documents:**
- `Documents.createdBy`: Creator (Many-to-One)
- `Documents.lastEditedBy`: Last editor (Many-to-One)
- `Documents.sharedWith`: Shared users (Many-to-Many)
- `Documents.userAccess`: Per-user access levels
- `Documents.viewedBy`: Users who viewed (Many-to-Many)
- `Documents.favoritedBy`: Users who favorited (Many-to-Many)

---

## Data Flow

### Creating a Document:
1. Create `Documents` entry with `folderId` (required)
2. Add document `_id` to `Folder.documents` array
3. Create `Content` entry with `documentId = Documents._id` and initial content

### Updating Document Content:
1. Find existing `Content` by `documentId`
2. Update `Content.content` and `Content.updatedDate`
3. If duplicates exist, clean them up first

### Moving a Document:
1. Update `Documents.folderId`
2. Remove document ID from old `Folder.documents` array
3. Add document ID to new `Folder.documents` array

### Deleting a Document:
1. Remove document ID from `Folder.documents` array
2. Delete `Documents` entry
3. Delete associated `Content` entry (should be handled by cascade or manually)

---

## Indexes

### Folder Collection:
- `Name`: Unique index (enforced by schema)

### Documents Collection:
- `folderId`: Index (for efficient folder queries)
- `createdBy`: Index (for user document queries)
- `sharedWith`: Index (for shared document queries)

### Content Collection:
- `documentId`: **Unique index** (prevents duplicates, enforced by schema)
- `documentId`: Regular index (for efficient lookups)

---

## Important Constraints

1. ✅ **Every document MUST have a folderId** - Enforced at application level
2. ✅ **Content.documentId is UNIQUE** - Enforced by database unique index
3. ✅ **Folder.Name is UNIQUE** - Enforced by database unique index
4. ✅ **One content entry per document** - Enforced by unique index and cleanup logic

---

## Potential Issues & Solutions

### Issue: Duplicate Content Entries
**Problem**: Multiple content entries for same document
**Solution**: 
- Unique index on `documentId` prevents new duplicates
- Cleanup logic in `ContentRepository.create()` removes existing duplicates

### Issue: Orphaned Content
**Problem**: Content exists without corresponding document
**Solution**: Should be handled by cascade delete or manual cleanup

### Issue: Folder.documents Array Out of Sync
**Problem**: Document exists but not in folder's documents array
**Solution**: Repository methods ensure synchronization when creating/moving documents

---

## Schema Files Location

- `Backend/src/folder/folder.schema.ts` - Folder schema
- `Backend/src/document/document.schema.ts` - Documents schema
- `Backend/src/content/content.schema.ts` - Content schema

---

## Repository Files Location

- `Backend/src/folder/folder.repository.ts` - Folder operations
- `Backend/src/document/document.repository.ts` - Document operations
- `Backend/src/content/content.repository.ts` - Content operations

