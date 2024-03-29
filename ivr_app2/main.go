package main

import (
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
		log.Printf("InboundChannel New event:")
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
	log.Printf("handler new client:", c.RemoteAddr())

	cmd := "connect"
	log.Printf("Sending cmd=%s\n", cmd)
	ev, err := c.Send(cmd)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("cmd=%s reply:\n", cmd)
	ev.PrettyPrint()

	uuid := ev.Get("Unique-Id")
	if uuid == "" {
		log.Fatal("could not get uuid of custom event")
	}
	log.Printf("Adding uuid: %s to connectionMap\n\n", uuid)
	connectionMap.Add(uuid, c)
	defer (func() {
		log.Printf("Removing uuid: %s from connectionMap\n\n", uuid)
		connectionMap.Remove(uuid)
	})()

	cmd = "myevents"
	log.Printf("Sending cmd=%s\n", cmd)
	ev, err = c.Send(cmd)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("cmd=%s reply:\n", cmd)
	ev.PrettyPrint()

	cmd = "divert_events on"
	log.Printf("Sending cmd=%s\n", cmd)
	ev, err = c.Send(cmd)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("cmd=%s reply:\n", cmd)
	ev.PrettyPrint()

	app_name := "answer"
	app_data := ""
	log.Printf("Sending Execute app=%s\n", app_name)
	ev, err = c.Execute(app_name, app_data, false)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("Execute app=%s reply:\n", app_name)
	ev.PrettyPrint()

	msg := "api uuid_audio_stream " + uuid + " start ws://tester:8080 mono 8k"
	log.Printf("Sending msg=%s\n", msg)
	ev, err = c.Send(msg)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("Sending msg=%s reply:\n", msg)
	ev.PrettyPrint()

	app_name = "playback"
	app_data = "silence_stream://-1"

	log.Printf("Sending Execute app=%s\n", app_name)
	ev, err = c.Execute(app_name, app_data, false)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("Execute app=%s reply:\n", app_name)
	ev.PrettyPrint()

	for {
		ev, err = c.ReadEvent()
		if err != nil {
			log.Println("Terminating", err)
			break
		}
		log.Printf("OutboundChannel New event:")
		ev.PrettyPrint2()
	}
}
