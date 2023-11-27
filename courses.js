console.log("Hello Courses");

var express = require('express');
var router = express.Router();
const fs = require("fs");
const { DateTime } = require("luxon");
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

async function getSections(username,password) {
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
    let filename = year+"_courseinfo.json";
    let data = {};
    for (let i = 0; i < courses.length; i++) {
        let cid = courses[i].cid;
        let cur_dept = courses[i].department;
        let cname = courses[i].cname;

        let cur = [];
        if (cur_dept in data) {
            cur = data[cur_dept];
        }
        
        // update array
        cur.push({
                id:cid,
                name:cname});
        // update object
        data[cur_dept] = cur;
    }
    let dir_exists = fs.existsSync(filepath);
    console.log(dir_exists);
    if (!dir_exists) { // If the directory already exists
        await fs.promises.mkdir(filepath,{ recursive: true });
    }
    fs.writeFile(filepath+filename, JSON.stringify(data), function(err, buf ) {
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
        // NOTE: New folders for each new year represented, with each one containing the respective courses and sections jsons
        // Put - Write all courses from public site into 20XX_courseinfo.json. Year specified is the later of xxxx-yyyy, aka the year the class of yyyy graduates
            // courseinfo needs to be organized by department, then course id/name
        // Put - Write all sections from banner site into 20XX_sectioninfo.json (depends on corresponding courseinfo.json). // Write all courses from public site into 20XX_courseinfo.json. Year specified is the later of xxxx-yyyy, aka the year the class of yyyy graduates
            // sectioninfo needs to be organized by quarter, then department, then course id/name, then section/professor
    // Data distribution - the fun stuff (TODO)
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
    console.log("Croy ear"+(curYear+1));
    if (req.params.year == curYear+1 || (req.params.year == curYear && curMonth() < 4)) { // Means next year and we know it's valid, so we look at the latest ("current"), or we want this year and it hasn't switched yet
        year = "current";
    } else { // So we're either looking at this year or years previous once they've been superceded by a current
        year = (req.params.year-1)+"-"+req.params.year;
    }
    console.log("Year: "+year);
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
    let sections = await getSections(req.params.username, req.params.password);
    await writeSections(sections,req.params.year);
    res.end();
});
module.exports = router;