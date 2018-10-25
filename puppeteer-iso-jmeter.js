// Import
const puppeteer = require("puppeteer");
const fs = require('fs');
const { promisify } = require('util');
const { harFromMessages } = require('chrome-har');

// list of events for converting to HAR
const events = [];

// event types to observe
const observe = [
  'Page.loadEventFired',
  'Page.domContentEventFired',
  'Page.frameStartedLoading',
  'Page.frameAttached',
  'Network.requestWillBeSent',
  'Network.requestServedFromCache',
  'Network.dataReceived',
  'Network.responseReceived',
  'Network.resourceChangedPriority',
  'Network.loadingFinished',
  'Network.loadingFailed',
];



(async () => {

	//****************************************************************************************
		nbRun=40
		run=0

		//eadUrl="https://ecorealad-sqe.schneider-electric.com/#/projects"
		//eadUrl="https://ecorealad-int.schneider-electric.com/#/projects"
		eadUrl="https://ecorealad-ppr-emea.schneider-electric.com/#/projects"
	
		//var env = process.argv[2]; //value will be "node"
		//defineTestingParams(env)
	
		usrLogin="perfuser01@yopmail.com"
		usrPassword="perfuser01"
		previousTimestamp = 0
		duplicatedProject=""
		targetProject="refPrj_PUPPETEER" 	// "L REF" "PUPPETEER_EMPTY"
		logFile="puppeteer.log"
		resultFile="results.log"
		harFile="puppeteer.har"
		screenshotPath="./screenshots/"
		stepCounter=1;
		globalTimeout=60000

		resultsTab = [];
	
	//****************************************************************************************

	//output file creation
	createlogFile(logFile)
	createlogFile(resultFile)


for (run = 0; run < nbRun; run++) {
	stepCounter=1

  	console.log("======  RUN: " +run +"   ======================================================")


	// browser instance creation
	const browser = await puppeteer.launch(
		{ 
			headless: true, 
			//slowMo: 500,
			//devtools: true,
		}
	);
	const page = await browser.newPage();
	await page.setDefaultNavigationTimeout(globalTimeout)
	await page.setViewport({width: 1024, height: 768 });

	// register events listeners
	const client = await page.target().createCDPSession();
	await client.send('Page.enable');
	await client.send('Network.enable');
	observe.forEach(method => {
		client.on(method, params => {
			events.push({ method, params });
		});
	});


try{

	//===============================================================
	// eAD landing page + user login
	await logon(page, eadUrl, usrLogin, usrPassword)
	await page.waitFor(2000)

	//  search for targetProject
	await proj_searchForProject(page, targetProject)
	await page.waitFor(1000)

	//  duplicate  targetProject
	await proj_duplicateProject(page, targetProject)
	await page.waitFor(1000)

	//	search for duplicated project
	await proj_searchForProject(page, duplicatedProject)
	await page.waitFor(1000)

	// open 1st project from list (searched project)
	await proj_openProject(page)
	await page.waitFor(2000)


	//===============================================================
	// open PRODUCT SELECTION
	await nav_gotoTabProductSelection(page)
	await page.waitFor(2000)

		// configure IC60N + Add x10
		await psui_configureProductIC60N(page)
		await psui_addToBom(page, 10)
		await page.waitFor(2000)

		await psui_backToHierarchyTopLevel(page)
		await page.waitFor(2500)

		// configure MTZ + Add x1
		await psui_configureProductMTZ1(page)
		await psui_addToBom(page, 1)
		await page.waitFor(2000)


	//===============================================================
	// open SWITCHBOARD EDITOR
	await nav_gotoTabSwitchboardEditor(page)
	await page.waitFor(5000)

		// create an emtpy enclosure
		await swbEditor_createEnclosure(page)
		await page.waitFor(3000)

		// mount all (1 MTZ1 + 10 iC60N)
		await swbEditor_mountAll(page)
		await page.waitFor(3000)
	

	//===============================================================	
	// open SWITCHBOARD BOM
	await nav_gotoTabSwitchboardBom(page)
	await page.waitFor(2000)
/*
		// duplicate product
		await bom_duplicateProduct(page)
		await page.waitFor(2000)

		// delete product
		await bom_deleteProduct(page)
		await page.waitFor(2000)

		// reconfigure product
		await bom_reconfigureProduct(page)
		await page.waitFor(2000)

*/
	//===============================================================		
	// open PROJECT QUOTE
	await nav_gotoTabProjectQuote(page) 
	await page.waitFor(2000)


	//===============================================================
	// open SWITCHBOARD EDITOR
	await nav_gotoTabSwitchboardEditor(page)
	await page.waitFor(3000)

		// umount all !
		//await swbEditor_unmountAll(page)
		// await page.waitFor(3000)

		// automatic solution
		// await swbEditor_automaticSolution(page)
		// await page.waitFor(3000)
/*
	//===============================================================
	// open SWITCHBOARDS
	await nav_gotoTabSwitchboards(page) 
	await page.waitFor(2000)

		// duplicate swb
		await swbs_duplicateSwb(page)
		await page.waitFor(3000)

		// delete swb
		await swbs_deleteSwb(page)
		await page.waitFor(3000)

		// create new swb
		await swbs_addSwb(page)
		await page.waitFor(2000)

*/
	//===============================================================
	// save project
	await proj_saveProject(page)
	await page.waitFor(2000)


	//===============================================================
	// back to PROJECTS page
	await nav_gotoTabProjects(page)
	await page.waitFor(2000)


	//===============================================================
	// END OF SCENARIO
	await browser.close()

}
catch(error)
{
	console.log(" > ERROR during script execution -> skip to next run !")
	console.error(error);

}
	

	// convert events to HAR file
  	console.log(" > Flushing navigation data into run_"+run +".har")
  	const har = harFromMessages(events);
  	await promisify(fs.writeFile)("run_"+run +".har", JSON.stringify(har));

}


var resultString = printResultsTab(resultsTab)	
logMsg(resultFile, resultString)





})();


