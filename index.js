// Initialization
var express = require('express');
var http = require('http');
var path = require('path');
var bodyParser = require('body-parser');
var validator = require('validator'); // See documentation at https://github.com/chriso/validator.js
var app = express();
var moment = require('moment');

// See https://stackoverflow.com/questions/5710358/how-to-get-post-query-in-express-node-js
app.use(bodyParser.json());
// See https://stackoverflow.com/questions/25471856/express-throws-error-as-body-parser-deprecated-undefined-extended
app.use(bodyParser.urlencoded({ extended: true }));
// End basic Initialization


// Mongo initialization and connect to database
var mongoUri = process.env.MONGOLAB_URI || process.env.MONGOHQ_URL || 'mongodb://localhost/pavloknew';
var MongoClient = require('mongodb').MongoClient, format = require('util').format;
var db = MongoClient.connect(mongoUri, function(error, databaseConnection) {
	db = databaseConnection;
});
// Mongodb connection now available

// Google calendar API and oAuth initialization
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var calendar = google.calendar('v3');

var clientId = "752476311485-bcf3kvfqdqqv62208gt030ul7mv4080k.apps.googleusercontent.com";
var clientSecret = "eBafXPCThZ9wFyLwzgI-j9qx";
var redirectUrl = "https://pavlok-cal.herokuapp.com/oauth2callback";
var SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
// Google calendar initialized

var auth = new googleAuth();
var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);
// Make sure oAuth client is ready


var authUrl = oauth2Client.generateAuthUrl({
	access_type: 'offline',
	scope: SCOPES,
});
// we have an authorization URL, Calendar API is ready to go

var key;

// Enabling CORS
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});
// CORS enabled


// when user requests to add their calendar, send a URL they can go to to authorize the app
app.get('/addCal', function(request, response) {	
	key = request.query.key;
	console.log(key);
	var url = JSON.stringify(authUrl);
	response.send(url);
});

// receive an oAuth token when a user authorizes the app through Google APIs
app.get('/oauth2callback', function(request, response) {
	
	var code = request.query.code;
	console.log(code);
	getNewToken(oauth2Client, code);
	
	response.set('Content-type', 'text/html');
	response.send("Thank you for using our app! Your Pavlok will now give you reminders for your calendar events");
});

// helper function to get a new user's oAuth token
function getNewToken(oauth2Client, code) {

	oauth2Client.getToken(code, function(err, tokens) {
		
		if (err) {
			console.log('Error trying to get token');
			return;
		}
		storeToken(token);
	});
}

// stores a new oAuth token in the database
function storeToken(token) {
		
	db.collection('users', function(er, collection) {
		if (!er) {
			var toInsert = {
				"key": key,
				"token": token,
			};

			collection.insert(toInsert, function(err, saved) {
				if (err) {
					console.log("Insert err");
				} else {
					console.log("Success");
					console.log(JSON.stringify(toInsert));
				}
			});
		}

	});
}

// every 60000 milliseconds, iterate through database entries and call getEvents on each user calendar
var j = setInterval(function() {
	
	db.collection('users', function(er, collection) {
		if (!er) {
			collection.find().toArray(function(err, cursor) {
				if (!err) {
					for (var i = 0; i < cursor.length; i++) {
						getEvents(cursor[i]);
					}
				}
			});
		}
	});

}, 60000);

// given a database entry, gets the next 10 events for that user
// for each event, if the event is now, or 5, 15, or 30 minutes away, send a request to the Pavlok API
// If event is 30 minutes away, wristband will beep
// If event is 15 minutes away, wristband will beep and vibrate
// If event is 5 minutes away, wristband will vibrate
// If event is now, wristband will shock user
function getEvents(entry) {
	
	if (entry.token == null || entry.token == undefined) return;
	var timeStart = new Date();
	var apikey = entry.key;	

	var thirtyMin = moment().add(30, 'minutes').format("dddd, MMMM Do YYYY, h:mm a");
	var fifteenMin = moment().add(15, 'minutes').format("dddd, MMMM Do YYYY, h:mm a");
	var fiveMin = moment().add(5, 'minutes').format("dddd, MMMM Do YYYY, h:mm a");
	var now = moment().format("dddd, MMMM Do YYYY, h:mm a");

	oauth2Client.credentials = entry.token;

calendar.events.list({
		auth: oauth2Client,
		calendarId: 'primary',
		timeMin: timeStart.toISOString(),
		maxResults: 10,
		singleEvents: true,
		orderBy: 'startTime'
		}, function(err, response) {
			if (err) {
				console.log('Err contact cal');
				return;		
			}
						
			var events = response.items;

			if (events.length == 0) {
				console.log('No upcoming events found.');
			} else {
				console.log('Upcoming 10 events:');
				for (var i = 0; i < events.length; i++) {
					var time = events[i].start.dateTime || events[i].start.date;
					time = moment(time).format("dddd, MMMM Do YYYY, h:mm a");

					if  (thirtyMin == time) {
						console.log("Found a match!");
						var options = {
							host: 'pavlok.herokuapp.com',
							path: '/api/' + apikey + '/beep/3'
						};

						callback = function(response) {
						  var str = '';

						  //another chunk of data has been recieved, so append it to `str`
						  response.on('data', function (chunk) {
						    str += chunk;
						  });

						  //the whole response has been recieved, so we just print it out here
						  response.on('end', function () {
						    console.log(str);
						  });
						}
					 	http.request(options, callback).end();							
					}
					if  (fifteenMin == time) {
						console.log("Found a match!");
						var options = {
							host: 'pavlok.herokuapp.com',
							path: '/api/' + apikey + '/vibrate/64'
						};

						callback = function(response) {
						  var str = '';

						  //another chunk of data has been recieved, so append it to `str`
						  response.on('data', function (chunk) {
						    str += chunk;
						  });

						  //the whole response has been recieved, so we just print it out here
						  response.on('end', function () {
						    console.log(str);
						  });
						}
					 	http.request(options, callback).end();

						var options = {
							host: 'pavlok.herokuapp.com',
							path: '/api/' + apikey + '/beep/3'
						};

						callback = function(response) {
						  var str = '';

						  //another chunk of data has been recieved, so append it to `str`
						  response.on('data', function (chunk) {
						    str += chunk;
						  });

						  //the whole response has been recieved, so we just print it out here
						  response.on('end', function () {
						    console.log(str);
						  });
						}
					 	http.request(options, callback).end();										
					}
					if  (fiveMin == time) {
						console.log("Found a match!");
						var options = {
							host: 'pavlok.herokuapp.com',
							path: '/api/' + apikey + '/vibrate/128'
						};

						callback = function(response) {
						  var str = '';

						  //another chunk of data has been recieved, so append it to `str`
						  response.on('data', function (chunk) {
						    str += chunk;
						  });

						  //the whole response has been recieved, so we just print it out here
						  response.on('end', function () {
						    console.log(str);
						  });
						}
					 	http.request(options, callback).end();							
					}	
					if  (now == time) {
						console.log("Found a match!");
						var options = {
							host: 'pavlok.herokuapp.com',
							path: '/api/' + apikey + '/shock/255'
						};

						callback = function(response) {
						  var str = '';

						  //another chunk of data has been recieved, so append it to `str`
						  response.on('data', function (chunk) {
						    str += chunk;
						  });

						  //the whole response has been recieved, so we just print it out here
						  response.on('end', function () {
						    console.log(str);
						  });
						}
					 	http.request(options, callback).end();							
					}											
				}
			}			
		});
}


app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
