var acc = null; // The AculabCloudClient instance
var inbound_enabled = false; // True if we have enabled inbound calls
var customer_id = null; // The WebRTC key
var slots = new Map([
	['a', {'call': null, 'inbound':false, 'connected':false, 'audio_player':null, 'local_video_player':null, 'remote_video_player': null, 'playing_ringing':false, 'gotremotestream':false, 'have_video': false}],
]);

function configToCallInput(slot, enabled) {
	document.getElementById(slot + "-remote-user-id").disabled = !enabled;
	document.getElementById(slot + "-remote-service").disabled = !enabled;
}

function configStartButtons(slot, enabled) {
	document.getElementById(slot + "-start_voice_button").disabled = !enabled;
	document.getElementById(slot + "-start_video_button").disabled = !enabled;
	document.getElementById(slot + "-start_service_voice_button").disabled = !enabled;
}

function configAcceptButtons(slot, audio_enabled, voice_enabled) {
	document.getElementById(slot + "-accept_voice_button").disabled = !audio_enabled;
	document.getElementById(slot + "-accept_video_button").disabled = !voice_enabled;
}

function configDtmfButtons(slot, enabled) {
	var dtmf_table = document.getElementById(slot + '-dtmf-buttons');
	var buttons = dtmf_table.getElementsByTagName('button');
	for (var i=0; i < buttons.length; i++) {
		buttons.item(i).disabled = !enabled;
	}
}

function gotmedia(slot, obj) {
	var slot_obj = slots.get(slot);
	for (player of [slot_obj.audio_player, slot_obj.remote_video_player]) {
		player.pause();
		player.loop = '';
		player.src = '';
		player.srcObject = null;
		player.type = '';
		player.load();
		slot_obj.playing_ringing = false;
		slot_obj.gotremotestream = false;
	}
	if (obj !== null) {
		slot_obj.gotremotestream = true;
		if (slot_obj.have_video) {
			player = slot_obj.remote_video_player;
		} else {
			player = slot_obj.audio_player;
		}
		player = slot_obj.remote_video_player;
		player.srcObject = obj.stream;
		player.load();
		var p = player.play();
		if (p !== undefined) {
			p.catch(error => {});
		}
	}
}

function handle_disconnect(slot, cause) {
	var slot_obj = slots.get(slot);
	slot_obj.connected=false;
	if (slot_obj.call != null) {
		slot_obj.call.disconnect();
		slot_obj.call = null;
	}
	gotmedia(slot, null);
	document.getElementById(slot + "-state").value = "Idle - " + cause;
	document.getElementById(slot + "-remote").value = "";
	configStartButtons(slot, true);
	document.getElementById(slot + "-stop_button").disabled = true;
	document.getElementById(slot + "-mute").disabled = true;
	document.getElementById(slot + "-mute").value = 'none';
	configToCallInput(slot, true);
	configAcceptButtons(slot, false, false);
	configDtmfButtons(slot, false);
}

function call_disconnected(slot, obj) {
	var slot_obj = slots.get(slot);
	slot_obj.call = null;
	handle_disconnect(slot, obj.cause);
	var player = slot_obj.local_video_player;
	player.src = '';
	player.srcObject = null;
	player.type = '';
	player.load();
}

function connecting(slot, obj) {
	var slot_obj = slots.get(slot);
	document.getElementById(slot + "-state").value = "Connecting";
	if (slot_obj.have_video == true) {
		var player = slot_obj.local_video_player;
		player.srcObject = obj.stream;
		player.load();
		document.getElementById(slot + "-state").value = "Connecting";
		var p = player.play();
		if (p !== undefined) {
			p.catch(error => {});
		}
	}
}

function ringing(slot) {
	var slot_obj = slots.get(slot);
	document.getElementById(slot + "-state").value = "Ringing";
	if (!slot_obj.playing_ringing) {
		var player = slot_obj.audio_player;
		if (player.canPlayType('audio/wav')) {
			if (!slot_obj.gotremotestream) {
				player.loop = 'loop';
				player.src = 'sounds/ringback.wav';
				player.type="audio/wav";
				player.load();
				var p = player.play();
				if (p !== undefined) {
					p.catch(error => {});
				}
			}
		} else {
			console.log("browser can't play audio/wav, so no ringing will be heard");
		}
		slot_obj.playing_ringing = true;
	}
}

function connected(slot) {
	var slot_obj = slots.get(slot);
	slot_obj.connected=true;
	document.getElementById(slot + "-state").value = "Connected";
	configStartButtons(slot, false);
	document.getElementById(slot + "-stop_button").disabled = false;
	document.getElementById(slot + "-mute").disabled = false;
	configDtmfButtons(slot, true);
}

function handle_error(slot, obj) {
	handle_disconnect(slot, obj.error);
}

