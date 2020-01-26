# @notabug/nab-server

notabug.io socketcluster server

## Notabug Backend Architechture Components

### Socket Cluster

https://socketcluster.io

The SocketCluster frontend is the main user facing access point for notabug.

It manages HTTP responses and WebSocket connections that data transfers over.

Connections to SocketCluster can be authenticated (separate from UI facing login)

Authenticated logins may be granted additional privileges, such as the ability to subscribe to or publish to channels.

Currently SocketCluster serves the application JS as static files

#### SocketCluster Channels

- **gun/put**
  - This is where raw unvalidated put data is published by clients
  - Non-admin clients may not read this channel
  - Anyone may put to this channel
- **gun/nodes/:soul**
  - Channels exist for every gunDB soul
  - All clients may subscribe to these channels
  - Only admin clients may publish to these channels
  - The initial state of the node is sent when subscribing to these channels
- **gun/@:msgId**
  - These are for individual **get/put** request acknowledgments
  - All clients may subscribe to these channels
  - Only admin clients may publish to these channels
