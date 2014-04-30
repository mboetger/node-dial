var dgram = require('dgram');
var http = require('http');
var url = require('url');
var xml2js = require('xml2js');

var BROADCAST_PORT = 1900;
var BROADCAST_IP = "239.255.255.250";
var SEARCH_TARGET = "urn:dial-multiscreen-org:service:dial:1";
var LISTENING_TIMEOUT = 10000;

var SEARCH_MSG = "M-SEARCH * HTTP/1.1\r\n" + "HOST: " + BROADCAST_IP + ":" + BROADCAST_PORT + "\r\n" + "MAN: \"ssdp:discover\"\r\n" + "MX: 10\r\n" + "ST:" + SEARCH_TARGET + "\r\n\r\n";

var message = new Buffer(SEARCH_MSG);

var server = dgram.createSocket("udp4");

server.on("error", function (err) {
  console.log("server error:\n" + err.stack);
  server.close();
});

var desc = function(res) {
  var content = "";
  res.setEncoding('utf8');
  res.on('data', function(chunk) {
    content += chunk;
  });

  res.on('end', function() {
    try {
      xml2js.parseString(content, function(err, services) {
        console.log('Devices:\n%j', services.root.device); 
      });
    } catch (ex) {
	//no bueno
    }
  });
}

server.on("message", function (msg, rinfo) {
  var tokens = new String(msg).split('\n');
  var targetMatches = false;
  var location = "";
  for (var i=0; i < tokens.length; i++) {
    var token = tokens[i];
    if (0 == token.indexOf('LOCATION')) {
      location = token.substring('LOCATION: '.length).trim();
    } else if (0 == token.indexOf('ST')) {
      var target = token.substring('ST: '.length).trim();
      targetMatches = target == SEARCH_TARGET;
    }
  }

  if (location.length > 0 && targetMatches) {
    var options = url.parse(location);
    options.headers = {
        "Content-Type":"application/x-www-form-urlencoded"
      };
    console.log("+++++++++++++DEVICE FOUND++++++++++++++++");  
    console.log(tokens);      
    http.get(options,desc);
  }
});


server.on("listening", function () {
  var address = server.address();
  console.log("server listening " +
      address.address + ":" + address.port);
});

server.bind();

server.send(message, 0, message.length, BROADCAST_PORT, BROADCAST_IP, function(err, bytes) {
  setTimeout(function() { server.close(); }, LISTENING_TIMEOUT);
});


