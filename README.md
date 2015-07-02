#Pavlok-cal
Web app that uses the Google Calendar and Pavlok APIs to send users reminders about events to a Pavlok wristband

- A user can add their Pavlok API key and an oAuth token allowing permissiont o their calendar to the database (from the front-end)
- The app then regularly iterates through the database, finds events for each user, and sends a reminder to a user's wristband 30 minutes, 15 minutes, 5 minutes, and at the time of an event