//#################### END OF FUNCTIONAL SCENARIO ####################




//=====================================================================================
async function getElapsedTime(page, doScreenShot, msg) {
	var millis = Date.now() - previousTimestamp;

	console.log(" > TIME: " + msg + " => " + millis/1000);
	logMsg(logFile, " > " +msg + " : " + millis/1000)

	// take a screenshot if required
	if (doScreenShot) {
		await page.screenshot({type: "jpeg", path: screenshotPath +"run"+run +'_' +stepCounter +'_' +msg +' ('+millis +'ms)'   +'.jpeg', quality: 90})
	}	

	// save step time into the resultsTab
	await addStepResult(resultsTab, stepCounter, msg, millis/1000)
		
	stepCounter++ // just to facilitate sceenshot naming and browsing
}

//=====================================================================================
async function getTimestamp(start) {
	previousTimestamp = Date.now()
}

//================================================================================================
// Search for a given project
async function	proj_searchForProject(page, searchedProject) {

	await page.waitFor(2500)
	await page.waitForSelector('#searchtext');
	//await page.waitForSelector('#TOTO', {timeout: 500});
	await page.focus('#searchtext')
	await page.keyboard.type(searchedProject)
	
	await page.waitFor(1500)
	await page.click('.fa-search')
	await console.log(" > search for project <" +searchedProject +">")

	await page.waitFor(2500)	
}	

//================================================================================================
async function nav_gotoTabProjects(page) {
	await getTimestamp()
	await page.click("#se-header-top-menu > se-application-logo > div")
	await console.log(" > Click on [ECOREAL AD] tab")
	await page.waitForSelector(".fieldSetProjDetails", {visible: true})
	await console.log(getElapsedTime(page, true, "Time to display PROJECTS (once authenticated)"))
}

