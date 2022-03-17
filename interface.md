_aculab-webrtc javascript interface_
====================================

AculabCloudClient
=================

Constructor
-----------

### AculabCloudClient(cloudId, webRtcAccessKey, clientId, logLevel)

Creates an AculabCloudClient object. A page can have more than one AculabCloudClient at a time.  
`cloudId` is the identifier of the Aculab Cloud where services that interact with the user are located.  
`webRtcAccessKey` is the WebRTC access key of your Aculab Cloud account.  
`clientId` identifies this client object. It is the value that will be placed in the call_from field in the call details of the application's main channel when making calls to inbound services. It is also the value used when services make outbound calls to WebRTC clients.  
_Note: `clientId` can only contain alphanumeric and +-.\_ characters._  
`logLevel` is a numeric value between 0 and 6 inclusive. 0 disables logging and 6 is the most detailed logging.

AculabCloudClient object functions
----------------------------------

### static boolean isSupported()

Returns true if the browser supports the necessary functionality and false if not.

### static array getCodecList(mediaType)

`mediaType` is either `"audio"` or `"video"`.  
Returns an array of RTCRtpCodecCapability objects, if the browser supports the necessary functionality and an empty array if not. The list can be reordered to set a preferred codec and passed in an AculabCloudCallOptions object when placing or answering calls. (Note: removing items from the list is allowed but may cause inter-operability problems.)

### AculabCloudOutgoingCall callService(serviceName)

`serviceName` is the name of the Aculab Cloud incoming service that the call will be connected to.

This initiates a call to the specified Aculab Cloud incoming service. Call progress is reported by callbacks, these should be set on the object returned by this function.

This throws a string exception if:

* the browser doesn't support calling the cloud
* there are too many calls already in progress
* serviceName contains disallowed characters

### AculabCloudOutgoingCall makeOutgoing(serviceName)

_Deprecated_ This is an alias for `callService`, which should be used instead.

### AculabCloudOutgoingCall callClient(clientId, token, options)

`clientId` is the client identifier of the WebRTC client that the call will be connected to.  
`token` is an authenication token. These can be obtained using an Aculab Cloud webservice.  
`options`, when specified, is a AculabCloudCallOptions object.

This initiates a call to the specified Aculab Cloud WebRTC client. Call progress is reported by callbacks, these should be set on the object returned by this function.

This throws a string exception if:

* the browser doesn't support calling the cloud
* there are too many calls already in progress
* clientId contains disallowed characters
* token is format is invalid

### void enableIncoming(token)

`token` is an authenication token. These can be obtained using an Aculab Cloud webservice. The token can be updated by calling this function with the new token.  
This function initiates registration of this client object as the destination for calls to the specified user. The status of the registration is reported by the onIncomingState callback.

This throws a string exception if the token format is invalid.

### void disableIncoming()

This function initiates the removal of this client as the destination for call to the specified user. The status of the registration is reported by the onIncomingState callback.

AculabCloudClient data properties
---------------------------------

### iceServers

Must be null or an array of RTCIceServer objects. This value can be changed at any time. Outgoing calls will use the value set when the call is made. Incoming calls will use the value set when the call is answered. If the value is null, an Aculab provided set of iceServers is used. Using an empty array will disable the Aculab provided iceServers.

### maxConcurrent

This is the number of concurrent calls this client is allowed to handle. The default is 1. This value must be 1 or greater. The upper limit is browser dependent.

AculabCloudClient callback properties
-------------------------------------

Each of these callback properties must be either `null` or a function. The function will be passed a single object parameter. Additional information may be included as properties of that object. All such properties are detailed below.

### onIncomingState

Called when user registration state changes.

The parameter object will have the following properties:

