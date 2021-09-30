import { Inviter } from "sip.js";

export class CallInviter extends Inviter {
	constructor(call, userAgent, targetURI, options = {}) {
		super(userAgent, targetURI, options);
		this.call = call;
	}
	onRedirect(response) {
		this.call._set_termination_reason_from_response(response);
		super.onRedirect(response);
	}
	onReject(response) {
		this.call._set_termination_reason_from_response(response);
		super.onReject(response);
	}
}
