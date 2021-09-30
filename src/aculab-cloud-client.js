"use strict";
import adapter from "webrtc-adapter";

import {
	RegistererState,
	SessionState,
	UserAgent,
	URI,
	Web
} from "sip.js";

import { AculabCloudIncomingCall } from "./aculab-cloud-incoming-call.js";
import { AculabCloudOutgoingServiceCall } from "./aculab-cloud-outgoing-service-call.js";
import { AculabCloudOutgoingClientCall } from "./aculab-cloud-outgoing-client-call.js";
import { MediaEventSessionDescriptionHandler } from "./media-event-session-description-handler.js";
import { TokenRegisterer } from "./token-registerer.js";

export class AculabCloudClient {
	constructor(cloudId, webRtcAccessKey, clientId, logLevel) {
		this.loglevel = logLevel
		if (this.loglevel < 0) {
			this.loglevel = 0;
		}
		this.console_log("AculabCloudClient cloudId = '" + cloudId + "', webRtcAccessKey = '" + webRtcAccessKey + "', clientId = '" + clientId + "'");
		this.console_log("AculabCloudClient using adapter for '" + adapter.browserDetails.browser + "'");
		if (typeof cloudId !== 'string') {
			throw 'cloudId is not a string';
		}
		if (!/^[0-9]+-[0-9]+-[0-9]+$/.test(cloudId)) {
			throw "Invalid cloudId";
		}
		if (typeof webRtcAccessKey !== 'string') {
			throw 'webRtcAccessKey is not a string';
		}
		if (!/^[a-z0-9]{1,63}$/.test(webRtcAccessKey)) {
			throw "Invalid webRtcAccessKey";
		}
		if (typeof clientId !== 'string') {
			throw 'clientId is not a string';
		}
		// will users include the sip: in the clientId? strip it if present
		if (clientId.startsWith("sip%3A") || clientId.startsWith("sip%3a")) {
			clientId = clientId.substring(6)
		} else if (clientId.startsWith("sip:")) {
			clientId = clientId.substring(4)
		}
		// we also strip 'webrtc:' just in case people use that!
		if (clientId.startsWith("webrtc%3A") || clientId.startsWith("webrtc%3a")) {
			clientId = clientId.substring(9)
		} else if (clientId.startsWith("webrtc:")) {
			clientId = clientId.substring(7)
		}

		// we restrict this, as the cloud back end seems to struggle with escaping
		if (!/^[A-Za-z0-9+\-_.]+$/.test(clientId)) {
			throw "Invalid clientId";
		}
		
		this._cloud = cloudId;
		this._webRtcAccessKey = webRtcAccessKey;
		this._clientId = clientId;
		var ua_log_level = "error";
		if (this.loglevel > 4) {
			ua_log_level = "debug";
		} else if (this.loglevel == 4) {
			ua_log_level = "log";
		} else if (this.loglevel == 3) {
			ua_log_level = "warn";
		} else {
			ua_log_level = "error";
		}
		this._ua = new UserAgent({
			uri: new URI("sip", clientId, webRtcAccessKey + ".webrtc-" + cloudId + ".aculabcloud.net"),
			transportOptions: {
				server: 'wss://webrtc-' + cloudId + '.aculabcloud.net/sipproxy',
				connectionTimeout: 30,
				traceSip: (this.loglevel > 5),
			},
			userAgentString: "AculabCloudClient",
			logLevel: ua_log_level,
			sessionDescriptionHandlerFactory: this.sessionDescriptionHandlerFactory.bind(this),
			sessionDescriptionHandlerFactoryOptions: {},
			autoStart: false,
		});
		this._ua.delegate = {
			onConnect: () => {
				this.console_log('AculabCloudClient: websocket connected');
				this._transport_connected = true;
				if (this._token) {
					this.enableIncoming(this._token);
				}
				this._requestIceServers();
			},
			onDisconnect: (err) => {
				if (err) {
					this.console_log(`AculabCloudClient: websocket disconnected (${err.name}:${err.message})`);
				} else {
					this.console_log(`AculabCloudClient: websocket disconnected (no error info)`);
				}
				this._transport_connected = false;
				// clear registration
				if (this._registerer) {
					this._registerer.setToken(undefined);
				}
				// disconnect all calls
				this._calls.forEach((call) => {
					if (call._termination_reason == '') {
						call._termination_reason = "FAILED";
					}
					call.disconnect();
					if (call._session && call._session.state == SessionState.Terminating) {
						call._session.onReject(); // force termination
					}
				});
				// stop getting ice servers
				if (this._option_request_refresh_timer) {
					clearTimeout(this._option_request_refresh_timer);
					this._option_request_refresh_timer = null;
				}
				// queue reconnect attempt
				this.reconnect(); // TODO should this only be "if (err)"
			},
			onInvite: (invitation) => {
				this.console_log('invite');
				if (this._calls.size >= this.maxConcurrent) {
					this.console_log("AculabCloudClient rejecting incoming, too many calls");
					invitation.reject({statusCode: 486}); // 486 == busy here
				} else {
					if (this.onIncoming) {
						var ic = new AculabCloudIncomingCall(this, invitation);
						let media_dirs = MediaEventSessionDescriptionHandler.get_audio_video_directions(invitation.body);
						this._calls.add(ic);
						var caller_type = "other";
						try {
							this.console_log("AculabCloudClient calling onIncoming");
							if (invitation.remoteIdentity.uri.host == `sip-${this._cloud}.aculab.com`) {
								caller_type = "service";
							} else if (invitation.remoteIdentity.uri.host == `${this._webRtcAccessKey}.webrtc-${this._cloud}.aculabcloud.net`) {
								caller_type = "client";
							}
							this.onIncoming({
								'call': ic,
								'from': invitation.remoteIdentity.uri.user,
								'type': caller_type,
								'offeringAudio': media_dirs.audio.includes('send'),
								'canReceiveAudio': media_dirs.audio.includes('recv'),
								'offeringVideo': media_dirs.video.includes('send'),
								'canReceiveVideo': media_dirs.video.includes('recv')
							});
						}
						catch(e) {
							this.console_error('AculabCloudClient onIncoming cause exception: ' + e.message);
							ic.reject(500); // should be a 500?
						}
					} else {
						this.console_log("AculabCloudClient rejecting incoming, no onIncoming callback defined");
						invitation.reject(); // default is 480, maybe "404 not found" as we can't alert the user
					}
				}
			}
		};
		this._calls = new Set();
		this._ua_started = false;
		this._transport_connected = false;
		this._token = null;
		this._registerer = null;
		this.onIncomingState = null;
		this._aculabIceServers = null;
		this._option_request = null;
		this._option_request_refresh_timer = null;
		this.maxConcurrent = 1;
		this.iceServers = null;
		this._reconnecting = false;

		// add legacy function name alias
		this.makeOutgoing = this.callService;
	}
	reconnect() {
		if (!this._ua_started) {
			return;
		}
		if (this._reconnecting) {
			return;
		}
		this._reconnecting = true;
		setTimeout(() => {
			if (!this._ua_started) {
				this._reconnecting = false;
				return;
			}
			this._ua.reconnect().then(() => {
				this._reconnecting = false;
			}).catch(() => {
				this._reconnecting = false;
				this.reconnect();
			})
		}, 1000);
	}
	sessionDescriptionHandlerFactory(session, options) {
		// provide a media stream factory
		const mediaStreamFactory = Web.defaultMediaStreamFactory();
		// make sure we allow `0` to be passed in so timeout can be disabled
		const iceGatheringTimeout = (options === null || options === void 0 ? void 0 : options.iceGatheringTimeout) !== undefined ? options === null || options === void 0 ? void 0 : options.iceGatheringTimeout : 5000;
		// merge passed factory options into default session description configuration
		let sessionDescriptionHandlerConfiguration = {
			iceGatheringTimeout,
			peerConnectionConfiguration: Object.assign(Object.assign({}, Web.defaultPeerConnectionConfiguration()), options === null || options === void 0 ? void 0 : options.peerConnectionConfiguration)
		};
		// set the desired ice servers
		if (this.iceServers != null) {
			sessionDescriptionHandlerConfiguration.peerConnectionConfiguration.iceServers = this.iceServers;
		} else {
			sessionDescriptionHandlerConfiguration.peerConnectionConfiguration.iceServers = this._aculabIceServers;
		}
		const logger = session.userAgent.getLogger("sip.SessionDescriptionHandler");
		return new MediaEventSessionDescriptionHandler(logger, mediaStreamFactory, sessionDescriptionHandlerConfiguration);
	}
	_isReady() {
		if (this._transport_connected && (this.iceServers != null || this._aculabIceServers != null)) {
			return true;
		}
		return false;
	}
	_requestIceServers() {
		if (!this._ua_started || !this._transport_connected) {
			return;
		}
		if (this._option_request_refresh_timer) {
			clearTimeout(this._option_request_refresh_timer);
			this._option_request_refresh_timer = null;
		}
		this.console_log('AculabCloudClient: sending options request');
		const request_uri = new URI('sip', '', `webrtc-${this._cloud}.aculabcloud.net`);

		const to_uri = request_uri;
		const from_uri = this._ua.configuration.uri;
		const core = this._ua.userAgentCore;
		const options = {};
		const message = core.makeOutgoingRequestMessage("OPTIONS", request_uri, from_uri, to_uri, options, ["X-AculabTurnRequest: 1"]);
		// Send message
		this._option_request = core.request(message, {
			onAccept: (response) => {
				this.console_log('AculabCloudClient: OPTIONS body:' + response.message.body);
				var turn_str = response.message.body;
				try {
					this._aculabIceServers = JSON.parse(turn_str);
				}
				catch(e) {
					this.console_error('AculabCloudClient: failed to parse iceServers response: ' + e.message);
					this._aculabIceServers = null;
				}
				this._option_request = null; // done with this one
				this._option_request_refresh_timer = setTimeout(() => {
					this._option_request_refresh_timer = null;
					this._requestIceServers();
				}, 30000); // once a minute should be ok, they are valid for 2
				if (this._aculabIceServers) {
					// trigger any calls waiting to start
					this._calls.forEach(function(call) {
						call._onclientready();
					});
				}
			},
			onReject: (response) => {
				this.console_log(`AculabCloudClient: OPTIONS failed (${response.message.statusCode} ${response.message.reasonPhrase})`);
				this._aculabIceServers = null;
				this._option_request = null; // done with this one
				this._option_request_refresh_timer = setTimeout(() => {
					this._option_request_refresh_timer = null;
					this._requestIceServers();
				}, 60000); // once a minute should be ok, they are valid for 2
			}
		});
	}
	console_log(msg) {
		if (this.loglevel > 1) {
			console.log(msg);
		}
	}
	console_error(msg) {
		if (this.loglevel > 0) {
			console.error(msg);
		}
	}
	_checkStop() {
		if (this._calls.size == 0 && this._token == null && this._registered_token == null) {
			// no longer need websocket connection
			this._ua.stop();
			this._ua_started = false;
			// the ua will disconnect the transport, but we don't get the event
			// so just clear the flag
			this._transport_connected = false;
		}
	}
	_removeCall(call) {
		if (this._calls.delete(call)) { // was still present
			this._checkStop();
			return true;
		}
		return false; // already gone
	}
	
	
	callService(serviceName) {
		if (typeof serviceName !== 'string') {
			throw 'serviceName is not a string';
		}
		// some users are including the sip: in the service name, strip it
		if (serviceName.startsWith("sip%3A") || serviceName.startsWith("sip%3a")) {
			serviceName = serviceName.substring(6)
		} else if (serviceName.startsWith("sip:")) {
			serviceName = serviceName.substring(4)
		}
		// service names are more restrictive than plain SIP usernames
		if (!/^[A-Za-z0-9\-_.+]+$/.test(serviceName)) {
			throw "Invalid serviceName";
		}
		if (this._calls.size >= this.maxConcurrent) {
			throw "Too many calls"
		}
		if (!this._ua_started) {
			this._ua.start();
			this._ua_started = true;
		}
		var outcall = new AculabCloudOutgoingServiceCall(this, serviceName);
		this._calls.add(outcall);
		return outcall;
	}
	callClient(clientId, token, options) {
		if (typeof clientId !== 'string') {
			throw 'clientId is not a string';
		}
		// some users are including the sip: in the service name, strip it
		if (clientId.startsWith("sip%3A")) {
			clientId = clientId.substring(6)
		} else if (clientId.startsWith("sip:")) {
			clientId = clientId.substring(4)
		}
		// service names are more restrictive than plain SIP usernames
		var testServiceName = clientId.replace(/([A-Za-z0-9-_.+])/g,'');
		if (testServiceName != '' || clientId === '') {
			throw "Invalid clientId";
		}
		if (this._calls.size >= this.maxConcurrent) {
			throw "Too many calls"
		}
		if (!this._ua_started) {
			this._ua.start();
			this._ua_started = true;
		}
		// check token looks plausible
		var token_bits = token.split('.');
		if (token_bits.length != 3 && token_bits.length != 5) { // 3 for just signed, 5 for encrypted and signed
			throw 'Invalid token';
		}
		var b64u_re = RegExp('^[-_0-9a-zA-Z]+$');
		token_bits.forEach((bit) => {
			if (!b64u_re.test(bit)) {
				throw 'Invalid token';
			}
		});
		var outcall = new AculabCloudOutgoingClientCall(this, clientId, token, options);
		this._calls.add(outcall);
		return outcall;
	}
	enableIncoming(token) {
		// check token looks plausible
		var token_bits = token.split('.');
		if (token_bits.length != 3 && token_bits.length != 5) { // 3 for just signed, 5 for encrypted and signed
			throw 'Invalid token';
		}
		var b64u_re = RegExp('^[-_0-9a-zA-Z]+$');
		token_bits.forEach((bit) => {
			if (!b64u_re.test(bit)) {
				throw 'Invalid token';
			}
		});
		this._token = token;
		if (!this._ua_started) {
			this._ua.start();
			this._ua_started = true;
		}
		if (!this._registerer) {
			this._registerer = new TokenRegisterer(this._ua);
			this._registerer.stateChange.addListener((update) => {
				if (update.state == RegistererState.Terminated) {
					return;
				}
				var ready = (update.state == RegistererState.Registered);
				if (this.onIncomingState) {
					let retry = update.retry || (this._ua_started && this._token && !this._transport_connected);
					this.console_log(`AculabCloudCaller calling onIncomingState(${ready}, ${update.cause}, ${retry})`);
					try {
						this.onIncomingState({'ready': ready, 'cause': update.cause, 'retry': retry});
					}
					catch(e) {
						this.console_error(`AculabCloudCaller onIncomingState(${ready}, ${update.cause}, ${retry}) caused exception: ${e.message}`);
					}
				}
				if (!ready && !this._token && this._registerer) {
					this._registerer.dispose();
					this._registerer = null;
					this._checkStop();
				}
			});
		}
		if (this._transport_connected) {
			this._registerer.setToken(this._token);
		}
	}
	disableIncoming() {
		this._token = null;
		if (this._registerer) {
			this._registerer.setToken(undefined);
		} else {
			this._checkStop();
		}
	}
	closeConnection() {
		this._ua.transport.disconnect();
	}
	static isSupported() {
		if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
			return false;
		}
		if (!window.WebSocket) {
			return false;
		}
		if (!window.RTCPeerConnection) {
			return false;
		}
		return true;
	}
	static getCodecList(mediaType) {
		if (window.RTCRtpTransceiver && 'setCodecPreferences' in window.RTCRtpTransceiver.prototype) {
			const {codecs} = RTCRtpSender.getCapabilities(mediaType);
			return codecs;
		}
		return [];
	}
}
