var express = require('express');
var bodyParser = require('body-parser');
var googleMaps = require('googlemaps');
var util = require('util');
// var twilio = require('twilio');
var request = require('request');
var http = require('http');
var $ = require('string')
var port = process.env.PORT || 3000;

// Authorizing our twilio client - credentials from twilio.com/user/account
var accountSid = 'AC96c47192ae354b5555452d23dbebd7c3';
var authToken = "1fda5201e21c1e697fa243ab77e68696";
var client = require('twilio')(accountSid, authToken);

// Cache all requests in memory
var api_cache = [];

var app = express();
// Use body-parser middleware for handling POST requests
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(bodyParser.json());

// Default route
app.get('/', function(req, res) {
  res.send("<h1> This is the polaris API server</h1>");
})

// Get cached requests
app.get('/api/sms', function(req, res) {
  res.json(api_cache);
});

// Twilio SMS Handler route
app.post('/api/sms', function(req, res) {
  api_cache = [];

    // Sanitize malformed incoming object
    var data = JSON.parse(
      req.body.Body
      .replace('(', '{')
      .replace(')', '}')
    );

  var recipient = JSON.parse(JSON.stringify(req.body.From));
  var twilioNum = JSON.parse(JSON.stringify(req.body.To));

  getDirections(data.origin, data.destination, data.mode, function(map, directions) {
    // Send Twiml (Twilio Markup) response
    var twiml = constructTwiml(map, directions);

    api_cache.push( twiml );

    client.messages.create({
        body: "JennTy please?! I love you <3",
        to: recipient,
        from: twilioNum
    }, function(err, message) {
        process.stdout.write(message.sid);
    });

    res.send(twiml);
  });

});

function constructTwiml(map, directions) {
  var twimlRes = '<?xml version="1.0" encoding="UTF-8"?>';

  //api_cache.push(map);
  // api_cache.push(directions);
  var payload = {};
  payload.map = map;
  payload.directions = directions;
  // api_cache.push(JSON.stringify(payload));
  twimlRes += '<Response><Message>' + JSON.stringify(payload) + '</Message></Response>';
  //api_cache.push(JSON.stringify(twimlRes));
  return twimlRes;
}

function getDirections(origin, destination, mode, callback) {
  // Make API call to the Google Maps API
  googleMaps.directions(origin, destination, function(err, result) {
    if (err) return console.error(err);

    // Grab encoded polyline data
    var polyline = result['routes'][0].overview_polyline.points;

    // Grab navigation data
    var directions = [];
    result['routes'][0]['legs'][0].steps.forEach(function(step) {
      var step = step.html_instructions;
      // cleanse HTML tags using string.js ($)
      // Hack(zen): insert space between Maps API destination div
      directions.push($(step).stripTags().s
        .replace('Destination', ', Destination')
      );
    });

    // callback(null,directions);

    // Grab a static map image
    var requestUrl = "http://maps.googleapis.com/maps/api/staticmap?size=400x200&format=jpg&zoom=13&path=weight:3%7Ccolor:red%7Cenc:"+polyline;
    request(requestUrl,function(error, response, body){
      if (!error && response.statusCode == 200){
        var map = body;
        // invoke callback with base-64 map and directions
        // api_cache.push(map);
        // api_cache.push(directions);
        callback(map, directions);
      }
    });

  }, 'false', mode, null, null, null, null, null, null);
}

// Start express server
app.listen(port, function() {
  console.log('Listening to port:', port);
});
