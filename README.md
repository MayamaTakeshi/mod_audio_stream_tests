# mod_audio_stream_tests

## Overview

Here we have artifacts to test freeswitch module mod_audio_stream

We use docker compose to build and manage 2 containers:
  - freeswitch with mod_audio_stream
  - tester (node.js, mrcp_server, sngrep)

## Preparation

Run:
```
./gen_env.sh
```
The above will prepare an .env file containing your user identity.

This will be used by compose.yml to create the same user inside the images.

This will simplify working with git (so that you can commit inside and outside the containers).

Do this:
```
cd src # go to a base folder somewhere
git clone https://github.com/MayamaTakeshi/mod_audio_stream_tests
git clone https://github.com/MayamaTakeshi/mrcp_server # used commit 6172df7b 
```

The important thing in the above is that mrcp_server folder is at the same place as mod_audio_stream_tests folder.

Then finaly create and start the containers:
```
cd mod_audio_stream_tests
docker compose up -d --build
```

## Testing
Now that the containers are running, you can go to the tester container:
```
docker compose exec tester build
```
once inside it, start a special tmux session:
```
tmuxinator start dev
```
The above will create a tmux session with 4 windows:
  - window opened in the tests/functional folder
  - ivr_server (golang app that will process mod_audio_stream msgs and freeswitch outbound socket clients)
  - mrcp_server
  - sngrep with mrcp support (sngrep2)

In the tests/functional folder you can run test scripts this way:
```
./runtests

```

Sample run:
```
takeshi@5968838586c4:~/.../functional$ ./runtests 
... ABRIDGED ...
Success. All tests passed

Successful tests:
  - audio_stream.test_esl_socket.js: duration=6.09 seconds
  - audio_stream.test_mod_lua.js: duration=2.03 seconds
  - dtmf.js: duration=1.75 seconds
  - speech_recog.js: duration=3.16 seconds

Everything OK

takeshi@5968838586c4:~/.../functional$
```

## Results

The test audio_stream.test_esl_socket.js confirm mod_audio_stream is usable to send audio to websocket server and receive messages from it.

The test simulates a websocket server that receives audio from freeswitch via mod_audio_stream and:
  - send command to speak a phrase: {msg: 'execute-app', app_name: 'speak', app_data: 'TTS_ENGINE|TTS_VOICE|TEXT'})
  - send command to stop audio output: {msg: 'stop-audio-output'}
  - send command to transfer the call: {msg: 'execute-app', app_name: 'bridge', app_data: 'TRANSFER_DESTINATION')

