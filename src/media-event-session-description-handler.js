import {
    Web,
    EmitterImpl,
    SessionDescriptionHandlerError,
    Modifiers,
} from 'sip.js';



var NativeModules = "";
var RTCPeerConnection = "";
var RTCIceCandidate = "";
var MediaStream = "";
var mediaDevices = "";
var RTCView = "";

if (typeof document == 'undefined') {
    // I'm on the react-native!
    NativeModules = require('react-native').NativeModules
    rnw = require('react-native-webrtc')
    RTCPeerConnection = rnw.RTCPeerConnection
    RTCIceCandidate = rnw.RTCIceCandidate
    MediaStream = rnw.MediaStream
    mediaDevices = rnw.mediaDevices
    RTCView = rnw.RTCView
    
}
var {WebRTCModule} = NativeModules;


function defer() {
    const deferred = {};
    deferred.promise = new Promise((resolve, reject) => {
        deferred.resolve = resolve;
        deferred.reject = reject;
    });
    return deferred;
}

//registerGlobals();

export class MediaEventSessionDescriptionHandler extends Web.SessionDescriptionHandler {
    constructor(logger, mediaStreamFactory, sessionDescriptionHandlerConfiguration) {
        super(logger, mediaStreamFactory, sessionDescriptionHandlerConfiguration);
        this.notified_stream = null;
        this.WebRTC = {
            MediaStream,
        getUserMedia: mediaDevices.getUserMedia,
            RTCPeerConnection
        };
        this.options = {};
    }
    get remoteMediaStream() {
        if (this._peerConnection.getSenders) {
            return super.remoteMediaStream;
        }
        return this._peerConnection.getRemoteStreams()
    }
    setRemoteTrack(track) {
        if (this._peerConnection.getSenders) {
            return (super.setRemoteTrack(track));
        }
        // Don't want to actually use this function since we are using depricated
        // getlocalStreams....  NEED THIS EVENTUALLY ONE OF THE APIS REACT NATIVE NEEDS
        this.logger.debug("SessionDescriptionHandler.setRemoteTrack");
        
    }
    setLocalMediaStream(stream) {
        this.logger.debug("SessionDescriptionHandler.setLocalMediaStream");
        if (!this._peerConnection) {
            throw new Error("Peer connection undefined.");
        }
        if (this._peerConnection.getSenders) {
            return (super.setLocalMediaStream(stream));
        }
        this._peerConnection.addStream(stream);
        this._localMediaStream = stream;
        return Promise.resolve();
    }
    
