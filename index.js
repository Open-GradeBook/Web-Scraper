var express = require('express');
var app = express();

var helloWorld = require('./helloWorld.js'); // HelloWorld router (try refreshing)
app.use('/test',helloWorld);



app.listen(3000);