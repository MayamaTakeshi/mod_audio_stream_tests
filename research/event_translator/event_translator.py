# this is just for reference. It doesn't work: we cannot use sendevent to generate DETECT_SPEECH from script.
# I think it is also not doable via ESL. I think it must be done by a freeswitch module.

import greenswitch
import gevent

fs = greenswitch.InboundESL(host='freeswitch', port=8021, password='ClueCon')

def on_mod_audio_stream_json(event):
  print("on_mod_audio_stream_json")
  print(event.headers)
  uid = event.headers['Unique-ID']
  print("uid:", uid)
  fs.send("sendevent CUSTOM\nEvent-Name: CUSTOM\nEvent-Subclass: myevent::test\n")
  fs.send("sendevent DETECTED_SPEECH\nEvent-Name: DETECTED_SPEECH\nSpeech-Type: detected-speech\nunique-id: " + uid + "\nContent-Length: 4\n\nabc\n")

def on_myevent_test(event):
  print("on_myevent_test")
  print(event.headers)

# the below doesn't work
def on_detected_speech(event):
  print("on_detected_speech")
  print(event.headers)

fs.register_handle('mod_audio_stream::json', on_mod_audio_stream_json)
fs.register_handle('myevent::test', on_myevent_test)
fs.register_handle('DETECTED_SPEECH', on_detected_speech)

fs.connect()

r = fs.send('events plain CUSTOM mod_audio_stream::json myevent::test DETECTED_SPEECH')
print(r.data)

while True:
    try:
        gevent.sleep(1)
    except KeyboardInterrupt:
        fs.stop()
        break
print('ESL Disconnected.')
