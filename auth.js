console.log("Hello Auth")

var express = require('express');
var router = express.Router();
const fs = require("fs");

let data ={};

function user_factory (user, pwd) {
    return {
        username:user,
        password:pwd,
        date_created:Date.now(),
    }
}

const serverSideStorage = "data/db.json";
fs.readFile(serverSideStorage, (err, buf) => {
    if(err) {
        console.log("error: ", err);
    } else {
        data =  JSON.parse( buf );
        console.log(data);
    }
    console.log("Data read from file.");
});

function saveToServer(data) {
    fs.writeFile(serverSideStorage, JSON.stringify(data), function(err, buf ) {
        if(err) {
            console.log("error: ", err);
        } else {
            console.log("Data saved successfully!");
        }
    });
}

function correctPassword(username,password) {
    let i = userExists(username);
    if (username) {
        if (data.users[i].password == password) {
            return true;
        } else {
            return false;
        }
    }
    return false;
}

function userExists(username) {
    for (let i = 0; i < data.users.length; i++) {
        if (data.users[i].username == username) {
            return i;
        }
    }
    return null;
}

// Create
// New user
router.post('/:user/:pwd',function(req, res) {
    let new_user = user_factory(req.params.user,req.params.pwd);
    if (userExists(req.params.user) == null) {
        console.log(data);
        data.users.push(new_user);
        console.log(data);
        saveToServer(data);
    } else {
        console.log("Already exists");
    }
    res.end();
});

// Read
// Verifies correct password
router.get('/:user/:pwd',function(req, res) {
    let username = req.params.user;
    let password = req.params.pwd;
    res.send(correctPassword(username,password)?"Correct Password":"Wrong Username or Password");
});

// Update
// Change password, if you have the correct username and previous password
router.put('/:user/:pwd/:newpwd',function(req, res) {
    let username = req.params.user;
    let password = req.params.pwd;
    if (correctPassword(username,password)) {
        let user = data.users[userExists(username)];
        user.password = req.params.newpwd;
        saveToServer(data);
        // console.log("trying to change");
    } else {
        // console.log("not trying to change");
    }
    res.end();
});

// Delete
// Delete user, if you have the correct username and password
router.delete('/:user/:pwd',function(req, res) {
    let username = req.params.user;
    let password = req.params.pwd;
    // console.log("data before");
    // console.log(data);
    if (correctPassword(username,password)) {
        data.users.splice(userExists(username),1);
        saveToServer(data);
    }
    // console.log("data after");
    // console.log(data);
    res.end();
});

module.exports = router;