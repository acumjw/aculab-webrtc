import { SessionState } from "sip.js";
import { MediaEventSessionDescriptionHandler } from "./media-event-session-description-handler.js";

export class AculabCloudCall {
    /**
     * @param {AculabCloudClient} client
     */
    constructor(client, reinvite_possible) {
        this.client = client;
        this._session = null;
        this._connected = false;
        this._notified_connected = false;
        this._remote_streams = null;
        this._notified_remote_streams = [];
        this._ice_connected = false;
        this._termination_reason = '';
        this._sdh_options = undefined;
        this._allowed_reinvite = reinvite_possible;
        
        /*
         * In order to deal with the fact that react-native-webrtc implemented muted video by stopping the stream
         * instead of sending a stream of 0's in order to shut off camera light when on mute.  Not a proper solution
         * and bug is filed. see https://github.com/react-native-webrtc/react-native-webrtc/issues/643
         * Work around is to have callbacks for local video mute/unmute to place a picture in the local view of the
         * call window. Also remote video mute which detects when nothing is on the rtp line (not receivng RTP
         * because of above.  There are 2 callbacks for the remote side to do something when it detects the other side has
         * muted.
         */
        this.onLocalVideoMute = null;
        this.onLocalVideoUnmute = null;
        this.onRemoteVideoMute = null;
        this.onRemoteVideoUnmute = null;
        
        this.onConnecting = null;
        this.onMedia = null;
        this.onMediaRemove = null;
        this.onUserMediaRemove = null;
        this.onConnected = null;
        this.onDisconnect = null;
        
    }

    // add setters for backwards compatibility
    set onLocalVideoMuteCB(func) {
        this.onLocalVideoMute = func;
    }

    set onLocalVideoUnMuteCB(func) {
        this.onLocalVideoUnmute = func;
    }

    set onRemoteVideoMuteCB(func) {
        this.onRemoteVideoMute = func;
    }

    set onRemoteVideoUnMuteCB(func) {
        this.onRemoteVideoUnmute = func;
    }
    //

    //Functions to call the callbacks with logging around it
    _onLocalVideoMute(obj){
        if (this.onLocalVideoMute != null){
            this.client.console_log('AculabCloudCall calling onLocalVideoMute');
            try {
                this.onLocalVideoMute(obj);
            }
            catch(err) {
                this.client.console_error('AculabCloudCall: Exception calling onLocalVideoMute: ' + err.message);
            }
        }
    }
    
    _onLocalVideoUnmute(obj){
        if (this.onLocalVideoUnmute != null){
            this.client.console_log('AculabCloudCall calling onLocalVideoUnmute');
            try {
                this.onLocalVideoUnmute(obj);
            }
            catch(err) {
                this.client.console_error('AculabCloudCall: Exception calling onLocalVideoUnmute: ' + err.message);
            }
        }
    }
    
    _onRemoteVideoMute(obj){
        if (this.onRemoteVideoMute != null){
            this.client.console_log('AculabCloudCall calling onRemoteVideoMute');
            try {
                this.onRemoteVideoMute(obj);
            }
            catch(err) {
                this.client.console_error('AculabCloudCall: Exception calling onRemoteVideoMute: ' + err.message);
            }
        }
    }
    
    _onRemoteVideoUnmute(obj){
        if (this.onRemoteVideoUnmute != null){
            this.client.console_log('AculabCloudCall calling onRemoteVideoUnmute');
            try {
                this.onRemoteVideoUnmute(obj);
            }
            catch(err) {
                this.client.console_error('AculabCloudCall: Exception calling onRemoteVideoUnmute: ' + err.message);
            }
        }
    }
    
