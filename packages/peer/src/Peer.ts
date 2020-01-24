import { Query } from './Query';
import { Thing } from './Thing';
import { Authentication } from './Authentication';

function init(Gun: any, config: any = {}) {
  const { leech = false, noGun = false, localStorage = false, persist = false, ...rest } =
    config || {};
  const peer: any = { config };

  if (!noGun) {
    const cfg = { localStorage: !!localStorage, radisk: !!persist, ...rest };

    if (persist) cfg.localStorage = false;
    if (cfg.storeFn) cfg.store = cfg.storeFn(cfg); // for indexeddb
    peer.Gun = Gun;
    peer.gun = new Gun(cfg);
    if (cfg.localStorage) peer.gun.on('localStorage:error', (a: any) => a.retry({}));
    if (leech) {
      const sendLeech = () => peer.gun._.on('out', { leech: true });

      sendLeech();
    }
  }

  peer.newScope = (opts: any) => Query.createScope(peer, opts);
  peer.onLogin = Authentication.onLogin(peer);
  peer.signup = Authentication.signup(peer);
  peer.login = Authentication.login(peer);
  peer.logout = () => Authentication.logout(peer);
  peer.isLoggedIn = () => Authentication.isLoggedIn(peer);
  peer.submit = Thing.submit(peer);
  peer.comment = Thing.comment(peer);
  peer.chat = Thing.chat(peer);
  peer.writePage = Thing.writePage(peer);
  peer.vote = Thing.vote(peer);
  peer.queries = Query;

  return peer;
}

export const Peer = {
  init
};
