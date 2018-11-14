var http = require('http'),
    httpProxy = require('http-proxy');
    url = require('url');

var uri_root_path = process.env.URI_ROOT_PATH || ''

var terminal_app = 'http://127.0.0.1:8081';
var terminal_root_url = '^' + uri_root_path + '/?$'

var auth_username = process.env.AUTH_USERNAME;
var auth_password = process.env.AUTH_PASSWORD;

var proxy = httpProxy.createProxyServer();

function on_error(err, req, res) {
  res.writeHead(500, {
    'Content-Type': 'text/plain'
  });

  res.end('Something went wrong.');
}

var server = http.createServer(function(req, res) {
  var auth = req.headers['authorization'];

  if (auth_username) {
    if (!auth) {
	res.statusCode = 401;
	res.setHeader('WWW-Authenticate', 'Basic realm="Terminal"');

	res.end('Login required.');

        return;
    }
    else {
      var tmp = auth.split(' ');
      var buf = new Buffer(tmp[1], 'base64');
      var plain_auth = buf.toString();

      var creds = plain_auth.split(':');
      var username = creds[0];
      var password = creds[1];

      if ((username != auth_username) || (password != auth_password)) {
	res.statusCode = 401;
	res.setHeader('WWW-Authenticate', 'Basic realm="Terminal"');

	res.end('Access denied.');

        return;
      }
    }
  }

  var parsed_url = url.parse(req.url);

  if (parsed_url.pathname.match(terminal_root_url)) {
    res.statusCode = 302;
    res.setHeader('Location', uri_root_path + '/session/1');

    res.end('Redirect to named session.');

    return;
  }

  proxy.web(req, res, { target: terminal_app }, on_error);
});

server.on('upgrade', function (req, socket, head) {
  proxy.ws(req, socket, head, { target: terminal_app }, on_error);
});

server.listen(8080, "0.0.0.0");