    _get_reason_from_sip_code(code) {
        if (/^10[0-9]/.test(code)) {
            return ""; // a provisional result!
        }
        if (code == "487") {
            return "NOANSWER";
        } else if (code == "486" || code == "600" || code == "603") {
            return "BUSY";
        } else if (code == "404" ||code == "410" || code == "480" || code == "604") {
            return "UNOBTAINABLE";
        } else if (/^3[0-9]%2$/.test(code)) {
            return "MOVED";
        } else if (/^6[0-9]%2$/.test(code)) {
            return "REJECTED";
        } else if (!/^20[0-9]/.test(code)) {
            return "FAILED";
        }
        return 'NORMAL';
    }
    /**
     * @param {Session} sess
     */
    set session(sess) {
        this._session = sess;
        this._callId = sess.request.callId;
        this._session.delegate = {
        onBye: (bye) => {
            // extract reason from BYE message
            if (this._termination_reason == '') {
                var reason_hdr = bye.incomingByeRequest.message.getHeader("Reason");
                this.client.console_log(`dialog end BYE Reason ${reason_hdr}`)
                if (reason_hdr) {
                    const m = reason_hdr.match(/SIP\s*;\s*cause\s*=\s*([0-9]{3})\s*;/);
                    if (m) {
                        const sipcode = m[1];
                        this._termination_reason = this._get_reason_from_sip_code(sipcode);
                        this.client.console_log(`setting termination reason - BYE - ${this._termination_reason}`);
                    }
                }
            }
            bye.accept();
        },
        onSessionDescriptionHandler: (sdh) => {
            this._add_media_handlers(sdh);
        }
        }
        this._session.stateChange.addListener((state) => {
            if (state == SessionState.Established) {
                this._onaccepted();
            }
            if (state == SessionState.Terminated) {
                this._onterminated();
            }
        })
    }
    callId() {
        return this._callId;
    }
    /**
     * @param {String} indtmf
     */
    sendDtmf(indtmf) {
        this.client.console_log('AculabCloudCall sendDtmf(' + indtmf + ')');
        if (indtmf.match(/^[^0-9A-Da-d#*]+$/) != null) {
            throw 'Invalid DTMF string';
        }
        if (this._session) {
            try {
                this._session.sessionDescriptionHandler.sendDtmf(indtmf);
            }
            catch(e) {
                this.client.console_error('AculabCloudCall: Exception sending DTMF: ' + e.message);
                throw 'DTMF send error';
            }
        } else {
            throw 'DTMF send error';
        }
    }
   
    mute(mic, output_audio, camera, output_video)  {
        this.client.console_log('AculabCloudCall mute(mic=' + mic + ', output_audio=' + output_audio + ', camera=' + camera + ', output_video=' + output_video +')');
        if (camera === undefined) {
            camera = mic;
        }
        if (output_video === undefined) {
            output_video = output_audio;
        }
       
        if (this._remote_streams) {
            this._remote_streams.forEach((stream) => {
                this.muteRemoteStream(stream, output_audio, output_video);
            });
        }

        this._session.sessionDescriptionHandler.localMediaStreams.forEach((stream) => {
            this.muteLocalStream(stream, mic, camera);
	});
    }

    muteStream(stream, mic, output_audio, camera, output_video)  {
        this.client.console_log('AculabCloudCall muteStream(mic=' + mic + ', output_audio=' + output_audio + ', camera=' + camera + ', output_video=' + output_video +')');
        if (this._session.sessionDescriptionHandler.getInternalStreamId(stream)) {
            this.muteLocalStream(stream, mic, camera);
        } else {
            this.muteRemoteStream(stream, output_audio, output_video);
        }
    }

    muteLocalStream(stream, mic, camera) {
        this.client.console_log('AculabCloudCall muteLocalStream(mic=' + mic + ',  camera=' + camera);
        var internal_stream_id = null;
        if (this._session && this._session.sessionDescriptionHandler) {
            internal_stream_id = this._session.sessionDescriptionHandler.getInternalStreamId(stream);
	}
        if (internal_stream_id) {
            if (this._session && this._session.sessionDescriptionHandler && this._session.sessionDescriptionHandler.peerConnection){
                var internal_stream = this._session.sessionDescriptionHandler.getLocalMediaStreamById(internal_stream_id);
                var pc = this._session.sessionDescriptionHandler.peerConnection;
                pc.getSenders().forEach(sender => {
                    if (sender.track.id) {
                        let internal_track = internal_stream.getTrackById(sender.track.id);
                        if (sender.track && internal_track) {
                            if (sender.track.kind == "audio") {
                                sender.track.enabled = !mic;
                                internal_track.enabled = !mic;
                            } else if (sender.track.kind == "video") {
                                sender.track.enabled = !camera;
                                internal_track.enabled = !camera;
                                if (sender.track.enabled) {
                                    this._onLocalVideoUnmute({'call': this, 'stream': internal_stream, 'track': sender.track});
                                } else {
                                    this._onLocalVideoMute({'call': this, 'stream': internal_stream, 'track': sender.track});
                                }
                            }
                        }
                    }
                });
            }
        }
    }

    muteRemoteStream(stream, output_audio, output_video) {
        this.client.console_log('AculabCloudCall muteRemoteStream(output_audio=' + output_audio + ',  output_video=' + output_video);
        if (this._remote_streams) {
            this._remote_streams.forEach((rstream) => {
                if (rstream.id === stream.id) {
                    rstream.getTracks().forEach((t) => {
                        if (t.kind == "audio") {
                            t.enabled = !output_audio;
                        } else if (t.kind == "video") {
                            t.enabled = !output_video;
                        }
                    });
                    return;
                }
            });
        }
    }
    
    _onclientready() {
        // nothing to do in base class
    }
    
    _onterminated() {
        this._session = null;
        var cause = this._termination_reason || "NORMAL";
        this.client.console_log('term: ' + cause);
        this._remote_stream = null;
        if (this._sdh_options && this._sdh_options.localStream) {
            this._sdh_options.localStreams.forEach((stream) => {
                stream.forEach((track) => {
                    track.stop();
                });
            });
        }
        if (this.client._removeCall(this)) { // was removed, so call user callback
            if (this.onDisconnect) {
                try {
                    this.onDisconnect({'call': this, 'cause': cause});
                }
                catch(err) {
                    this.client.console_error('AculabCloudCall: Exception calling onDisconnect: ' + err.message);
                }
            }
        }
    }
    _check_notify_remove_media() {
        for (let i = this._notified_remote_streams.length - 1; i > 0; i--) {
            let found = false;
            this._remote_streams.forEach((stream) => {
                if (this._notified_remote_streams[i].id == stream.id) {
                    found = true;
                }
            });
            if (!found) {
                this.client.console_log('AculabCloudCall calling onMediaRemove');
                try {
                    this.onMediaRemove({'call': this, 'stream': this._notified_remote_streams[i]});
                }
                catch(e) {
                    this.client.console_error('AculabCloudCall onMediaRemove caused exception: ' + e.message);
                }
                this._notified_remote_streams.splice(i, 1);
            }
        }
    }
    _check_notify_media() {
        this._remote_streams.forEach((stream) => {
            this._check_notify_stream(stream);
        });
    }
    _check_notify_stream(stream) {
        let already_notified = false;
        this._notified_remote_streams.forEach((ns) => {
            if (ns.id == stream.id) {
                already_notified = true;
            }
        });
        if (!already_notified && this._ice_connected) {
            this._notified_remote_streams.push(stream);
            try {
                //Need to do some setup of mute callbacks for remote stream
                if (stream) {
                    var this_call = this;
                    var this_stream = stream;
                    this_stream.getVideoTracks().forEach(track => {;
                        track.onunmute = (ev) => {
                            this_call._onRemoteVideoUnmute({'call': this_call, 'stream': this_stream, 'track': track});
                        }
                        track.onmute = (ev) => {
                            this_call._onRemoteVideoMute({'call': this_call, 'stream': this_stream, 'track': track});
                        }
                    });
                }
            }
            catch(e) {
                this.client.console_error('AculabCloudCall adding video track mute handlers caused exception: ' + e.message);
            }
            this.client.console_log('AculabCloudCall calling onMedia');
            try {
                this.onMedia({'call': this, 'stream': stream});
            }
            catch(e) {
                this.client.console_error('AculabCloudCall onMedia caused exception: ' + e.message);
            }
        }
    }
    _check_notify_connected() {
        
        if (this._connected && !this._notified_connected && this._ice_connected) {
            this._notified_connected = true;
            
            if (this.onConnected) {
                this.client.console_log('AculabCloudCall calling onConnected' + ` ice: ${this._ice_connected}`);
                try {
                    this.onConnected({'call': this});
                }
                catch(e) {
                    this.client.console_error('AculabCloudCall onConnected caused exception:' + e.message);
                }
            }
        }
    }
    _onaccepted() {
        this._connected = true;
        this._check_notify_connected()
    }
    _set_ice_state(connected) {
        this.client.console_log('AculabCloudCall set_ice_state(connected=' + connected + ')');
        this._ice_connected = connected;
        this._check_notify_media();
        this._check_notify_connected();
    }
    _add_media_handlers(sdh) {
        this.client.console_log('AculabCloudCall adding media event handlers');

        sdh.onUserMedia = (stream) => {
            let notified = false;
            if (this.onConnecting) {
                this.client.console_log('AculabCloudCall calling onConnecting');
                try {
                    
                    this.onConnecting({'call': this, "stream": stream});
                    notified = true;
                }
                catch(e) {
                    this.client.console_error('AculabCloudCall onConnecting caused exception:' + e.message);
                }
            }
            return notified;
        }

        sdh.onUserMediaRemove = (stream) => {
            let notified = false;
            if (this.onUserMediaRemove) {
                this.client.console_log('AculabCloudCall calling onUserMediaRemoved');
                try {
                    this.onUserMediaRemove({'call': this, "stream": stream});
                    notified = true;
                }
                catch(e) {
                    this.client.console_error('AculabCloudCall onUserMediaRemoved caused exception:' + e.message);
                }
            }
            return notified;
        }
        
        sdh.onUserMediaFailed = (err) => {
            this.client.console_error('AculabCloudCall getUserMedia failed - ' + err);
            // store error, so we can report correct reason in onDisconnect callback
            if (this._termination_reason == '') {
                this._termination_reason = 'MIC_ERROR';
            }
        }
        
        sdh.peerConnectionDelegate = {
        ontrack: (ev) => {
            
            ev.streams[0].onremovetrack = ({track}) => {
                sdh.removeRemoteMediaTrack(track);
                if (!ev.streams[0].getTracks().length) {
                }
                this._remote_streams = sdh.remoteMediaStreams;
                this._check_notify_remove_media();
            };

            if (ev.track) {
                sdh.addRemoteMediaStream(ev.streams[0], ev.track);
                this._remote_streams = sdh.remoteMediaStreams;
                this._check_notify_media();
            }
        },
        onaddstream: (ev) => {
            
            this._remote_streams = sdh.remoteMediaStreams;
            this._check_notify_media();
            
        },
        oniceconnectionstatechange: () => {
            this._remote_stream = sdh.remoteMediaStreams;
            
            var icestate = sdh.peerConnection.iceConnectionState;
            if (icestate == 'connected' || icestate == 'completed') {
                
                this._set_ice_state(true);
            } else {
                this._set_ice_state(false);
            }
        }
        }
    }
    getConnectionInfo() {
        var that = this;
        return new Promise(function(resolve) {
            if (that._session && that._session.sessionDescriptionHandler && that._session.sessionDescriptionHandler.peerConnection) {
                that._session.sessionDescriptionHandler.peerConnection.getStats().then(stats => {
                    let localAddr = "Unknown";
                    let remoteAddr = "Unknown";
                    let localType = "?";
                    let remoteType = "?";
                    if(stats){
                        let selectedPairId = null;
                        stats.forEach(stat => {
                            if(stat.type == "transport"){
                                selectedPairId = stat.selectedCandidatePairId;
                            }
                        });
                        let candidatePair = stats.get(selectedPairId);
                        if(!candidatePair){
                            stats.forEach(stat => {
                                if(stat.type == "candidate-pair" && stat.selected){
                                    candidatePair = stat;
                                }
                            });
                        }
                        
                        if (candidatePair){
                            // eslint-disable-next-line no-inner-declarations
                            function _extractAddrPort(cand) {
                                let addr = 'a.b.c.d';
                                let port = 'N';
                                if (cand.address !== undefined && cand.port !== undefined) {
                                    addr = cand.address;
                                    port = cand.port;
                                } else if (cand.ip !== undefined && cand.port !== undefined) {
                                    addr = cand.ip;
                                    port = cand.port;
                                } else if (cand.ipAddress !== undefined && cand.portNumber !== undefined) {
                                    addr = cand.ipAddress;
                                    port = cand.portNumber;
                                }
                                return `${addr}:${port}`;
                            }
                            let remote = stats.get(candidatePair.remoteCandidateId);
                            remoteType = remote.candidateType;
                            remoteAddr = _extractAddrPort(remote);
                            let local = stats.get(candidatePair.localCandidateId);
                            if (local.relayProtocol) {
                                localType = local.relayProtocol;
                            } else if (local.protocol) {
                                localType = local.protocol;
                            }
                            localAddr = _extractAddrPort(local);
                        }
                    }
                    resolve(localAddr + " " + localType + " => " + remoteAddr + " " + remoteType);
                })
                .catch(() => {
                    resolve("Failed to get stats");
                });
            } else {
                resolve("No peer connection");
            }
        });
    }
    addStream(stream) {
        if (!this._allowed_reinvite) {
            throw 'addStream not available';
        }
        this.client.console_log('AculabCloudOutgoingCall addStream :' + this._session);
        if (this._session && !this._disconnect_called) {
            try {
                let options = this._sdh_options;
                let internal_stream_id = this._session.sessionDescriptionHandler.userToInternalLocalStreamIds.get(stream.id);
                let need_adding = false;
                if (!internal_stream_id) {
                    let found = false;
                    options.localStreams.forEach((lstream) => {
                        if (lstream.id == stream.id) {
                            found = true;
                        }
                    });
                    if (!found) {
                        need_adding = true;
                    }
                }
                if (need_adding) {
                    options.localStreams.push(stream);
                    this.reinvite(options);
                } else {
                    throw "Stream already exists";
                }
            }
            catch(e) {
                this.client.console_error('AculabCloudCall: Exception Adding stream: ' + e.message);
                throw 'Add stream error';
            }
        } else {
            throw 'Not connected error';
        }
    }

    removeStream(stream) {
        if (!this._allowed_reinvite) {
            throw 'removeStream not available';
        }
        this.client.console_log('AculabCloudOutgoingCall removeStream :' + this._session);
        if (this._session && !this._disconnect_called) {
            try {
                let options = this._sdh_options;
                let stream_id = this._session.sessionDescriptionHandler.getUserStreamId(stream);
                if (stream_id) {
                    options.localStreams = options.localStreams.filter(item => item.id !== stream_id);
                    this.reinvite(options);
                } else {
                    throw "Stream does not exist";
                }
            }
            catch(e) {
                this.client.console_error('AculabCloudCall: Exception Removing stream: ' + e.message);
                throw 'Remove stream error';
            }
        } else {
            throw 'Not connected error';
        }
    }

    reinvite(options) {
        if (!this._allowed_reinvite) {
            throw 'Reinvite not available';
        }
        if (options.localStreams === undefined || options.localStreams.length == 0) {
            throw 'At least one MediaStream needed in options.localStreams';
        }
        this.client.console_log('AculabCloudOutgoingCall reinvite :' + this._session);
        if (this._session && !this._disconnect_called) {
            try {
                this._sdh_options = MediaEventSessionDescriptionHandler.fixup_options(options);
                let opts = {
                };
                this._sdh_options.reinvite = true;
                console.log(this._sdh_options);
                opts.sessionDescriptionHandlerOptions = this._sdh_options;
                opts.sessionDescriptionHandlerOptionsReInvite = this._sdh_options;
                this.client.console_log('AculabCloudCall: new constraints: ' + opts);
                this.client.console_error(opts);
                this._session.invite(opts);
            }
            catch(e) {
                this.client.console_error('AculabCloudCall: Exception changing constraints: ' + e.message);
                throw 'Reinvite error';
            }
        } else {
            throw 'Reinvite error';
        }
    }
}