//================================================================================================
async function nav_gotoTabSwitchboards(page) {
	await getTimestamp()
	await page.click("#se-header-bottom-menu > div > div > ead-menu > div:nth-child(1) > a")
	await console.log(" > Click on [SWITCHBOARDS] tab")
	await page.waitForSelector("#swbTitleInput")
	await console.log(getElapsedTime(page, true, "Time to display SWITCHBOARDS"))
}

//================================================================================================
async function nav_gotoTabProjectQuote(page) {
	await getTimestamp()
	await page.click("#se-header-bottom-menu > div > div > ead-menu > div:nth-child(5) > a")
	await console.log(" > Click on [PROJECT QUOTE] tab")
	await page.waitForSelector(".manage-discounts-alignment .ng-scope")
	await console.log(getElapsedTime(page, true, "Time to display PROJECT QUOTE"))
}

//================================================================================================
async function nav_gotoTabSwitchboardBom(page) {
	await getTimestamp()
	await page.click("#se-header-bottom-menu > div > div > ead-menu > div:nth-child(4) > a")
	await console.log(" > Click on [SWITCHBOARD BOM] tab")
	await page.waitForSelector("#se-bom-informations > div > div.se-bom-ui-totalprice-area > div > h4 > span.valueClass.ng-binding.ng-scope")
	await console.log(getElapsedTime(page, true, "Time to display SWITCHBOARD BOM"))
}

//================================================================================================
async function nav_gotoTabSwitchboardEditor(page) {
	await getTimestamp()
	await page.click("#se-header-bottom-menu > div > div > ead-menu > div:nth-child(3) > a")
	await console.log(" > Click on [SWITCHBOARD EDITOR] tab")
	await page.waitForSelector(".se-viewer3d-layer-palette-checkbox-text")
	await page.waitFor(300) // extra time required to display 3d scene
	await console.log(getElapsedTime(page, true, "Time to display SWITCHBOARD EDITOR"))
}

//================================================================================================
async function nav_gotoTabProductSelection(page) {
	await getTimestamp()
	await page.click("#se-header-bottom-menu > div > div > ead-menu > div:nth-child(2) > a")
	await console.log(" > Click on [PRODUCT CATALOG] tab")
	await page.waitForSelector(".psui-final-product") //more relevant than .hierarchy__header__level5
	await console.log(getElapsedTime(page, true, "Time to display PRODUCT SELECTION"))
}

//================================================================================================
async function nav_logout(page){
	await console.log(" > Click on [user login] icon")
	await page.click("#se-header-top-menu > se-login-localization > div > ul > li > a")
	await page.waitFor(500)
	await console.log(" > Click on [Logout] ")
	await page.click("#se-header-top-menu > se-login-localization > div > ul > li > ul > li.logout > a")
	await page.waitFor(500)
	await page.click("#se-dialog-btn2")
	await page.waitFor(".landing-page-container")
	await console.log(" > Back on eAD landing page")
}



