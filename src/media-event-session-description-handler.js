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
var registerGlobals = "";
var RTCView = "";
var {WebRTCModule} = {};

if (typeof document == 'undefined') {
    // I'm on the react-native!
    NativeModules = require('react-native').NativeModules
    rnw = require('react-native-webrtc')
    RTCPeerConnection = rnw.RTCPeerConnection
    RTCIceCandidate = rnw.RTCIceCandidate
    MediaStream = rnw.MediaStream
    mediaDevices = rnw.mediaDevices
    registerGlobals = rnw.registerGlobals
    RTCView = rnw.RTCView
    
    
    WebRTCModule = NativeModules;
}

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
            return (super.getRemoteMediaStream());
        }
        return this._peerConnection.getRemoteStreams()
    }
    setRemoteTrack(track) {
        if (this._peerConnection.getSenders) {
            return (super.setRemoteTrack(track));
        }
        //*****CHRIS****  Don't want to actually use this function since we are using depricated getlocalStreams....  NEED THIS EVENTUALLY ONE OF THE APIS REACT NATIVE NEEDS
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
        //*****CHRIS*****  Probably need to remove the existing stream stillm but haven't had time to do this
        // will happen probably when working on mute/unmute
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
     *****CHRIS***** THIS IS A BIT OF A HACKTILL GETSENDERS IMPLEMENTED
     ******NEEDS CODE IN NATIVE STUFF.
     */
    //HACK ALERT HACK ALERT  THIS IS BULLSHIT WITH SOME NATIVE CODE IN AculabWebRTCNExtern.m
    //Really need sender/receiver support in react-native
    sendDtmf(indtmf, options) {
        if (this._peerConnection.getSenders) {
            return ( super.sendDtmf(indtmf, options));
        }
        
        //If old way of doing shit......  For iOS and Android
        //console.log('*****CHRIS***** sending dtmf SESSION', this._session);
        this.logger.debug('AculabCloudCall sendDtmf(' + indtmf + ')');
        if (indtmf.match(/[^0-9A-Da-d#*]/) != null) {
            throw 'Invalid DTMF string';
        }
        
        if (this.peerConnection) {
            try {
                var pc = this.peerConnection;
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
            this._localMediaStream = await super.getLocalMediaStream(options);
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
    
    static fixup_options(options) {
        const defaults = {
        constraints: {
        audio: true,
            //video: false
        video: {
            //width: 640,
            //height: 480,
        frameRate: 30,
        facingMode: ("front"),
            //deviceId: ""  //videoSourceId
        }
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
                this.peerConnection.iceGatheringState === 'complete' ||
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


