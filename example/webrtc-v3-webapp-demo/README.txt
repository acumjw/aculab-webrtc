WebRTC Example Code
===================

Introduction
------------

This directory contains some example code for WebRTC.  It consists of a simple
Python Flask app containing a small number of URL endpoints, and a few
static files.

Prerequisites
-------------

To run the sample code, you will need to have Python3 and the flask python
module installed.

To install the flask module, run:
  $ pip3 install flask

Configuration
-------------

The app must be configured with your credentials before it is run.  There
are a few variables near the top of webrtcws.py that need setting:

 - CLOUD_REGION must be set to your cloud region ("0-2-0", "1-2-0", etc)
 - CLOUD_USERNAME must be set to your cloud username
 - CLOUD_API_ACCESS_KEY must be set to your Web Services API key
 - CLOUD_WEBRTC_ACCESS_KEY must be set to your WebRTC access key
 - CLOUD_WEBRTC_TOKEN_TTL must be set to the WebRTC token time to live
 - LISTENING_PORT is set to 3918 by default. Change this if required.

The API and WebRTC access keys can be found under your account menu in the
Cloud Console.

Running
-------

To run the WebRTC demo app, run:
  python3 webrtcws.py

You can access the WebRTC demo at https://[your-ip-address]:3918/.

Using the Demo
--------------

This demo allows you to test making and receiving calls using WebRTC on a
browser. Each browser instance you create a single client with a unique ID
and token.  This client can then call a service (e.g. webrtcdemo),
or call or be called by another client.

The demo has three steps:

Step 1:  Enter a Client ID name and click Create to register with WebRTC

The Client ID identifies the user of this WebRTC instance.  Choose something
unique for each browser instance connected to this demo.

Step 2: (optional) This step can be skipped when a calling a service.

Click "Generate token" then, when the "Client token" box
has been filled in, click "Enable" to enable incoming calls.

The "Token TTL (seconds)" box shows how long the token will live, and it
shows the value configured in webrtcws.py.

If you do not want to enable incoming calls, then you can skip this step.

Step 3: Call a Client ID or service, or accept an incoming call

If you have more than one browser instances running the WebRTC demo,
then you can call another Client ID of any other browser instance by entering
the other Client ID in the "Client ID to call" box and clicking either
"Video call" or "Voice call" next to it.

Alternatively, you can call a service by clicking "Voice call" on the
"Service to call" line.

You can accept an incoming call by clicking on "Accept video" or "Accept voice"
once a call has been detected.  "Accept video" will be enabled only if the
incoming call contains a video stream.

Mic, speakers and video input/output can be muted by selecting an option in the
Mute drop down box.

Troubleshooting
---------------

If you have a browser extension that disables media autoplay, then disable it
for this demo.
