import { FreeSwitchClient, once } from 'esl'

  const client = new FreeSwitchClient({
      host: 'freeswitch',
      port: 8021,
  })


async function test() {
  console.log(client)
  client.on('connect', async () => {
    console.log('connect')
    var res = await client.current_call?.novents()
    console.log(res)
    res = await client.current_call?.event_json('mod_audio_stream::json')
    console.log(res)
  })

}

await test()
