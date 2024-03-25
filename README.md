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
The above will create a tmux session with 3 windows:
  - mrcp_server
  - sngrep with mrcp support (sngrep2)
  - window opened in the tests/functional folder

In the tests/functional folder you can execute a test script like this:
```
node speech_recog.js
```

## Results

There are no results yet.

Research is ongoing.