//================================================================================================
async function psui_configureProductMTZ1(page) {
	await page.waitFor(2000)

	await getTimestamp()
	await page.click(".hierarchy__menu__level2 .mCSB_container ul > li:nth-child(1) > a") 
	await page.click(".hierarchy__body__level5 .ng-isolate-scope:nth-child(3) .psui-btn-normal")
	await page.waitFor(".psui-characteristics__information__label", {visible: true})
	await console.log(getElapsedTime(page, true, "Time to open MTZ1 KB"))

	await page.waitFor(2000)

	await page.click(".psui-configure-product__characs__content psui-configure-characteristics:nth-child(1) > main > span.psui-characteristics__information__value.psui-characteristics__information__value--one-row > span:nth-child(1)")
	await page.waitFor(2500)
	
	await page.click(".psui-configure-product__characs__content psui-configure-characteristics:nth-child(2) > main > span.psui-characteristics__information__value.psui-characteristics__information__value--one-row > span:nth-child(1)")
	await page.waitFor(2500)

	await page.click(".psui-configure-product__characs__content psui-configure-characteristics:nth-child(3) > main > span.psui-characteristics__information__value.psui-characteristics__information__value--one-row > span:nth-child(1)")
	await page.waitFor(2500)
	
	await page.click(".psui-configure-product__characs__content psui-configure-characteristics:nth-child(4) > main > span.psui-characteristics__information__value.psui-characteristics__information__value--one-row > span:nth-child(1)")
	await page.waitFor(2500)

	await page.click(".psui-configure-product__characs__content psui-configure-characteristics:nth-child(5) > main > span.psui-characteristics__information__value.psui-characteristics__information__value--one-row > span:nth-child(1)")
	await page.waitFor(2500)

	await page.click(".psui-configure-product__characs__content psui-configure-characteristics:nth-child(6) > main > span.psui-characteristics__information__value.psui-characteristics__information__value--one-row > span:nth-child(1)")
	await page.waitFor(2500)
}

//================================================================================================
async function psui_configureProductIC60N(page) {
	await page.waitFor(2000)

	await getTimestamp()
	await page.click(".hierarchy__menu__level2 .mCSB_container ul > li:nth-child(3) > a") 
	await page.click(".hierarchy__body__level5 .ng-isolate-scope:nth-child(1) .psui-btn-normal")
	await page.waitFor(".psui-characteristics__information__label", {visible: true})
	await console.log(getElapsedTime(page, true, "Time to open Acti 9 iC60 KB"))

	await page.waitFor(2000)

	await page.click(".psui-configure-product__characs__content psui-configure-characteristics:nth-child(1) > main > span.psui-characteristics__information__value.psui-characteristics__information__value--one-row > span:nth-child(1)")
	await page.waitFor(2500)
	
	await page.click(".psui-configure-product__characs__content psui-configure-characteristics:nth-child(2) > main > span.psui-characteristics__information__value.psui-characteristics__information__value--one-row > span:nth-child(1)")
	await page.waitFor(2500)

	await page.click(".psui-configure-product__characs__content psui-configure-characteristics:nth-child(3) > main > span.psui-characteristics__information__value.psui-characteristics__information__value--one-row > span:nth-child(1)")
	await page.waitFor(2500)
	
	await page.click(".psui-configure-product__characs__content psui-configure-characteristics:nth-child(4) > main > span.psui-characteristics__information__value.psui-characteristics__information__value--one-row > span:nth-child(1)")
	await page.waitFor(2500)

	await page.click(".psui-configure-product__characs__content psui-configure-characteristics:nth-child(5) > main > span.psui-characteristics__information__value.psui-characteristics__information__value--one-row > span:nth-child(1)")
	await page.waitFor(2500)
}


//================================================================================================
async function psui_addToBom(page, qty) {
	
	//set qty 
	await console.log(" > set QTY for Add To BOM")
	await page.waitFor(".psui-solution__field")
	await page.evaluate(function() {
		document.querySelector('.psui-solution__field').value = ''
	})
	
	await page.waitFor(2000)

	await page.focus(".psui-solution__field")
	console.log(" > type qty value")
	await page.keyboard.type(qty.toString())

	await console.log(" > Click on [Add To BOM]")
	await getTimestamp()
	//await page.click("#wrap > div > product-selection > div > psui > psui-configure-product > psui-layout-columns > psui-layout-column.ng-isolate-scope.psui-layout-column--right > main > psui-layout-column-body > psui-solution > div.psui-solution__add-to-cart.ng-scope > button")
	//await page.waitForSelector("#wrap > div > product-selection > div > psui > psui-configure-product > psui-layout-columns > psui-layout-column.ng-isolate-scope.psui-layout-column--right > main > psui-layout-column-body > psui-solution > div.psui-solution__add-to-cart.ng-scope > button")
	await page.click(".psui-solution__add-to-cart__button")
	await page.waitForSelector(".psui-solution__add-to-cart__button", {timeout: 60000})


	await console.log(getElapsedTime(page, true, "Time to Add to BOM - qty=" +qty))

}

