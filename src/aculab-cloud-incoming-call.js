import { AculabCloudCall } from "./aculab-cloud-call.js";
import { MediaEventSessionDescriptionHandler } from "./media-event-session-description-handler.js";
import { SessionState } from "sip.js";

export class AculabCloudIncomingCall extends AculabCloudCall {
        /**
         * @param {AculabCloudClient} client
         * @param {Invitation} session
         */
        constructor(client, session) {
                super(client);
                this.session = session;
                this.answer_pending = false;
                this._disconnect_called = false;
        }
        answer(options) {
                this._sdh_options = MediaEventSessionDescriptionHandler.fixup_options(options);
                this.client.console_log('AculabCloudIncomingCall: answer requested');
                if (this.client._isReady()) {
                        this._doanswer();
                } else {
                        this.answer_pending = true;
                        // should we queue a timeout that results on _onterminate getting called
                }
        }
        _onclientready() {
                if (this.answer_pending) {
                        this._doanswer();
                }
        }
        _doanswer() {
                this.client.console_log('AculabCloudIncomingCall: answering');
                if (this._session) {
                        // FIXME: Allow video and audio for re invite
                        let opts = {
                                sessionDescriptionHandlerOptions: this._sdh_options
                        }
                        this._session.accept(opts);
                }
                this.answer_pending = false;
        }
        ringing() {
                this.client.console_log('AculabCloudIncomingCall: ringing');
                if (this._session) {
                        this._session.progress();
                }
        }
        reject(cause) {
                this.client.console_log('AculabCloudIncomingCall: reject(' + cause + ')');
                var int_cause = 486;
                if (cause) {
                        try {
                                int_cause = parseInt(cause);
                                if (int_cause < 400 || int_cause > 699) {
                                        throw 'out of range';
                                }
                        }
                        catch(err) {
                                this.client.console_error('AculabCloudIncomingCall: reject cause invalid - ' + cause);
                                int_cause = 486; // default to busy
                        }
                }
                this.answer_pending = false;
                if (this._session) {
                        if (this._session.state == SessionState.Initial || this._session.state == SessionState.Establishing) {
                                this._session.reject({statusCode: int_cause});
                        } else {
                                this._session.bye({
                                        requestOptions: {
                                                extraHeaders: [
                                                        `Reason: SIP; cause=${int_cause}; text="Rejected"`
                                                ]
                                        }
                                });
                        }
                }
        }
        disconnect() {
                this.client.console_log('AculabCloudIncomingCall disconnect called');
                if (this._session && !this._disconnect_called) {
                        this._disconnect_called = true;
                        this.client.console_log(`call in state ${this._session.state}`);
                        if (this._session.state == SessionState.Initial || this._session.state == SessionState.Establishing) {
                                this.reject();
                        } else {
                                this._session.bye();
                        }
                }
                this.answer_pending = false;
        }
	addStream(stream) {
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
		this.client.console_error('AculabCloudIncomingCall reinvite :' + this._session);
		if (options.localStreams === undefined || options.localStreams.length == 0) {
			throw 'At least one MediaStream needed in options.localStreams';
		}
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
