package main

import (
	"fmt"
	"log"
  "time"

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
	PrettyPrint(ev)

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
		PrettyPrint(ev)

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
	fmt.Println("new client:", c.RemoteAddr())

  cmd := "connect"
  fmt.Printf("\ncmd=%s\n", cmd)
  ev, err := c.Send(cmd)
	if err != nil {
		log.Fatal(err)
	}
  fmt.Printf("\ncmd=%s reply:\n", cmd)
	PrettyPrint(ev)

  uuid := ev.Get("Unique-Id")
  if uuid == "" {
    log.Fatal("could not get uuid of custom event")
  }
	fmt.Printf("\nuuid: %s\n", uuid)

  connectionMap.Add(uuid, c)

  cmd = "myevents"
  fmt.Printf("\ncmd=%s\n", cmd)
  ev, err = c.Send(cmd)
	if err != nil {
		log.Fatal(err)
	}
  fmt.Printf("\ncmd=%s reply:\n", cmd)
	PrettyPrint(ev)

  cmd = "answer"
  fmt.Printf("\ncmd=%s\n", cmd)
  ev, err = c.Execute(cmd, "", false)
	if err != nil {
		log.Fatal(err)
	}
  fmt.Printf("\ncmd=%s reply:\n", cmd)
	PrettyPrint(ev)

  msg := "api uuid_audio_stream " + uuid + " start ws://tester:8080 mono 8k"
  fmt.Printf("\nmsg=%s\n", msg)
  ev, err = c.Send(msg)
	if err != nil {
		log.Fatal(err)
	}
  fmt.Printf("\nmsg=%s reply:\n", cmd)
	PrettyPrint(ev)

  app_name := "playback"
  app_data := "silence_stream://-1"

  fmt.Printf("\nexecute app_name=%s\n", app_name)
	ev, err = c.Execute(app_name, app_data, false)
	if err != nil {
		log.Fatal(err)
	}
  fmt.Printf("\nexecute app_name=%s reply:\n", app_name)
	PrettyPrint(ev)

	for {
		ev, err = c.ReadEvent()
		if err != nil {
			log.Fatal(err)
		}
    fmt.Println("\n\nOutboundChannel New event:")
		PrettyPrint(ev)
	}
}

func PrintKey(ev *eventsocket.Event, key string) {
  if val := ev.Get(key); val != "" {
    fmt.Printf("%s: %s\n", key, val)
  }
}

func PrettyPrint(ev *eventsocket.Event) {
	strings := []string{"Event-Name", "Application", "Application-Data", "Application-Response", "Content-Type", "Unique-Id"}

	currentTime := time.Now()

	fmt.Println(currentTime.Format("2006-01-02 15:04:05:"))

	for _, value := range strings {
    PrintKey(ev, value)
	}

	if ev.Body != "" {
		fmt.Printf("BODY: %#v\n", ev.Body)
	}
}


