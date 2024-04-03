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

  z.add_event_filter({
    event: 'ws_conn_digits', // we are getting garbage so we will not check this yet.
  })

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

    if (fs.existsSync("a.raw")) {
        fs.unlinkSync("a.raw")
    }

    if (fs.existsSync("b.raw")) {
        fs.unlinkSync("b.raw")
    }

    conn.on('message', msg => {
      if(typeof msg == 'string') {
        z.push_event({
          event: 'ws_msg',
          conn,
          msg,
        })
      } else {
        ws_binary_msg_count++
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

  fs.writeFileSync('/tmp/scripts/handle_mod_audio_stream_json.lua', `
local api = freeswitch.API()
local uuid = event:getHeader("Unique-ID")
freeswitch.consoleLog("debug", uuid .. " got json " .. event:getBody())
local cmd = "uuid_setvar " .. uuid .. " mas_json " .. event:getBody()
freeswitch.consoleLog("debug", uuid .. " cmd=" .. cmd)
local res = api:executeString(cmd)
freeswitch.consoleLog("debug", uuid .. " res=" .. res)
cmd = "uuid_break " .. uuid .. " all"
freeswitch.consoleLog("debug", uuid .. " cmd=" .. cmd)
res = api:executeString(cmd)
freeswitch.consoleLog("debug", uuid .. " res=" .. res)
`)

  fs.writeFileSync('/tmp/scripts/test.lua', `
local api = freeswitch.API()
local uuid = session:get_uuid()

local abort = false

function myHangupHook(s, status, arg)
    session:consoleLog("debug", "myHangupHook: " .. status)
    abort = true
end

session:setHangupHook("myHangupHook")

local JSON = require("JSON")

res = session:execute("answer")

local cmd = "uuid_audio_stream " .. uuid .. " start ws://tester:8080 mono 8k"
local res = api:executeString(cmd)

session:setVariable("mas_json", "")

while not abort do
  local mas_json = session:getVariable("mas_json")
  if not mas_json or mas_json == "" then
    app = "playback"
    session:consoleLog("debug",  "app=" .. app)
    res = session:execute(app, "silence_stream://-1") -- endless silence
    session:consoleLog("debug",  "res=" .. tostring(res))
  else 
    -- 'uuid_break uuid all' from hook will terminate playback/speak and we can proceed
    session:consoleLog("debug", "mas_json=" .. mas_json)
    local json = JSON:decode(mas_json)
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
    session:setVariable("mas_json", "")
  end
end
`)

  const calling_number = '0311112222'

  // make the call from t1 to freeswitch
  const oc = sip.call.create(t1.id, {from_uri: `sip:${calling_number}@test.com`, to_uri: `sip:test_mod_lua@freeswitch`})

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
      event: 'ws_conn',
      conn: m.collect('conn') 
    },
  ], 1000)

  await z.sleep(500)

  z.store.conn.send(JSON.stringify({msg: 'execute-app', app_name: 'speak', app_data: `unimrcp:mrcp_server|dtmf|1234`}))

  await z.wait([
    {
      event: 'dtmf',
      call_id: oc.id,
      digits: '1234',
      mode: 1,
    },
  ], 2000)

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

  const transfer_destination = '0355556666'

  z.store.conn.send(JSON.stringify({msg: 'execute-app', app_name: 'bridge', app_data: `sofia/external/${transfer_destination}@${t1.address}:${t1.port}`}))

  await z.wait([
    {
      event: 'incoming_call',
      transport_id: t1.id,
      call_id: m.collect('ic_id'),
      msg: sip_msg({
        $rU: transfer_destination,
        $fU: calling_number,
      }),
    },
    {
      event: 'ws_close',
    }
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

