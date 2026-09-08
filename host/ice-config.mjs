/**
 * Public STUN-only ICE for the Arnacon host. TURN is not committed here.
 * Media stays on the host (window.top.browserCall), never in skin HTML.
 */
export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];
