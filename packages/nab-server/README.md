# @notabug/nab-server

notabug.io server meta-project

## Notabug Backend Architechture Components

### Socket Cluster frontend

The SocketCluster frontend is the main user facing access point for notabug.

It manages HTTP responses and WebSocket connections that all data transfers over.

Connections to SocketCluster can be authenticated (separate from UI facing login)

Authenticated logins may be granted additional privileges, such as the ability to subscribe to or publish to channels.

Currently SocketCluster serves the application JS as static files

#### SocketCluster Channels

 - **gun/put**
   - This is where raw unvalidated put data is published by clients
   - Non-admin clients may not read this channel
   - Anyone may put to this channel
 - **gun/put/validated**
   - This is **gun/put** filtered for valid messages
   - All clients may subscribe to this channel
   - Only admin clients may publish to this channel
 - **gun/put/diff**
   - All database differences, and only differences are published to this channel
   - All clients may subscribe to this channel
   - Only admin clients may publish to this channel
 - **gun/nodes/:soul**
   - Channels exist for every gunDB soul
   - All clients may subscribe to these channels
   - Only admin clients may publish to these channels
   - The initial state of the node is sent when subscribing to these channels
 - **gun/get**
   - Raw, unvalidated get requests can be published by clients here
   - Non-admin clients may not read this channel
   - This is not really used currently
 - **gun/get/validated**
   - This is **gun/get** filtered for valid messages
   - All clients may subscribe to this channel
   - Only admin clients may publish to this channel
   - This is only used internally currently
 - **gun/@:msgId**
   - These are for individual **get/put** request acknowledgments
   - All clients may subscribe to these channels
   - Only admin clients may publish to these channels

### Validator

Responsible for user input sanitization and front line defense

  - authenticates as an admin client
  - subscribes to **gun/put** and **gun/get**
  - validates incoming messages
  - published validated messages to **gun/put/validated** and **gun/get/validated**

### Storage

Currently, LMDB is used as a storage backend.

The storage process:

  - authenticates as an admin client
  - Handles writes:
    - subscribes to **gun/put/validated**
    - compares incoming data to existing data with CRDT
    - generates a diff (partial graph data) for any changes
    - publishes the diff to **gun/put/diff**
    - publishes individual updates for each updated soul in the diff to **gun/nodes/:soul**
  - Handles read requests:
    - subscribes to **gun/get/validated**
    - responds by publishing data to **gun/@:msgId** where msgId is the unique message identifier of the request

### Tabulator

The tabulator counts votes and updates aggregate data for things

  - can be totally unprivileged but must identify with an account
  - subscribes to **gun/put/diff**
  - looks for votes/comments that would change counts
  - publishes updated count data to **gun/put** signed as tabulator


### Indexer

The indexer builds sorted lists of things and updates these lists in response to data changes

  - can be totally unprivileged but must identify with an account
  - subscribes to **gun/put/diff**
  - looks for things and tabulation updates that would change listings
  - publishes updated listings to **gun/put** signed as the indexer
