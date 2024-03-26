const esl = require('modesl');


//open a connection
conn = new esl.Connection('freeswitch', 8021, 'ClueCon', function() {
    //send the status api command
   console.log(conn)
    conn.subscribe('CUSTOM mod_audio_stream::json', e => {
        console.log('subscribe OK')
        console.log(e)
    })
 
    conn.on('mod_audio_stream::json', e => {
        console.log('mod_audio_stream::json', e)
    })

})

