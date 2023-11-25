console.log("Hello Courses");

var express = require('express');
var router = express.Router();
const fs = require("fs");
const { off } = require('process');
var puppeteer = require('puppeteer');

let data ={};

// Returns courses
function course_factory (id, dept, name) {
    return {
        cid:id,
        department:dept,
        cname:name,
    }
}

// Returns specific sections of courses
function section_factory (id, dept, name, secton, teacher, semester, term, numEnrolled, maxEnrolled) {
    return {
        cid:id,
        department:dept,
        cname:name,
        section:secton,
        professor:teacher,
        quarter:semester,
        year:term,
    }
}

const bannerSite = 'https://prodwebxe-hv.rose-hulman.edu/regweb-cgi/reg-sched.pl';
function publicSite(year) { 
    return 'https://www.rose-hulman.edu/academics/course-catalog/'+year+'/index.html';
};
// We can get the last five years' course sites (all that matter) by subbing in 'xxxx-yyyy' where 'current' is, e.g., https://www.rose-hulman.edu/academics/course-catalog/2022-2023/index.html

const serverSideStorage = "data/courseinfo.json"; // all the courses
const sectionSideStorage = "data/sectioninfo.json"; // all the sections
const archivedBannerSite = "data/old_banner_site.html"; // uses publicly
const archivedPublicSite = "data/old_public_site.html"; // storing all publicly listed courses


fs.readFile(serverSideStorage, (err, buf) => {
    if(err) {
        console.log("error: ", err);
    } else {
        data =  JSON.parse( buf );
        console.log(data);
    }
    console.log("Data read from file.");
});


async function bannerSiteUp() {
    // puppeteering
    const browser = await puppeteer.launch({headless: "new"});
    const page = await browser.newPage();
    // Banner web schedule site
    await page.goto(bannerSite, { timeout: 30000 } );

    // Inputting username/password
        // await page.type('input[id="usernameUserInput"]', 'gajavegs');
        // await page.type('input[id="password"]', 'Red/Tornado22');
    await page.click('input[id="usernameUserInput"]');
    await page.keyboard.type('gajavegs', {delay: 100});
    await page.click('input[id="password"]');
    await page.keyboard.type('Red/Tornado22', {delay: 100});

    await page.screenshot({path: 'files/screenshot.png'});
    
    // Logging in
        // await page.click("[type=\"submit\"]");
        // await page.click(".form-group > .form-actions");
    await page.keyboard.press('Enter');
    
    await page.screenshot({path: 'files/screenshot2.png'});
    
    // Waiting for schedule page to load
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log("Waited");

    await page.screenshot({path: 'files/screenshot3.png'});

    // await browser.close();
    let content = await page.content();
    return content;
}

async function publicSiteUp() {
    // puppeteering
    const browser = await puppeteer.launch({headless: "new"});
    const page = await browser.newPage();
    // Public course listing site
    const response = await page.goto(publicSite("current"), { timeout: 30000 } ); // for scraping add options like network2 or whatever; we can vary getting the source html (like in this case) or getting what the user actually sees after some js shenanigans with these options
    let content = await response.text();

    await page.screenshot({path: 'files/screenshot4.png'});
    // console.log("Search results: "+ await page.$("#search-results").toString());
    // await browser.close();
    return content;
}

function yearsSince1970(){
    const minute = 1000 * 60;
    const hour = minute * 60;
    const day = hour * 24;
    const year = day * 365;

    return Math.round(Date.now() / year);
}

function curMonth(){
    return Date.now().getMonth();
}

// Overview
  // This API will allow for the maintenance and use of a publicly available database of Rose-Hulman's course offerings

// Commands: 
    // Verification (COMPLETE)
        // NOTE: Someone has to have already done 2FA before this works. I am using my credentials for this
        // Put - Overwrite old_banner_site.html. Only call when sure twe can process old_site.html
        // Get - The banner site is up/we logged in right (or at least has the html we expect)
        // Put - Overwrite old_public_site.html. Only call when sure we can process old_site.html
        // Get - The public site is up/we logged in right (or at least has the html we expect)
    // Data acquisition (IN PROGRESS)
        // NOTE: We can make this more flexible and parametrize by year, professor, etc. to update information in only parts of the db but waiting for mongodb first since I don't want to implement allat in json
        // Put - Write all courses from public site into 20XX_courseinfo.json. Offsets 'x' years backwards
            // courseinfo needs to be organized by department, then course id/name
        // Put -  Write all sections from banner site into 20XX_sectioninfo.json (depends on corresponding courseinfo.json). Offsets 'x' years backwards
            // sectioninfo needs to be organized by quarter, then department, then course id/name, then section/professor
    // Data distribution - the fun stuff (TODO)
        // A bunch of Gets, basically anything an actual DB can do, mixing and matching parameters to yoink appropriate records. Implementing this will be herculean with jsons, so just wait for and leverage mongodb or mysql when it comes around
        // Get - whether a class exists
        // Get - whether a section exists 
        // Get - any non-empty classes

