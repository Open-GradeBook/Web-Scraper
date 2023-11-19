console.log("Hello Gradebook")
/*
const path = require("path");
const util = require("util");
const fs = require("fs");

const filesDirectory = path.join(__dirname, "files")
// console.clear()

util.log( "Hello" );
util.log(filesDirectory);

// fs.writeFile(path.join(filesDirectory, "test.txt"), "Hello World written from Node.js", (err)=>{
//     if(err) {
//         console.log("Error", err);
//         return;
//     }
//     console.log("It suceeded!");
// });

const fileContents = fs.readFileSync(path.join(filesDirectory, "test.txt"), "UTF-8");
console.log("from file: ", fileContents);*/

var express = require('express');
var router = express.Router();
let swap = "Mello world!";
router.get('/',function(req, res) {
    res.send(swap);
    if (swap == "Hello world!") {
        swap = "Mello world!";
    } else {
        swap = "Hello world!";
    }
});
module.exports = router;