| property | value |
| --- | --- |
| `ready` | A boolean indicating whether this client is waiting for incoming calls. |
| `cause` | One of the following strings:<dl><dt>'DISCONNECTED'</dt><dd>the connection to the cloud has been lost.</dd><dt>'INVALIDTOKEN'</dt><dd>the token specified is not valid (for example, it has expired)</dd><dt>'FAILED'</dt><dd>the registration was unsuccessful for some other reason</dd><dt>'NORMAL'</dt><dd>the state change was in response to API calls</dd></dl> |
| `retry` | A boolean indicating whether the client will automatically retry the registration. |

### onIncoming

Called when an incoming call occurs. If this is null or throws an exception, the incoming call is rejected.

The parameter object will have the following properties:

| property | value |
| --- | --- |
| `call` | An AculabCloudIncomingCall object. |
| `from` | The CallerID passed by the remote party. |
| `type` | The type of the remote party. One of "client", "service" or "other". |
| `offeringAudio` | The remote party is offering to send audio. |
| `canReceiveAudio` | The remote party can receive audio. |
| `offeringVideo` | The remote party is offering to send video. |
| `canReceiveVideo` | The remote party can receive video. |

Call progress is reported by callbacks, these should be set on the passed call object before returning from the callback function.

AculabCloudCallOptions
======================

This object is used to modify the default behaviour of the client when making or answering calls.

AculabCloudCallOptions object properties
----------------------------------------

### constraints

A MediaStreamConstraints object. The default is `"{ audio: true, video: false }"`.

### receiveAudio

Can be true, false or undefined. When undefined the client will receive audio if the constraints require an audio track and refuse to receive audio otherwise. The default is undefined.

### receiveVideo

Can be true, false or undefined. When undefined the client will receive video if the constraints require an video track and refuse to receive video otherwise. The default is undefined.

### codecs

An object with the following properties:

|     |     |
| --- | --- |
| `audio` | An array of RTCRtpCodecCapability, such as that returned by AculabCloudClient.getCodecList("audio"). The default is an empty array, which results in using the browser defaults. |
| `video` | An array of RTCRtpCodecCapability, such as that returned by AculabCloudClient.getCodecList("video"). The default is an empty array, which results in using the browser defaults. |

### maxBitrateAudio

The maximum bitrate to use for audio. Set to Infinte to have no limit, undefined to use the browser default, or an integer which is in bits per second.

### maxBitrateVideo

The maximum bitrate to use for video. Set to Infinte to have no limit, undefined to use the browser default, or an integer which is in bits per second.

AculabCloudCall
===============

The base class for call objects. Instances derived from this object are returned by callService(), callClient() or passed to the onIncoming callback.

AculabCloudCall object functions
--------------------------------

### string callId()

Gets the callId used for the call. For outgoing calls this may return `undefined` until the onConnecting() callback is being called. For incoming calls it is always available.

### void mute(mic, outputAudio, camera, outputVideo)

`mic`, `outputAudio`, `camera` and `outputVideo` are boolean. If `mic` is true, then the microphone (sent audio) is muted. If `outputAudio` is true the received audio is muted. If `camera` is true, then the video stream being sent has every frame filled entirely with black pixels. If `outputVideo` is true, then the video stream being received has every frame filled entirely with black pixels. If `camera` or `outputVideo` are undefined, then the value is replaced by `mic` and `outputAudio` respectively.

### void sendDtmf(dtmf_str)

`dtmf_str` is a string containing the DTMF digits to be sent. These are 0,1,2,3,4,5,6,7,8,9,*,#,A,B,C and D.

This throws a string exception if there is an invalid digit in the string. There is no return value.

### void disconnect()

Disconnects any existing call. This can be called at any time.

AculabCloudCall callback properties
-----------------------------------

Each of these callback properties must be either `null` or a function. The function will be passed a single object parameter. Additional information may be included as properties of that object. All such properties are detailed below.

### onDisconnect

The call has disconnected.

The parameter object will have the following properties:

