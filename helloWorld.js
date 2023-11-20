console.log("Hello Gradebook")

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