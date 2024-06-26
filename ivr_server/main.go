package main

import (
	"log"
  "strings"
  "fmt"
  "os"

  "encoding/json"

	"ivr_server/eventsocket"
)

func usage() {
  app := os.Args[0]

  fmt.Printf(`
Usage: %s freeswitch_esl_address freeswitch_esl_password listen_address web_socket_url
Ex:    %s freeswitch:8021 ClueCon tester:9090 ws://tester:8080
`, app, app)
}

func parseJSON(jsonData string) (map[string]interface{}, error) {
    var data map[string]interface{}
    if err := json.Unmarshal([]byte(jsonData), &data); err != nil {
        return nil, err
    }
    return data, nil
}

func _log(id string, format string, args ...interface{}) {
  message := fmt.Sprintf(format, args...)
  log.Printf("%s: %s", id, message)
}


func sendCmdAndWaitOk(id string, conn *eventsocket.Connection, cmd string) (*eventsocket.Event, error) {
  _log(id, "Sending cmd=%s\n", cmd)
  ev, err := conn.Send(cmd)
  return waitOk(id, conn, cmd, ev, err)
}

func sendExecuteAndWaitOk(id string, conn *eventsocket.Connection, app_name string, app_data string, lock bool) (*eventsocket.Event, error) {
	_log(id, "Sending Execute app_name=%s app_data=%s\n", app_name, app_data)
  ev, err := conn.Execute(app_name, app_data, lock)
  return waitOk(id, conn, app_name, ev, err)
}

func waitOk(id string, conn *eventsocket.Connection, cmd string, ev *eventsocket.Event, err error) (*eventsocket.Event, error) {
  for {
    if err != nil {
      _log(id, "err=%v\n", err)
      return nil, err
    }

    ct := ev.Get("Content-Type")
    if ct == "command/reply" || ct == "api/response" {
      _log(id, "cmd=%s reply:\n", cmd)
      ev.PrettyPrint()
      reply := ev.Get("Reply-Text")
      if reply == "" {
        reply = ev.Body
      }
      if strings.HasPrefix(reply, "+OK") {
        return ev, nil
      } else {
        return nil, fmt.Errorf(reply)
      }
    }
		ev, err = conn.ReadEvent()
  }
}

func main() {
  if len(os.Args) != 5 {
    usage()
    os.Exit(1)
  }

  freeswitch_esl_address := os.Args[1]
  freeswitch_esl_password := os.Args[2]
  listen_address := os.Args[3]
  websocket_server_url := os.Args[4]

  id := "inbound_socket"

	conn, err := eventsocket.Dial(freeswitch_esl_address, freeswitch_esl_password)

	if err != nil {
		_log(id, "Dial err=%v\n", err)
    os.Exit(1)
	}

  cmd := "events plain CUSTOM mod_audio_stream::json"
	_, err = sendCmdAndWaitOk(id, conn, cmd)
  if err != nil {
    _log(id, "%s err=%v\n", err)
    os.Exit(1)
	}

	connectionMap := NewConnectionMap()

	go eventsocket.ListenAndServe(listen_address, func(new_conn *eventsocket.Connection) {
		handler(new_conn, connectionMap, websocket_server_url)
	})

	for {
		ev, err := conn.ReadEvent()
		if err != nil {
			_log(id, "ReadEvent err=%v\n", err)
      os.Exit(1)
		}
		_log(id, "new event:")
		ev.PrettyPrint2()

		uuid := ev.Get("Unique-Id")
		if uuid == "" {
			_log(id, "could not get uuid of custom event\n")
      continue
		}

		outbound_socket_conn, ok := connectionMap.Get(uuid)
		if !ok {
			_log(id, "connection not found for %s\n", uuid)
      continue
		}

		outbound_socket_conn.InjectEvent(ev)
	}
	conn.Close()
}

func handler(conn *eventsocket.Connection, connectionMap *ConnectionMap, websocket_server_url string) {
  id := "outbound_socket_client:" + conn.RemoteAddr().String()
	_log(id, "start")

	ev, err := conn.Send("connect")
	if err != nil {
		_log(id, "connect err=%v\n", err)
    return
	}
	log.Printf("connect reply:\n")
	ev.PrettyPrint()

	uuid := ev.Get("Unique-Id")
	if uuid == "" {
		_log(id, "could not get uuid of custom event\n")
	}

  _log(id, "got uuid=%s\n", uuid)
  id = uuid
	_log(id, "Adding uuid to connectionMap\n\n")
	connectionMap.Add(uuid, conn)
	defer (func() {
		_log(id, "Removing uuid from connectionMap\n\n")
		connectionMap.Remove(uuid)
	})()

  cmd := "myevents"
	ev, err = sendCmdAndWaitOk(id, conn, cmd)
  if err != nil { return }

	cmd = "divert_events on"
	ev, err = sendCmdAndWaitOk(id, conn, cmd)
  if err != nil { return }

	app_name := "answer"
	app_data := ""
	ev, err = sendExecuteAndWaitOk(id, conn, app_name, app_data, false)
  if err != nil { return }

	cmd = "api uuid_audio_stream " + uuid + " start " + websocket_server_url + " mono 8k"
	ev, err = sendCmdAndWaitOk(id, conn, cmd)
  if err != nil { return }
  defer (func() {
		_log(id, "Stopping uuid_audio_stream\n\n")
    cmd := "api uuid_audio_stream " + uuid + " stop"
    _, err := sendCmdAndWaitOk(id, conn, cmd)
    if err != nil {
		  _log(id, "uuid_audio_stream stop err=%v\n\n", err)
    }
  })()

  /*
	app_name = "playback"
	app_data = "silence_stream://-1"
	ev, err = sendExecuteAndWaitOk(id, conn, app_name, app_data, false)
  if err != nil { return }
  */

	for {
		ev, err = conn.ReadEvent()
		if err != nil {
			_log(id, "Terminating", err)
			break
		}
		_log(id, "new event:")
		ev.PrettyPrint2()
    if(ev.Get("Event-Name") == "CUSTOM" && ev.Get("Event-Subclass") == "mod_audio_stream::json") {
      err = handle_mod_audio_stream_json_msg(id, conn, ev)
      if err != nil { return }
    }
	}
}

func handle_mod_audio_stream_json_msg(id string, conn *eventsocket.Connection, ev *eventsocket.Event) (error) {
  data, err := parseJSON(ev.Body)
  if err != nil {
      _log(id, "Error parsing JSON: %v\n", err)
      return err
  }
  switch(data["msg"]) {
    case "execute-app":
      app_name, ok := data["app_name"].(string)
      if !ok {
        return fmt.Errorf("cmd execute-app app-name is not a string or not found")
      }
      app_data, ok := data["app_data"].(string)
      if !ok {
        app_data = ""
      }
      ev, err = sendExecuteAndWaitOk(id, conn, app_name, app_data, false)
      if err != nil {
        return err
      }
      if(app_name == "bridge") {
        // this is not an actual error. It is just to finish the ivr processing as the call was transfered
        return fmt.Errorf("EOF_DUE_TRANSFER")
      }
    case "stop-audio-output":
      cmd := "api uuid_break " + id + " all"
      ev, err = sendCmdAndWaitOk(id, conn, cmd)
      if err != nil { return err }
  }
  return nil
}