function mute_call(slot) {
	var slot_obj = slots.get(slot);
	if (slot_obj.call) {
		var sel = document.getElementById(slot + '-mute').value;
		if (sel == 'all') {
			slot_obj.call.mute(true, true, true, true);
		} else if (sel == "mic") {
			slot_obj.call.mute(true, false, false, false);
		} else if (sel == "speaker") {
			slot_obj.call.mute(false, true, false, false);
		} else if (sel == "camera") {
			slot_obj.call.mute(false, false, true, false);
		} else if (sel == "video player") {
			slot_obj.call.mute(false, false, false, true);
		} else if (sel == "audio") {
			slot_obj.call.mute(true, true, false, false);
		} else if (sel == "video") {
			slot_obj.call.mute(false, false, true, true);
		} else {
			slot_obj.call.mute(false, false, false, false);
		}
	}
}

function start_call(slot, av, call_type) {
	var slot_obj = slots.get(slot);
	if (slot_obj.call) {
		if (slot_obj.inbound && !slot_obj.connected) {
			console.log("accepting inbound");
			document.getElementById(slot + "-state").value = "Accepting call";
			configStartButtons(slot, false);
			configAcceptButtons(slot, false, false);
			document.getElementById(slot + "-stop_button").disabled = false;
			call_options = {};
			if (av == 'voice') {
				slot_obj.have_video = false;
			}
			call_options.constraints = {audio: true, video: slot_obj.have_video};
			slot_obj.call.answer(call_options);
		} else {
			console.log("not starting call - call in progress");
		}
	} else {
		console.log("starting call");
		console.log(AculabCloudClient.getCodecList("video"));
		console.log(AculabCloudClient.getCodecList("audio"));
		token = document.getElementById("token").value;
		call_options = {};
		slot_obj.have_video = false;
		var remote_name = "unknown";
		if (call_type == 'client') {
			if (av == 'video') {
				slot_obj.have_video = true;
			}
			call_options.constraints = {audio: true, video: slot_obj.have_video};
			user_id = document.getElementById(slot + "-remote-user-id").value;
			slot_obj.call = acc.callClient(encodeURIComponent(user_id), token, call_options);
			remote_name = "Client: " + user_id;
		} else {
			service = document.getElementById(slot + "-remote-service").value;
			slot_obj.call = acc.callService(encodeURIComponent(service));
			remote_name = "Service: " + service;
		}
		slot_obj.call.onDisconnect = call_disconnected.bind(null, slot);
		slot_obj.call.onRinging = ringing.bind(null, slot);
		slot_obj.call.onMedia = gotmedia.bind(null, slot);
		slot_obj.call.onConnecting = connecting.bind(null, slot);
		slot_obj.call.onConnected = connected.bind(null, slot);
		slot_obj.call.onError = handle_error.bind(null, slot);
		slot_obj.inbound = false;
		document.getElementById(slot + "-remote").value = remote_name;
		configToCallInput(slot, false);
		configStartButtons(slot, false);
		document.getElementById(slot + "-stop_button").disabled = false;
	}
}

function stop_call(slot) {
	var slot_obj = slots.get(slot);
	console.log("stopping call");
	if (slot_obj.call) {
		// if inbound and not accepted, use reject instead
		if (slot_obj.inbound && !slot_obj.connected) {
			slot_obj.call.reject(486);
		} else {
			slot_obj.call.disconnect();
		}
	}
	document.getElementById(slot + "-stop_button").disabled = true;
	configDtmfButtons(slot, false);
}

function send_dtmf(slot, dtmf) {
	var slot_obj = slots.get(slot);
	if (slot_obj.call) {
		console.log("send dtmf:" + dtmf);
		slot_obj.call.sendDtmf(dtmf);
	}
}

function new_call(obj) {
	var slot = '';
	var slot_obj = null;
	for (var [s, o] of slots) {
		if (o.call == null) {
			slot = s;
			slot_obj = o;
			break;
		}
	}
	if (slot_obj == null) {
		obj.call.reject(486);
		return;
	}
	if (obj.offeringVideo && obj.canReceiveVideo) {
		slot_obj.have_video = true;
	} else {
		slot_obj.have_video = false;
	}
	configStartButtons(slot, false);
	configAcceptButtons(slot, true, slot_obj.have_video);
	document.getElementById(slot + "-stop_button").disabled = false;
	document.getElementById(slot + "-state").value = "Incoming";
	document.getElementById(slot + "-remote").value = obj.from;
	configToCallInput(slot, false);
	slot_obj.call = obj.call;
	slot_obj.inbound = true;
	
	slot_obj.call.onDisconnect = call_disconnected.bind(null, slot);
	slot_obj.call.onRinging = ringing.bind(null, slot);
	slot_obj.call.onMedia = gotmedia.bind(null, slot);
	slot_obj.call.onConnecting = connecting.bind(null, slot);
	slot_obj.call.onConnected = connected.bind(null, slot);
	slot_obj.call.onError = handle_error.bind(null, slot);

	var player = slot_obj.audio_player;
	if (player.canPlayType('audio/wav')) {
		if (!slot_obj.gotremotestream) {
			player.loop = 'loop';
			player.src = 'sounds/ringing.wav';
			player.type="audio/wav";
			player.load();
			var p = player.play();
			if (p !== undefined) {
				p.catch(error => {});
			}
		}
	} else {
		console.log("browser can't play audio/wav, so no ringing will be heard");
	}
	slot_obj.call.ringing();
}

