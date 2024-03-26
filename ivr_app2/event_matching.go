package main

import (
	"ivr/eventsocket"
  "reflect"
)

// RemoveMatchingEvent removes the matching event from the list if all headers and body match.
func RemoveMatchingEvent(eventList []*eventsocket.Event, arrivingEvent *eventsocket.Event) []*eventsocket.Event {
	var updatedList []*eventsocket.Event

	for _, event := range eventList {
		// Check if headers and body match
		if headersMatch(event.Header, arrivingEvent.Header) && event.Body == arrivingEvent.Body {
			continue // Skip this event as it matches
		}
		updatedList = append(updatedList, event)
	}

	return updatedList
}

// Check if headers match
func headersMatch(eventHeader, arrivingHeader eventsocket.EventHeader) bool {
	for key, value := range eventHeader {
		if arrivingValue, ok := arrivingHeader[key]; ok {
			if !reflect.DeepEqual(value, arrivingValue) {
				return false
			}
		} else {
			return false
		}
	}
	return true
}
