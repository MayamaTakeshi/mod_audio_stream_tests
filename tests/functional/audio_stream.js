const sip = require ('sip-lab')
const Zeq = require('@mayama/zeq')
const m = require('data-matching')
const sip_msg = require('sip-matching')
const fs = require('fs')

var z = new Zeq()

async function test() {
  z.trap_events(sip.event_source, 'event', (evt) => {
    var e = evt.args[0]
    return e
  })

  sip.set_codecs("pcmu/8000/1:128")
  sip.dtmf_aggregation_on(500)

  // here we start sip-lab
  console.log(sip.start((data) => { console.log(data)} ))

  const t1 = sip.transport.create({address: "tester"})

  console.log("t1", t1)

  fs.writeFileSync('/usr/local/freeswitch/scripts/test.lua', `
session:answer()
session:sleep(500)
session:set_tts_params("unimrcp:mrcp_server", "dtmf")
session:speak('1234')
session:sleep(5000)`)

  // make the call from t1 to freeswitch
  const oc = sip.call.create(t1.id, {from_uri: 'sip:0311112222@test.com', to_uri: `sip:05011112222@freeswitch`})

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
  ], 1000)

  sip.call.start_speech_recog(oc.id)
  
  await z.wait([
    {
       event: 'dtmf',
       call_id: oc.id,
       digits: '1234',
       mode: 1,
    },
  ], 1200)
 

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

