var dgram = require('dgram');
var http = require('http');
var url = require('url');
var xml2js = require('xml2js');
var argv = require('optimist').argv;

var BROADCAST_PORT = 1900;
var BROADCAST_IP = "239.255.255.250";
var SEARCH_TARGET = "urn:dial-multiscreen-org:service:dial:1";
var LISTENING_TIMEOUT = 10000;

var SEARCH_MSG = "M-SEARCH * HTTP/1.1\r\n" + "HOST: " + BROADCAST_IP + ":" + BROADCAST_PORT + "\r\n" + "MAN: \"ssdp:discover\"\r\n" + "MX: 10\r\n" + "ST:" + SEARCH_TARGET + "\r\n\r\n";

var message = new Buffer(SEARCH_MSG);

var server = dgram.createSocket("udp4");

var app = argv.a;
var friendlyName = argv.f;
var ip = argv.i;


server.on("error", function (err) {
  console.log("server error:\n" + err.stack);
  server.close();
});

var appAvail = function(tokens, location, services, appUrl, res) {
  var content = "";
  res.setEncoding('utf8');
  res.on('data', function(chunk) {
    content += chunk;
  });

  res.on('end', function() {
    try {
      xml2js.parseString(content, function(err, appInfo) {

        console.log('\n');
        console.log('Incoming UDP Message :\n%j', tokens); 
        console.log('\n');
        console.log('********* Requesting Service Information From %j **********', location);
        console.log('\n');
        console.log('HTTP Response:\n%j', services); 
        console.log('\n');
        console.log('********* Requesting App Information From %j **********', appUrl);
        console.log('\n');
        if (!appInfo) {
          console.log('App Not Available\n'); 
        } else {
          console.log('HTTP Response:\n%j', appInfo); 
        }
        console.log('\n');
        console.log('***************************************************************************************');
      });
    } catch (ex) {
	//no bueno
    }
  });
}

var desc = function(tokens, location, res) {
  var content = "";
  res.setEncoding('utf8');
  res.on('data', function(chunk) {
    content += chunk;
  });

  res.on('end', function() {
    try {
      xml2js.parseString(content, function(err, services) {
        var displayInfo = true;
        if (friendlyName != null) {
          var nameRegEx = new RegExp(friendlyName, 'i');
          displayInfo = services.root.device[0].friendlyName[0].match(nameRegEx);
        }
        if (displayInfo) {
          if (app) {
            var appUrl = res.headers['application-url'];
            if (appUrl.slice(-1) != '/') {
              appUrl += '/';
            }
            appUrl += app;
            var options = url.parse(appUrl);
            
            options.headers = {
                "Content-Type":"application/x-www-form-urlencoded"
              };
            http.get(options,appAvail.bind(this, tokens, location, services, url.format(options)));
          } else {
            console.log('\n');
            console.log('Incoming UDP Message :\n%j', tokens); 
            console.log('\n');
            console.log('********* Requesting Service Information From %j **********', location);
            console.log('\n');
            console.log('HTTP Response:\n%j', services); 
            console.log('\n');
            console.log('***************************************************************************************');
          }
        }
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

    if (ip != null) {
      var ipRegEx = new RegExp(ip, 'i');
      if (!location.match(ipRegEx)) {
        return;
      }
    }
    var options = url.parse(location);
    options.headers = {
        "Content-Type":"application/x-www-form-urlencoded"
      };
    http.get(options,desc.bind(this, tokens, location));
  }
});


server.on("listening", function () {
  var address = server.address();
  if (app) { 
    console.log("Looking for %j", app);
  }
  if (friendlyName) {
    console.log("Looking for device %j", friendlyName);
  }
  if (ip) {
    console.log("Looking for IP Address: %j", ip);
  }
  console.log("Server Listening " +
      address.address + ":" + address.port);

  console.log("Broadcasting on %s:%d", BROADCAST_IP, BROADCAST_PORT);
  server.send(message, 0, message.length, BROADCAST_PORT, BROADCAST_IP, function(err, bytes) {
    setTimeout(function() { server.close(); }, LISTENING_TIMEOUT);
  });
});

server.bind();


