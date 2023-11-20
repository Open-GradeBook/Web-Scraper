var express = require('express');
var app = express();

var helloWorld = require('./helloWorld.js'); // HelloWorld router (try refreshing)
app.use('/test',helloWorld);

var auth = require('./auth.js'); // HelloWorld router (try refreshing)
app.use('/auth',auth);

app.listen(3000);