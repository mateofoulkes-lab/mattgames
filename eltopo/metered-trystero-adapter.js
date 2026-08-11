// Trystero-compatible adapter backed by Metered Realtime Messaging.
// Keeps El Topo game logic unchanged while replacing signalling/presence/transport.

const PUBLISHABLE_KEY = 'pk_live_f3999f9364b91c8c878fe6d646063389eee28486';
const CHANNEL = 'topo-global-v1';
const BUILD_VERSION = '0.6.0';
const ADAPTER_MARK = 'eltopo-metered-v1';

export const selfId = (globalThis.crypto?.randomUUID?.() || `topo-${Date.now()}-${Math.random()}`)
  .replace(/[^a-zA-Z0-9]/g, '')
  .slice(0, 24);

let activeAdapter = null;

function sdkClass() {
  return globalThis.MeteredPeer?.MeteredPeer || null;
}

function flattenUrls(urls) {
  if (Array.isArray(urls)) return urls;
  return urls ? [urls] : [];
}

function hasTurnConfigured(remote) {
  try {
    const cfg = remote.pc?.getConfiguration?.();
    return !!cfg?.iceServers?.some(server =>
      flattenUrls(server.urls).some(url => /^turns?:/i.test(String(url)))
    );
  } catch {
    return false;
  }
}

async function selectedRoute(remote) {
  try {
    const stats = await remote.pc?.getStats?.();
    if (!stats) return { relay: false, known: false };

    let pair = null;
    stats.forEach(report => {
      if (report.type === 'transport' && report.selectedCandidatePairId) {
        pair = stats.get(report.selectedCandidatePairId) || pair;
      }
    });
    if (!pair) {
      stats.forEach(report => {
        if (
          report.type === 'candidate-pair' &&
          report.state === 'succeeded' &&
          (report.nominated || report.selected)
        ) pair = report;
      });
    }
    if (!pair) return { relay: false, known: false };

    const local = stats.get(pair.localCandidateId);
    const remoteCandidate = stats.get(pair.remoteCandidateId);
    const relay = local?.candidateType === 'relay' || remoteCandidate?.candidateType === 'relay';
    return { relay, known: true };
  } catch {
    return { relay: false, known: false };
  }
}

function renderStatus(adapter) {
  const badge = document.getElementById('meteredStatus');
  if (!badge) return;

  const remoteCount = adapter?.remoteByMetered.size || 0;
  const players = adapter?.joined ? remoteCount + 1 : 0;
  const infos = [...(adapter?.rtcInfo.values() || [])];
  const rtcConnected = infos.filter(x => x.dcOpen || x.state === 'connected').length;
  const turnReady = infos.filter(x => x.turnReady).length;
  const relay = infos.filter(x => x.relay).length;

  let label = `v${BUILD_VERSION} · Metered`;
  const state = adapter?.signalState || 'idle';
  let cls = 'wait';

  if (adapter?.lastError) {
    label += ` · ERROR: ${adapter.lastError}`;
    cls = 'error';
  } else if (state === 'joining') {
    label += ' · conectando…';
  } else if (state === 'reconnecting') {
    label += ` · reconectando · ${players} jugador${players === 1 ? '' : 'es'}`;
  } else if (state === 'joined') {
    label += ` ✓ · ${players} jugador${players === 1 ? '' : 'es'}`;
    if (remoteCount) {
      label += ` · RTC ${rtcConnected}/${remoteCount}`;
      if (relay) label += ' · TURN relay ✓';
      else if (turnReady) label += ' · TURN listo';
      else label += ' · TURN no detectado';
    }
    cls = rtcConnected === remoteCount || remoteCount === 0 ? 'ok' : 'wait';
  } else if (state === 'closed') {
    label += ' · desconectado';
    cls = 'error';
  }

  badge.textContent = label;
  badge.className = `metered-status ${cls}`;
}

function createAction(adapter, name) {
  const action = {
    onMessage: null,
    send(data, opts) {
      return adapter.sendAction(name, data, opts?.target);
    }
  };
  adapter.actions.set(name, action);
  return action;
}

function makeRoomProxy(adapter) {
  let onJoin = null;
  let onLeave = null;
  const pendingJoins = [];

  return {
    makeAction(name) {
      return createAction(adapter, name);
    },
    get onPeerJoin() { return onJoin; },
    set onPeerJoin(fn) {
      onJoin = fn;
      while (pendingJoins.length && typeof onJoin === 'function') onJoin(pendingJoins.shift());
    },
    get onPeerLeave() { return onLeave; },
    set onPeerLeave(fn) { onLeave = fn; },
    _peerJoined(logicalId) {
      if (typeof onJoin === 'function') onJoin(logicalId);
      else pendingJoins.push(logicalId);
    },
    _peerLeft(logicalId) {
      if (typeof onLeave === 'function') onLeave(logicalId);
    },
    leave() {
      adapter.close();
    }
  };
}

