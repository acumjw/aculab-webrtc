function setUpGetToken(showButton, cloudObj, clientObj, tokenObj, settings) {
	html = `
<style>
/* The Modal (background) */
.modal {
  display: none; /* Hidden by default */
  position: fixed; /* Stay in place */
  z-index: 1; /* Sit on top */
  left: 0;
  top: 0;
  width: 100%; /* Full width */
  height: 100%; /* Full height */
  overflow: auto; /* Enable scroll if needed */
  background-color: rgb(0,0,0); /* Fallback color */
  background-color: rgba(0,0,0,0.4); /* Black w/ opacity */
}

/* Modal Content/Box */
.modal-content {
  background-color: #fefefe;
  margin: 15% auto; /* 15% from the top and centered */
  padding: 20px;
  border: 1px solid #888;
  width: fit-content;
}

/* The Close Button */
.modal-content .close {
  color: #aaa;
  float: right;
  font-size: 28px;
  font-weight: bold;
}

.modal-content .close:hover,
.modal-content .close:focus {
  color: black;
  text-decoration: none;
  cursor: pointer;
}

.modal-content div {
	padding: 2px;
}

.modal-content .centre {
  display: flex;
  justify-content: center;
  align-items: center;	
}

/* The switch - the box around the slider */
.modal-content .switch {
	position: relative;
	display: inline-block;
	width: 40px;
	height: 24px;
}

/* Hide default HTML checkbox */
.modal-content .switch input {
	opacity: 0;
	width: 0;
	height: 0;
}

/* The slider */
.modal-content .slider {
	position: absolute;
	cursor: pointer;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	vertical-align: middle;
	background-color: #ccc;
	-webkit-transition: .4s;
	transition: .4s;
}

.modal-content .slider:before {
	position: absolute;
	content: "";
	height: 16px;
	width: 16px;
	left: 4px;
	bottom: 4px;
	background-color: white;
	-webkit-transition: .4s;
	transition: .4s;
}

.modal-content h4 {
	margin-block-start: 1.5em;
	margin-block-end: 0.5em;
}

.modal-content input:checked + .slider {
	background-color: #2196F3;
}

.modal-content input:checked:disabled + .slider {
	background-color: #9ecdef;
}

.modal-content input:focus + .slider {
	box-shadow: 0 0 1px #2196F3;
}

.modal-content input:checked + .slider:before {
	-webkit-transform: translateX(16px);
	-ms-transform: translateX(16px);
	transform: translateX(16px);
}

/* Rounded sliders */
.modal-content .slider.round {
	border-radius: 24px;
}

.modal-content .slider.round:before {
	border-radius: 50%;
}
</style>
<div id="generateTokenDialog" class="modal">

  <!-- Modal content -->
  <div id="generateTokenDialogContent" class="modal-content">
    <span class="close">&times;</span>
	<header>
		<h2>Generate a token</h2>
	</header>
	<p>This uses the <a href="https://www.aculab.com/cloud/other-apis/web-services/webrtc-clients?target=service_action_tabs&tab-id=webrtc-generate-token" target="_blank">webrtc_generate_token</a> Web Service API to generate a token.
	<h4>Credentials</h4>
	<div>
		Cloud: <span id="modal-cloud"></span>
	</div>
	<div>
		Cloud Username: <input id="cloud-username" size=30 value="">
	</div>
	<div>
		API Access Key: <input id="cloud-password" size=30 value="" type="password">
	</div>
	<h4>Parameters</h4>
	<div>
		Client ID: <span id="modal-client"></span>
	</div>
	<div>
		TTL: <input id="modal-ttl" size=10 value="3600" min="600" max="87600" type="number">
	</div>
	<div>
		Can enable incoming:
		<label class="switch">
			<input type="checkbox" id="modal-enable-incoming">
			<span class="slider round"></span>
		</label>

	</div>
	<div>
		Call client: <input id="modal-call-client" size=30 value="">
	</div>
	<div>
		&nbsp;
	</div>
	<div class="centre">
		<button id="gen_token_button">Generate a token</button>
	</div>
  </div>

</div>
`;
	var defaults = {
		ttl: 3600,
		ttl_fixed: false,
		incoming: true,
		incoming_fixed: false,
		call_client: "*",
		call_client_fixed: false,
	}
	var args = { ...defaults, ...settings };
	showButton.insertAdjacentHTML("afterend", html);
	var modal = document.getElementById("generateTokenDialog");

	var ttlObj = document.getElementById("modal-ttl");
	var incomingObj = document.getElementById("modal-enable-incoming");
	var callClientObj = document.getElementById("modal-call-client");

	ttlObj.value = args.ttl;
	if (args.ttl_fixed) {
		ttlObj.disabled = true;
	}
	incomingObj.checked = args.incoming;
	if (args.incoming_fixed) {
		incomingObj.disabled = true;
	}
	callClientObj.value = args.call_client;
	if (args.call_client_fixed) {
		callClientObj.disabled = true;
	}

	// Get the <span> element that closes the modal
	var span = modal.getElementsByClassName("close")[0];

	var content = document.getElementById("generateTokenDialogContent");

	// When the user clicks on the button, open the modal and update client/cloud
	showButton.onclick = function() {
		modal.style.display = "block";
		content.style.marginTop = "" + (showButton.getBoundingClientRect().top + document.documentElement.scrollTop) + "px";
		document.getElementById("modal-client").textContent = clientObj.value;
		document.getElementById("modal-cloud").textContent = cloudObj.value;
	}

	// When the user clicks on <span> (x), close the modal
	span.onclick = function() {
		modal.style.display = "none";
	}

	// Get the button that open gets the token
	var gen_btn = document.getElementById("gen_token_button");
	gen_btn.onclick = function() {
		cloud = cloudObj.value
		clientId = clientObj.value;
		username = document.getElementById("cloud-username").value;
		password = document.getElementById("cloud-password").value;
		ttl = ttlObj.value;
		if(ttl == '') {
			ttl = 3600;
		}

		enable_incoming = incomingObj.checked ? "true" : "false";
		call_client = callClientObj.value;

		var data = new FormData();
		data.append("client_id", clientId);
		data.append("ttl", ttl);
		data.append("enable_incoming", enable_incoming);
		if (call_client != "") {
			data.append("call_client", call_client);
		}
		fetch("https://ws-" + cloud + ".aculabcloud.net/webrtc_generate_token", {
			method: 'POST',
			headers: {
				"Authorization": "Basic " + btoa(cloud + "/" + username + ":" + password)
			},
			body: data
		}).then(async response => {
			const isJson = response.headers.get('content-type')?.includes('application/json');
			const data = isJson ? await response.json() : null;

			// check for error response
			if (!response.ok) {
				// get error message from body or default to response status
				const error = (data && data.error && data.error.text) || `HTTP ${response.status}`;
				return Promise.reject(error);
			}
			tokenObj.value = data.token;
			modal.style.display = "none";
		  })
		.catch(error => {
			console.error('There has been a problem with your fetch operation:', error);
			alert(error.toString());
		});
	}



	// When the user clicks anywhere outside of the modal, close it
	window.onclick = function(event) {
	  if (event.target == modal) {
		modal.style.display = "none";
	  }
	}
}
