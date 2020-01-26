# Notabug UI

Federated fork of classic reddit UI based on gunDB

> I think all censorship should be deplored. My position is that bits are **not a bug**.
>
> — Aaron Swartz (1986 - 2013)

**notabug** is a p2p link aggregator app that is:

- distributed: peers backup/serve content
- anonymous: but don't trust it to be
- psuedo-anonymous: users can create optional cryptographic identities
- immutable: edits are not supported for anonymous content
- mutable: edits are supported for authenticated content
- PoW-based: **voting is slow/CPU heavy**

## Setup Instructions

### Pre-Requisites

Git and Node + Yarn are required.

NVM is recommended: https://github.com/nvm-sh/nvm

    wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.2/install.sh | bash
    nvm install 12 && npm install -g yarn

### Notabug Server Install

    git clone https://github.com/notabugio/notabug.git && cd notabug
    yarn setup && yarn start

## Server Operation Commands

The commands necessary for operating a notabug server.  
They should be run in your notabug checkout's root directory.

### yarn setup

Installs yarn dependencies and builds all packages

### yarn start

Starts the server with pm2

### yarn stop

Stops running server if using pm2

### yarn logs

Tail pm2 server logs

### yarn status

Show pm2 status

### yarn reload

Hot-restart server worker process(es) if using pm2

### yarn gitupgrade

Pulls latest master, installs packages, rebuilds and hot reloads server in pm2

## Dev Commands

The commands are primarily useful for doing notabug development

### yarn server

Starts the server in foreground (pm2 is preferred/recommended)

Control+C to stop

### yarn buildchanges

Builds local changes only

### yarn buildall

Builds all packages