    checkAndDefaultConstraints(constraints) {
        const defaultConstraints = { audio: true, video: true };
        constraints = constraints || defaultConstraints;
        // Empty object check
        if (Object.keys(constraints).length === 0 && constraints.constructor === Object) {
            return defaultConstraints;
        }
        return constraints;
    }
    
    
    /**
     * Send DTMF via RTP (RFC 4733)
     * @param {String} tones A string containing DTMF digits
     * @param {Object} [options] Options object to be used by sendDtmf
     * @returns {boolean} true if DTMF send is successful, false otherwise
     */
    sendDtmf(indtmf, options) {
        if (this._peerConnection.getSenders) {
            return ( super.sendDtmf(indtmf, options));
        }
        
        
        this.logger.debug('AculabCloudCall sendDtmf(' + indtmf + ')');
        if (indtmf.match(/[^0-9A-Da-d#*]/) != null) {
            throw 'Invalid DTMF string';
        }
        
        if (this._peerConnection) {
            try {
                var pc = this._peerConnection;
                WebRTCModule.peerConnectionSendDTMF(indtmf, 500, 400, pc._peerConnectionId);
            }
            catch(e) {
                this.logger.error('AculabCloudCall: Exception sending DTMF: ' + e);
                throw 'DTMF send error';
            }
        } else {
            throw 'DTMF send error';
        }
    }
    
    /**
     * Creates an offer or answer.
     * @param options - Options bucket.
     * @param modifiers - Modifiers.
     */
    getDescription(options, modifiers) {
        if (this._peerConnection.getSenders) {
            return ( super.getDescription(options, modifiers));
        }
        
        var _a, _b;
        this.logger.debug("SessionDescriptionHandler.getDescription");
        if (this._peerConnection === undefined) {
            return Promise.reject(new Error("Peer connection closed."));
        }
        // Callback on data channel creation
        this.onDataChannel = options === null || options === void 0 ? void 0 : options.onDataChannel;
        // ICE will restart upon applying an offer created with the iceRestart option
        const iceRestart = (_a = options === null || options === void 0 ? void 0 : options.offerOptions) === null || _a === void 0 ? void 0 : _a.iceRestart;
        // ICE gathering timeout may be set on a per call basis, otherwise the configured default is used
        const iceTimeout = (options === null || options === void 0 ? void 0 : options.iceGatheringTimeout) === undefined
        ? (_b = this.sessionDescriptionHandlerConfiguration) === null || _b === void 0 ? void 0 : _b.iceGatheringTimeout : options === null || options === void 0 ? void 0 : options.iceGatheringTimeout;
        return this.getLocalMediaStream(options)
        .then(() => this.createDataChannel(options))
        .then(() =>(this.createLocalOfferOrAnswer(options)))
        .then((sessionDescription) => this.applyModifiers(sessionDescription, modifiers))
        .then((sessionDescription) => this.setLocalSessionDescription(sessionDescription))
        .then(() => this.waitForIceGatheringComplete(iceRestart, iceTimeout))
        .then(() => this.getLocalSessionDescription())
        .then((sessionDescription) => {
            return {
            body: sessionDescription.sdp,
            contentType: "application/sdp"
            };
        })
        .catch((error) => {
            this.logger.error("SessionDescriptionHandler.getDescription failed - " + error);
            throw error;
        });
    }
    async getMediaStreams(constraints)
    {
        
        return await mediaDevices.getUserMedia(constraints);
    }
    async getMediaDevices()
    {
        return await mediaDevices.enumerateDevices();
    }
    async getLocalMediaStream(options) {
        try {
            //this._localMediaStream =
            await super.getLocalMediaStream(options);
            if (this.onUserMedia && this.notified_stream != this._localMediaStream) {
                this.notified_stream = this._localMediaStream;
                this.onUserMedia(this._localMediaStream);
            }
            return this._localMediaStream;
        } catch (error) {
            if (this.onUserMediaFailed) {
                this.onUserMediaFailed(error);
            }
            throw error;
        }
    }
    
    resetIceGatheringComplete() {
        this.iceGatheringTimeout = false;
        this.logger.log("resetIceGatheringComplete");
        if (this.iceGatheringTimer) {
            clearTimeout(this.iceGatheringTimer);
            this.iceGatheringTimer = undefined;
        }
        if (this.iceGatheringDeferred) {
            this.iceGatheringDeferred.reject();
            this.iceGatheringDeferred = undefined;
        }
    }
    
    close() {
        this.logger.log("closing PeerConnection");
        // have to check signalingState since this.close() gets called multiple times
        if (this._peerConnection && this._peerConnection.signalingState !== "closed") {
            if (this._peerConnection.getSenders) {
                this._peerConnection.getSenders().forEach((sender) => {
                    if (sender.track) {
                        sender.track.stop();
                    }
                });
            }
            else {
                this.logger.warn("Using getLocalStreams which is deprecated");
                this._peerConnection.getLocalStreams().forEach((stream) => {
                    stream.getTracks().forEach((track) => {
                        track.stop();
                    });
                });
            }
            if (this._peerConnection.getReceivers) {
                this._peerConnection.getReceivers().forEach((receiver) => {
                    if (receiver.track) {
                        receiver.track.stop();
                    }
                });
            }
            else {
                this.logger.warn("Using getRemoteStreams which is deprecated");
                this._peerConnection.getRemoteStreams().forEach((stream) => {
                    stream.getTracks().forEach((track) => {
                        track.stop();
                    });
                });
            }
            this.resetIceGatheringComplete();
            this._peerConnection.close();
        }
    }
    
    setDirection(sdp) {
        // eslint-disable-next-line @typescript-eslint/prefer-regexp-exec
        const match = sdp.match(/a=(sendrecv|sendonly|recvonly|inactive)/);
        if (match === null) {
            this.direction = this.C.DIRECTION.NULL;
            
            return;
        }
        const direction = match[1];
        switch (direction) {
            case this.C.DIRECTION.SENDRECV:
            case this.C.DIRECTION.SENDONLY:
            case this.C.DIRECTION.RECVONLY:
            case this.C.DIRECTION.INACTIVE:
                this.direction = direction;
                break;
            default:
                this.direction = this.C.DIRECTION.NULL;
                break;
        }
        
    }
   
    updateDirection(options) {
        if (this._peerConnection === undefined) {
            return Promise.reject(new Error("Peer connection closed."));
        }
        const getTransceiverKind = ((transceiver) => {
            if (transceiver.sender && transceiver.sender.track) {
                return transceiver.sender.track.kind;
            }
            if (transceiver.receiver && transceiver.receiver.track) {
                return transceiver.receiver.track.kind;
            }
            return "unknown";
        });
        const updateTransceiverCodecsAndBitrates = ((transceiver, kind) => {
            if (transceiver.setCodecPreferences) {
                if (kind == "video") {
                    this.logger.debug("SessionDescriptionHandler.updateDirection - setting video codecs");
                    transceiver.setCodecPreferences(options.codecs.video);
                } else if (kind == "audio") {
                    this.logger.debug("SessionDescriptionHandler.updateDirection - setting audio codecs");
                    transceiver.setCodecPreferences(options.codecs.audio);
                }
            }
            if (transceiver.sender) {
                let bitrate = undefined;
                if (kind == "video") {
                    bitrate = options.maxBitrateVideo;
                } else if (kind == "audio") {
                    bitrate = options.maxBitrateAudio;
                }
                if (bitrate !== undefined) {
                    const parameters = transceiver.sender.getParameters();
                    if (!parameters.encodings) {
                        parameters.encodings = [{}];
                    }
                    let changed = false;
                    parameters.encodings.forEach((enc) => {
                        if (!isFinite(bitrate) || bitrate < 0) {
                            if (Object.prototype.hasOwnProperty.call(enc, 'maxBitrate')) {
                                delete enc.maxBitrate;
                                changed = true;
                            }
                        } else {
                            if (enc.maxBitrate != bitrate) {
                                enc.maxBitrate = bitrate;
                                changed = true;
                            }
                        }
                    });
                    if (changed) {
                        this.logger.debug("SessionDescriptionHandler.updateDirection - setting " + kind + " bandwidth");
                        transceiver.sender.setParameters(parameters)
                        .then(() => {})
                        .catch(e => this.logger.error(e));
                    }
                }
            }
        });
        switch (this._peerConnection.signalingState) {
            case "stable":
                // if we are stable, assume we are creating a local offer
                this.logger.debug("SessionDescriptionHandler.updateDirection - setting offer direction");
            {
                let vid_dir = "";
                if (options.constraints.video) {
                    vid_dir += "send";
                }
                if (options.receiveVideo) {
                    vid_dir += "recv";
                }
                if (vid_dir.length == 4) {
                    vid_dir += "only";
                } else if (vid_dir == "") {
                    vid_dir = "inactive";
                }
                let aud_dir = "";
                if (options.constraints.audio) {
                    aud_dir += "send";
                }
                if (options.receiveAudio) {
                    aud_dir += "recv";
                }
                if (aud_dir.length == 4) {
                    aud_dir += "only";
                } else if (aud_dir == "") {
                    aud_dir = "inactive";
                }
                // set the transceiver direction to the offer direction
                this._peerConnection.getTransceivers().forEach((transceiver) => {
                    if (transceiver.direction /* guarding, but should always be true */) {
                        let offerDirection = "inactive";
                        let kind = getTransceiverKind(transceiver);
                        if (kind == "video") {
                            offerDirection = vid_dir;
                            vid_dir = "inactive"; // only one video track please
                        }
                        if (kind == "audio") {
                            offerDirection = aud_dir;
                            aud_dir = "inactive"; // only one audio track please
                        }
                        if (transceiver.direction !== offerDirection) {
                            transceiver.direction = offerDirection;
                        }
                        updateTransceiverCodecsAndBitrates(transceiver, kind);
                    }
                });
            }
                break;
            case "have-remote-offer":
                // if we have a remote offer, assume we are creating a local answer
                this.logger.debug("SessionDescriptionHandler.updateDirection - setting answer direction");
            {
                // determine the offered direction
                const description = this._peerConnection.remoteDescription;
                if (!description) {
                    throw new Error("Failed to read remote offer");
                }
                const offeredDirections = MediaEventSessionDescriptionHandler.get_audio_video_directions(description.sdp);
                let vid_dir = "";
                if (options.constraints.video && offeredDirections.video.includes("recv")) {
                    vid_dir += "send";
                }
                if (options.receiveVideo && offeredDirections.video.includes("send")) {
                    vid_dir += "recv";
                }
                if (vid_dir.length == 4) {
                    vid_dir += "only";
                } else if (vid_dir == "") {
                    vid_dir = "inactive";
                }
                let aud_dir = "";
                if (options.constraints.audio && offeredDirections.audio.includes("recv")) {
                    aud_dir += "send";
                }
                if (options.receiveAudio && offeredDirections.audio.includes("send")) {
                    aud_dir += "recv";
                }
                if (aud_dir.length == 4) {
                    aud_dir += "only";
                } else if (aud_dir == "") {
                    aud_dir = "inactive";
                }
                
                // set the transceiver direction to the answer direction
                this._peerConnection.getTransceivers().forEach((transceiver) => {
                    if (transceiver.direction /* guarding, but should always be true */ && transceiver.direction !== "stopped") {
                        let answerDirection = "inactive";
                        let kind = getTransceiverKind(transceiver);
                        if (transceiver.mid !== null) {
                            if (kind == "video") {
                                answerDirection = vid_dir;
                                vid_dir = "inactive"; // only one video track please
                            }
                            if (kind == "audio") {
                                answerDirection = aud_dir;
                                aud_dir = "inactive"; // only one audio track please
                            }
                        }
                        if (answerDirection == "inactive") {
                            transceiver.stop();
                        } else {
                            if (transceiver.direction !== answerDirection) {
                                transceiver.direction = answerDirection;
                            }
                            updateTransceiverCodecsAndBitrates(transceiver, kind);
                        }
                    }
                });
            }
                break;
            case "have-local-offer":
            case "have-local-pranswer":
            case "have-remote-pranswer":
            case "closed":
            default:
                return Promise.reject(new Error("Invalid signaling state " + this._peerConnection.signalingState));
        }
        return Promise.resolve();
    }
    
    static fixup_options(options) {
        const defaults = {
            constraints: {
            audio: true,
            video: false
            },
            receiveAudio: undefined,
            receiveVideo: undefined,
            codecs: {
            audio: [],
            video: []
            },
            maxBitrateAudio: undefined,
            maxBitrateVideo: undefined,
        };
        let opts = {...defaults, ...options};
        if (opts.receiveAudio === undefined) {
            opts.receiveAudio = (opts.constraints.audio != false);
        }
        if (opts.receiveVideo === undefined) {
            opts.receiveVideo = (opts.constraints.video != false);
        }
        if (typeof(RTCRtpTransceiver) === "undefined") {
            // legacy options as transceiver not supported
            opts.offerOptions = {
            offerToReceiveAudio: opts.receiveAudio,
            offerToReceiveVideo: opts.receiveVideo
            }
        }
        return opts;
    }
    static get_audio_video_directions(sdp) {
        let lines = sdp.split("\r\n");
        let sess_dir = "";
        let aud_dir = "";
        let vid_dir = "";
        let in_vid_m = false;
        let in_aud_m = false;
        for (let line of lines) {
            let dir = "";
            if (line == "a=sendrecv") {
                dir = "sendrecv";
            } else if (line == "a=sendonly") {
                dir = "sendonly";
            } else if (line == "a=recvonly") {
                dir = "recvonly";
            } else if (line == "a=inactive") {
                dir = "inactive";
            }
            if (dir) {
                if (!sess_dir) {
                    sess_dir = dir;
                } else if (in_vid_m) {
                    vid_dir = dir;
                } else if (in_aud_m) {
                    aud_dir = dir;
                }
                // check for aud and vid being set and break early
                if (vid_dir && aud_dir) {
                    break;
                }
            }
            if (line.startsWith("m=")) {
                // check for aud and vid being set and break early
                if (vid_dir && aud_dir) {
                    break;
                }
                if (sess_dir == "") {
                    sess_dir = "sendrecv"; // the default
                }
                if (!vid_dir && line.startsWith("m=video ")) {
                    in_vid_m = true;
                    vid_dir = sess_dir;
                }
                if (!aud_dir && line.startsWith("m=audio ")) {
                    in_aud_m = true;
                    aud_dir = sess_dir;
                }
            }
        }
        return {"video": vid_dir, "audio": aud_dir};
    }

    // Creates an RTCSessionDescriptionInit from an RTCSessionDescription
    createRTCSessionDescriptionInit(RTCSessionDescription) {
        return {
        type: RTCSessionDescription.type,
        sdp: RTCSessionDescription.sdp,
        };
    }
    
    // ICE gathering state handling
    isIceGatheringComplete() {
        return (
                this._peerConnection.iceGatheringState === 'complete' ||
                this.iceGatheringTimeout
                );
    }
    
    triggerIceGatheringComplete() {
        if (this.isIceGatheringComplete()) {
            if (this.iceGatheringTimer) {
                clearTimeout(this.iceGatheringTimer);
                this.iceGatheringTimer = undefined;
            }
            if (this.iceGatheringDeferred) {
                this.iceGatheringDeferred.resolve();
                this.iceGatheringDeferred = undefined;
            }
        }
    }
    
    addDefaultIceServers(rtcConfiguration) {
        if (!rtcConfiguration.iceServers) {
            rtcConfiguration.iceServers = [{urls: 'stun:stun.l.google.com:19302'}];
        }
        return rtcConfiguration;
    }
    addDefaultIceCheckingTimeout(peerConnectionOptions) {
        if (peerConnectionOptions.iceCheckingTimeout === undefined) {
            peerConnectionOptions.iceCheckingTimeout = 5000;
        }
        return peerConnectionOptions;
    }

}


