package main

import (
	"fmt"
	"log"

	//"github.com/fiorix/go-eventsocket/eventsocket"
  "ivr/eventsocket"
)

func main() {
	c, err := eventsocket.Dial("freeswitch:8021", "ClueCon")
	if err != nil {
		log.Fatal(err)
	}
  ev, err := c.Send("events plain CUSTOM mod_audio_stream::json")
	if err != nil {
		log.Fatal(err)
	}
	ev.PrettyPrint2()

  connectionMap := NewConnectionMap()

	go eventsocket.ListenAndServe(":9090", func(c *eventsocket.Connection) {
   handler(c, connectionMap) 
  })

	for {
		ev, err := c.ReadEvent()
		if err != nil {
			log.Fatal(err)
		}
    fmt.Println("\nInboundChannel New event:")
		ev.PrettyPrint2()

    uuid := ev.Get("Unique-Id")
    if uuid == "" {
      log.Fatal("could not get uuid of custom event")
    }

    conn, ok := connectionMap.Get(uuid)
    if !ok {
      log.Fatal("connection not found")
    }

    conn.InjectEvent(ev)
	}
	c.Close()
}

func handler(c *eventsocket.Connection, connectionMap *ConnectionMap) {
	fmt.Println("handler new client:", c.RemoteAddr())

  cmd := "connect"
  fmt.Printf("\nSending cmd=%s\n", cmd)
  ev, err := c.Send(cmd)
	if err != nil {
		log.Fatal(err)
	}
  fmt.Printf("\ncmd=%s reply:\n", cmd)
	ev.PrettyPrint()

  uuid := ev.Get("Unique-Id")
  if uuid == "" {
    log.Fatal("could not get uuid of custom event")
  }
	fmt.Printf("\nuuid: %s\n", uuid)

  connectionMap.Add(uuid, c)

  cmd = "myevents"
  fmt.Printf("\nSending cmd=%s\n", cmd)
  ev, err = c.Send(cmd)
	if err != nil {
		log.Fatal(err)
	}
  fmt.Printf("\ncmd=%s reply:\n", cmd)
	ev.PrettyPrint()

  app_name := "answer"
  app_data := ""
  fmt.Printf("\nSending Execute app=%s\n", app_name)
  ev, err = c.Execute(app_name, app_data, false)
	if err != nil {
		log.Fatal(err)
	}
  fmt.Printf("\nExecute app=%s reply:\n", app_name)
	ev.PrettyPrint()

  msg := "api uuid_audio_stream " + uuid + " start ws://tester:8080 mono 8k"
  fmt.Printf("\nSending msg=%s\n", msg)
  ev, err = c.Send(msg)
	if err != nil {
		log.Fatal(err)
	}
  fmt.Printf("\nSending msg=%s reply:\n", msg)
	ev.PrettyPrint()

  app_name = "playback"
  app_data = "silence_stream://-1"

  fmt.Printf("\nSending Execute app=%s\n", app_name)
	ev, err = c.Execute(app_name, app_data, false)
	if err != nil {
		log.Fatal(err)
	}
  fmt.Printf("\nExecute app=%s reply:\n", app_name)
	ev.PrettyPrint()

	for {
		ev, err = c.ReadEvent()
		if err != nil {
			log.Fatal(err)
		}
    fmt.Println("\n\nOutboundChannel New event:")
		ev.PrettyPrint2()
	}
}


