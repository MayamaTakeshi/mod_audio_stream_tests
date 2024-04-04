// This script shows that we cannot use
// freeswitch.EventConsumer("CUSTOM", "mod_audio_stream::json")
// on a channel script as it will get all such events from all channels.

const sip = require ('sip-lab')
const Zeq = require('@mayama/zeq')
const m = require('data-matching')
const sip_msg = require('sip-matching')
const fs = require('fs')
const assert = require('assert')

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

  const ws_server = new WebSocket.Server({ port: 8080 })

  var ws_binary_msg_count = 0

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

    conn.on('message', msg => {
      if(typeof msg == 'string') {
        z.push_event({
          event: 'ws_msg',
          conn,
          msg,
        })
      } else {
        dds.write(msg)
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

  fs.writeFileSync('/tmp/scripts/handle_mod_audio_stream_json.lua', '')

  fs.writeFileSync('/tmp/scripts/test.lua', `
local JSON = require('JSON')

local uuid = session:get_uuid()
local wss_url = "ws://tester:8080"
local mix_type = "mono" -- or "mixed" or "stereo"
local sampling_rate = "8k" -- or "16k"

session:answer();
session:setInputCallback("onInput");

api = freeswitch.API()
con = freeswitch.EventConsumer("CUSTOM", "mod_audio_stream::json");

api:execute("uuid_audio_stream", string.format("%s start %s %s %s", uuid, wss_url, mix_type, sampling_rate))

while (session:ready() == true) do
	for e in (function() return con:pop() end) do
		session:consoleLog("debug", "______________________________BODY_________________________");
		local body = e:getBody()
    session:consoleLog("debug", "body=" .. body)
    local json = JSON:decode(body)
    if json.msg == "execute-app" then
      if json.app_name == "bridge" then
        -- need to stop audio_stream as we will exit the script
        cmd = "uuid_audio_stream " .. uuid .. " stop"
        res = api:executeString(cmd)
        session:consoleLog("debug", "executing cmd=" .. cmd .. "got res=" .. tostring(res))
        abort = true
      end

      session:consoleLog("debug", "executing app=" .. json.app_name .. " with data=" .. json.app_data)
      session:execute(json.app_name, json.app_data)
    else
      session:consoleLog("debug", "unsupported msg=" .. json.msg)
    end
	end
end
`)

  const calling_number = '0311112222'

  // make two calls from t1 to freeswitch
  const oc1 = sip.call.create(t1.id, {from_uri: `sip:${calling_number}@test.com`, to_uri: `sip:test_mod_lua@freeswitch`})
  const oc2 = sip.call.create(t1.id, {from_uri: `sip:${calling_number}@test.com`, to_uri: `sip:test_mod_lua@freeswitch`})

  await z.wait([
    {
      event: 'response',
      call_id: oc1.id,
      method: 'INVITE',
      msg: sip_msg({
        $rs: '100',
        $rr: 'Trying',
      }),
    },
    {
      event: 'response',
      call_id: oc1.id,
      method: 'INVITE',
      msg: sip_msg({
        $rs: '200',
        $rr: 'OK',
      }),
    },
    {
      event: 'media_update',
      call_id: oc1.id,
      status: 'ok',
    },
    {
      event: 'ws_conn',
      conn: m.collect('conn1') 
    },

    {
      event: 'response',
      call_id: oc2.id,
      method: 'INVITE',
      msg: sip_msg({
        $rs: '100',
        $rr: 'Trying',
      }),
    },
    {
      event: 'response',
      call_id: oc2.id,
      method: 'INVITE',
      msg: sip_msg({
        $rs: '200',
        $rr: 'OK',
      }),
    },
    {
      event: 'media_update',
      call_id: oc2.id,
      status: 'ok',
    },
    {
      event: 'ws_conn',
      conn: m.collect('conn2') 
    },
  ], 1000)

  await z.sleep(500)

  // Here we send execute-app speak only for one of the websocket connections
  z.store.conn1.send(JSON.stringify({msg: 'execute-app', app_name: 'speak', app_data: `unimrcp:mrcp_server|dtmf|1111`}))

  // whowever, both calls will get the digits 1111
  await z.wait([
    {
      event: 'dtmf',
      call_id: oc1.id,
      digits: '1111',
      mode: 1,
    },
    {
      event: 'dtmf',
      call_id: oc2.id,
      digits: '1111',
      mode: 1,
    },
  ], 2000)

  sip.call.terminate(oc1.id)
  sip.call.terminate(oc2.id)

  // and wait for termination events
  await z.wait([
    {
      event: 'response',
      call_id: oc1.id,
      method: 'BYE',
      msg: sip_msg({
        $rs: '200',
        $rr: 'OK',
      }),
    },
    {
      event: 'call_ended',
      call_id: oc1.id,
    },

    {
      event: 'response',
      call_id: oc2.id,
      method: 'BYE',
      msg: sip_msg({
        $rs: '200',
        $rr: 'OK',
      }),
    },
    {
      event: 'call_ended',
      call_id: oc2.id,
    },
    {
      event: 'ws_close',
    },
    {
      event: 'ws_close',
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

