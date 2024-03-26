const sip = require ('sip-lab')
const Zeq = require('@mayama/zeq')
const m = require('data-matching')
const sip_msg = require('sip-matching')
const fs = require('fs')

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

  // make the call from t1 to freeswitch
  const oc = sip.call.create(t1.id, {from_uri: 'sip:0311112222@test.com', to_uri: `sip:test_esl_socket@freeswitch`})

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

  await z.wait([
    {
      event: 'ws_conn_digits',
      //digits: '*1', // we are spuriously detecting '*' and '1'. This might be a bug in dtmf-detection-stream
    },
  ], 2000)

  z.store.conn.send(JSON.stringify({type: 'start_of_input'}))

  sip.call.send_dtmf(oc.id, {digits: '1234567890', mode: 1})

  await z.wait([
    {
      event: 'ws_conn_digits',
      digits: '1234567890',
    },
  ], 5000)

  z.store.conn.send(JSON.stringify({type: 'start_of_input'}))

  await z.sleep(1000)

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
  ], 1000)

  console.log("Success")

  sip.stop()
}


test()
.catch(e => {
  console.error(e)
  process.exit(1)
})
