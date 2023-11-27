console.log("Hello Courses");

var express = require('express');
var router = express.Router();
const fs = require("fs");
const { get } = require('http');
const { DateTime } = require("luxon");
const { getDefaultAutoSelectFamilyAttemptTimeout } = require('net');
var puppeteer = require('puppeteer');

// Returns courses
function course_factory (id, dept, name) {
    return {
        cid:id,
        department:dept,
        cname:name,
    }
}

// Returns specific sections of courses
function section_factory (id, name, secton, teacher, semester, term) {
    return {
        cid:id,
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

const archivedBannerSite = "data/old_banner_site.html"; // uses publicly
const archivedPublicSite = "data/old_public_site.html"; // storing all publicly listed courses

async function bannerSiteUp(username, password) {
    // puppeteering
    const browser = await puppeteer.launch({headless: "new"});
    const page = await browser.newPage();
    // Banner web schedule site
    await page.goto(bannerSite, { timeout: 30000 } );

    // Inputting username/password
    await page.click('input[id="usernameUserInput"]');
    await page.keyboard.type(username, {delay: 100});
    await page.click('input[id="password"]');
    await page.keyboard.type(password, {delay: 100});

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


async function getSections(year,username,password) {
    // puppeteering
    const browser = await puppeteer.launch({headless: "new"});
    const page = await browser.newPage();
    // Banner web schedule site
    await page.goto(bannerSite, { timeout: 30000 } );

    // Inputting username/password
    await page.click('input[id="usernameUserInput"]');
    await page.keyboard.type(username, {delay: 100});
    await page.click('input[id="password"]');
    await page.keyboard.type(password, {delay: 100});

    await page.keyboard.press('Enter');
    
    // Waiting for schedule page to load
    await new Promise(resolve => setTimeout(resolve, 1000));

    await page.screenshot({path: 'files/screenshot7.png'});

    // document.querySelector("[name=\"termcode\"] option").innerText
        // The dropdown in question
    let toChoose = await getOptions(page, year);
    let departments = await getDepartments(page);
    let toRet = [];
    for (let key in toChoose) {
        await getOptionSections(page, year, key, toChoose, departments, toRet);
    }

    // Leaving and coming back to reset the site works
        // await page.goto(publicSite("current"), { timeout: 30000 } );
        // await page.screenshot({path: 'files/screenshot8.png'});
        // await page.goto(bannerSite, { timeout: 30000 } );
        // await page.screenshot({path: 'files/screenshot9.png'});
    return toRet;
}

async function getOptionSections(page, year, quarter, toChoose, departments, toRet) {
    let option = toChoose[quarter];
    // Goes through all courses by department
    for (let i = 0; i < departments.length; i++) {
        // Set the quarter to the given option
        await page.select("[name=\"termcode\"]",option);
        // Set table (choose "table")
        await page.select("[name=\"view\"]","table");
        // set current department
        await page.select("[name=\"deptid\"]",departments[i]); // as long as this was selected last, enter will work

        // Clickin in
        await page.click("[name=\"deptid\"]"); // clicks dropdown after selecting
        await page.keyboard.press('Enter'); // press enter
        await new Promise(resolve => setTimeout(resolve, 3000)); // An estimated boun
        if (i == 0) {
            console.log("Saving Biology and Biomedical Engineering");
            await page.screenshot({path: 'files/screenshot10.png'}); // should be 
        }
        console.log("toRet length before: "+toRet.length);
        await getPageSections(page, year, quarter, toRet);
        console.log("toRet length after: "+toRet.length);
        // Reset page via repeat goto banner url after each scrape
        await page.goto(bannerSite, { timeout: 30000 } );
    }
}

async function getPageSections(page, year, quarter, toRet) {
    const nn = await page.$$("p table tr td");
    const colnums = {
        "Course":0,
        "CRN":1,
        "Course Title":2,
        "Instructor":3,
        "CrHrs":4,
        "Enrl":5,
        "Cap":6,
        "Term Schedule":7,
        "Comments":8,
        "Final Exam Schedule":9,
        "Term Dates":10,
    };
    const numCols = 11;
    for (let i = 0; i < nn.length; i+=numCols) { // skip that first row since it just has col names
        // await( await option.getProperty('innerText') ).jsonValue();
        const c = await( await nn[i+colnums["Course"]].getProperty('innerText') ).jsonValue();
        const id = c.substring(0,c.indexOf('-')); // All but "-XX"
        const name = await( await nn[i+colnums["Course Title"]].getProperty('innerText') ).jsonValue();
        const section = c.substring(c.indexOf('-')+1);
        const professor = await( await nn[i+colnums["Instructor"]].getProperty('innerText') ).jsonValue();
        // (id, name, secton, teacher, semester, term)
        let toPush = section_factory(id,name,section,professor,quarter,year);
        // if (i == 0) {
        //     console.log(toPush);
        // }
        toRet.push(toPush);
    }
}

// Returns option values for selecting in dropdown
async function getDepartments(page) {
    let allOptions = await page.$$("[name=\"deptid\"] option");
    let toRet = [];
    for (let i = 1; i < allOptions.length; i++) { // skips the first because we're assuming it's empty; won't have a value and will crash
        const option = allOptions[i];
        const val = await( await option.getProperty('value') ).jsonValue();
        toRet.push(val);
    }
    return toRet;
}

async function getOptions(page, year) {
    const allOptions = await page.$$("[name=\"termcode\"] option");
    let toChoose = {};
    let found = false;
    for (let i = 0; i < allOptions.length; i++) { // Could implement a binary search, would be a major pain tho for an array of size 20
        const option = allOptions[i];
        const val = await( await option.getProperty('value') ).jsonValue();
        const name = await( await option.getProperty('innerText') ).jsonValue();
        let curYear = val.substring(0,4);
        if (!found) {
            if (curYear < year && i === 0) { // So if even the (presumably) latest part of the list has not happened yer
                break;
            }
            if (curYear == year) {
                toChoose[name.substring(0,name.length-18)] = val; // Gives the quarter
                found = true;
            }
        } else {
            if (curYear != year) { // we found all of them
                break;
            }
            toChoose[name.substring(0,name.length-18)] = val;
        }
    }
    return toChoose;
}

async function getCourses(year) {
    // puppeteering
    const browser = await puppeteer.launch({headless: "new"});
    const page = await browser.newPage();
    // Public course listing site
    await page.goto(publicSite(year), { timeout: 30000 } ); // for scraping add options like network2 or whatever; we can vary getting the source html (like in this case) or getting what the user actually sees after some js shenanigans with these options

    await page.screenshot({path: 'files/screenshot5.png'});
    
    let toRet = [];
    let loop = true;
    let length = await page.evaluate(() => {
        return (Array.from(document.querySelector('#courses').children).length);
    });
    while (loop) {
        // Adds the courses of the current page to the list
        await getPageCourses(page,toRet);
        await page.click("[ng-click=\"setCurrent(pagination.current + 1)\"]");
        loop = await hasNext(page,length);
    }
    await getPageCourses(page,toRet);

    return toRet;
}

// Length changed because no longer at limit of course length
async function hasNext(page, oldLen) {
    // return !!(await page.$("[ng-click=\"setCurrent(pagination.current + 1)\"]"));
    let length = await page.evaluate(() => {
        return (Array.from(document.querySelector('#courses').children).length);
    });
    return oldLen == length;
}

async function getPageCourses(page, toRet) {
    const nn = await page.$$("#courses .ng-binding");
    for (let i = 0; i < nn.length; i++) {
        const n = nn[i];
        // https://stackoverflow.com/questions/59001256/pupetteer-get-inner-text-returns-jshandle-prefix
        const t = await( await n.getProperty('innerText') ).jsonValue(); // evaluate did not work in this scenario, don't 100% get why this does
        const id_and_name = t.split("\n");
        const dept_and_number = id_and_name[0].split(" ");

        // console.log("id and name: "+id_and_name);
        // console.log("dept and number: "+dept_and_number);
        // await browser.close();
        if (dept_and_number[1] && dept_and_number[0] && id_and_name[1]) { // prvents incomplete course data
            toRet.push(course_factory(dept_and_number[1],dept_and_number[0],id_and_name[1])); // id, dept, name
        }
    }
}

async function writeCourses(courses, year) {
    let filepath = "data/"+year+"/";
    let filename = year+"_courseinfo";
    let data = {};
    let courseset = {};
    for (let i = 0; i < courses.length; i++) {
        let cid = courses[i].cid;
        let cur_dept = courses[i].department;
        let cname = courses[i].cname;
        courseset[cur_dept+cid] = cur_dept; // so we can split by the prefixes

        let cur = {};
        if (cur_dept in data) {
            cur = data[cur_dept];
        }
        // update object
        cur[cid] = cname;
        // update object
        data[cur_dept] = cur;
    }

    // Lol it's like a demo of synchronous vs promises vs callbacks
    let dir_exists = fs.existsSync(filepath);
    if (!dir_exists) { // If the directory already exists
        await fs.promises.mkdir(filepath,{ recursive: true });
    }
    fs.writeFile(filepath+filename+".json", JSON.stringify(data), function(err, buf ) {
        if(err) {
            console.log("error: ", err);
        } else {
            console.log("Data saved successfully!");
        }
    });
    fs.writeFile(filepath+filename+"_courseset.json", JSON.stringify(courseset), function(err, buf ) {
        if(err) {
            console.log("error: ", err);
        } else {
            console.log("Data saved successfully!");
        }
    });
}

// TODO: Make writing a little more sophisticated
async function writeSections(sections, year) {
    let filepath = "data/"+year+"/";
    let filename = year+"_sectioninfo";
    let data = {sections};

    // Lol it's like a demo of synchronous vs promises vs callbacks
    let dir_exists = fs.existsSync(filepath);
    if (!dir_exists) { // If the directory already exists
        await fs.promises.mkdir(filepath,{ recursive: true });
    }
    fs.writeFile(filepath+filename+".json", JSON.stringify(data), function(err, buf ) {
        if(err) {
            console.log("error: ", err);
        } else {
            console.log("Data saved successfully!");
        }
    });
}

function curMonth(){
    return DateTime.now().month;
}

function thisYear(){
    return DateTime.now().year;
}

// Overview
  // This API will allow for the maintenance and use of a webscraper for Rose-Hulman's publicly available course offerings as well as specific sections for user's with credentials

// Commands: 
    // Verification (COMPLETE)
        // NOTE: Someone has to have already done 2FA before this works. I am using my credentials for this
        // Put - Overwrite old_banner_site.html. Only call when sure twe can process old_site.html
        // Get - The banner site is up/we logged in right (or at least has the html we expect)
        // Put - Overwrite old_public_site.html. Only call when sure we can process old_site.html
        // Get - The public site is up/we logged in right (or at least has the html we expect)
    // Data acquisition (COMPLETE)
        // NOTE: We can make this more flexible and parametrize by year, professor, etc. to update information in only parts of the db but waiting for mongodb first since I don't want to implement allat in json
        // NOTE: New folders for each new year represented, with each one containing the respective courses and sections jsons
        // Put - Write all courses from public site into 20XX_courseinfo.json. Year specified is the later of xxxx-yyyy, aka the year the class of yyyy graduates
            // courseinfo needs to be organized by department, then course id/name
        // Put - Write all sections from banner site into 20XX_sectioninfo.json (depends on corresponding courseinfo.json). // Write all courses from public site into 20XX_courseinfo.json. Year specified is the later of xxxx-yyyy, aka the year the class of yyyy graduates
            // sectioninfo needs to be organized by quarter, then department, then course id/name, then section/professor
        // Put - maybe later, also getting all of the descriptions could be fun
    // Data distribution - the fun stuff (IN PROGRESS)
        // A bunch of Gets, basically anything an actual DB can do, mixing and matching parameters to yoink appropriate records. Implementing this will be herculean with jsons, so just wait for and leverage mongodb or mysql when it comes around
        // Get - whether a class exists (to prevent invalid classes from being created)
        // Get - whether a section exists (to prevent invalid sections from being created) (if their section is empty so far and invisible,
        //       we'll ask if they can't find a section that anyone's been a part of; don't want to overwhelm with empty sections)
        // Get - any non-empty classes

// ISSUES: 
    // There seems to be a recurring issue relating to a failure to log in.
        // It's resolved by manually logging into banner web, navigating to the schedule while logged in, and then logging out
        // Potentially also just solved by waiting
    // 2FA is a pain in the arse
        // Potential solution: We'll have a get where we send in a username, password, and phone number
        // Then we'll have a post where we send in the 2FA code
    // Error: Requesting main frame too early!
        // Seems to happen arbitrarily, just rereun

// Read
// RUN BEFORE FUTURE SCRAPING. Checks if the banner site is up/in the same format it was designed for
router.get('/scraping_up/banner/:username/:password', async function(req, res) {
    let content = await bannerSiteUp(req.params.username,req.params.password); // gets the banner site html
    let prev = await fs.promises.readFile(archivedBannerSite);
    res.send(content==prev?"banner scraping is up":"banner scraping is down. \nUsername/password may be incorrect: \nHow to encode special characters in URLs (e.g., '/' = %2F):\n https://www.w3schools.com/tags/ref_urlencode.ASP");
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
    let curYear = thisYear();
    let months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    // Can't tell the future
    if (req.params.year > curYear+1) {
        res.send("Invalid year: "+req.params.year);
    }
    // Since summer registrations are over and the public site will be aimed at potential new students, it'll switch over in May to the next school year.
    // Before April it will probably not have switched and therefore the next year will not yet be valid.
    if ((req.params.year == curYear+1 && curMonth() < 3)) {
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
    let courses = await getCourses(year);
    await writeCourses(courses,req.params.year);
    res.end();
});
// Write all sections from banner site into 20XX_sectioninfo.json (depends on corresponding courseinfo.json). // Write all courses from public site into 20XX_courseinfo.json. Year specified is the later of xxxx-yyyy, aka the year the class of yyyy graduates
router.put('/load_sections/:year/:username/:password',async function(req,res) {
    let curYear = thisYear();
    // Can't tell the future
    if (req.params.year > curYear+1) {
        res.send("Invalid year: "+req.params.year);
    }
    let sections = await getSections(req.params.year,req.params.username, req.params.password);
    // Load/use the collected course info while organizing 
    await writeSections(sections,req.params.year);
    
    res.end();
});
module.exports = router;