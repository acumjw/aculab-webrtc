import { AculabCloudOutgoingCall } from "./aculab-cloud-outgoing-call.js";
import { URI } from "sip.js";

export class AculabCloudOutgoingClientCall extends AculabCloudOutgoingCall {
	constructor(client, clientId, token, options) {  // TODO add option to allow video
		let uri = new URI("sip", clientId, `${client._webRtcAccessKey}.webrtc-${client._cloud}.aculabcloud.net;transport=tcp`);
		super(client, uri, {
			extraHeaders: ["Authorization: Bearer " + token]
		}, options, true);
	}
	_add_media_handlers(sdh) {
		super._add_media_handlers(sdh);
		// add transceivers if we want to receive (not needed if we are sending, but doesn't hurt)
		if (typeof(RTCRtpTransceiver) !== "undefined") {
			if (this._sdh_options.receiveAudio) {
				sdh._peerConnection.addTransceiver("audio", {direction:"recvonly"});
			}
			if (this._sdh_options.receiveVideo) {
				sdh._peerConnection.addTransceiver("video", {direction:"recvonly"});
			}
		}
	}
}