function createAdapter(options = {}) {
  const adapter = {
    peer: null,
    room: null,
    joined: false,
    signalState: 'idle',
    lastError: '',
    actions: new Map(),
    remoteByMetered: new Map(),
    meteredToLogical: new Map(),
    logicalToMetered: new Map(),
    announcedLogical: new Set(),
    rtcInfo: new Map(),
    pendingBroadcasts: [],
    lastPresenceBroadcast: 0,

    markStatus() { renderStatus(adapter); },

    mapRemote(meteredId, logicalId) {
      if (!logicalId || logicalId === selfId) return null;
      const previous = adapter.meteredToLogical.get(meteredId);
      adapter.meteredToLogical.set(meteredId, logicalId);
      adapter.logicalToMetered.set(logicalId, meteredId);
      if (!adapter.announcedLogical.has(logicalId)) {
        adapter.announcedLogical.add(logicalId);
        adapter.room?._peerJoined(logicalId);
      }
      if (previous && previous !== logicalId) adapter.logicalToMetered.delete(previous);
      return logicalId;
    },

    async waitForTarget(logicalId, timeoutMs = 5000) {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        const id = adapter.logicalToMetered.get(logicalId);
        if (id) return id;
        await new Promise(r => setTimeout(r, 50));
      }
      throw new Error(`Metered target not found: ${logicalId}`);
    },

    async sendEnvelope(envelope, targetLogicalId) {
      if (!adapter.joined || !adapter.peer) {
        return new Promise((resolve, reject) => {
          adapter.pendingBroadcasts.push({ envelope, targetLogicalId, resolve, reject });
        });
      }
      if (targetLogicalId) {
        const meteredId = await adapter.waitForTarget(targetLogicalId);
        return adapter.peer.sendTo(meteredId, envelope);
      }
      return adapter.peer.send(envelope);
    },

    async sendAction(name, payload, targetLogicalId) {
      // The old game sends a presence heartbeat every 1.8s. Metered already has
      // real presence, so throttle broadcast heartbeats while keeping the old
      // game's timeout logic satisfied.
      if (name === 'p' && !targetLogicalId) {
        const now = Date.now();
        if (now - adapter.lastPresenceBroadcast < 4500) return;
        adapter.lastPresenceBroadcast = now;
      }
      return adapter.sendEnvelope({
        __adapter: ADAPTER_MARK,
        kind: 'action',
        action: name,
        logicalId: selfId,
        payload
      }, targetLogicalId);
    },

    async intro(targetMeteredId) {
      if (!adapter.joined || !adapter.peer) return;
      const msg = { __adapter: ADAPTER_MARK, kind: 'intro', logicalId: selfId };
      try {
        if (targetMeteredId) await adapter.peer.sendTo(targetMeteredId, msg);
        else await adapter.peer.send(msg);
      } catch (err) {
        console.warn('[ElTopo/Metered] intro failed', err);
      }
    },

    wireDataChannel(remote, dc) {
      const info = adapter.rtcInfo.get(remote.id) || {
        state: remote.state || 'idle',
        turnReady: hasTurnConfigured(remote),
        relay: false,
        routeKnown: false,
        dcOpen: false
      };
      adapter.rtcInfo.set(remote.id, info);
      dc.onopen = async () => {
        info.dcOpen = true;
        try { dc.send(JSON.stringify({ t: 'topo-probe', at: Date.now() })); } catch {}
        const route = await selectedRoute(remote);
        info.relay = route.relay;
        info.routeKnown = route.known;
        info.turnReady = info.turnReady || hasTurnConfigured(remote);
        adapter.markStatus();
      };
      dc.onmessage = () => {
        info.dcOpen = true;
        adapter.markStatus();
      };
      dc.onerror = () => adapter.markStatus();
      dc.onclose = () => {
        info.dcOpen = false;
        adapter.markStatus();
      };
    },

    createProbe(remote) {
      if (remote.polite) return;
      try {
        const dc = remote.pc.createDataChannel('topo-connectivity', { ordered: true });
        adapter.wireDataChannel(remote, dc);
      } catch (err) {
        console.warn('[ElTopo/Metered] probe channel failed', err);
      }
    },

    wireRemote(remote) {
      adapter.remoteByMetered.set(remote.id, remote);
      const info = {
        state: remote.state || 'idle',
        turnReady: hasTurnConfigured(remote),
        relay: false,
        routeKnown: false,
        dcOpen: false
      };
      adapter.rtcInfo.set(remote.id, info);

      remote.on('data-channel', ({ channel }) => adapter.wireDataChannel(remote, channel));
      remote.on('state-change', async ({ to }) => {
        info.state = to;
        info.turnReady = info.turnReady || hasTurnConfigured(remote);
        if (to === 'connected') {
          const route = await selectedRoute(remote);
          info.relay = route.relay;
          info.routeKnown = route.known;
        }
        adapter.markStatus();
      });
      remote.on('connection-reset', () => {
        info.dcOpen = false;
        info.state = 'connecting';
        adapter.createProbe(remote);
        adapter.markStatus();
      });
      remote.on('negotiation-error', ({ err }) => {
        console.warn('[ElTopo/Metered] WebRTC negotiation error', err);
        adapter.markStatus();
      });

      adapter.createProbe(remote);
      adapter.markStatus();
    },

    async connect() {
      const MeteredPeer = sdkClass();
      if (!MeteredPeer) {
        adapter.lastError = 'SDK no cargó';
        adapter.signalState = 'closed';
        adapter.markStatus();
        options.onJoinError?.({ error: new Error('Metered Realtime SDK unavailable') });
        return;
      }

      adapter.signalState = 'joining';
      adapter.markStatus();
      const peer = new MeteredPeer({ apiKey: PUBLISHABLE_KEY });
      adapter.peer = peer;

      peer.on('state-change', ({ to }) => {
        adapter.signalState = to;
        adapter.markStatus();
        if (to === 'joined') adapter.intro();
      });

      peer.on('peer-joined', ({ peer: remote }) => {
        adapter.wireRemote(remote);
        adapter.intro(remote.id);
      });

      peer.on('peer-left', ({ peer: remote }) => {
        adapter.remoteByMetered.delete(remote.id);
        adapter.rtcInfo.delete(remote.id);
        const logicalId = adapter.meteredToLogical.get(remote.id);
        if (logicalId) {
          adapter.meteredToLogical.delete(remote.id);
          adapter.logicalToMetered.delete(logicalId);
          adapter.announcedLogical.delete(logicalId);
          adapter.room?._peerLeft(logicalId);
        }
        adapter.markStatus();
      });

      peer.on('data', ({ senderPeerId, data }) => {
        if (!data || data.__adapter !== ADAPTER_MARK) return;
        const logicalId = adapter.mapRemote(senderPeerId, data.logicalId);
        if (!logicalId) return;

        // Intro only establishes the Metered-ID <-> game-ID mapping.
        // Do NOT answer another intro here; both peers already announce on join,
        // and replying would create an endless intro ping-pong.
        if (data.kind === 'intro') return;
        if (data.kind !== 'action') return;

        const action = adapter.actions.get(data.action);
        if (action?.onMessage) action.onMessage(data.payload, { peerId: logicalId });
      });

      peer.on('error', ({ err }) => {
        adapter.lastError = err?.name || 'conexión';
        console.error('[ElTopo/Metered]', err);
        adapter.markStatus();
        options.onJoinError?.({ error: err });
      });

      try {
        await peer.join(CHANNEL);
        adapter.joined = true;
        adapter.signalState = 'joined';
        adapter.lastError = '';
        adapter.markStatus();
        await adapter.intro();

        const queued = adapter.pendingBroadcasts.splice(0);
        for (const item of queued) {
          adapter.sendEnvelope(item.envelope, item.targetLogicalId).then(item.resolve, item.reject);
        }
      } catch (error) {
        adapter.lastError = error?.name || 'no conecta';
        adapter.signalState = 'closed';
        adapter.markStatus();
        console.error('[ElTopo/Metered] join failed', error);
        options.onJoinError?.({ error });
        const queued = adapter.pendingBroadcasts.splice(0);
        queued.forEach(item => item.reject(error));
      }
    },

    close() {
      adapter.joined = false;
      adapter.signalState = 'closed';
      adapter.markStatus();
      try { adapter.peer?.close('leave'); } catch {}
    }
  };

  adapter.room = makeRoomProxy(adapter);
  adapter.connect();
  return adapter;
}

export function joinRoom(_config, _roomId, options = {}) {
  if (activeAdapter) activeAdapter.close();
  activeAdapter = createAdapter(options);
  renderStatus(activeAdapter);
  return activeAdapter.room;
}

queueMicrotask(() => renderStatus(activeAdapter));
