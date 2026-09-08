/**
 * Browser-side media leg for incoming calls forwarded from the Android app.
 * Signaling rides the existing WebSocket; the original caller never sees this peer.
 */
import { ICE_SERVERS } from './ice-config.mjs';

function wantsVideo(body) {
    if (!body) return false;
    if (body.videoCall === true || body.videoCall === 'true') return true;
    return typeof body.sdp === 'string' && /m=video\s/i.test(body.sdp);
}

console.log('Arnacon browser-call.mjs loaded v1.8.19');

export function installBrowserCall(controller) {
    console.log('Arnacon browser call forwarding ready v1.8.19');
    let pc = null;
    let pcPromise = null;
    let localStream = null;
    let remoteAudio = null;
    let remoteVideoEl = null;
    let localVideoEl = null;
    let callId = null;
    let remoteSession = false;
    let videoEnabled = false;
    let pendingRemoteStream = null;
    const pendingIce = [];

    function send(action, body) {
        const payload = {
            action,
            body: { localId: controller.localId, ...body },
        };
        if (typeof controller._send === 'function') {
            controller._send(payload);
            return;
        }
        if (typeof controller._pairingSend === 'function') {
            controller._pairingSend(payload);
        }
    }

    function ensureAudioEl() {
        if (!remoteAudio) {
            remoteAudio = document.createElement('audio');
            remoteAudio.autoplay = true;
            remoteAudio.setAttribute('playsinline', 'true');
            remoteAudio.style.display = 'none';
            document.body.appendChild(remoteAudio);
        }
        return remoteAudio;
    }

    function sameTracks(el, tracks) {
        const current = el && el.srcObject && el.srcObject.getTracks
            ? el.srcObject.getTracks()
            : [];
        if (current.length !== tracks.length) return false;
        for (let i = 0; i < tracks.length; i++) {
            if (current[i] !== tracks[i]) return false;
        }
        return true;
    }

    function bindTracks(el, tracks) {
        if (!el || !tracks.length) return false;
        if (sameTracks(el, tracks)) return false;
        el.srcObject = new MediaStream(tracks);
        return true;
    }

    function attachRemoteStream(stream) {
        if (!stream) return;
        pendingRemoteStream = stream;
        const audioTracks = stream.getAudioTracks();
        const videoTracks = stream.getVideoTracks();
        if (audioTracks.length) {
            const audioEl = ensureAudioEl();
            bindTracks(audioEl, audioTracks);
            const play = audioEl.play();
            if (play && typeof play.catch === 'function') {
                play.catch((err) => console.warn('Browser call audio play failed', err));
            }
        }
        if (!videoTracks.length) return;
        if (!remoteVideoEl) {
            console.log('Remote video track waiting for video element');
            return;
        }
        const rebound = bindTracks(remoteVideoEl, videoTracks);
        remoteVideoEl.autoplay = true;
        remoteVideoEl.playsInline = true;
        remoteVideoEl.muted = true;
        remoteVideoEl.classList.add('active');
        const play = remoteVideoEl.play();
        if (play && typeof play.catch === 'function') {
            play.catch((err) => console.warn('Browser call video play failed', err));
        }
        const overlay = remoteVideoEl.ownerDocument
            && remoteVideoEl.ownerDocument.getElementById('loadingOverlay');
        if (overlay) overlay.classList.add('hidden');
        if (rebound) {
            console.log('Attached remote video track to element');
        }
    }

    function attachLocalPreview() {
        if (!localVideoEl || !localStream) return;
        const videoTracks = localStream.getVideoTracks();
        if (!videoTracks.length) return;
        bindTracks(localVideoEl, videoTracks);
        localVideoEl.autoplay = true;
        localVideoEl.muted = true;
        localVideoEl.playsInline = true;
        localVideoEl.classList.add('active');
        const doc = localVideoEl.ownerDocument;
        const container = doc && doc.getElementById('localVideoContainer');
        if (container) container.classList.add('active');
        const jpegPreview = doc && doc.getElementById('localVideoImg');
        if (jpegPreview) {
            jpegPreview.classList.remove('active');
            jpegPreview.removeAttribute('src');
        }
        localVideoEl.play().catch(() => {});
    }

    async function getLocalMedia(wantVideo) {
        if (!wantVideo) {
            return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        }
        try {
            return await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
            });
        } catch (err) {
            console.warn('Mic+camera failed, retrying separately', err);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            try {
                const cam = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
                });
                cam.getVideoTracks().forEach((track) => stream.addTrack(track));
            } catch (camErr) {
                console.warn('Camera unavailable for browser call', camErr);
            }
            return stream;
        }
    }

    async function ensureLocalVideoTrack() {
        if (localStream && localStream.getVideoTracks().length) {
            return localStream.getVideoTracks()[0];
        }
        const cam = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        });
        const track = cam.getVideoTracks()[0];
        if (!track) return null;
        if (!localStream) {
            localStream = cam;
        } else {
            localStream.addTrack(track);
        }
        return track;
    }

    function describeTransceivers(connection) {
        return (connection.getTransceivers() || []).map((t) => ({
            mid: t.mid,
            direction: t.direction,
            recv: t.receiver && t.receiver.track && t.receiver.track.kind,
            send: t.sender && t.sender.track && t.sender.track.kind,
        }));
    }

    function findVideoTransceiver(connection) {
        const list = connection.getTransceivers() || [];
        return list.find((t) => {
            if (t.receiver && t.receiver.track && t.receiver.track.kind === 'video') return true;
            if (t.sender && t.sender.track && t.sender.track.kind === 'video') return true;
            if (t.mid === '1') return true;
            try {
                const codecs = t.receiver && t.receiver.getParameters && t.receiver.getParameters().codecs;
                if (codecs && codecs.some((c) => /video\//i.test(c.mimeType || ''))) return true;
            } catch (_) {}
            return false;
        });
    }

    async function waitForVideoTransceiver(connection, timeoutMs = 400) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const found = findVideoTransceiver(connection);
            if (found) return found;
            await new Promise((resolve) => setTimeout(resolve, 25));
        }
        return findVideoTransceiver(connection);
    }

    /**
     * Firefox answers video as recvonly unless the offer's video transceiver
     * already has a sender track. Attach camera after setRemoteDescription,
     * never with addTrack before the remote offer.
     */
    async function attachLocalVideoToOffer(connection) {
        if (!connection) return;
        let videoTrack = null;
        try {
            videoTrack = await ensureLocalVideoTrack();
        } catch (err) {
            console.warn('Could not get camera for browser call', err);
            return;
        }
        if (!videoTrack) {
            console.warn('No local camera track for browser call');
            return;
        }
        const existing = (connection.getSenders() || []).find((s) => s.track && s.track.kind === 'video');
        if (existing) {
            await existing.replaceTrack(videoTrack);
            videoEnabled = true;
            attachLocalPreview();
            console.log('Replaced existing video sender with local camera');
            return;
        }
        const videoTransceiver = await waitForVideoTransceiver(connection);
        console.log('Gateway transceivers after offer', describeTransceivers(connection));
        if (videoTransceiver && videoTransceiver.sender) {
            try {
                videoTransceiver.direction = 'sendrecv';
            } catch (_) {}
            await videoTransceiver.sender.replaceTrack(videoTrack);
        } else {
            connection.addTrack(videoTrack, localStream);
        }
        videoEnabled = true;
        attachLocalPreview();
        console.log('Attached local camera to video transceiver',
            videoTransceiver && videoTransceiver.mid);
    }

    async function ensurePeerConnection(options = {}) {
        const wantVideo = !!options.video;
        if (pc) return pc;
        if (pcPromise) return pcPromise;
        pcPromise = (async () => {
            localStream = await getLocalMedia(wantVideo);
            videoEnabled = wantVideo && localStream.getVideoTracks().length > 0;
            pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
            localStream.getAudioTracks().forEach((track) => pc.addTrack(track, localStream));
            pc.onconnectionstatechange = () => {
                if (!pc) return;
                if (pc.connectionState === 'failed') {
                    console.warn('Browser call PeerConnection failed');
                    close();
                    try {
                        controller.receiveData(JSON.stringify({
                            action: 'call-ended',
                            body: { reason: 'peerconnection-failed' },
                        }));
                    } catch (_) {}
                }
            };
            pc.onicecandidate = (event) => {
                if (!event.candidate || !callId) return;
                send('browser-call-ice', {
                    callId,
                    candidate: event.candidate.candidate,
                    sdpMid: event.candidate.sdpMid,
                    sdpMLineIndex: event.candidate.sdpMLineIndex,
                });
            };
            pc.ontrack = (event) => {
                console.log('Gateway remote track', event.track && event.track.kind,
                    event.track && event.track.id);
                const stream = (event.streams && event.streams[0])
                    || pendingRemoteStream
                    || new MediaStream();
                if (event.track && stream.getTracks().indexOf(event.track) < 0) {
                    stream.addTrack(event.track);
                }
                attachRemoteStream(stream);
            };
            attachLocalPreview();
            return pc;
        })();
        try {
            return await pcPromise;
        } catch (err) {
            pcPromise = null;
            throw err;
        }
    }

    async function handleOffer(body) {
        if (!body || !body.sdp) return;
        callId = body.callId || callId;
        remoteSession = true;
        const wantVideo = wantsVideo(body);
        console.log('Received browser-call-offer for', callId, 'video=' + wantVideo);
        try {
            const connection = await ensurePeerConnection({ video: wantVideo });
            await connection.setRemoteDescription({ type: 'offer', sdp: body.sdp });
            if (wantVideo) {
                await attachLocalVideoToOffer(connection);
            }
            while (pendingIce.length) {
                const candidate = pendingIce.shift();
                try {
                    await connection.addIceCandidate(candidate);
                } catch (err) {
                    console.warn('Failed to add queued ICE candidate', err);
                }
            }
            const answer = await connection.createAnswer();
            await connection.setLocalDescription(answer);
            console.log('Sent browser-call-answer video=' + wantVideo,
                /m=video[\s\S]*?a=(sendrecv|recvonly|sendonly|inactive)/.exec(answer.sdp || '')?.[1]);
            send('browser-call-answer', {
                callId,
                sdp: connection.localDescription.sdp,
            });
        } catch (err) {
            console.error('Failed to handle browser-call-offer', err);
        }
    }

    async function handleIce(body) {
        if (!body || !body.candidate) return;
        const candidate = {
            candidate: body.candidate,
            sdpMid: body.sdpMid != null ? String(body.sdpMid) : '0',
            sdpMLineIndex: Number(body.sdpMLineIndex) || 0,
        };
        if (pc && pc.remoteDescription) {
            try {
                await pc.addIceCandidate(candidate);
            } catch (err) {
                console.warn('Failed to add ICE candidate', err);
            }
        } else {
            pendingIce.push(candidate);
        }
    }

    function close() {
        pendingIce.length = 0;
        pendingRemoteStream = null;
        remoteSession = false;
        videoEnabled = false;
        pcPromise = null;
        if (pc) {
            try { pc.close(); } catch (_) {}
            pc = null;
        }
        if (localStream) {
            localStream.getTracks().forEach((track) => track.stop());
            localStream = null;
        }
        if (remoteAudio) {
            remoteAudio.srcObject = null;
        }
        if (remoteVideoEl) {
            remoteVideoEl.srcObject = null;
            remoteVideoEl.classList.remove('active');
        }
        if (localVideoEl) {
            localVideoEl.srcObject = null;
            localVideoEl.classList.remove('active');
        }
        callId = null;
    }

    controller.on('browser-call-offer', (body) => { handleOffer(body); });
    controller.on('browser-call-ice', (body) => { handleIce(body); });
    controller.on('call-ended', () => { close(); });
    controller.on('ringing', (body) => {
        remoteSession = true;
        callId = (body && (body.to || body.callId)) || callId;
        ensurePeerConnection({ video: wantsVideo(body) }).catch((err) => {
            console.error('Media access failed for outgoing browser call', err);
        });
    });
    controller.on('call-started', (body) => {
        remoteSession = true;
        callId = (body && (body.from || body.callId)) || callId;
        ensurePeerConnection({ video: wantsVideo(body) }).catch((err) => {
            console.error('Media access failed for browser call', err);
        });
    });

    return {
        accept(id, options = {}) {
            callId = id;
            remoteSession = true;
            send('accept-call', { callId: id, source: 'browser' });
            ensurePeerConnection({ video: !!options.video }).catch((err) => {
                console.error('Media access failed for browser call', err);
            });
            const audioEl = ensureAudioEl();
            const play = audioEl.play();
            if (play && typeof play.catch === 'function') {
                play.catch(() => {});
            }
        },
        setVideoElements({ remote, local } = {}) {
            remoteVideoEl = remote || remoteVideoEl;
            localVideoEl = local || localVideoEl;
            if (pendingRemoteStream) {
                attachRemoteStream(pendingRemoteStream);
            } else if (pc) {
                const receivers = pc.getReceivers ? pc.getReceivers() : [];
                const remoteTracks = receivers.map((r) => r.track).filter(Boolean);
                if (remoteTracks.length) {
                    attachRemoteStream(new MediaStream(remoteTracks));
                }
            }
            attachLocalPreview();
        },
        async switchCamera() {
            if (!pc || !localStream) return false;
            const current = localStream.getVideoTracks()[0];
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameras = devices.filter((d) => d.kind === 'videoinput');
            if (cameras.length < 2 && !current) return false;
            let nextDeviceId = null;
            if (current && cameras.length > 1) {
                const currentId = current.getSettings && current.getSettings().deviceId;
                const idx = cameras.findIndex((d) => d.deviceId === currentId);
                nextDeviceId = cameras[(idx + 1) % cameras.length].deviceId;
            }
            const facing = current && current.getSettings && current.getSettings().facingMode === 'user'
                ? 'environment'
                : 'user';
            const constraints = nextDeviceId
                ? { video: { deviceId: { exact: nextDeviceId } }, audio: false }
                : { video: { facingMode: { ideal: facing } }, audio: false };
            const next = await navigator.mediaDevices.getUserMedia(constraints);
            const nextTrack = next.getVideoTracks()[0];
            if (!nextTrack) return false;
            const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
            if (sender) {
                await sender.replaceTrack(nextTrack);
            } else {
                pc.addTrack(nextTrack, localStream);
            }
            if (current) {
                localStream.removeTrack(current);
                current.stop();
            }
            localStream.addTrack(nextTrack);
            attachLocalPreview();
            return true;
        },
        setMuted(muted) {
            if (!localStream) return;
            localStream.getAudioTracks().forEach((track) => {
                track.enabled = !muted;
            });
        },
        isActive() {
            return !!pc;
        },
        isRemoteSession() {
            return remoteSession;
        },
        isVideo() {
            return videoEnabled;
        },
        close,
    };
}
