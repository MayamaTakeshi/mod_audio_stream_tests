
session:answer()
session:sleep(500)
session:set_tts_params("unimrcp:mrcp_server", "dtmf")
session:speak('1234')
session:sleep(5000)