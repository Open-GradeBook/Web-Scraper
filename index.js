var express = require('express');
var app = express();

var helloWorld = require('./helloWorld.js'); // HelloWorld router (try refreshing)
app.use('/test',helloWorld);

var auth = require('./auth.js'); // Auth router (try CRUD-ing)
app.use('/auth',auth);

var courses = require('./courses.js'); // Courses router
app.use('/courses',courses);

app.listen(3000);