//================================================================================================
async function psui_modifyBom(page) {
	await console.log(" > Click on [Modify BOM]")
	await getTimestamp()
	await page.click("#wrap > div > product-selection-reconfigure > div > span.reconfigure.ng-scope > psui-configure-product > psui-layout-columns > psui-layout-column.ng-isolate-scope.psui-layout-column--right > main > psui-layout-column-body > psui-solution > div.psui-solution__add-to-cart.ng-scope > button")
	
	// wait for retreiving swb BOM
	await page.waitForSelector("#se-bom-informations > div > div.se-bom-ui-totalprice-area > div > h4 > span.valueClass.ng-binding.ng-scope")
	await console.log(getElapsedTime(page, true, "Time to reconfigure product (iso)"))

}

//================================================================================================
async function logon(page, url, username, password) {

	// 1 - go to landing page + click on "Login/Join Partner" button
	await page.goto(url);

	await console.log(" > Click on Login button")
	await getTimestamp()
	await page.click('#se-header-top-menu > se-login-localization > div > div > div > div');


	// 2 : filling login form with credentials + click on "Connection" button
	await page.waitForSelector('#username');
	await console.log(getElapsedTime(page, true, "Time to get login form"))

	await page.focus('#username');
	await page.keyboard.type(username);
	await page.waitFor(500)
	await page.focus("#password")
	await page.keyboard.type(password);
	
	await page.waitFor(1500)
	await console.log(" > Click on Connection button")

	await getTimestamp()
	await page.click('#loginbutton');
	await page.waitForSelector(".fieldSetProjDetails", {visible: true})
	await console.log(getElapsedTime(page, true, "Time to display PROJECTS (including authentication)"))


	// 3 : manage "unsaved change popup"
	try {
		// new version
		/*
		await page.waitForSelector('#se-dialog', {timeout: 5000})
   		await console.log(" > Unsaved change popup window detected => click on [DONT SAVE]")
		await page.waitFor(500)
  		await page.click('#se-dialog-btn2')
  		*/

  		// PPR
  		await page.waitForSelector('.modal-unsaved > .se-modal-content > .ng-scope > p > .se-btn-white', {timeout: 5000})
  		await console.log(" > Unsaved change popup window detected => click on [DONT SAVE]")
		await page.waitFor(500)
  		await page.click('.modal-unsaved > .se-modal-content > .ng-scope > p > .se-btn-white')

  	} 
	catch (error) {
  		await console.log(" > Unsaved change popup window detected didn't appear.")
	}
}

//================================================================================================
async function proj_openProject(page) {
	// ASSUMPTION : project to be opened has been searched before /!\ 
	
	// open 1st project card 
	await page.waitForSelector("#moreBtn")
	await page.click("#mCSB_2_container .ng-scope")
	await getTimestamp()
	await console.log(" > click on 1st project card")
	//await page.waitForSelector("#add-new-swb-icon")
	await page.waitForSelector("#swbTitleInput") // more relevant than #add-new-swb-icon

	await console.log(getElapsedTime(page, true, "Time to open selected project"))		
}


//================================================================================================
async function proj_duplicateProject(page, projectName) {
	// ASSUMPTION : project to be duplicated has been searched before /!\ 
	
	// duplicating 1st project card 
	await console.log(" > click on [...] button")
	await page.click('#moreBtn')
	await page.waitFor(1000)

	await console.log(" > click on [Duplicate] menu item")
	await page.click('#duplicateProject')
	await page.waitFor(1000)

	await console.log(" > set project name")
	await page.click('#projName')	
	await page.evaluate(function() {
		document.querySelector('#projName').value = ''
	})
	
	duplicatedProject = "pup" +"_" + Date.now()
	await page.type("#projName", duplicatedProject)

	await console.log(" > click on [Duplicate] button")
	await getTimestamp()
	await page.click('#createOrSaveBtn')
	await page.waitForSelector("#blmCreateProjectModal", {hidden: true});
	await console.log(getElapsedTime(page, true, "Time to duplicate selected project"))
}

