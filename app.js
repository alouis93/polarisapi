var express = require('express');
var bodyParser = require('body-parser');
var googleMaps = require('googlemaps');
var util = require('util');
var twilio = require('twilio');
var request = require('request');
var http = require('http');
var $ = require('string')
var port = process.env.PORT || 3000;

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

  api_cache.push(data);
  // var data = req.body;
  // console.log(req.body);

  getDirections(data.origin, data.destination, data.mode, function(map, directions) {
    // Send Twiml (Twilio Markup) response
    var twiml = constructTwiml(map, directions);

    res.send(twiml);
  });

});

function constructTwiml(map, directions) {
  var twimlRes = '<?xml version="1.0" encoding="UTF-8"?>';

  api_cache.push(directions);

  twimlRes += '<Response><Message>' +
    // '<Map>' + JSON.stringify(map) + '</Map>' +
    + JSON.stringify(directions) +
    '</Message></Response>';
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
        api_cache.push(map);
        api_cache.push(directions);
        callback(map, directions);
      }
    });

  }, 'false', mode, null, null, null, null, null, null);
}

// Start express server
app.listen(port, function() {
  console.log('Listening to port:', port);
});
