import * as R from 'ramda';

const signup = R.curry(
  (peer, username, password, opts = {}) =>
    new Promise((ok, fail) => {
      if (peer && peer.gun && peer.gun.user) {
        const user = peer.gun.user();
        user.create(
          username,
          password,
          (ack: any) => {
            if (ack.err) {
              fail(ack.err);
              user.leave();
              peer.gun.user().leave();
            } else {
              peer.login(username, password).then(ok);
            }
          },
          opts
        );
      } else {
        fail('SEA is not loaded');
      }
    })
);

const login = R.curry((peer, username, password) =>
  new Promise((ok, fail) => {
    if (peer && peer.gun && peer.gun.user) {
      const user = peer.gun.user();

      user.auth(username, password, (ack: any) =>
        ack.err ? fail(ack.err) : ok(peer.gun.user().is)
      );
    } else {
      fail('SEA is not loaded');
    }
  }).then(result => {
    peer._onLogin && peer._onLogin(result); // eslint-disable-line
    return result;
  })
);

const logout = (peer: any) => peer.gun.user().leave();
const isLoggedIn = (peer: any) => peer.gun && peer.gun.user && peer.gun.user().is;
const onLogin = R.curry((peer, fn) => (peer._onLogin = fn)); // eslint-disable-line

export const Authentication = {
  signup,
  login,
  logout,
  isLoggedIn,
  onLogin
};