//================================================================================================
async function psui_backToHierarchyTopLevel(page) {
	await getTimestamp()
	await console.log(" > click on [<] PSUI button")
	await page.click("#wrap > div > product-selection > div > psui > psui-configure-product > div > a")
	await page.waitForSelector(".hierarchy__body__level5")
	await console.log(getElapsedTime(page, true, "Time to display PSUI root hierarchy"))
}

//================================================================================================
async function swbEditor_mountAll(page) {
	await getTimestamp()
	await console.log(" > click on [Mount All] button")
	await page.click("#wrap > div > switchboard-editor > div > div > div > se-switchboard-editor > div > div > div.swb-sideBarWorkbench > div.swb-sideBarWorkbench__workbenchTo3D > input:nth-child(2)")
	await page.waitFor(100)
	await page.waitForSelector(".swb-editor__overlay", {hidden: true, timeout: 60000})
	await console.log(getElapsedTime(page, true, "Time to mount all products on workbench"))
}

//================================================================================================
async function swbEditor_unmountAll(page) {
	await getTimestamp()
	await console.log(" > click on [Unmount All] button")
	await page.click("#wrap > div > switchboard-editor > div > div > div > se-switchboard-editor > div > div > div.swb-sideBarWorkbench > div.swb-sideBarWorkbench__workbenchTo3D > input:nth-child(1)")
	
	await page.waitForSelector("swb-automaticSolution", {timeout: 60000})
	await console.log(getElapsedTime(page, true, "Time to unmount all products from switchboard"))
}

//================================================================================================
async function swbEditor_automaticSolution(page) {
	await getTimestamp()
	await console.log(" > click on [Automatic solution] button")
	await page.click("#wrap > div > switchboard-editor > div > div > div > se-switchboard-editor > div > div > div.swb-3DViewer.swb3DViewer__width_withWorkbench > se-swb-automatic-solution > div > div > input:nth-child(1)")
	
	await page.waitForSelector(".se-viewer3d-layer-palette-checkbox-text")
	await console.log(getElapsedTime(page, true, "Time to mount all products using Automatic solution"))
}


//================================================================================================
async function swbEditor_createEnclosure(page) {

	await console.log(" > get enclosure enclosure properties (+)")
	await page.evaluate(() => {
        const nodes = angular.element($(".viewer3d-host"))
            .scope().modelManager
            .getNodesWithCommercialReferences(['08606']);
        const enclosureNode = nodes[0].userData.SE;

        const enclosureBlock = angular.element($(".viewer3d-demo"))
            .injector().get('swbMechanicalAssemblyService')
            .getBlockFromMechanicalPartId(enclosureNode.mechanicalPartId);

        angular.element($(".viewer3d-demo"))
            .injector().get('swbNotifyService')
            .swbOptionsToDisplay({
                type: "INSTALLATION_ZONE",
                id: enclosureBlock.id
            });
    });

  	await page.waitFor(2000)

	await console.log(" > click on [Add new empty enclosure zone]")
	await page.waitForSelector('.modal-dialog > .modal-content > .modal-body > .swb-options__firstDescriptors > .se-btn:nth-child(1)')
  	await page.click('.modal-dialog > .modal-content > .modal-body > .swb-options__firstDescriptors > .se-btn:nth-child(1)')

  	await page.waitFor(2000)

	await console.log(" > click on [Apply]")

	await page.waitForSelector('.swb-options > .modal-dialog > .modal-content > .modal-footer > .swb-button-green')
	await page.click('.swb-options > .modal-dialog > .modal-content > .modal-footer > .swb-button-green')
  	
  	await getTimestamp()
	await page.waitFor(100)
	await page.waitForSelector(".swb-editor__overlay", {hidden: true, timeout: 60000})
	await console.log(getElapsedTime(page, true, "Time to create an empty enclosure"))
}