// ISSUES: 
    // There seems to be a recurring issue relating to a failure to log in.
        // It's resolved by manually logging into banner web, navigating to the schedule while logged in, and then logging out
        // Potentially also just solved by waiting
    // 2FA is a pain in the arse
        // Potential solution: We'll have a get where we send in a username, password, and phone number
        // Then we'll have a post where we send in the 2FA code

// Read
// RUN BEFORE FUTURE SCRAPING. Checks if the banner site is up/in the same format it was designed for
router.get('/scraping_up/banner', async function(req, res) {
    let content = await bannerSiteUp(); // gets the banner site html
    let prev = await fs.promises.readFile(archivedBannerSite);
    res.send(content==prev?"banner scraping is up":"banner scraping is down");
});
// RUN BEFORE FUTURE SCRAPING. Checks if the public site is up/in the same format it was designed for
router.get('/scraping_up/public', async function(req, res) {
    let content = await publicSiteUp(); // gets the public site html
    let prev = await fs.promises.readFile(archivedPublicSite);
    res.send(content==prev?"public scraping is up":"public scraping is down");
});


// Update
// Overwrite old_banner_site.html. Only call when sure we can process old_site.html
router.put('/update_archive/banner',async function(req,res) {
    let content = await bannerSiteUp(); // gets the banner site html
    fs.writeFile(archivedBannerSite,content,function(err, buf) {
        if(err) {
            res.send("error writing: ", err);
        } else {
            res.send("success writing");
        }
    });
});
// Overwrite old_public_site.html. Only call when sure we can process old_site.html
router.put('/update_archive/public',async function(req,res) {
    let content = await publicSiteUp(); // gets the public site html
    fs.writeFile(archivedPublicSite,content,function(err, buf) {
        if(err) {
            res.send("error writing: ", err);
        } else {
            res.send("success writing");
        }
    });
});
// Write all courses from public site into 20XX_courseinfo.json. Year specified is the later of xxxx-yyyy, aka the year the class of yyyy graduates
router.put('/load_courses/:year',async function(req,res) {
    // prolly gonna be async
    // return an error for stupid offsets. I'll also create new folders for each new year represented, with each one containing the respective courses and sections jsons
    let curYear = yearsSince1970()+1970; // 
    let months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    // Can't tell the future
    if (req.params.year > curYear+1) {
        res.send("Invalid year: "+req.params.year);
    }
    // Since summer registrations are over and the public site will be aimed at potential new students, it'll switch over in May to the next school year. Before May it will not have switched and therefore offsets for next year will not yet be valid.
    if ((req.params.year == curYear+1 && curMonth() < 4)) {
        res.send("Invalid month. Too early in the year for next years schedule: "+months.get(curMonth())+"\n(Correct if I'm wrong)");
    }

    // So we assume the site will switch over in May, so anything after that "current" will be next year, and we assume "prev-year" will start existing
    let year = "";
    // We know there will be a valid url for the given year
    if (req.params.year == curYear+1 || (req.params.year == curYear && curMonth() < 4)) { // Means next year and we know it's valid, so we look at the latest ("current"), or we want this year and it hasn't switched yet
        year = "current";
    } else { // So we're either looking at this year or years previous once they've been superceded by a current
        year = (req.params.year-1)+"-"+req.params.year;
    }
    

    // stepping through all 39 pages, will likely involve another puppeteer function to await
    // I should look into some html to json solutions

});
// Write all sections from banner site into 20XX_sectioninfo.json (depends on corresponding courseinfo.json). // Write all courses from public site into 20XX_courseinfo.json. Year specified is the later of xxxx-yyyy, aka the year the class of yyyy graduates
router.put('/load_sections/:year',async function(req,res) {
    // prolly gonna be async
    // return an error for stupid offsets. I'll also create new folders for each new year represented, with each one containing the respective courses and sections jsons



    // stepping through all 39 pages, will likely involve another puppeteer function to await
    // I should look into some html to json solutions
});
module.exports = router;