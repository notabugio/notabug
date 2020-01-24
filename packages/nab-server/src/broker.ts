// tslint:disable-next-line: no-var-requires
require('dotenv').config()
import scClusterBrokerClient from 'scc-broker-client'
// tslint:disable-next-line: no-submodule-imports
import SCBroker from 'socketcluster/scbroker'

// tslint:disable-next-line: no-class
class Broker extends SCBroker {
  public run(): void {
    // tslint:disable-next-line: no-console
    console.log('   >> Broker PID:', process.pid)

    /*
      If either `SCC_STATE_SERVER_HOST='123.45.67.89' node server.js` environment variable is set,
      or `node server.js --cssh '123.45.67.89'` argument is provided,
      the broker will try to attach itself to the SC Cluster for automatic horizontal scalability.
      This is mostly intended for the Kubernetes deployment of SocketCluster - In this case,
      The clustering/sharding all happens automatically.
    */
    if (this.options.clusterStateServerHost) {
      scClusterBrokerClient.attach(this, {
        authKey: this.options.clusterAuthKey,
        clientPoolSize: this.options.clusterClientPoolSize,
        mappingEngine: this.options.clusterMappingEngine,
        stateServerAckTimeout: this.options.clusterStateServerAckTimeout,
        stateServerConnectTimeout: this.options
          .clusterStateServerConnectTimeout,
        stateServerHost: this.options.clusterStateServerHost,
        stateServerPort: this.options.clusterStateServerPort,
        stateServerReconnectRandomness: this.options
          .clusterStateServerReconnectRandomness
      })
    }
  }
}

// tslint:disable-next-line: no-unused-expression
new Broker()