//================================================================================================
async function proj_saveProject(page) {
	await console.log(" > click on [Save] button")
	await getTimestamp()
	await page.click(".saveProj")
	//await page.waitForSelector(".se-snackbar-wrapper", {visible: true});	// SQE selector
	await page.waitForSelector("#loading-bar", {hidden: true});

	await console.log(getElapsedTime(page, true, "Time to save project"))
}



//================================================================================================
async function bom_deleteProduct(page) {
	await console.log(" > click on [Delete] button (BOM)")
	await page.click("#delete_product")
	
	await page.waitForSelector("#se-dialog-title");		// SQE selector

	// confirm deletion
	await page.waitFor(2000)
	await console.log(" > click on [YES] button to confirm deletion")
	await getTimestamp()
	await page.click("#se-dialog-btn2")					// SQE selector
	await page.waitForSelector("#bom-spinner", {visible: true});
	await console.log(getElapsedTime(page, true, "Time to delete product from BOM"))
}

//================================================================================================
async function bom_reconfigureProduct(page) {
	await console.log(" > click on [Reconfigure] button (BOM)")
	await getTimestamp()
	await page.click("#reconfigure_product")
	await page.waitFor(".psui-characteristics__information__label")
	await console.log(getElapsedTime(page, true, "Time to open product configuration from BOM"))

	await page.waitFor(2000)

	// modify BOM without any change (product deleted/recreated)
	await psui_modifyBom(page)
}


//================================================================================================
async function bom_duplicateProduct(page) {
	await console.log(" > click on [Duplicate] button (BOM)")
	await getTimestamp()
	await page.click("#duplicate_product")
	await page.waitForSelector("#bom-spinner", {visible: true});

	await console.log(getElapsedTime(page, true, "Time to duplicate product from BOM"))
}



//================================================================================================
async function swbs_addSwb(page){
	await console.log(" > click on [Add new switchboard] button")
	await getTimestamp()
	await page.click("#add-new-swb-icon")
	
	//await page.waitFor('.noright > .md-button > .md-secondary-container > .md-secondary:nth-child(1) > .md-secondary')	// SQE  selector
	await page.waitForSelector("#loading-bar", {hidden: true});	// INT selector

	await console.log(getElapsedTime(page, true, "Time to create a new swb"))
}


//================================================================================================
async function swbs_duplicateSwb(page){
	await console.log(" > click on [duplicate swb] button (1st)")
	
	await getTimestamp()
	await page.click('.noright > .md-button > .md-secondary-container > .md-secondary:nth-child(1) > .md-secondary')
	
	await page.waitForSelector(".se-snackbar-wrapper", {visible: true});	// SQE selector
	await console.log(getElapsedTime(page, true, "Time to duplicate an existing swb"))

}

//================================================================================================
async function swbs_deleteSwb(page){
	await console.log(" > click on [delete swb] button (1st)")
	
	await page.waitForSelector('.noright > .md-button > .md-secondary-container > .md-secondary:nth-child(2) > .md-secondary')
	await page.click('.noright > .md-button > .md-secondary-container > .md-secondary:nth-child(2) > .md-secondary')
	
	await page.waitFor("#se-dialog-title")				// SQE selector
	await page.waitFor(2000)

	// confirm deletion
	await console.log(" > click on [YES] button to confirm deletion")
	await getTimestamp()
	await page.click("#se-dialog-btn2")							// SQE selector
	await page.waitForSelector(".se-snackbar-wrapper", {visible: true});	// SQE selector

	await console.log(getElapsedTime(page, true, "Time to delete an existing swb"))
}




