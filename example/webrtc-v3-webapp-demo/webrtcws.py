#!/usr/bin/python3

import flask
from flask import request, jsonify, redirect
import sys
import requests


### Configuration options.
#  Your CLOUD_API_ACCESS_KEY and CLOUD_WEBRTC_ACCESS_KEY can be found
#  in the Aculab Cloud Console.
###

# The cloud region you would like to use.  String: e.g. "0-2-0"
CLOUD_REGION = None
# Your usename on the specified cloud region.  String: e.g. "your.mail@yourcompany.com"
CLOUD_USERNAME = None
# Your API access key for the specified cloud region.  String: e.g. "accesskey"
CLOUD_API_ACCESS_KEY = None
# Your WebRTC access key for the specified cloud region.  String: e.g. "webrtaccesskey"
CLOUD_WEBRTC_ACCESS_KEY = None
# The default TTL of a requested WebRTC token.  Integer: e.g. 600.  Minimum 600
CLOUD_WEBRTC_TOKEN_TTL = 600
# The TCP port that the web service will listen on.  Integer: e.g. 3918
LISTENING_PORT = 3918


app = flask.Flask(__name__, static_url_path="",
                  static_folder="serving_static/static")
app.config["DEBUG"] = True


@app.route('/', methods=["GET"])
def home():
    return redirect("/webrtc_vid.html", code=302)


@app.route("/get_webrtc_token_for_client", methods=["POST"])
def get_webrtc_token_for_client():
    """ A wrapper function to call /webrtc_generate_token web service API """
    """ request.json is a json object in the form:
            {'client_id': a_client_id,

        The repose is a JSON object in the form:
            {'token': the_returned_token} """


    client_id = request.data.decode()

    auth = (f"{CLOUD_REGION}/{CLOUD_USERNAME}", CLOUD_API_ACCESS_KEY)
    host = f"ws-{CLOUD_REGION}.aculabcloud.net"
    result = requests.get(f"https://{host}/webrtc_generate_token?client_id={client_id}&ttl={CLOUD_WEBRTC_TOKEN_TTL}&enable_incoming=true&call_client=*",
                          auth=auth)

    if result.status_code == 200:
        # Return the JSON data to the caller
        return result.text

    print(f"Error, failed to get token. {result.text}")
    return jsonify({"token": "Failed to get token.  Check CLOUD_REGION, CLOUD_USERNAME and CLOUD_API_ACCESS_KEY are correct"})


@app.route("/get_webrtc_demo_config", methods=["GET"])
def get_webrtc_demo_config():
    """ Get the CLOUD_WEBRTC_ACCESS_KEY and CLOUD_REGION as some JSON data """
    """ The repose is a JSON object in the form:
            {'token': the_webrtc_access_key,
             'cloud': the_configured_cloud_region
             'ttl': reqired_ttl_for_generated_webrtc_token} """

    return jsonify({"token": CLOUD_WEBRTC_ACCESS_KEY,
                    "cloud": CLOUD_REGION,
                    "ttl": CLOUD_WEBRTC_TOKEN_TTL})


def main():
    unset_vars = []
    if not CLOUD_USERNAME:
        unset_vars.append("CLOUD_USERNAME")
    if not CLOUD_API_ACCESS_KEY:
        unset_vars.append("CLOUD_ACCESS_KEY")
    if not CLOUD_WEBRTC_ACCESS_KEY:
        unset_vars.append("CLOUD_WEBRTC_ACCESS_KEY")
    if not CLOUD_REGION:
        unset_vars.append("CLOUD_REGION")

    if unset_vars:
        print("Set the following variables in webrtcws.py before running:")
        print(", ".join(unset_vars))
        sys.exit(1)

    app.run(host='0.0.0.0', port=LISTENING_PORT, ssl_context='adhoc')


if __name__ == "__main__":
    main()
