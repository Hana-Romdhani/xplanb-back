# Database Relationships - Visual Diagram

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER Collection                          │
│  _id: ObjectId                                                   │
│  firstName, lastName, email, ...                                 │
└─────────────────────────────────────────────────────────────────┘
         ▲                    ▲                    ▲
         │                    │                    │
         │                    │                    │
    (owner)              (shared)            (creator/editor)
         │                    │                    │
         │                    │                    │
┌────────┴────────┐   ┌───────┴────────┐   ┌──────┴─────────────┐
│  FOLDER         │   │  FOLDER        │   │  DOCUMENTS          │
│                 │   │  (shared)      │   │                     │
│  _id            │   │                │   │  _id               │
│  Name (UNIQUE)  │   │  _id           │   │  Title             │
│  user: ObjectId │   │  sharedWith:   │   │  folderId: ObjectId │
│  documents: []  │   │    [ObjectId]  │   │  createdBy: ObjectId│
│  sharedWith: [] │   │  userAccess:[] │   │  lastEditedBy: ...  │
│  userAccess: [] │   │                │   │  sharedWith: []    │
│  contents: []   │   │                │   │  userAccess: []     │
└────────┬────────┘   └────────────────┘   │  contentType: []   │
         │                                    │  archived: boolean │
         │                                    │  version: number   │
         │                                    │  statistics: {...} │
         │                                    └──────────┬─────────┘
         │                                              │
         │                                    (one-to-one)
         │                                              │
         │                                    ┌─────────▼─────────┐
         │                                    │  CONTENT          │
         │                                    │                   │
         │                                    │  _id              │
         │                                    │  documentId: str  │
         │                                    │    (UNIQUE)       │
         │                                    │  content: string  │
         │                                    │  creationDate     │
         │                                    │  updatedDate      │
         │                                    └───────────────────┘
         │
         │
    (contains)
         │
         │
┌────────▼────────────────────────────────────────────────────────┐
│                    DOCUMENTS in Folder.documents[]               │
│                                                                   │
│  When document created:                                          │
│    1. Documents.folderId = Folder._id                            │
│    2. Folder.documents.push(Documents._id)                       │
│                                                                   │
│  When document moved:                                            │
│    1. Old Folder.documents.pull(Documents._id)                   │
│    2. New Folder.documents.push(Documents._id)                   │
│    3. Documents.folderId = New Folder._id                       │
└──────────────────────────────────────────────────────────────────┘
```

## Relationship Types

### 1. Folder → Documents (One-to-Many)
```
Folder (1) ──────< (many) Documents
```
- **Folder.documents**: Array of document ObjectIds
- **Documents.folderId**: Reference to folder ObjectId
- **Required**: Every document MUST have a folderId

### 2. Documents → Content (One-to-One)
```
Documents (1) ────── (1) Content
```
- **Content.documentId**: Unique reference to Documents._id
- **Enforced**: Unique index on Content.documentId
- **Storage**: Content stored separately for performance

### 3. User → Folder (Many-to-One for ownership)
```
User (1) ──────< (many) Folder
```
- **Folder.user**: Owner of the folder
- **Folder.sharedWith**: Array of users with access

### 4. User → Documents (Many-to-One for creation)
```
User (1) ──────< (many) Documents
```
- **Documents.createdBy**: Creator of the document
- **Documents.lastEditedBy**: Last user who edited
- **Documents.sharedWith**: Array of users with access

## Data Integrity Rules

### 1. Document Creation Flow
```
┌──────────┐
│  Create  │
│ Document │
└────┬─────┘
     │
     ├─→ 1. Create Documents entry
     │      - Set folderId (REQUIRED)
     │      - Set createdBy
     │
     ├─→ 2. Add to Folder.documents[]
     │      - Folder.documents.push(documentId)
     │
     └─→ 3. Create Content entry
            - Set documentId = Documents._id
            - Set initial content (JSON string)
```

### 2. Content Update Flow
```
┌──────────────┐
│  Update      │
│  Content     │
└──────┬───────┘
       │
       ├─→ 1. Check for duplicates
       │      - Find all Content with same documentId
       │      - Delete duplicates (keep most recent)
       │
       ├─→ 2. Update existing Content
       │      - findOneAndUpdate({ documentId }, { content, updatedDate })
       │      - upsert: true (create if doesn't exist)
       │
       └─→ 3. Verify save
              - Check saved content matches sent content
```

### 3. Document Move Flow
```
┌──────────────┐
│  Move        │
│  Document    │
└──────┬───────┘
       │
       ├─→ 1. Get old folder
       │      - Find document's current folderId
       │
       ├─→ 2. Remove from old folder
       │      - OldFolder.documents.pull(documentId)
       │
       ├─→ 3. Update document
       │      - Documents.folderId = newFolderId
       │
       └─→ 4. Add to new folder
              - NewFolder.documents.push(documentId)
```

## Collection Summary

| Collection | Primary Key | Unique Fields | Required Fields | Relationships |
|------------|-------------|---------------|----------------|---------------|
| **folders** | `_id` | `Name` | `Name`, `user` | → User (owner)<br>→ Documents[]<br>→ User[] (shared) |
| **documents** | `_id` | None | `Title`, `folderId` | → Folder<br>→ User (creator)<br>→ User[] (shared)<br>→ Content (1:1) |
| **contents** | `_id` | `documentId` | `documentId`, `content` | → Documents (1:1) |

## Indexes

### Folders
- `Name`: **UNIQUE INDEX** - Prevents duplicate folder names

### Documents
- `folderId`: **INDEX** - Fast folder queries
- `createdBy`: **INDEX** - Fast user document queries
- `sharedWith`: **INDEX** - Fast shared document queries

### Contents
- `documentId`: **UNIQUE INDEX** - Prevents duplicates, ensures 1:1 relationship
- `documentId`: **INDEX** - Fast document content lookups

## Access Control

### Folder Access
- **Owner**: Full access (via `Folder.user`)
- **Shared Users**: Access via `Folder.sharedWith` + `Folder.userAccess`
- **Access Levels**: `'view'` or `'update'`

### Document Access
- **Owner**: Full access (via `Documents.createdBy`)
- **Shared Users**: Access via `Documents.sharedWith` + `Documents.userAccess`
- **Access Levels**: `'view'` or `'edit'`
- **Folder Access**: Inherits from folder if document is in shared folder

## Notes

1. **Content Separation**: Content is stored separately to:
   - Improve query performance (metadata vs. content)
   - Allow independent content versioning
   - Reduce document document size

2. **Bidirectional Updates**: When documents are created/moved, both:
   - Document's `folderId` is updated
   - Folder's `documents` array is updated

3. **Unique Constraints**: 
   - `Folder.Name` must be unique
   - `Content.documentId` must be unique (one content per document)

4. **Cascade Considerations**: 
   - Deleting a folder should handle its documents
   - Deleting a document should delete its content
   - Currently handled at application level, not database level