//================================================================================================
async function createlogFile(file){

	//create a file named file:
	fs.appendFile(file, "\n\n## PUPPETEER run log ## " + new Date(Date.now()), function (err) {
	  if (err) throw err;

	  // log configuration used for the run
	  var tmp=''
	  tmp= "- url: "+ eadUrl + "\n- " +"user: " +usrLogin + "\n- " +"project: " +targetProject +"\n"
	  logMsg(file, tmp)
	});

}

//================================================================================================
async function logMsg(file, msg){

	fs.appendFile(file, "\n" + msg, (err) => {
  	if (err) throw err;
	});

}




//================================================================================================
function addStepResult(tab, step, msg, result) {
	if (step>tab.length) {
		tab.push([msg,result])
	}
	else {
		tab[step-1].push(result)
	}
}


//================================================================================================
function printResultsTab(tab) {

	var resultLine =""

	for (var i in tab) 
	{
		for (var j in tab[i])
		{
				resultLine = resultLine + ";" + tab[i][j]
		}
		resultLine += "\n"
	}

	console.log(resultLine)

	return resultLine
}





async function testHierarchy(page) {
	
	console.log("test hierarchy menu niv 1")


	console.log("> Residual current device")
	await page.click(".hierarchy__menu__level2 .mCSB_container ul > li:nth-child(4) > a") 
	await page.waitFor(3000)
	
	console.log("> Molded case circuit Beaker")	
	await page.click(".hierarchy__menu__level2 .mCSB_container ul > li:nth-child(2) > a") 
	await page.waitFor(3000)


	console.log("> Air Circuit Beaker")	
	await page.click(".hierarchy__menu__level2 .mCSB_container ul > li:nth-child(1) > a") 
	await page.waitFor(3000)
	
	
	console.log("> Modular circuit Beaker")	
	await page.click(".hierarchy__menu__level2 .mCSB_container ul > li:nth-child(3) > a") 
	await page.waitFor(3000)

//#wrap > div > product-selection > div > psui > div > psui-product-hierarchy > div > psui-tabs > span.psui-tabs__item.ng-binding.ng-scope.psui-tabs__item--active
}
















// find the link, by going over all links on the page
async function findByLink(page, linkString) {
  const links = await page.$$('a')
  for (var i=0; i < links.length; i++) {
    let valueHandle = await links[i].getProperty('innerText');
    let linkText = await valueHandle.jsonValue();
    const text = getText(linkText);
    if (linkString == text) {
      console.log(linkString);
      console.log(text);
      console.log("Found");
      return links[i];
    }
  }
  return null;
}

// Normalizing the text
async function getText(linkText) {
  linkText = linkText.replace(/\r\n|\r/g, "\n");
  linkText = linkText.replace(/\ +/g, " ");

  // Replace &nbsp; with a space 
  var nbspPattern = new RegExp(String.fromCharCode(160), "g");
  return linkText.replace(nbspPattern, " ");
}


async function findElemByText({str, selector = '*', leaf = 'outerHTML'}){
  // generate regex from string
  const regex = new RegExp(str, 'gmi');

  // search the element for specific word
  const matchOuterHTML = e => (regex.test(e[leaf]))

  // array of elements
  const elementArray = [...document.querySelectorAll(selector)];

  // return filtered element list
  return elementArray.filter(matchOuterHTML)
}



async function defineTestingParams(lenv){

	switch(lenv) {
		case "PPR":
			eadUrl="https://ecorealad-ppr.schneider-electric.com/#/projects"
			env="PPR"
			break

		case "INT":
			adUrl="https://ecorealad-int.schneider-electric.com/#/projects"
			env="INT"
			break

		case "SQE":
			eadUrl="https://ecorealad-sqe.schneider-electric.com/#/projects"
			env="SQE"
			break

		default:
			console.log("No environment (INT|SQE|PPR) provided => SQE is used by default")
			env="SQE"
			eadUrl="https://ecorealad-sqe.schneider-electric.com/#/projects"
	}
}