const sip = require ('sip-lab')
const Zeq = require('@mayama/zeq')
const m = require('data-matching')
const sip_msg = require('sip-matching')
const fs = require('fs')

const tu = require('./lib/test_utils')

const DtmfDetectionStream = require('dtmf-detection-stream')
const WebSocket = require('ws')

var z = new Zeq()

async function test() {
  z.trap_events(sip.event_source, 'event', (evt) => {
    var e = evt.args[0]
    return e
  })

  const aggregation_timeout = 500

  sip.set_codecs("pcmu/8000/1:128")
  sip.dtmf_aggregation_on(aggregation_timeout)

  await tu.hangup_all_calls()

  fs.writeFileSync('/tmp/scripts/handle_mod_audio_stream_json.lua', `
local uuid = event:getHeader("Unique-ID")
freeswitch.consoleLog("debug", uuid .. " got json " .. event:getBody())
`)

  const ws_server = new WebSocket.Server({ port: 8080 })

  ws_server.on('connection', conn => {
    const format = {
        sampleRate: 8000,
        bitDepth: 16,
        channels: 1,
    }

    var last_digit_time = null
    var digits = ""

    setInterval(() => {
      if(digits.length > 0) {
        var now = Date.now()
        if(now - last_digit_time >= aggregation_timeout) {
          z.push_event({
            event: 'ws_conn_digits',
            conn,
            digits,
          })
          digits = ""
        }
      }
    }, 100)

    const dds = new DtmfDetectionStream(format)
    dds.on('digit', digit => {
      digits += digit
      last_digit_time = Date.now()
    })

		z.push_event({
			event: 'ws_conn',
			conn,
		})
       
    if (fs.existsSync("a.raw")) {    
        fs.unlinkSync("a.raw")
    }

    if (fs.existsSync("b.raw")) {    
        fs.unlinkSync("b.raw")
    }

    conn.on('message', msg => {
      console.log("ws message")
      if(typeof msg == 'string') {
        z.push_event({
          event: 'ws_msg',
          conn,
          msg,
        })
      } else {
        const bufferLength = Object.keys(msg).length
        const buffer = Buffer.alloc(bufferLength)
        Object.keys(msg).forEach(key => {
          const index = parseInt(key)
          const value = msg[key]
          if(value != 0 && value != 255) {
            console.log(`non silence ${value}`)
          }
          buffer[index] = value
        })
        dds.write(buffer)
        //dds.write(msg)

				// Write the buffer to the file in append mode
				fs.writeFile("a.raw", buffer, { flag: 'a' }, err => {
					if (err) {
						console.error('Error writing to file a.raw:', err);
						return;
					}
					console.log('Data appended to file successfully.');
				})

				fs.writeFile("b.raw", msg, { flag: 'a' }, err => {
					if (err) {
						console.error('Error writing to file b.raw:', err);
						return;
					}
					console.log('Data appended to file successfully.');
				})
      }
    })

    conn.on('close', () => {
			z.push_event({
				event: 'ws_close',
				conn,
			})
    })
  })

  // here we start sip-lab
  console.log(sip.start((data) => { console.log(data)} ))

  const t1 = sip.transport.create({address: "tester"})

  console.log("t1", t1)

  const calling_number = '0311112222'

  // make the call from t1 to freeswitch
  const oc = sip.call.create(t1.id, {from_uri: `sip:${calling_number}@test.com`, to_uri: `sip:test_esl_socket@freeswitch`})

  await z.wait([
    {
      event: 'response',
      call_id: oc.id,
      method: 'INVITE',
      msg: sip_msg({
        $rs: '100',
        $rr: 'Trying',
      }),
    },
   {
      event: 'response',
      call_id: oc.id,
      method: 'INVITE',
      msg: sip_msg({
        $rs: '183',
        $rr: 'Session Progress',
      }),
    },
    {
      event: 'response',
      call_id: oc.id,
      method: 'INVITE',
      msg: sip_msg({
        $rs: '200',
        $rr: 'OK',
      }),
    },
    {
      event: 'media_update',
      call_id: oc.id,
      status: 'ok',
    },
    {
      event: 'media_update',
      call_id: oc.id,
      status: 'ok',
    },
    {
      event: 'ws_conn',
      conn: m.collect('conn') 
    },
  ], 1000)

  await z.sleep(500)

  z.store.conn.send(JSON.stringify({msg: 'execute-app', app_name: 'speak', app_data: 'unimrcp:mrcp_server|dtmf|<speak><prosody rate="50ms">1234</prosody><break time="1000ms"/><prosody rate="50ms">1234</prosody><break time="1000ms"/><prosody rate="50ms">1234</prosody></speak>'}))

  await z.wait([
    {
      event: 'dtmf',
      call_id: oc.id,
      digits: '1234',
      mode: 1,
    },
  ], 2000)

  z.store.conn.send(JSON.stringify({msg: 'stop-audio-output'}))

  z.store.conn.send(JSON.stringify({msg: 'execute-app', app_name: 'speak', app_data: 'unimrcp:mrcp_server|dtmf|abcd'}))

  // if stop-audio-output is successful, we should not get remaining digits from first 'speak' and we should get the digits from the second 'speak'
  await z.wait([
    {
      event: 'dtmf',
      call_id: oc.id,
      digits: 'abcd',
      mode: 1,
    },
  ], 2000)

  sip.call.send_dtmf(oc.id, {digits: '321', mode: 1})

  await z.wait([
    {
      event: 'ws_conn_digits',
      digits: '321',
    },
  ], 2000)

  const transfer_destination = '0355556666'

  z.store.conn.send(JSON.stringify({msg: 'execute-app', app_name: 'bridge', app_data: `sofia/external/${transfer_destination}@${t1.address}:${t1.port}`}))

  await z.wait([
    {
      event: 'ws_close',
    },
    {
      event: 'incoming_call',
      transport_id: t1.id,
      call_id: m.collect('ic_id'),
      msg: sip_msg({
        $rU: transfer_destination,
        $fU: calling_number,
      }),
    },
  ], 1000)

  sip.call.respond(z.store.ic_id, {code: 200, reason: 'OK'})

  await z.wait([
    {
      event: 'media_update',
      call_id: z.store.ic_id,
      status: 'ok',
    },
  ], 1000)

  sip.call.send_dtmf(oc.id, {digits: '1234', mode: 1})
  sip.call.send_dtmf(z.store.ic_id, {digits: '4321', mode: 1})

  await z.wait([
    {
      event: 'dtmf',
      call_id: oc.id,
      digits: '4321',
      mode: 1,
    },
    {
      event: 'dtmf',
      call_id: z.store_icid,
      digits: '1234',
      mode: 1,
    },
  ], 2000)

  // now we terminate the call from t1 side
  sip.call.terminate(oc.id)

  // and wait for termination events
  await z.wait([
    {
      event: 'response',
      call_id: oc.id,
      method: 'BYE',
      msg: sip_msg({
        $rs: '200',
        $rr: 'OK',
      }),
    },
    {
      event: 'call_ended',
      call_id: oc.id,
    },
    {
      event: 'call_ended',
      call_id: z.store.ic_id,
    },
  ], 1000)

  console.log("Success")

  sip.stop()
}


test()
.catch(e => {
  console.error(e)
  process.exit(1)
})

