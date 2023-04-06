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