function incomingState(state) {
	if (state.ready) {
		document.getElementById("reg_state").value = "Incoming enabled";
	} else {
		var reg_state = "Not ready for incoming - " + state.cause;
		if (state.retry) {
			reg_state = reg_state + ' - retrying';
		}
		document.getElementById("reg_state").value = reg_state
	}
}

function register() {
	token = document.getElementById("token").value;
	if (acc) {
		try {
			acc.enableIncoming(token);
		}
		catch(err) {
			alert("Error: " + err);
			return;
		}
		document.getElementById("reg_state").value = "Enabling Incoming";
		document.getElementById("unreg_button").disabled = false;
		inbound_enabled = true;
	} else {
		document.getElementById("reg_state").value = "Client not found";
	}
}

function unregister() {
	if (acc) {
		acc.disableIncoming();
		document.getElementById("unreg_button").disabled = true;
		document.getElementById("reg_state").value = "Disabling Incoming";
		document.getElementById("token").value = "";
		inbound_enabled = false;
	} else {
		document.getElementById("reg_state").value = "No cloud client";
	}
}

function start_client(cloud, customer, user, logLevel) {
	if (acc) {
		return;
	}
	if (AculabCloudClient.isSupported()) {
		try {
			acc = new AculabCloudClient(cloud, customer, user, logLevel);
		}
		catch(err) {
			acc = null;
			alert("Error: " + err)
		}
		if (acc) {
			acc.maxConcurrent = slots.size;
			acc.onIncoming = new_call;
			acc.onIncomingState = incomingState;
			document.getElementById("reg_button").disabled = false;
			document.getElementById("reg_state").value = "Incoming disabled";
		} else {
			document.getElementById("reg_state").value = "Error creating cloud client";
		}
	} else {
		document.getElementById("reg_state").value = "not supported by this browser";
	}
}

function make_client() {
	cloud_obj = document.getElementById("cloud");
	cloud = cloud_obj.value
	clientId_obj = document.getElementById("clientId");
	logLevel_obj = document.getElementById("logLevel");
	start_client(cloud, customer_id, clientId_obj.value, parseInt(logLevel_obj.value));
	if (!acc) {
		return;
	}
	cloud_obj.disabled = true;
	clientId_obj.disabled = true;
	logLevel_obj.disabled = true;
	document.getElementById("create_button").disabled = true;
	document.getElementById("del_button").disabled = false;
	document.getElementById("reg_button").disabled = false;
	document.getElementById("con_state").value = "Connected";
	for (var [s, obj] of slots.entries()) {
		obj.audio_player = document.getElementById(s + '-player');
		obj.local_video_player = document.getElementById(s + '-local-video');
		obj.remote_video_player = document.getElementById(s + '-remote-video');
		obj.audio_player.load(); // do this early in response to user action to ensure we can play later
		obj.local_video_player.load(); // do this early in response to user action to ensure we can play later
		obj.remote_video_player.load(); // do this early in response to user action to ensure we can play later
		configStartButtons(s, true);
	}
}

function dtor_client() {
	for (var obj of slots.values()) {
		if (obj.call) {
			return;
		}
	}
	if (inbound_enabled) {
		unregister();
	}
	acc = null;
	cloud_obj = document.getElementById("cloud");
	clientId_obj = document.getElementById("clientId");
	logLevel_obj = document.getElementById("logLevel");
	cloud_obj.disabled = false;
	clientId_obj.disabled = false;
	logLevel_obj.disabled = false;
	document.getElementById("create_button").disabled = false;
	document.getElementById("del_button").disabled = true;
	document.getElementById("reg_button").disabled = true;
	document.getElementById("unreg_button").disabled = true;
	document.getElementById("con_state").value = "Not connected";
	for (var s of slots.keys()) {
		document.getElementById(s + '-stop_button').disabled = true;
		configStartButtons(s, false);
	}
}

function get_webrtc_token() {
	cloud_obj = document.getElementById("cloud");
	cloud = cloud_obj.value
	customer = customer_id;
	clientId = document.getElementById("clientId").value;

	document.getElementById("token").value = "";
	fetch("/get_webrtc_token_for_client", {
		method: "POST",
		body: clientId
	})
	.then(response => response.json())
	.then(data => document.getElementById("token").value = data.token)
	.catch(function(err) {
		console.log("Fetch problem: " + err.message);
		document.getElementById("reg_state").value = "Fetch failed. Reload page."
	});
}

function set_config(jsn) {
	customer_id = jsn.token;
	document.getElementById("cloud").value = jsn.cloud;
	document.getElementById("ttl").value = jsn.ttl;
	document.getElementById("token").value = "";
}

function get_webrtc_demo_config() {
	fetch("/get_webrtc_demo_config", {
		headers: {
			'Accept': 'application/json'
		},
		method: "GET"
	})
	.then(response => response.json())
	.then(data => set_config(data));
}
