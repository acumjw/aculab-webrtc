import { CallInviter } from "./call-inviter.js";
import { AculabCloudCall } from "./aculab-cloud-call.js";
import { MediaEventSessionDescriptionHandler } from "./media-event-session-description-handler.js";
import { SessionState } from "sip.js";

export class AculabCloudOutgoingCall extends AculabCloudCall {
	constructor(client, uri, inviter_options, options, reinvite_possible) {
		super(client);
		this._uri = uri;
		this._inviter_options = inviter_options;
		this._sdh_options = MediaEventSessionDescriptionHandler.fixup_options(options);
		if (!reinvite_possible || options.localStreams === undefined) {
			this.allowed_reinvite = false;
		} else {
			this.allowed_reinvite = true;
		}
		this._disconnect_called = false;
		if (this.client._isReady()) {
			this._doinvite();
		} else {
			this.invite_pending = true;
			// should we queue a timeout that results on _onterminate getting called
		}
	}
	_set_termination_reason_from_response(response) {
		// get termination reason from response
		if (this._termination_reason == '') {
			this._termination_reason = this._get_reason_from_sip_code(response.message.statusCode.toString());
			this.client.console_log(`setting termination reason - reject - ${this._termination_reason}`);
		}
	}
	_onclientready() {
		if (this.invite_pending) {
			this._doinvite();
		}
	}
	_doinvite() {
		this.client.console_log('AculabCloudOutgoingCall: invite to "' + this._uri + '"')
		this.session = new CallInviter(this, this.client._ua, this._uri, this._inviter_options);
		let opts = { 
			requestDelegate: {
				onProgress: (response) => {
					this._progress(response);
				}
			}
		};
		opts.sessionDescriptionHandlerOptions = this._sdh_options;
		this._session.invite(opts);
		this.invite_pending = false;
	}
	_progress(response) {
		if (response.message && response.message.statusCode == 180) {
			if (this.onRinging) {
				this.client.console_log('AculabCloudOutgoingCall calling onRinging');
				try {
					this.onRinging({'call': this});
				}
				catch(e) {
					this.client.console_error('AculabCloudOutgoingCall onRinging caused exception:' + e.message);
				}
			}
		}
	}
	disconnect() {
		this.client.console_log('AculabCloudOutgoingCall disconnect called');
		if (this.invite_pending) {
			this.invite_pending = false;
			this._termination_reason = 'NOANSWER'
			this.client.console_log(`setting termination reason - disconnect(nocall) - ${this._termination_reason}`);
			this._onterminated();
		}
		if (this._session && !this._disconnect_called) {
			this._disconnect_called = true;
			if (this._session.state == SessionState.Established) {
				this._session.bye();
			} else if (this._session.state == SessionState.Establishing) {
				if (this._termination_reason == '') {
					this._termination_reason = 'NOANSWER';
					this.client.console_log(`setting termination reason - disconnect - ${this._termination_reason}`);
				}
				this._session.cancel();
			}
		}
	}

	addStream(stream) {
		if (!this.allowed_reinvite) {
			throw 'addStream not available';
		}
		this.client.console_error('AculabCloudOutgoingCall addStream :' + this._session);
		if (this._session && !this._disconnect_called) {
			try {
				let options = this._sdh_options;
				let internal_stream_id = this._session.sessionDescriptionHandler.userToInternalLocalStreamIds.get(stream.id);
				let need_adding = false;
				if (!internal_stream_id) {
					console.log("mjw... internal stream ID oes not exist");
					let found = false;
					options.localStreams.forEach((lstream) => {
						if (lstream.id == stream.id) {
							found = true;
						}
					});
					if (!found) {
						console.log("mjw... needs adding");
						need_adding = true;
					}
				}
				if (need_adding) {
					console.log("mjw... pushing");
					options.localStreams.push(stream);
					console.log("mjw... reinviting");
					this.reinvite(options);
					console.log("mjw... reinvited");
				} else {
					console.log("mjw... stream already exists");
					throw "Stream already exists";
				}
			}
			catch(e) {
				this.client.console_error('AculabCloudCall: Exception Adding stream: ' + e.message);
				console.log("mjw... error adding stream " + e.message);
				throw 'Add stream error';
			}
		} else {
			throw 'Not connected error';
		}
	}

	removeStream(stream) {
		if (!this.allowed_reinvite) {
			throw 'removeStream not available';
		}
		this.client.console_error('AculabCloudOutgoingCall removeStream :' + this._session);
		if (this._session && !this._disconnect_called) {
			try {
				let options = this._sdh_options;
				console.log("mjw... removeStream ");
				console.log(options.localStreams); // mjw...
				let stream_id = this._session.sessionDescriptionHandler.getUserStreamId(stream);
				console.log("mjw... Got stream id " + stream_id);
				if (stream_id) {
					console.log("mjw... filtering");
					options.localStreams = options.localStreams.filter(item => item.id !== stream_id);
					console.log("mjw... reinviting");
					this.reinvite(options);
					console.log("mjw... reinvited");
				} else {
					console.log("mjw... stream does not exist");
					throw "Stream does not exist";
				}
			}
			catch(e) {
				this.client.console_error('AculabCloudCall: Exception Removing stream: ' + e.message);
				console.log("mjw... error remove stream " + e.message);
				throw 'Remove stream error';
			}
		} else {
			throw 'Not connected error';
		}
	}

	reinvite(options) {
		if (!this.allowed_reinvite) {
			throw 'Reinvite not available';
		}
		if (options.localStreams === undefined || options.localStreams.length == 0) {
			throw 'At least one MediaStream needed in options.localStreams';
		}
		this.client.console_error('AculabCloudOutgoingCall reinvite :' + this._session);
		if (this._session && !this._disconnect_called) {
			try {
				this._sdh_options = MediaEventSessionDescriptionHandler.fixup_options(options);
				let opts = { 
				};
				this._sdh_options.reinvite = true;
				console.log(this._sdh_options);
				opts.sessionDescriptionHandlerOptions = this._sdh_options;
				opts.sessionDescriptionHandlerOptionsReInvite = this._sdh_options;
				this.client.console_error('AculabCloudCall: new constraints: ' + opts);
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
