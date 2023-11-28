# The Course Webscraping Backend

 **Overview
 ** 
 This API will allow for the maintenance and use of a webscraper for Rose-Hulman's publicly available course offerings as well as specific sections for user's with credentials

# Commands: 
    
** Verification (COMPLETE)
**	   
 NOTE: Someone has to have already done 2FA before this works. I am using my credentials for this
	   
 Put - Overwrite old_banner_site.html. Only call when sure twe can process old_site.html
	   
 Get - The banner site is up/we logged in right (or at least has the html we expect)
	   
 Put - Overwrite old_public_site.html. Only call when sure we can process old_site.html
	   
 Get - The public site is up/we logged in right (or at least has the html we expect)
    
** Data acquisition (COMPLETE)
**	   
 NOTE: We can make this more flexible and parametrize by year, professor, etc. to update information in only parts of the db but waiting for mongodb first since I don't want to implement allat in json
	   
 NOTE: New folders for each new year represented, with each one containing the respective courses and sections jsons
	   
 Put - Write all courses from public site into 20XX_courseinfo.json. Year specified is the later of xxxx-yyyy, aka the year the class of yyyy graduates
		  
 courseinfo needs to be organized by department, then course id/name
	   
 Put - Write all sections from banner site into 20XX_sectioninfo.json (depends on corresponding courseinfo.json). 
 Write all courses from public site into 20XX_courseinfo.json. Year specified is the later of xxxx-yyyy, aka the year the class of yyyy graduates
		  
 sectioninfo needs to be organized by quarter, then department, then course id/name, then section/professor
	   
 Put - maybe later, also getting all of the descriptions could be fun
    
** Data distribution - the fun stuff (IN PROGRESS)
**	   
 A bunch of Gets, basically anything an actual DB can do, mixing and matching parameters to yoink appropriate records. Implementing this will be herculean with jsons, so just wait for and leverage mongodb or mysql when it comes around
	   
 Get - whether a class exists (to prevent invalid classes from being created)
	   
 Get - whether a section exists (to prevent invalid sections from being created) (if their section is empty so far and invisible,
	   
	  we'll ask if they can't find a section that anyone's been a part of; don't want to overwhelm with empty sections)
	   
 Get - any non-empty classes

# ISSUES: 
    
 There seems to be a recurring issue relating to a failure to log in.
	   
 It's resolved by manually logging into banner web, navigating to the schedule while logged in, and then logging out
	   
 Potentially also just solved by waiting
    
 2FA is a pain in the arse
	   
 Potential solution: We'll have a get where we send in a username, password, and phone number
	   
 Then we'll have a post where we send in the 2FA code
    
 Error: Requesting main frame too early!
	   
 Seems to happen arbitrarily, just rereun