| property | value |
| --- | --- |
| `call` | The call object that is reporting the event. |
| `cause` | One of the following strings:<dl><dt>'MIC_ERROR'</dt><dd>no microphone is available to the AculabCloudClient, usually because the user refused access or there is no microphone.</dd><dt>'BUSY'</dt><dd>the service called hangup() with the busy cause or the service could not be started (due to limited UAS capacity, for example)</dd><dt>'UNOBTAINABLE'</dt><dd>the specified incoming service name does not exist</dd><dt>'MOVED'</dt><dd>the service attempted to redirect the call</dd><dt>'REJECTED'</dt><dd>the call was rejected either by the incoming service or an intermediary</dd><dt>'NOANSWER'</dt><dd>the call did not connect</dd><dt>'FAILED'</dt><dd>the call was unsuccessful for some other reason</dd><dt>'ERROR'</dt><dd>an internal error occurred.</dd><dt>'NORMAL'</dt><dd>the call has disconnected in the normal way after having connected</dd></dl> |

### onMedia

Called when remote media is available to be rendered to the user.

The parameter object will have the following properties:

| property | value |
| --- | --- |
| `call` | The call object that is reporting the event. |
| `stream` | A MediaStream object suitable connecting to an `<audio>` or a `<video>` HTMLMediaElement as the `srcObject`. |

### onConnecting

Called once the local media has been obtained and the browser will now start to prepare the sockets needed to transport the call media. The passed stream is the local media.

The parameter object will have the following properties:

| property | value |
| --- | --- |
| `call` | The call object that is reporting the event. |
| `stream` | A MediaStream object suitable connecting to an `<audio>` or a `<video>` HTMLMediaElement as the `srcObject`. |

### onConnected

Called when the call has been answered.

The parameter object will have the following properties:

| property | value |
| --- | --- |
| `call` | The call object that is reporting the event. |

### onLocalVideoMute

Called when the call's local video track has been muted.

The parameter object will have the following properties:

| property | value |
| --- | --- |
| `call` | The call object that is reporting the event. |
| `stream` | A MediaStream object that is the local media stream. |
| `track` | A MediaStreamTrack object that is the muted local media track. |

### onLocalVideoUnmute

Called when the call's local video track has been unmuted.

The parameter object will have the following properties:

| property | value |
| --- | --- |
| `call` | The call object that is reporting the event. |
| `stream` | A MediaStream object that is the local media stream. |
| `track` | A MediaStreamTrack object that is the unmuted local media track. |

### onRemoteVideoMute

Called when the call's remote video track has been muted.

The parameter object will have the following properties:

| property | value |
| --- | --- |
| `call` | The call object that is reporting the event. |
| `stream` | A MediaStream object that is the remote media stream. |
| `track` | A MediaStreamTrack object that is the muted remote media track. |

### onRemoteVideoUnmute

Called when the call's remote video track has been unmuted.

The parameter object will have the following properties:

| property | value |
| --- | --- |
| `call` | The call object that is reporting the event. |
| `stream` | A MediaStream object that is the remote media stream. |
| `track` | A MediaStreamTrack object that is the unmuted remote media track. |

AculabCloudOutgoingCall extends AculabCloudCall
===============================================

The class for outgoing call objects as returned by callService() and callClient(). No additional functions are defined.

AculabCloudOutgoingCall callback properties
-------------------------------------------

Each of these callback properties must be either `null` or a function. The function will be passed a single object parameter. Additional information may be included as properties of that object. All such properties are detailed below.

### onRinging

The incoming service has signalled that the call is ringing.

The parameter object will have the following properties:

| property | value |
| --- | --- |
| `call` | The call object that is reporting the event. |

AculabCloudIncomingCall extends AculabCloudCall
===============================================

The class for incoming call objects passed to the onIncoming callback. No additional callbacks are defined.

AculabCloudIncomingCall object functions
----------------------------------------

### void answer(options)

`options`, when specified, is a AculabCloudCallOptions object.

Answer the incoming call.

### void ringing()

Notify the calling service that the user is being alerted to the incoming call.

### void reject(cause)

Reject the incoming call with the `cause` value specified. The value should be a SIP response code between 400 and 699 inclusive. If no cause is given or the specified cause is invalid, the cause 486 (Busy Here) will be used.
